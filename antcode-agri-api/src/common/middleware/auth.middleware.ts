import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../errors/app-error.js";

/** Shape stored inside every access token issued by our API. */
interface AccessTokenPayload extends JwtPayload {
  sub: string;
  role: "BUYER" | "COOPERATIVE" | "DRIVER" | "ADMIN";
  tokenType: "access";
}

/**
 * Protects private routes.
 *
 * Flow:
 * 1. Read the Bearer token from the Authorization header.
 * 2. Verify its signature and expiration.
 * 3. Confirm that it is an ACCESS token.
 * 4. Reload the user from the database so suspended/deleted accounts cannot
 *    continue using an old but otherwise valid token.
 * 5. Attach a small trusted user object to req.user.
 */
export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      throw new AppError("Authentication is required", 401);
    }

    const token = authorization.slice("Bearer ".length).trim();

    if (!token) {
      throw new AppError("Authentication token is missing", 401);
    }

    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;

    if (!decoded.sub || decoded.tokenType !== "access") {
      throw new AppError("Invalid authentication token", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, role: true, status: true },
    });

    if (!user) {
      throw new AppError("The account associated with this token no longer exists", 401);
    }

    // Pending accounts may authenticate so they can inspect their approval
    // state, but rejected/suspended accounts cannot use protected endpoints.
    if (user.status === "SUSPENDED" || user.status === "REJECTED") {
      throw new AppError("This account is not allowed to access the platform", 403);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    if (error instanceof jwt.TokenExpiredError) {
      next(new AppError("Authentication token has expired", 401));
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError("Invalid authentication token", 401));
      return;
    }

    next(error);
  }
}
