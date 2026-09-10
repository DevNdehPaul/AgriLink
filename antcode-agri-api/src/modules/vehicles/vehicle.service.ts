import { AppError } from "../../common/errors/app-error.js";
import { prisma } from "../../config/prisma.js";
import {
  UserStatus,
  VehicleStatus,
  VerificationStatus,
} from "../../generated/prisma/enums.js";
import type {
  CreateVehicleInput,
  UpdateVehicleAvailabilityInput,
  UpdateVehicleInput,
} from "./vehicle.validation.js";

/**
 * Loads the DriverProfile that belongs to the authenticated User.
 *
 * We never accept a driverId from the request body. This prevents one driver
 * from registering or modifying vehicles on behalf of another driver.
 */
async function getDriverProfile(userId: string) {
  const driver = await prisma.driverProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!driver) {
    throw new AppError("Driver profile not found", 404);
  }

  return driver;
}

/**
 * Finds a vehicle only when it belongs to the authenticated driver's profile.
 * Returning the same 404 for a missing vehicle and a vehicle owned by another
 * driver avoids leaking another driver's vehicle information.
 */
async function getOwnedVehicle(driverId: string, vehicleId: string) {
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      driverId,
    },
  });

  if (!vehicle) {
    throw new AppError("Vehicle not found", 404);
  }

  return vehicle;
}

/**
 * Register a vehicle under the authenticated driver.
 *
 * New vehicles are explicitly created unavailable. Even though the database
 * has a default, dispatch eligibility should be an intentional action by a
 * verified driver rather than an accidental side effect of registration.
 */
async function createVehicle(userId: string, input: CreateVehicleInput) {
  const driver = await getDriverProfile(userId);

  try {
    return await prisma.vehicle.create({
      data: {
        driverId: driver.id,
        registrationNo: input.registrationNo,
        type: input.type,
        capacityKg: input.capacityKg,
        currentCity: input.currentCity ?? driver.city ?? null,
        status: VehicleStatus.ACTIVE,
        isAvailable: false,
      },
    });
  } catch (error) {
    // Prisma P2002 = unique constraint violation. We intentionally avoid
    // importing Prisma error classes here so the module remains lightweight.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new AppError("A vehicle with this registration number already exists", 409);
    }

    throw error;
  }
}

/**
 * List only vehicles owned by the authenticated driver.
 */
async function listMyVehicles(userId: string) {
  const driver = await getDriverProfile(userId);

  return prisma.vehicle.findMany({
    where: { driverId: driver.id },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Update editable vehicle metadata.
 *
 * status, isAvailable and driverId are deliberately NOT accepted here.
 * Those fields represent operational/security state and are controlled by
 * dedicated backend rules.
 */
async function updateVehicle(
  userId: string,
  vehicleId: string,
  input: UpdateVehicleInput,
) {
  const driver = await getDriverProfile(userId);
  await getOwnedVehicle(driver.id, vehicleId);

  const data: {
    registrationNo?: string;
    type?: CreateVehicleInput["type"];
    capacityKg?: number;
    currentCity?: string | null;
  } = {};

  if (input.registrationNo !== undefined) {
    data.registrationNo = input.registrationNo;
  }
  if (input.type !== undefined) {
    data.type = input.type;
  }
  if (input.capacityKg !== undefined) {
    data.capacityKg = input.capacityKg;
  }
  if (input.currentCity !== undefined) {
    data.currentCity = input.currentCity;
  }

  try {
    return await prisma.vehicle.update({
      where: { id: vehicleId },
      data,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new AppError("A vehicle with this registration number already exists", 409);
    }

    throw error;
  }
}

/**
 * Change whether a vehicle may participate in dispatch.
 *
 * A driver may always turn a vehicle OFF. Turning it ON is stricter:
 * - the User account must be ACTIVE;
 * - the DriverProfile must be VERIFIED;
 * - the vehicle itself must have ACTIVE operational status.
 *
 * This means account creation alone never grants transport authority.
 */
async function updateVehicleAvailability(
  userId: string,
  vehicleId: string,
  input: UpdateVehicleAvailabilityInput,
) {
  const driver = await getDriverProfile(userId);
  const vehicle = await getOwnedVehicle(driver.id, vehicleId);

  if (input.isAvailable) {
    if (driver.user.status !== UserStatus.ACTIVE) {
      throw new AppError("Your driver account must be active before accepting dispatches", 403);
    }

    if (driver.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new AppError("Your driver profile must be verified before accepting dispatches", 403);
    }

    if (vehicle.status !== VehicleStatus.ACTIVE) {
      throw new AppError("Only an active vehicle can be made available for dispatch", 409);
    }
  }

  return prisma.vehicle.update({
    where: { id: vehicle.id },
    data: { isAvailable: input.isAvailable },
  });
}

export const vehicleService = {
  createVehicle,
  listMyVehicles,
  updateVehicle,
  updateVehicleAvailability,
};
