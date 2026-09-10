import { randomBytes } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import { OrderStatus, ShipmentEventType, ShipmentStatus, UserStatus, VehicleStatus, VerificationStatus } from "../../generated/prisma/enums.js";
import { AppError } from "../../common/errors/app-error.js";
import { prisma } from "../../config/prisma.js";
import type { CreateTransportLoadInput } from "./transport-load.validation.js";

const TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5_000,
  timeout: 15_000,
} as const;

function loadNumber(): string {
  return `LOAD-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/**
 * Creates one physical transport load from several independent shipments.
 * Commercial boundaries are deliberately preserved: every shipment keeps its
 * own order, payment hold, tracking events, dispute and delivery confirmation.
 * Only the scarce transport resource (driver + vehicle) is shared.
 */
async function createSharedLoad(input: CreateTransportLoadInput) {
  return prisma.$transaction(async (tx) => {
    const shipments = await tx.shipment.findMany({
      where: { id: { in: input.shipmentIds } },
      include: { order: true },
    });

    if (shipments.length !== input.shipmentIds.length) {
      throw new AppError("One or more shipments were not found", 404);
    }

    // Pool only untouched shipments. This prevents a shipment from belonging
    // to two trips or changing vehicle after physical assignment has begun.
    for (const shipment of shipments) {
      if (shipment.status !== ShipmentStatus.AWAITING_ASSIGNMENT) {
        throw new AppError(`Shipment ${shipment.shipmentNumber} is not awaiting assignment`, 409);
      }
      if (shipment.transportLoadId || shipment.vehicleId || shipment.driverId) {
        throw new AppError(`Shipment ${shipment.shipmentNumber} is already assigned to transport`, 409);
      }
    }

    const first = shipments[0]!;
    const normalize = (value: string) => value.trim().toLowerCase();

    // MVP route pooling is intentionally strict and explainable: same pickup
    // city and same destination city. Corridor/waypoint matching can be added
    // later without weakening today's safety invariants.
    const incompatible = shipments.find(
      (s) => normalize(s.pickupCity) !== normalize(first.pickupCity) || normalize(s.deliveryCity) !== normalize(first.deliveryCity),
    );
    if (incompatible) {
      throw new AppError("Shared-load shipments must currently use the same pickup and delivery cities", 409);
    }

    const totalWeightKg = shipments.reduce(
      (sum, shipment) => sum.plus(shipment.loadWeightKg),
      new Prisma.Decimal(0),
    );

    const vehicle = await tx.vehicle.findUnique({
      where: { id: input.vehicleId },
      include: { driver: { include: { user: { select: { status: true } } } } },
    });
    if (!vehicle) throw new AppError("Vehicle not found", 404);
    if (vehicle.status !== VehicleStatus.ACTIVE || !vehicle.isAvailable) {
      throw new AppError("Vehicle is not available for a shared load", 409);
    }
    if (!vehicle.driver.isAvailable) throw new AppError("Driver is not available for a shared load", 409);
    if (vehicle.driver.user.status !== UserStatus.ACTIVE || vehicle.driver.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new AppError("Driver is not approved for dispatch", 409);
    }
    if (vehicle.capacityKg.lessThan(totalWeightKg)) {
      throw new AppError(`Combined shipment weight ${totalWeightKg.toString()} kg exceeds vehicle capacity ${vehicle.capacityKg.toString()} kg`, 409);
    }

    // Atomic claims preserve the double-booking protection already used by
    // single-shipment assignment. Concurrent load creation cannot claim the
    // same driver/vehicle twice.
    const driverClaim = await tx.driverProfile.updateMany({
      where: { id: vehicle.driverId, isAvailable: true },
      data: { isAvailable: false },
    });
    if (driverClaim.count !== 1) throw new AppError("Driver was assigned by another request", 409);

    const vehicleClaim = await tx.vehicle.updateMany({
      where: { id: vehicle.id, isAvailable: true, status: VehicleStatus.ACTIVE },
      data: { isAvailable: false },
    });
    if (vehicleClaim.count !== 1) throw new AppError("Vehicle was assigned by another request", 409);

    const assignedAt = new Date();
    const load = await tx.transportLoad.create({
      data: {
        loadNumber: loadNumber(),
        vehicleId: vehicle.id,
        driverId: vehicle.driverId,
        pickupCity: first.pickupCity,
        deliveryCity: first.deliveryCity,
        totalWeightKg,
        assignedAt,
      },
    });

    // updateMany is safe here because all shipment IDs were validated above
    // inside this SERIALIZABLE transaction. The status condition is retained
    // as a final guard against stale/concurrent assignment attempts.
    const assigned = await tx.shipment.updateMany({
      where: { id: { in: input.shipmentIds }, status: ShipmentStatus.AWAITING_ASSIGNMENT, transportLoadId: null },
      data: {
        transportLoadId: load.id,
        driverId: vehicle.driverId,
        vehicleId: vehicle.id,
        status: ShipmentStatus.ASSIGNED,
        assignedAt,
      },
    });
    if (assigned.count !== input.shipmentIds.length) {
      throw new AppError("One or more shipments changed while the shared load was being created", 409);
    }

    await tx.shipmentEvent.createMany({
      data: shipments.map((shipment) => ({
        shipmentId: shipment.id,
        type: ShipmentEventType.DRIVER_ASSIGNED,
        city: vehicle.currentCity,
        note: `Assigned to shared load ${load.loadNumber} using vehicle ${vehicle.registrationNo}`,
      })),
    });

    await tx.order.updateMany({
      where: { id: { in: shipments.map((s) => s.orderId) }, status: OrderStatus.CONFIRMED },
      data: { status: OrderStatus.CONFIRMED },
    });

    return tx.transportLoad.findUniqueOrThrow({
      where: { id: load.id },
      include: {
        vehicle: true,
        driver: { include: { user: { select: { fullName: true, phone: true } } } },
        shipments: { include: { order: true, events: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "asc" } },
      },
    });
  }, TX_OPTIONS);
}

async function getById(id: string) {
  const load = await prisma.transportLoad.findUnique({
    where: { id },
    include: {
      vehicle: true,
      driver: { include: { user: { select: { fullName: true, phone: true } } } },
      shipments: { include: { order: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!load) throw new AppError("Transport load not found", 404);
  return load;
}

async function list() {
  return prisma.transportLoad.findMany({
    include: { vehicle: true, driver: { include: { user: { select: { fullName: true } } } }, shipments: true },
    orderBy: { createdAt: "desc" },
  });
}

export const transportLoadService = { createSharedLoad, getById, list };
