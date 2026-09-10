import { Prisma } from "../../generated/prisma/client.js";
import {
  OrderStatus,
  PaymentHoldStatus,
  ReservationStatus,
  WalletEntryDirection,
  WalletEntryType,
  ShipmentEventType,
  ShipmentStatus,
} from "../../generated/prisma/enums.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";

async function payOrderFromWallet(userId: string, orderId: string) {
  return prisma.$transaction(
    async (tx) => {
      const buyer = await tx.buyerProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!buyer) throw new AppError("Buyer profile not found", 404);

      const order = await tx.order.findFirst({
        where: { id: orderId, buyerId: buyer.id },
        include: { reservations: true, paymentHold: true },
      });
      if (!order) throw new AppError("Order not found", 404);

      // A unique PaymentHold per order prevents a second successful debit.
      if (order.paymentHold !== null) {
        throw new AppError("This order already has a payment hold", 409);
      }
      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        throw new AppError(`Order cannot be paid while in ${order.status} status`, 409);
      }

      const activeReservations = order.reservations.filter(
        (r) => r.status === ReservationStatus.ACTIVE,
      );
      if (activeReservations.length === 0) {
        throw new AppError("This order no longer has an active inventory reservation", 409);
      }
      if (activeReservations.some((r) => r.expiresAt.getTime() <= Date.now())) {
        throw new AppError(
          "The inventory reservation has expired. Cancel this order and create a new one.",
          409,
        );
      }

      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new AppError("Wallet not found", 404);

      /*
       * Atomic balance guard: the UPDATE succeeds only if enough available
       * balance still exists at the instant PostgreSQL executes it.
       */
      const debit = await tx.wallet.updateMany({
        where: {
          id: wallet.id,
          availableBalance: { gte: order.totalAmount },
        },
        data: {
          availableBalance: { decrement: order.totalAmount },
          heldBalance: { increment: order.totalAmount },
        },
      });

      if (debit.count !== 1) {
  throw new AppError(
    `Insufficient wallet balance. Available: ${wallet.availableBalance.toString()} XAF; required: ${order.totalAmount.toString()} XAF`,
    409,
  );
}

      // This is our application's escrow-style hold, not Fapshi legal escrow.
      await tx.paymentHold.create({
        data: {
          walletId: wallet.id,
          orderId: order.id,
          amount: order.totalAmount,
          status: PaymentHoldStatus.ACTIVE,
        },
      });

      await tx.walletLedgerEntry.create({
        data: {
          walletId: wallet.id,
          type: WalletEntryType.ORDER_HOLD,
          direction: WalletEntryDirection.DEBIT,
          amount: order.totalAmount,
          reference: order.orderNumber,
          description: `Funds held for agricultural order ${order.orderNumber}`,
        },
      });

      // Paid stock is no longer a temporary reservation.
      await tx.inventoryReservation.updateMany({
        where: { orderId: order.id, status: ReservationStatus.ACTIVE },
        data: { status: ReservationStatus.CONVERTED },
      });

      const paidOrder = await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PAYMENT_SECURED },
        include: {
          items: true,
          reservations: true,
          paymentHold: true,
          cooperative: { select: { id: true, name: true, city: true } },
        },
      });

      const updatedWallet = await tx.wallet.findUniqueOrThrow({
        where: { id: wallet.id },
      });

      return { order: paidOrder, wallet: updatedWallet };
    },
    {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5_000,
  timeout: 15_000,
},
  );
}

/**
 * Buyer confirms that a driver-reported delivery was actually received.
 *
 * This closes the protected transaction in one SERIALIZABLE transaction:
 * - shipment DELIVERY_REPORTED -> DELIVERED
 * - order DELIVERY_REPORTED -> COMPLETED
 * - payment hold ACTIVE -> RELEASED
 * - buyer held balance decreases
 * - cooperative wallet available balance increases
 * - both sides receive auditable ledger entries
 * - the driver and vehicle are released for new work
 *
 * Fapshi is intentionally NOT called here. Fapshi already collected the
 * buyer's money into the platform wallet. This operation is an internal
 * ledger settlement; an external payout belongs to the withdrawal flow.
 */
async function confirmDeliveryAndReleaseFunds(userId: string, orderId: string) {
  return prisma.$transaction(
    async (tx) => {
      const buyer = await tx.buyerProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!buyer) throw new AppError("Buyer profile not found", 404);

      const order = await tx.order.findFirst({
        where: { id: orderId, buyerId: buyer.id },
        include: {
          paymentHold: true,
          shipment: true,
          cooperative: { select: { id: true, userId: true, name: true } },
        },
      });

      // Using buyerId in the query avoids leaking whether another buyer's
      // order exists.
      if (!order) throw new AppError("Order not found", 404);

      if (order.status !== OrderStatus.DELIVERY_REPORTED) {
        throw new AppError(
          `Delivery cannot be confirmed while order is in ${order.status} status`,
          409,
        );
      }

      if (!order.shipment) throw new AppError("Shipment not found for this order", 409);
      if (order.shipment.status !== ShipmentStatus.DELIVERY_REPORTED) {
        throw new AppError(
          `Delivery cannot be confirmed while shipment is in ${order.shipment.status} status`,
          409,
        );
      }

      if (!order.paymentHold) throw new AppError("Payment hold not found for this order", 409);
      if (order.paymentHold.status !== PaymentHoldStatus.ACTIVE) {
        throw new AppError(`Payment hold is already ${order.paymentHold.status}`, 409);
      }

      // The hold must represent exactly the amount being settled.
      if (order.paymentHold.amount.comparedTo(order.totalAmount) !== 0) {
        throw new AppError("Payment hold amount does not match order total", 409);
      }

      const buyerWallet = await tx.wallet.findUnique({
        where: { id: order.paymentHold.walletId },
      });
      if (!buyerWallet || buyerWallet.userId !== userId) {
        throw new AppError("Buyer payment wallet mismatch", 409);
      }

      // Conditional update is an additional concurrency/idempotency guard.
      // Only one request can move this hold from ACTIVE to RELEASED.
      const holdRelease = await tx.paymentHold.updateMany({
        where: { id: order.paymentHold.id, status: PaymentHoldStatus.ACTIVE },
        data: { status: PaymentHoldStatus.RELEASED },
      });
      if (holdRelease.count !== 1) {
        throw new AppError("Payment hold has already been processed", 409);
      }

      // Remove only money that is genuinely still held. If the ledger/balance
      // has become inconsistent, fail the entire transaction rather than
      // completing delivery with a partial financial settlement.
      const buyerRelease = await tx.wallet.updateMany({
        where: {
          id: buyerWallet.id,
          heldBalance: { gte: order.paymentHold.amount },
        },
        data: {
          heldBalance: { decrement: order.paymentHold.amount },
        },
      });
      if (buyerRelease.count !== 1) {
        throw new AppError("Held wallet balance is insufficient for settlement", 409);
      }

      // Every cooperative is backed by a User, so the existing generic Wallet
      // model can also represent cooperative earnings without introducing a
      // second balance system.
      const cooperativeWallet = await tx.wallet.upsert({
        where: { userId: order.cooperative.userId },
        update: {},
        create: { userId: order.cooperative.userId },
      });

      await tx.wallet.update({
        where: { id: cooperativeWallet.id },
        data: { availableBalance: { increment: order.paymentHold.amount } },
      });

      // Two ledger entries make the transfer explainable from both wallets.
      await tx.walletLedgerEntry.createMany({
        data: [
          {
            walletId: buyerWallet.id,
            type: WalletEntryType.ORDER_RELEASE,
            direction: WalletEntryDirection.DEBIT,
            amount: order.paymentHold.amount,
            reference: order.orderNumber,
            description: `Held funds released for completed order ${order.orderNumber}`,
          },
          {
            walletId: cooperativeWallet.id,
            type: WalletEntryType.ORDER_RELEASE,
            direction: WalletEntryDirection.CREDIT,
            amount: order.paymentHold.amount,
            reference: order.orderNumber,
            description: `Earnings received for completed order ${order.orderNumber}`,
          },
        ],
      });

      const deliveredAt = new Date();

      await tx.shipment.update({
        where: { id: order.shipment.id },
        data: {
          status: ShipmentStatus.DELIVERED,
          deliveredAt,
          events: {
            create: {
              type: ShipmentEventType.DELIVERED,
              city: order.shipment.deliveryCity,
              note: "Delivery verified by buyer.",
            },
          },
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.COMPLETED },
      });

      // A shared vehicle must stay locked until EVERY sibling shipment on the
      // same transport load has reached a terminal state. For a normal
      // single-shipment assignment there is no transportLoadId, so release is
      // immediate exactly as before.
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
            data: { status: "COMPLETED", completedAt: deliveredAt },
          });
        }
      }

      if (canReleaseTransport && order.shipment.vehicleId) {
        await tx.vehicle.update({
          where: { id: order.shipment.vehicleId },
          data: { isAvailable: true, currentCity: order.shipment.deliveryCity },
        });
      }
      if (canReleaseTransport && order.shipment.driverId) {
        await tx.driverProfile.update({
          where: { id: order.shipment.driverId },
          data: { isAvailable: true, city: order.shipment.deliveryCity },
        });
      }

      // Fetch only after every state change so the response reflects the
      // committed business state rather than stale included relations.
      const completedOrder = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          paymentHold: true,
          shipment: {
            include: {
              vehicle: true,
              driver: true,
              events: { orderBy: { createdAt: "asc" } },
            },
          },
          cooperative: { select: { id: true, name: true, city: true } },
        },
      });

      const updatedBuyerWallet = await tx.wallet.findUniqueOrThrow({
        where: { id: buyerWallet.id },
      });
      const updatedCooperativeWallet = await tx.wallet.findUniqueOrThrow({
        where: { id: cooperativeWallet.id },
      });

      return {
        order: completedOrder,
        buyerWallet: updatedBuyerWallet,
        cooperativeWallet: updatedCooperativeWallet,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 15_000,
    },
  );
}

export const orderPaymentService = {
  payOrderFromWallet,
  confirmDeliveryAndReleaseFunds,
};
