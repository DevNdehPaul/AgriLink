import type { NextFunction, Request, Response } from "express";
import { PrismaPg } from "@prisma/adapter-pg";
import { env as cloudflareEnv } from "cloudflare:workers";

import { runWithPrisma } from "../../config/prisma-context.js";
import { PrismaClient } from "../../generated/prisma-cloudflare/client.js";

export function prismaMiddleware(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const adapter = new PrismaPg({
    connectionString: cloudflareEnv.HYPERDRIVE.connectionString,
  });

  const prisma = new PrismaClient({
    adapter,
  });

  runWithPrisma(prisma, () => {
    next();
  });
}