import { Router } from "express";
import { authMiddleware } from "../../common/middleware/auth.middleware.js";
import { requireRoles } from "../../common/middleware/role.middleware.js";
import { UserRole } from "../../generated/prisma/enums.js";
import { shipmentController } from "./shipment.controller.js";

export const shipmentRouter = Router();
shipmentRouter.use(authMiddleware);

shipmentRouter.post("/orders/:orderId", requireRoles(UserRole.BUYER), shipmentController.createForOrder);
shipmentRouter.get("/:id/dispatch-recommendations", requireRoles(UserRole.ADMIN), shipmentController.recommendations);
shipmentRouter.patch("/:id/assign", requireRoles(UserRole.ADMIN), shipmentController.assignVehicle);
shipmentRouter.get("/mine", requireRoles(UserRole.DRIVER), shipmentController.listMine);
shipmentRouter.patch("/:id/pickup", requireRoles(UserRole.DRIVER), shipmentController.pickup);
shipmentRouter.patch("/:id/in-transit", requireRoles(UserRole.DRIVER), shipmentController.startTransit);
shipmentRouter.patch("/:id/report-delivery", requireRoles(UserRole.DRIVER), shipmentController.reportDelivery);
