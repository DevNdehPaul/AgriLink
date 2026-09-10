import { Router } from "express";
import { authMiddleware } from "../../common/middleware/auth.middleware.js";
import { requireRoles } from "../../common/middleware/role.middleware.js";
import { UserRole } from "../../generated/prisma/enums.js";
import { driverController } from "./driver.controller.js";

export const driverRouter = Router();
driverRouter.use(authMiddleware, requireRoles(UserRole.DRIVER));
driverRouter.patch("/me/availability", driverController.updateMyAvailability);
