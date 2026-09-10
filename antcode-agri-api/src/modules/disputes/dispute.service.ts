import { Prisma } from "../../generated/prisma/client.js";
import {
  DisputeResolution,
  DisputeStatus,
  OrderStatus,
  PaymentHoldStatus,
  ShipmentEventType,
  ShipmentStatus,
  UserStatus,
  VehicleStatus,
  VerificationStatus,
  WalletEntryDirection,
  WalletEntryType,
} from "../../generated/prisma/enums.js";
import { AppError } from "../../common/errors/app-error.js";
import { prisma } from "../../config/prisma.js";
import type { CreateDisputeInput, ResolveDisputeInput } from "./dispute.validation.js";

const TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5_000,
  timeout: 15_000,
} as const;

/**
 * A buyer opens a dispute only after the driver has reported delivery and
 * before the buyer has confirmed it. This is the point where the platform
 * still controls an ACTIVE payment hold and can safely freeze settlement.
 */
async function openDispute(userId: string, orderId: string, input: CreateDisputeInput) {
  return prisma.$transaction(async (tx) => {
    const buyer = await tx.buyerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!buyer) throw new AppError("Buyer profile not found", 404);

    const order = await tx.order.findFirst({
      where: { id: orderId, buyerId: buyer.id },
      include: { paymentHold: true, shipment: true, dispute: true },
    });
    if (!order) throw new AppError("Order not found", 404);

    if (order.dispute) throw new AppError("This order already has a dispute", 409);
    if (order.status !== OrderStatus.DELIVERY_REPORTED) {
      throw new AppError(`Order cannot be disputed while in ${order.status} status`, 409);
    }
    if (!order.shipment || order.shipment.status !== ShipmentStatus.DELIVERY_REPORTED) {
      throw new AppError("The shipment must have a reported delivery before it can be disputed", 409);
    }
    if (!order.paymentHold || order.paymentHold.status !== PaymentHoldStatus.ACTIVE) {
      throw new AppError("This order no longer has an active protected payment hold", 409);
    }

    // Conditional transition prevents a racing delivery-confirmation request
    // from releasing the same hold while this dispute is being opened.
    const frozen = await tx.paymentHold.updateMany({
      where: { id: order.paymentHold.id, status: PaymentHoldStatus.ACTIVE },
      data: { status: PaymentHoldStatus.DISPUTED },
    });
    if (frozen.count !== 1) throw new AppError("Payment hold has already been processed", 409);

    await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.DISPUTED },
    });

    return tx.dispute.create({
      data: { orderId: order.id, openedById: userId, reason: input.reason },
      include: {
        order: {
          include: {
            paymentHold: true,
            shipment: true,
            cooperative: { select: { id: true, name: true, city: true } },
          },
        },
      },
    });
  }, TX_OPTIONS);
}

async function listMyDisputes(userId: string) {
  return prisma.dispute.findMany({
    where: { openedById: userId },
    include: {
      order: { select: { id: true, orderNumber: true, status: true, totalAmount: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function listAllDisputes() {
  return prisma.dispute.findMany({
    include: {
      openedBy: { select: { id: true, fullName: true, phone: true, email: true } },
      resolvedBy: { select: { id: true, fullName: true } },
      order: {
        include: {
          paymentHold: true,
          shipment: true,
          buyer: { select: { id: true, businessName: true, city: true } },
          cooperative: { select: { id: true, name: true, city: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * ADMIN resolution is the only path out of a DISPUTED payment hold.
 * Both possible financial outcomes are handled in this single transaction:
 * REFUND_BUYER or RELEASE_COOPERATIVE.
 */
async function resolveDispute(adminUserId: string, disputeId: string, input: ResolveDisputeInput) {
  return prisma.$transaction(async (tx) => {
    const dispute = await tx.dispute.findUnique({
      where: { id: disputeId },
      include: {
        order: {
          include: {
            paymentHold: true,
            shipment: true,
            cooperative: { select: { userId: true, name: true } },
          },
        },
      },
    });
    if (!dispute) throw new AppError("Dispute not found", 404);
    if (dispute.status !== DisputeStatus.OPEN) throw new AppError("Dispute has already been resolved", 409);

    const { order } = dispute;
    if (order.status !== OrderStatus.DISPUTED) throw new AppError("Order is no longer in disputed status", 409);
    if (!order.paymentHold || order.paymentHold.status !== PaymentHoldStatus.DISPUTED) {
      throw new AppError("Payment hold is no longer disputed", 409);
    }

    const buyerWallet = await tx.wallet.findUnique({ where: { id: order.paymentHold.walletId } });
    if (!buyerWallet) throw new AppError("Buyer payment wallet not found", 409);

    const amount = order.paymentHold.amount;
    const heldDebit = await tx.wallet.updateMany({
      where: { id: buyerWallet.id, heldBalance: { gte: amount } },
      data: { heldBalance: { decrement: amount } },
    });
    if (heldDebit.count !== 1) throw new AppError("Held wallet balance is insufficient for dispute resolution", 409);

    if (input.resolution === DisputeResolution.REFUND_BUYER) {
      const hold = await tx.paymentHold.updateMany({
        where: { id: order.paymentHold.id, status: PaymentHoldStatus.DISPUTED },
        data: { status: PaymentHoldStatus.REFUNDED },
      });
      if (hold.count !== 1) throw new AppError("Payment hold has already been processed", 409);

      await tx.wallet.update({
        where: { id: buyerWallet.id },
        data: { availableBalance: { increment: amount } },
      });
      await tx.walletLedgerEntry.create({
        data: {
          walletId: buyerWallet.id,
          type: WalletEntryType.REFUND,
          direction: WalletEntryDirection.CREDIT,
          amount,
          reference: order.orderNumber,
          description: `Refund after dispute resolution for order ${order.orderNumber}`,
        },
      });

      await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.CANCELLED } });
      if (order.shipment) {
        await tx.shipment.update({
          where: { id: order.shipment.id },
          data: {
            status: ShipmentStatus.FAILED,
            events: {
              create: {
                type: ShipmentEventType.FAILED,
                city: order.shipment.deliveryCity,
                note: "Delivery dispute resolved in buyer's favour; payment refunded.",
              },
            },
          },
        });
      }
    } else {
      const hold = await tx.paymentHold.updateMany({
        where: { id: order.paymentHold.id, status: PaymentHoldStatus.DISPUTED },
        data: { status: PaymentHoldStatus.RELEASED },
      });
      if (hold.count !== 1) throw new AppError("Payment hold has already been processed", 409);

      const cooperativeWallet = await tx.wallet.upsert({
        where: { userId: order.cooperative.userId },
        update: {},
        create: { userId: order.cooperative.userId },
      });
      await tx.wallet.update({
        where: { id: cooperativeWallet.id },
        data: { availableBalance: { increment: amount } },
      });
      await tx.walletLedgerEntry.createMany({
        data: [
          {
            walletId: buyerWallet.id,
            type: WalletEntryType.ORDER_RELEASE,
            direction: WalletEntryDirection.DEBIT,
            amount,
            reference: order.orderNumber,
            description: `Disputed held funds released for order ${order.orderNumber}`,
          },
          {
            walletId: cooperativeWallet.id,
            type: WalletEntryType.ORDER_RELEASE,
            direction: WalletEntryDirection.CREDIT,
            amount,
            reference: order.orderNumber,
            description: `Earnings received after dispute resolution for order ${order.orderNumber}`,
          },
        ],
      });

      await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.COMPLETED } });
      if (order.shipment) {
        await tx.shipment.update({
          where: { id: order.shipment.id },
          data: {
            status: ShipmentStatus.DELIVERED,
            deliveredAt: order.shipment.deliveredAt ?? new Date(),
            events: {
              create: {
                type: ShipmentEventType.DELIVERED,
                city: order.shipment.deliveryCity,
                note: "Delivery dispute resolved in cooperative's favour; payment released.",
              },
            },
          },
        });
      }
    }

    // Shared-load safety: resolving one shipment must not release a truck that
    // is still carrying another active shipment in the same pooled trip.
    if (order.shipment?.vehicleId) {
      let canReleaseTransport = true;
      if (order.shipment.transportLoadId) {
        const remaining = await tx.shipment.count({
          where: {
            transportLoadId: order.shipment.transportLoadId,
            id: { not: order.shipment.id },
            status: { notIn: [ShipmentStatus.DELIVERED, ShipmentStatus.FAILED, ShipmentStatus.CANCELLED] },
          },
        });
        canReleaseTransport = remaining === 0;
        if (canReleaseTransport) {
          await tx.transportLoad.update({
            where: { id: order.shipment.transportLoadId },
            data: { status: "COMPLETED", completedAt: new Date() },
          });
        }
      }

      if (canReleaseTransport) {
        const vehicle = await tx.vehicle.findUnique({
          where: { id: order.shipment.vehicleId },
          include: { driver: { include: { user: true } } },
        });
        if (vehicle) {
          const eligible = vehicle.status === VehicleStatus.ACTIVE && vehicle.driver.verificationStatus === VerificationStatus.VERIFIED && vehicle.driver.user.status === UserStatus.ACTIVE;
          await tx.vehicle.update({ where: { id: vehicle.id }, data: { isAvailable: eligible, currentCity: order.shipment.deliveryCity } });
          await tx.driverProfile.update({ where: { id: vehicle.driverId }, data: { isAvailable: eligible, city: order.shipment.deliveryCity } });
        }
      }
    }

    // Conditional status update makes duplicate admin resolution harmless:
    // a second request cannot resolve an already RESOLVED dispute.
    const resolved = await tx.dispute.updateMany({
      where: { id: dispute.id, status: DisputeStatus.OPEN },
      data: {
        status: DisputeStatus.RESOLVED,
        resolution: input.resolution,
        adminNote: input.adminNote,
        resolvedById: adminUserId,
        resolvedAt: new Date(),
      },
    });
    if (resolved.count !== 1) throw new AppError("Dispute has already been resolved", 409);

    return tx.dispute.findUniqueOrThrow({
      where: { id: dispute.id },
      include: {
        resolvedBy: { select: { id: true, fullName: true } },
        order: { include: { paymentHold: true, shipment: true } },
      },
    });
  }, TX_OPTIONS);
}

export const disputeService = { openDispute, listMyDisputes, listAllDisputes, resolveDispute };
