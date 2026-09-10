import type { UserRole, UserStatus } from "../../generated/prisma/enums.js";

/**
 * Adds our authenticated user information to Express Request.
 *
 * After authMiddleware succeeds, controllers can safely read:
 *   req.user.id
 *   req.user.role
 *   req.user.status
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
        status: UserStatus;
      };
    }
  }
}

export {};
