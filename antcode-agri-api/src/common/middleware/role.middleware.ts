import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "../../generated/prisma/enums.js";
import { AppError } from "../errors/app-error.js";

/**
 * Creates middleware that only permits the supplied roles.
 * authMiddleware MUST run before this middleware.
 *
 * Example:
 * router.post("/listings", authMiddleware, requireRoles("COOPERATIVE"), ...)
 */
export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError("Authentication is required", 401));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new AppError("You are not authorized to perform this action", 403));
      return;
    }

    next();
  };
}
