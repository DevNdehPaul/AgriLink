import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../common/errors/app-error.js";
import { driverService } from "./driver.service.js";
import { updateDriverAvailabilitySchema } from "./driver.validation.js";

async function updateMyAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError("Authentication is required", 401);
    const input = updateDriverAvailabilitySchema.parse(req.body);
    const driver = await driverService.updateMyAvailability(req.user.id, input);
    res.status(200).json({ success: true, message: input.isAvailable ? "Driver is now available for dispatch." : "Driver is now unavailable for dispatch.", data: { driver } });
  } catch (error) { next(error); }
}

export const driverController = { updateMyAvailability };
