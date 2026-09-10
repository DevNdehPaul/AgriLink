import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../common/errors/app-error.js";
import { vehicleService } from "./vehicle.service.js";
import {
  createVehicleSchema,
  updateVehicleAvailabilitySchema,
  updateVehicleSchema,
  vehicleIdSchema,
} from "./vehicle.validation.js";

/**
 * Vehicle controllers are intentionally thin. Validation and HTTP response
 * formatting live here; ownership and dispatch rules live in the service.
 */
async function createVehicle(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError("Authentication is required", 401);

    const input = createVehicleSchema.parse(req.body);
    const vehicle = await vehicleService.createVehicle(req.user.id, input);

    res.status(201).json({
      success: true,
      message: "Vehicle registered successfully.",
      data: { vehicle },
    });
  } catch (error) {
    next(error);
  }
}

async function listMyVehicles(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError("Authentication is required", 401);

    const vehicles = await vehicleService.listMyVehicles(req.user.id);

    res.status(200).json({
      success: true,
      message: "Driver vehicles retrieved successfully.",
      data: { vehicles },
    });
  } catch (error) {
    next(error);
  }
}

async function updateVehicle(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError("Authentication is required", 401);

    const { id } = vehicleIdSchema.parse(req.params);
    const input = updateVehicleSchema.parse(req.body);
    const vehicle = await vehicleService.updateVehicle(req.user.id, id, input);

    res.status(200).json({
      success: true,
      message: "Vehicle updated successfully.",
      data: { vehicle },
    });
  } catch (error) {
    next(error);
  }
}

async function updateVehicleAvailability(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError("Authentication is required", 401);

    const { id } = vehicleIdSchema.parse(req.params);
    const input = updateVehicleAvailabilitySchema.parse(req.body);
    const vehicle = await vehicleService.updateVehicleAvailability(
      req.user.id,
      id,
      input,
    );

    res.status(200).json({
      success: true,
      message: input.isAvailable
        ? "Vehicle is now available for dispatch."
        : "Vehicle is now unavailable for dispatch.",
      data: { vehicle },
    });
  } catch (error) {
    next(error);
  }
}

export const vehicleController = {
  createVehicle,
  listMyVehicles,
  updateVehicle,
  updateVehicleAvailability,
};
