import crypto from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import {
  ListingStatus,
  OrderStatus,
  ReservationStatus,
} from "../../generated/prisma/enums.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";

import type {
  CreateOrderInput,
  OrderQueryInput,
} from "./order.validation.js";

/**
 * Resolve the buyer profile from the authenticated user.
 *
 * The API never accepts buyerId from the client. Ownership comes from the
 * verified JWT identity, preventing one user from placing an order as another.
 */
async function getBuyerForUser(userId: string) {
  const buyer = await prisma.buyerProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      city: true,
    },
  });

  if (!buyer) {
    throw new AppError("Buyer profile not found", 404);
  }

  return buyer;
}

/**
 * Human-readable order number for demos/operations.
 * The database UUID remains the canonical primary key.
 */
function generateOrderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `AGR-${stamp}-${random}`;
}

/**
 * Create an order and reserve inventory atomically.
 *
 * SECURITY / INTEGRITY RULES:
 * - Client sends listing + quantity only; price is read from PostgreSQL.
 * - Only ACTIVE inventory can be ordered.
 * - Inventory is decremented with a conditional update:
 *       availableQuantityKg >= requested quantity
 *   This is the critical concurrency guard. Two simultaneous buyers cannot
 *   both successfully reserve the same final stock.
 * - Order, item, reservation and inventory mutation all run in ONE transaction.
 *   If any step fails, PostgreSQL rolls the entire operation back.
 *
 * For the sprint MVP, one order contains produce from one cooperative. This
 * keeps settlement and shipment ownership unambiguous. Multi-listing carts can
 * later group items by cooperative into separate orders.
 */
async function createOrder(userId: string, input: CreateOrderInput) {
  const buyer = await getBuyerForUser(userId);
  const requestedQuantity = new Prisma.Decimal(input.quantityKg);

  return prisma.$transaction(
    async (tx) => {
      const listing = await tx.produceListing.findUnique({
        where: { id: input.listingId },
        select: {
          id: true,
          cooperativeId: true,
          name: true,
          pricePerKg: true,
          availableQuantityKg: true,
          status: true,
        },
      });

      if (!listing || listing.status !== ListingStatus.ACTIVE) {
        throw new AppError(
          "This produce listing is not available for ordering",
          404,
        );
      }

      if (listing.availableQuantityKg.lessThan(requestedQuantity)) {
        throw new AppError(
          `Only ${listing.availableQuantityKg.toString()} kg is currently available`,
          409,
        );
      }

      /**
       * Atomic stock claim.
       *
       * updateMany becomes a compare-and-update operation because the WHERE
       * clause checks available stock at the exact moment PostgreSQL updates
       * the row. If another request consumed the stock after our earlier read,
       * count becomes 0 and this transaction aborts instead of overselling.
       */
      const stockClaim = await tx.produceListing.updateMany({
        where: {
          id: listing.id,
          status: ListingStatus.ACTIVE,
          availableQuantityKg: {
            gte: requestedQuantity,
          },
        },
        data: {
          availableQuantityKg: {
            decrement: requestedQuantity,
          },
          reservedQuantityKg: {
            increment: requestedQuantity,
          },
        },
      });

      if (stockClaim.count !== 1) {
        throw new AppError(
          "The requested stock was just reserved by another buyer. Please refresh and try again.",
          409,
        );
      }

      // Monetary values are always derived server-side from the listing.
      const subtotal = listing.pricePerKg.mul(requestedQuantity);

      // Delivery pricing belongs to the logistics milestone. Until then we
      // explicitly store zero rather than accepting a client-controlled fee.
      const deliveryFee = new Prisma.Decimal(0);
      const totalAmount = subtotal.plus(deliveryFee);

      // Reservation expiry gives us a future cleanup point for unpaid orders.
      // The payment milestone will either convert or release this reservation.
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      const order = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          buyerId: buyer.id,
          cooperativeId: listing.cooperativeId,
          status: OrderStatus.PENDING_PAYMENT,
          subtotal,
          deliveryFee,
          totalAmount,
          deliveryCity: input.deliveryCity,
          deliveryAddress: input.deliveryAddress,
          items: {
            create: {
              listingId: listing.id,
              produceName: listing.name,
              quantityKg: requestedQuantity,
              unitPrice: listing.pricePerKg,
              subtotal,
            },
          },
          reservations: {
            create: {
              listingId: listing.id,
              quantityKg: requestedQuantity,
              status: ReservationStatus.ACTIVE,
              expiresAt,
            },
          },
        },
        include: {
          items: true,
          reservations: true,
          cooperative: {
            select: {
              id: true,
              name: true,
              city: true,
            },
          },
        },
      });

      /**
       * If the reservation consumed the final available stock, make the listing
       * disappear from the public marketplace immediately.
       */
      const remainingListing = await tx.produceListing.findUniqueOrThrow({
        where: { id: listing.id },
        select: { availableQuantityKg: true },
      });

      if (remainingListing.availableQuantityKg.lessThanOrEqualTo(0)) {
        await tx.produceListing.update({
          where: { id: listing.id },
          data: { status: ListingStatus.SOLD_OUT },
        });
      }

      return order;
    },
    {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5_000,
  timeout: 15_000,
},
  );
}

/** Buyer sees only orders belonging to their own profile. */
async function listMyOrders(userId: string, query: OrderQueryInput) {
  const buyer = await getBuyerForUser(userId);

  const where: Prisma.OrderWhereInput = {
    buyerId: buyer.id,
  };

  if (query.status !== undefined) {
    where.status = query.status;
  }

  const [items, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: query.limit,
      skip: query.offset,
      include: {
        items: true,
        reservations: true,
        cooperative: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    items,
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

/** Buyer may retrieve one order only if they own it. */
async function getMyOrder(userId: string, orderId: string) {
  const buyer = await getBuyerForUser(userId);

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      buyerId: buyer.id,
    },
    include: {
      items: true,
      reservations: true,
      cooperative: {
        select: {
          id: true,
          name: true,
          city: true,
          region: true,
          locality: true,
        },
      },
    },
  });

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  return order;
}

/**
 * Cancel an unpaid order and return its reserved stock.
 *
 * This operation is deliberately transactional and idempotent from a business
 * perspective: only PENDING_PAYMENT orders with ACTIVE reservations can be
 * cancelled here. Once payment is secured, cancellation/refund belongs to the
 * payment/dispute state machine instead.
 */
async function cancelMyOrder(userId: string, orderId: string) {
  const buyer = await getBuyerForUser(userId);

  return prisma.$transaction(
    async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id: orderId,
          buyerId: buyer.id,
        },
        include: {
          reservations: true,
        },
      });

      if (!order) {
        throw new AppError("Order not found", 404);
      }

      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        throw new AppError(
          "Only orders awaiting payment can be cancelled directly",
          409,
        );
      }

      const activeReservations = order.reservations.filter(
        (reservation) => reservation.status === ReservationStatus.ACTIVE,
      );

      if (activeReservations.length === 0) {
        throw new AppError(
          "This order no longer has an active inventory reservation",
          409,
        );
      }

      for (const reservation of activeReservations) {
        await tx.produceListing.update({
          where: { id: reservation.listingId },
          data: {
            availableQuantityKg: {
              increment: reservation.quantityKg,
            },
            reservedQuantityKg: {
              decrement: reservation.quantityKg,
            },
          },
        });

        await tx.inventoryReservation.update({
          where: { id: reservation.id },
          data: {
            status: ReservationStatus.RELEASED,
          },
        });

        /**
         * A listing that became SOLD_OUT only because of this reservation can
         * return to ACTIVE after stock is released.
         */
        const listing = await tx.produceListing.findUniqueOrThrow({
          where: { id: reservation.listingId },
          select: {
            status: true,
            availableQuantityKg: true,
          },
        });

        if (
          listing.status === ListingStatus.SOLD_OUT &&
          listing.availableQuantityKg.greaterThan(0)
        ) {
          await tx.produceListing.update({
            where: { id: reservation.listingId },
            data: { status: ListingStatus.ACTIVE },
          });
        }
      }

      return tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
        },
        include: {
          items: true,
          reservations: true,
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

export const orderService = {
  createOrder,
  listMyOrders,
  getMyOrder,
  cancelMyOrder,
};
