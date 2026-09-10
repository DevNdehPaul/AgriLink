import { z } from "zod";
import { ListingStatus } from "../../generated/prisma/enums.js";

/**
 * Reusable numeric validation for Prisma Decimal-backed fields.
 *
 * API clients send normal JSON numbers. Prisma safely converts these values
 * into Decimal when the service writes them to PostgreSQL.
 */
const positiveNumber = z.coerce
  .number()
  .finite("Value must be a finite number")
  .positive("Value must be greater than 0");

const nonNegativeNumber = z.coerce
  .number()
  .finite("Value must be a finite number")
  .min(0, "Value cannot be negative");

/**
 * Converts an ISO-compatible date string into a Date.
 * We validate explicitly so invalid dates never reach Prisma.
 */
const dateString = z
  .string()
  .trim()
  .min(1, "Harvest date is required")
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Harvest date must be a valid date",
  })
  .transform((value) => new Date(value));

export const createProduceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  pricePerKg: positiveNumber,
  totalQuantityKg: positiveNumber,
  harvestDate: dateString,
  originCity: z.string().trim().min(2).max(120),
  pickupLocation: z.string().trim().max(255).optional(),
});

export const updateProduceSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    pricePerKg: positiveNumber.optional(),
    totalQuantityKg: positiveNumber.optional(),
    harvestDate: dateString.optional(),
    originCity: z.string().trim().min(2).max(120).optional(),
    pickupLocation: z.string().trim().max(255).nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided",
  });

export const updateProduceStatusSchema = z.object({
  status: z.enum([
    ListingStatus.DRAFT,
    ListingStatus.ACTIVE,
    ListingStatus.PAUSED,
    ListingStatus.SOLD_OUT,
    ListingStatus.EXPIRED,
  ]),
});

export const produceIdSchema = z.object({
  id: z.string().uuid("Produce listing id must be a valid UUID"),
});

export const produceQuerySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  minPrice: nonNegativeNumber.optional(),
  maxPrice: nonNegativeNumber.optional(),
  sort: z
    .enum(["newest", "price_asc", "price_desc", "harvest_asc", "harvest_desc"])
    .default("newest"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
}).refine(
  (query) =>
    query.minPrice === undefined ||
    query.maxPrice === undefined ||
    query.minPrice <= query.maxPrice,
  {
    message: "minPrice cannot be greater than maxPrice",
    path: ["minPrice"],
  },
);

export const myProduceQuerySchema = z.object({
  status: z
    .enum([
      ListingStatus.DRAFT,
      ListingStatus.ACTIVE,
      ListingStatus.PAUSED,
      ListingStatus.SOLD_OUT,
      ListingStatus.EXPIRED,
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateProduceInput = z.infer<typeof createProduceSchema>;
export type UpdateProduceInput = z.infer<typeof updateProduceSchema>;
export type UpdateProduceStatusInput = z.infer<typeof updateProduceStatusSchema>;
export type ProduceQueryInput = z.infer<typeof produceQuerySchema>;
export type MyProduceQueryInput = z.infer<typeof myProduceQuerySchema>;
