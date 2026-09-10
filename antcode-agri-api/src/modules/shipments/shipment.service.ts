import { randomBytes } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import {
  OrderStatus,
  ShipmentEventType,
  ShipmentStatus,
  UserStatus,
  VehicleStatus,
  VerificationStatus,
} from "../../generated/prisma/enums.js";
import { AppError } from "../../common/errors/app-error.js";
import { prisma } from "../../config/prisma.js";
import type { ShipmentEventBodyInput } from "./shipment.validation.js";

const TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5_000,
  timeout: 15_000,
} as const;

function shipmentNumber(): string {
  return `SHP-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/** Buyer creates the logistics record only after funds have been secured. */
async function createForOrder(userId: string, orderId: string) {
  const buyer = await prisma.buyerProfile.findUnique({ where: { userId } });
  if (!buyer) throw new AppError("Buyer profile not found", 404);

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, buyerId: buyer.id },
      include: {
        shipment: true,
        cooperative: true,
        items: { include: { listing: true } },
      },
    });
    if (!order) throw new AppError("Order not found", 404);
    if (order.shipment) throw new AppError("This order already has a shipment", 409);
    if (order.status !== OrderStatus.PAYMENT_SECURED) {
      throw new AppError("A shipment can only be created after payment is secured", 409);
    }
    if (order.items.length === 0) throw new AppError("Order has no transportable items", 409);

    const loadWeightKg = order.items.reduce(
      (sum, item) => sum.plus(item.quantityKg),
      new Prisma.Decimal(0),
    );
    const firstListing = order.items[0]!.listing;

    const shipment = await tx.shipment.create({
      data: {
        shipmentNumber: shipmentNumber(),
        orderId: order.id,
        pickupCity: firstListing.originCity || order.cooperative.city,
        pickupAddress: firstListing.pickupLocation,
        deliveryCity: order.deliveryCity,
        deliveryAddress: order.deliveryAddress,
        loadWeightKg,
        events: { create: { type: ShipmentEventType.CREATED, city: firstListing.originCity } },
      },
      include: { events: true },
    });

    await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.CONFIRMED } });
    return shipment;
  }, TX_OPTIONS);
}

/**
 * Manual assignment for the first logistics milestone.
 * Smart dispatch will call the same invariant-preserving assignment path later.
 *
 * Double booking is blocked in two ways inside one SERIALIZABLE transaction:
 * 1) DriverProfile.isAvailable is atomically claimed true -> false.
 * 2) Vehicle.isAvailable is atomically claimed true -> false.
 * Only one concurrent assignment can successfully claim each resource.
 */
async function assignVehicle(shipmentId: string, vehicleId: string) {
  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) throw new AppError("Shipment not found", 404);
    if (shipment.status !== ShipmentStatus.AWAITING_ASSIGNMENT) {
      throw new AppError("Only a shipment awaiting assignment can be assigned", 409);
    }

    const vehicle = await tx.vehicle.findUnique({
      where: { id: vehicleId },
      include: { driver: { include: { user: { select: { status: true } } } } },
    });
    if (!vehicle) throw new AppError("Vehicle not found", 404);
    if (vehicle.status !== VehicleStatus.ACTIVE || !vehicle.isAvailable) {
      throw new AppError("Vehicle is not available for dispatch", 409);
    }
    if (vehicle.capacityKg.lessThan(shipment.loadWeightKg)) {
      throw new AppError("Vehicle does not have enough capacity for this shipment", 409);
    }
    if (vehicle.driver.user.status !== UserStatus.ACTIVE || vehicle.driver.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new AppError("Driver is not approved for dispatch", 409);
    }

    // Atomic resource claims are the concurrency guard. A normal pre-check alone
    // would be vulnerable if two requests arrived at the same time.
    const driverClaim = await tx.driverProfile.updateMany({
      where: { id: vehicle.driverId, isAvailable: true },
      data: { isAvailable: false },
    });
    if (driverClaim.count !== 1) throw new AppError("Driver is already assigned or unavailable", 409);

    const vehicleClaim = await tx.vehicle.updateMany({
      where: { id: vehicle.id, isAvailable: true, status: VehicleStatus.ACTIVE },
      data: { isAvailable: false },
    });
    if (vehicleClaim.count !== 1) throw new AppError("Vehicle was assigned by another request", 409);

    const assignedAt = new Date();
    return tx.shipment.update({
      where: { id: shipment.id },
      data: {
        driverId: vehicle.driverId,
        vehicleId: vehicle.id,
        status: ShipmentStatus.ASSIGNED,
        assignedAt,
        events: { create: { type: ShipmentEventType.DRIVER_ASSIGNED, city: vehicle.currentCity, note: `Assigned vehicle ${vehicle.registrationNo}` } },
      },
      include: { driver: { include: { user: { select: { fullName: true, phone: true } } } }, vehicle: true, events: { orderBy: { createdAt: "asc" } }, order: true },
    });
  }, TX_OPTIONS);
}

async function listMyShipments(userId: string) {
  const driver = await prisma.driverProfile.findUnique({ where: { userId } });
  if (!driver) throw new AppError("Driver profile not found", 404);
  return prisma.shipment.findMany({
    where: { driverId: driver.id },
    include: { vehicle: true, order: true, events: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}

async function driverTransition(
  userId: string,
  shipmentId: string,
  nextStatus: "PICKED_UP" | "IN_TRANSIT" | "DELIVERY_REPORTED",
  body: ShipmentEventBodyInput,
) {
  const driver = await prisma.driverProfile.findUnique({
    where: { userId },
  });

  if (!driver) {
    throw new AppError("Driver profile not found", 404);
  }

  return prisma.$transaction(async (tx) => {
    /**
     * The shipment must belong to the authenticated driver.
     * This prevents one driver from changing another driver's shipment.
     */
    const shipment = await tx.shipment.findFirst({
      where: {
        id: shipmentId,
        driverId: driver.id,
      },
    });

    if (!shipment) {
      throw new AppError("Shipment not found", 404);
    }

    /**
     * Explicit state-transition rules.
     *
     * ASSIGNED
     *   -> PICKED_UP
     *   -> IN_TRANSIT
     *   -> DELIVERY_REPORTED
     *
     * Drivers cannot skip stages or move a shipment backwards.
     */
    const allowed: Record<string, string[]> = {
      PICKED_UP: [ShipmentStatus.ASSIGNED],
      IN_TRANSIT: [ShipmentStatus.PICKED_UP],
      DELIVERY_REPORTED: [ShipmentStatus.IN_TRANSIT],
    };

    if (!allowed[nextStatus]!.includes(shipment.status)) {
      throw new AppError(
        `Shipment cannot move from ${shipment.status} to ${nextStatus}`,
        409,
      );
    }

    const now = new Date();

    const eventType =
      nextStatus === "PICKED_UP"
        ? ShipmentEventType.PICKED_UP
        : nextStatus === "IN_TRANSIT"
          ? ShipmentEventType.IN_TRANSIT
          : ShipmentEventType.DELIVERY_REPORTED;

    /**
     * Build the shipment update dynamically because some timestamps only
     * apply to particular transitions.
     */
    const data: Record<string, unknown> = {
      status: nextStatus,
      events: {
        create: {
          type: eventType,
          ...(body.city !== undefined ? { city: body.city } : {}),
          ...(body.note !== undefined ? { note: body.note } : {}),
        },
      },
    };

    if (nextStatus === "PICKED_UP") {
      data.pickedUpAt = now;
    }

    if (nextStatus === "DELIVERY_REPORTED") {
      data.deliveryReportedAt = now;
    }

    /**
     * First update the shipment.
     *
     * We intentionally do NOT include the related order here because the
     * order state is updated immediately afterwards. Including it now would
     * return the old order state in the API response.
     */
    await tx.shipment.update({
      where: { id: shipment.id },
      data,
    });

    /**
     * Keep the commercial order lifecycle synchronized with logistics.
     *
     * PICKED_UP and IN_TRANSIT both mean the order is physically moving.
     *
     * DELIVERY_REPORTED means the driver says the goods reached the buyer,
     * but this is NOT final delivery verification and must NOT release funds.
     */
    const nextOrderStatus =
      nextStatus === "DELIVERY_REPORTED"
        ? OrderStatus.DELIVERY_REPORTED
        : OrderStatus.IN_TRANSIT;

    await tx.order.update({
      where: { id: shipment.orderId },
      data: {
        status: nextOrderStatus,
      },
    });

    /**
     * Fetch the final state only after BOTH shipment and order have been
     * updated.
     *
     * This ensures the API response reflects the same state that is actually
     * stored in the database.
     */
    return tx.shipment.findUniqueOrThrow({
      where: { id: shipment.id },
      include: {
        vehicle: true,
        events: {
          orderBy: {
            createdAt: "asc",
          },
        },
        order: true,
      },
    });
  }, TX_OPTIONS);
}

export const shipmentService = { createForOrder, assignVehicle, listMyShipments, driverTransition };
