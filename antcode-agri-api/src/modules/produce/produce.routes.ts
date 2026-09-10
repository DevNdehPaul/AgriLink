import { Router } from "express";
import { authMiddleware } from "../../common/middleware/auth.middleware.js";
import { requireRoles } from "../../common/middleware/role.middleware.js";
import { UserRole } from "../../generated/prisma/enums.js";
import { produceController } from "./produce.controller.js";

export const produceRouter = Router();

/**
 * IMPORTANT: "/mine" is declared before "/:id".
 * Otherwise Express could interpret the literal word "mine" as an id.
 */

// Public marketplace endpoints.
produceRouter.get("/", produceController.listMarketplace);
produceRouter.get("/mine", authMiddleware, requireRoles(UserRole.COOPERATIVE), produceController.listMyProduce);
produceRouter.get("/:id", produceController.getProduceById);

// Cooperative-only supply management.
produceRouter.post("/", authMiddleware, requireRoles(UserRole.COOPERATIVE), produceController.createProduce);
produceRouter.patch("/:id", authMiddleware, requireRoles(UserRole.COOPERATIVE), produceController.updateProduce);
produceRouter.patch("/:id/status", authMiddleware, requireRoles(UserRole.COOPERATIVE), produceController.updateProduceStatus);
produceRouter.delete("/:id", authMiddleware, requireRoles(UserRole.COOPERATIVE), produceController.removeProduce);
