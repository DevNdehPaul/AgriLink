import { Router } from "express";
import { authMiddleware } from "../../common/middleware/auth.middleware.js";
import { requireRoles } from "../../common/middleware/role.middleware.js";
import { UserRole } from "../../generated/prisma/enums.js";
import { vehicleController } from "./vehicle.controller.js";

export const vehicleRouter = Router();

// Every vehicle-management endpoint belongs to an authenticated DRIVER.
vehicleRouter.use(authMiddleware, requireRoles(UserRole.DRIVER));

// Keep literal routes before parameterized routes for predictable matching.
vehicleRouter.get("/mine", vehicleController.listMyVehicles);
vehicleRouter.post("/", vehicleController.createVehicle);
vehicleRouter.patch("/:id", vehicleController.updateVehicle);
vehicleRouter.patch("/:id/availability", vehicleController.updateVehicleAvailability);
