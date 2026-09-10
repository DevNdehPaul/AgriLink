import type { NextFunction, Request, Response } from "express";
import { authService } from "./auth.service.js";
import {
  buyerRegistrationSchema,
  cooperativeRegistrationSchema,
  driverRegistrationSchema,
  loginSchema,
  refreshTokenSchema,
} from "./auth.validation.js";

/** HTTP controller for authentication endpoints. */
async function registerBuyer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = buyerRegistrationSchema.parse(req.body);
    const result = await authService.registerBuyer(input);
    res.status(201).json({ success: true, message: "Buyer account created successfully.", data: result });
  } catch (error) { next(error); }
}

async function registerCooperative(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = cooperativeRegistrationSchema.parse(req.body);
    const result = await authService.registerCooperative(input);
    res.status(201).json({
      success: true,
      message: "Cooperative registration submitted successfully. Account is pending verification.",
      data: result,
    });
  } catch (error) { next(error); }
}

async function registerDriver(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = driverRegistrationSchema.parse(req.body);
    const result = await authService.registerDriver(input);
    res.status(201).json({
      success: true,
      message: "Driver registration submitted successfully. Account is pending verification.",
      data: result,
    });
  } catch (error) { next(error); }
}

async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    res.status(200).json({ success: true, message: "Login successful.", data: result });
  } catch (error) { next(error); }
}

async function refreshAccessToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = refreshTokenSchema.parse(req.body);
    const result = await authService.refreshAccessToken(input.refreshToken);
    res.status(200).json({ success: true, message: "Access token refreshed successfully.", data: result });
  } catch (error) { next(error); }
}

async function getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required." });
      return;
    }
    const result = await authService.getCurrentUser(req.user.id);
    res.status(200).json({ success: true, message: "Current user retrieved successfully.", data: result });
  } catch (error) { next(error); }
}

export const authController = {
  registerBuyer,
  registerCooperative,
  registerDriver,
  login,
  refreshAccessToken,
  getCurrentUser,
};
