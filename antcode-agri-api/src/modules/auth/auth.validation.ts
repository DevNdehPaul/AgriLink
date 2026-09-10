import { z } from "zod";

/** Shared phone rule: international format, e.g. +237670000001. */
const phoneSchema = z.string().trim().regex(
  /^\+[1-9]\d{7,14}$/,
  "Phone number must use international format, for example +237670000001",
);

/** Password rule used by all public registration endpoints. */
const passwordSchema = z.string()
  .min(8, "Password must contain at least 8 characters")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[0-9]/, "Password must contain a number");

const optionalEmailSchema = z.email("Please provide a valid email address").optional();

export const buyerRegistrationSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required").max(120),
  phone: phoneSchema,
  email: optionalEmailSchema,
  password: passwordSchema,
  buyerType: z.enum([
    "INDIVIDUAL", "RESTAURANT", "HOTEL", "RETAILER",
    "WHOLESALER", "FOOD_PROCESSOR", "OTHER",
  ]),
  businessName: z.string().trim().min(2).max(150).optional(),
  city: z.string().trim().min(2, "City is required").max(100),
  deliveryAddress: z.string().trim().min(2).max(250).optional(),
});
export type BuyerRegistrationInput = z.infer<typeof buyerRegistrationSchema>;

export const cooperativeRegistrationSchema = z.object({
  fullName: z.string().trim().min(2, "Representative's full name is required").max(120),
  phone: phoneSchema,
  email: optionalEmailSchema,
  password: passwordSchema,
  name: z.string().trim().min(2, "Cooperative name is required").max(150),
  description: z.string().trim().max(1000).optional(),
  region: z.string().trim().max(100).optional(),
  city: z.string().trim().min(2, "City is required").max(100),
  locality: z.string().trim().max(150).optional(),
});
export type CooperativeRegistrationInput = z.infer<typeof cooperativeRegistrationSchema>;

export const driverRegistrationSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required").max(120),
  phone: phoneSchema,
  email: optionalEmailSchema,
  password: passwordSchema,
  licenseNumber: z.string().trim().min(2).max(100).optional(),
  city: z.string().trim().min(2).max(100).optional(),
});
export type DriverRegistrationInput = z.infer<typeof driverRegistrationSchema>;

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Phone number or email is required"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
