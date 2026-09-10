import { Router } from "express";

import { authController } from "./auth.controller.js";
import { authMiddleware } from "../../common/middleware/auth.middleware.js";
import { authRateLimit } from "../../common/middleware/rate-limit.middleware.js";

/**
 * ============================================================
 * AUTH ROUTES
 * ============================================================
 *
 * Base path:
 *
 * /api/v1/auth
 *
 * These routes connect HTTP endpoints to the authentication
 * controller.
 */

export const authRouter = Router();


/**
 * ------------------------------------------------------------
 * BUYER REGISTRATION
 * ------------------------------------------------------------
 *
 * Public route.
 */
authRouter.post(
  "/register/buyer",
  authRateLimit,
  authController.registerBuyer,
);


/**
 * ------------------------------------------------------------
 * COOPERATIVE REGISTRATION
 * ------------------------------------------------------------
 *
 * Public route.
 *
 * The cooperative will be created with PENDING status and must
 * later be approved by an administrator.
 */
authRouter.post(
  "/register/cooperative",
  authRateLimit,
  authController.registerCooperative,
);


/**
 * ------------------------------------------------------------
 * DRIVER REGISTRATION
 * ------------------------------------------------------------
 *
 * Public route.
 *
 * The driver will also remain PENDING until verified.
 */
authRouter.post(
  "/register/driver",
  authRateLimit,
  authController.registerDriver,
);


/**
 * ------------------------------------------------------------
 * LOGIN
 * ------------------------------------------------------------
 *
 * Public route.
 *
 * Successful authentication returns an access token and refresh
 * token.
 */
authRouter.post(
  "/login",
  authRateLimit,
  authController.login,
);


/**
 * ------------------------------------------------------------
 * REFRESH ACCESS TOKEN
 * ------------------------------------------------------------
 *
 * Public in the HTTP sense because an expired access token
 * cannot protect this endpoint.
 *
 * The refresh token itself acts as the credential.
 */
authRouter.post(
  "/refresh",
  authRateLimit,
  authController.refreshAccessToken,
);


/**
 * ------------------------------------------------------------
 * CURRENT USER
 * ------------------------------------------------------------
 *
 * Protected route.
 *
 * authMiddleware verifies the Bearer access token before the
 * request reaches the controller.
 */
authRouter.get(
  "/me",
  authMiddleware,
  authController.getCurrentUser,
);