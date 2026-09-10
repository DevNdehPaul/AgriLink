import { AppError } from "../../common/errors/app-error.js";
import { prisma } from "../../config/prisma.js";
import {
  ShipmentStatus,
  UserStatus,
  VerificationStatus,
} from "../../generated/prisma/enums.js";
import type { UpdateDriverAvailabilityInput } from "./driver.validation.js";

/**
 * Shipment states that mean the driver is already committed to transport work.
 *
 * A driver attached to a shipment in any of these states must not be allowed
 * to manually mark themselves as available for another dispatch.
 */
const ACTIVE_SHIPMENT_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.ASSIGNED,
  ShipmentStatus.PICKED_UP,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.DELIVERY_REPORTED,
];

/**
 * Controls whether the authenticated driver is accepting new transport work.
 *
 * DriverProfile.isAvailable and Vehicle.isAvailable are deliberately separate:
 *
 * - DriverProfile.isAvailable tells dispatch whether the PERSON can accept work.
 * - Vehicle.isAvailable tells dispatch whether a particular VEHICLE can be used.
 *
 * Both must be available before a shipment can be assigned.
 *
 * IMPORTANT:
 * A driver cannot manually make themselves available while they already have
 * an active shipment. This prevents the driver's availability flag from
 * contradicting the actual shipment state and helps protect against
 * double-booking.
 */
async function updateMyAvailability(
  userId: string,
  input: UpdateDriverAvailabilityInput,
) {
  const driver = await prisma.driverProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          status: true,
        },
      },
    },
  });

  if (!driver) {
    throw new AppError("Driver profile not found", 404);
  }

  /**
   * Additional checks are only necessary when the driver is trying to become
   * available.
   *
   * A driver is always allowed to make themselves unavailable.
   */
  if (input.isAvailable) {
    // Suspended, rejected or otherwise inactive accounts must never receive work.
    if (driver.user.status !== UserStatus.ACTIVE) {
      throw new AppError(
        "Your driver account must be active before accepting dispatches",
        403,
      );
    }

    // Only drivers approved by operations can participate in dispatch.
    if (driver.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new AppError(
        "Your driver profile must be verified before accepting dispatches",
        403,
      );
    }

    /**
     * Availability must agree with the shipment state.
     *
     * We do not rely only on DriverProfile.isAvailable because that boolean
     * could be changed manually or become inconsistent after an interrupted
     * operation.
     *
     * Shipment records are therefore treated as the stronger source of truth
     * when deciding whether the driver is already busy.
     */
    const activeShipment = await prisma.shipment.findFirst({
      where: {
        driverId: driver.id,
        status: {
          in: ACTIVE_SHIPMENT_STATUSES,
        },
      },
      select: {
        id: true,
        shipmentNumber: true,
        status: true,
      },
    });

    if (activeShipment) {
      throw new AppError(
        `You cannot become available while shipment ${activeShipment.shipmentNumber} is ${activeShipment.status}.`,
        409,
      );
    }
  }

  return prisma.driverProfile.update({
    where: { id: driver.id },
    data: {
      isAvailable: input.isAvailable,
    },
  });
}

export const driverService = {
  updateMyAvailability,
};