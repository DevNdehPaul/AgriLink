import "dotenv/config";

import { defineConfig, env } from "prisma/config";

/**
 * ============================================================
 * PRISMA CLI CONFIGURATION
 * ============================================================
 *
 * This configuration is used by Prisma CLI commands such as:
 *
 * npx prisma validate
 * npx prisma migrate dev
 * npx prisma db pull
 *
 * IMPORTANT:
 *
 * Our application has two database connection strings:
 *
 * DATABASE_URL
 *     → pooled Neon connection
 *     → used by the running Express application
 *
 * DIRECT_URL
 *     → direct Neon connection
 *     → used by Prisma CLI and migrations
 *
 * Migrations should use the direct database connection rather
 * than going through the connection pooler.
 */

export default defineConfig({
  /**
   * ----------------------------------------------------------
   * PRISMA SCHEMA
   * ----------------------------------------------------------
   *
   * Tell Prisma where our database schema is located.
   */
  schema: "prisma/schema.prisma",

  /**
   * ----------------------------------------------------------
   * MIGRATIONS
   * ----------------------------------------------------------
   *
   * Prisma will store generated migration files inside:
   *
   * prisma/migrations/
   */
  migrations: {
    path: "prisma/migrations",
  },

  /**
   * ----------------------------------------------------------
   * DATABASE CONNECTION
   * ----------------------------------------------------------
   *
   * Prisma CLI uses the DIRECT Neon PostgreSQL connection.
   *
   * We deliberately DO NOT use DATABASE_URL here because
   * DATABASE_URL is reserved for the pooled connection used
   * by our running application.
   */
  datasource: {
    url: env("DIRECT_URL"),
  },
});