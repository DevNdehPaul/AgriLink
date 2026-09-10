import { Router } from "express";
import { authMiddleware } from "../../common/middleware/auth.middleware.js";
import { requireRoles } from "../../common/middleware/role.middleware.js";
import { UserRole } from "../../generated/prisma/enums.js";
import { adminController } from "./admin.controller.js";

export const adminRouter = Router();
adminRouter.use(authMiddleware, requireRoles(UserRole.ADMIN));
adminRouter.get("/dashboard", adminController.dashboard);
adminRouter.get("/operations/alerts", adminController.alerts);
adminRouter.get("/orders", adminController.orders);
adminRouter.get("/orders/:id", adminController.order);
adminRouter.get("/shipments", adminController.shipments);
adminRouter.get("/shipments/:id", adminController.shipment);
adminRouter.get("/cooperatives", adminController.cooperatives);
adminRouter.get("/cooperatives/:id", adminController.cooperative);
adminRouter.get("/drivers", adminController.drivers);
adminRouter.get("/vehicles", adminController.vehicles);
adminRouter.get("/withdrawals", adminController.withdrawals);
