import "dotenv/config";
import { z } from "zod";

/** Validates environment configuration at startup. */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z.string().default("http://localhost:4200"),
  REQUEST_BODY_LIMIT: z.string().default("256kb"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must contain at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must contain at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  FAPSHI_BASE_URL: z.string().url().default("https://sandbox.fapshi.com"),

  // Collection service credentials: buyer wallet deposits.
  FAPSHI_API_USER: z.string().min(1, "FAPSHI_API_USER is required"),
  FAPSHI_API_KEY: z.string().min(1, "FAPSHI_API_KEY is required"),

  // Payout service credentials MUST belong to a separate Fapshi service.
  // Optional at startup so the rest of the API can still run before payout
  // credentials are configured; payout calls fail explicitly if absent.
  FAPSHI_PAYOUT_API_USER: z.string().min(1).optional(),
  FAPSHI_PAYOUT_API_KEY: z.string().min(1).optional(),
});

const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  console.error("Invalid environment configuration:", parsedEnv.error.flatten().fieldErrors);
  throw new Error("Environment configuration is invalid. Check your .env file.");
}
export const env = parsedEnv.data;

/** Comma-separated frontend origins allowed to call the API from browsers. */
export const corsOrigins = env.CORS_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (env.NODE_ENV === "production") {
  if (corsOrigins.length === 0 || corsOrigins.includes("*")) {
    throw new Error("Production CORS_ORIGINS must contain explicit trusted origins.");
  }

  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error("JWT access and refresh secrets must be different in production.");
  }

  if (!env.FAPSHI_PAYOUT_API_USER || !env.FAPSHI_PAYOUT_API_KEY) {
    console.warn("Fapshi payout credentials are not configured; cooperative payouts will be unavailable.");
  }
}

