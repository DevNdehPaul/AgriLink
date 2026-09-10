import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "./env.js";

/**
 * PostgreSQL driver adapter used by Prisma 7.
 * The connection string comes from our validated environment configuration.
 */
const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

/**
 * One shared Prisma client is exported for the entire application.
 * Services will import this instance instead of creating new clients.
 */
export const prisma = new PrismaClient({ adapter });
