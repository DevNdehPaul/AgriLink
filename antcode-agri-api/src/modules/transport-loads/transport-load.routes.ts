import { Router } from "express";
import { authMiddleware } from "../../common/middleware/auth.middleware.js";
import { requireRoles } from "../../common/middleware/role.middleware.js";
import { UserRole } from "../../generated/prisma/enums.js";
import { transportLoadController } from "./transport-load.controller.js";

export const transportLoadRouter = Router();
transportLoadRouter.use(authMiddleware, requireRoles(UserRole.ADMIN));
transportLoadRouter.post("/", transportLoadController.create);
transportLoadRouter.get("/", transportLoadController.list);
transportLoadRouter.get("/:id", transportLoadController.getById);
