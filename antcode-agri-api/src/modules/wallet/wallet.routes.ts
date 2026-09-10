import { Router } from "express";
import { authMiddleware } from "../../common/middleware/auth.middleware.js";
import { requireRoles } from "../../common/middleware/role.middleware.js";
import { UserRole } from "../../generated/prisma/enums.js";
import { walletController } from "./wallet.controller.js";

export const walletRouter = Router();
walletRouter.use(authMiddleware);

// Both buyers and cooperatives need to see their platform wallet.
walletRouter.get("/", requireRoles(UserRole.BUYER, UserRole.COOPERATIVE), walletController.getWallet);

// Buyer funding / collection flow.
walletRouter.get("/deposits", requireRoles(UserRole.BUYER), walletController.listDeposits);
walletRouter.post("/deposits/direct-pay", requireRoles(UserRole.BUYER), walletController.requestDeposit);
walletRouter.post("/deposits/:id/sync", requireRoles(UserRole.BUYER), walletController.syncDeposit);

// Cooperative settlement withdrawal / payout flow.
walletRouter.get("/withdrawals", requireRoles(UserRole.COOPERATIVE), walletController.listWithdrawals);
walletRouter.post("/withdrawals", requireRoles(UserRole.COOPERATIVE), walletController.requestWithdrawal);
walletRouter.post("/withdrawals/:id/sync", requireRoles(UserRole.COOPERATIVE), walletController.syncWithdrawal);
