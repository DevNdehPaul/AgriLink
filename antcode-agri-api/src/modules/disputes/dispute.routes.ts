import { Router } from "express";
import { authMiddleware } from "../../common/middleware/auth.middleware.js";
import { requireRoles } from "../../common/middleware/role.middleware.js";
import { UserRole } from "../../generated/prisma/enums.js";
import { disputeController } from "./dispute.controller.js";

export const disputeRouter = Router();
disputeRouter.use(authMiddleware);

// Buyer trust path: dispute only their own driver-reported order.
disputeRouter.post("/orders/:id", requireRoles(UserRole.BUYER), disputeController.open);
disputeRouter.get("/mine", requireRoles(UserRole.BUYER), disputeController.mine);

// Operations path: admins review and resolve frozen funds.
disputeRouter.get("/", requireRoles(UserRole.ADMIN), disputeController.all);
disputeRouter.patch("/:id/resolve", requireRoles(UserRole.ADMIN), disputeController.resolve);
