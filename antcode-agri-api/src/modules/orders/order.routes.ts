import { Router } from "express";
import { authMiddleware } from "../../common/middleware/auth.middleware.js";
import { requireRoles } from "../../common/middleware/role.middleware.js";
import { UserRole } from "../../generated/prisma/enums.js";
import { orderController } from "./order.controller.js";
import { orderPaymentController } from "./order-payment.controller.js";

export const orderRouter = Router();

orderRouter.use(authMiddleware, requireRoles(UserRole.BUYER));

orderRouter.post("/", orderController.createOrder);
orderRouter.get("/", orderController.listMyOrders);
orderRouter.post("/:id/pay", orderPaymentController.payOrder);
orderRouter.post("/:id/confirm-delivery", orderPaymentController.confirmDelivery);
orderRouter.post("/:id/cancel", orderController.cancelMyOrder);
orderRouter.get("/:id", orderController.getMyOrder);
