import { z } from "zod";

/**
 * Vehicle types intentionally mirror the Prisma enum.
 * Literal validation here keeps malformed API input away from Prisma.
 */
const vehicleTypeSchema = z.enum([
  "MOTORBIKE",
  "CAR",
  "VAN",
  "PICKUP",
  "TRUCK",
]);

const capacityKgSchema = z.coerce
  .number()
  .finite("Vehicle capacity must be a finite number")
  .positive("Vehicle capacity must be greater than 0")
  .max(100_000, "Vehicle capacity is unrealistically large");

const registrationNoSchema = z
  .string()
  .trim()
  .min(3, "Registration number is too short")
  .max(40, "Registration number is too long")
  .transform((value) => value.toUpperCase());

export const createVehicleSchema = z.object({
  registrationNo: registrationNoSchema,
  type: vehicleTypeSchema,
  capacityKg: capacityKgSchema,
  currentCity: z.string().trim().min(2).max(120).optional(),
});

export const updateVehicleSchema = z
  .object({
    registrationNo: registrationNoSchema.optional(),
    type: vehicleTypeSchema.optional(),
    capacityKg: capacityKgSchema.optional(),
    currentCity: z.string().trim().min(2).max(120).nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one vehicle field must be provided",
  });

export const updateVehicleAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});

export const vehicleIdSchema = z.object({
  id: z.string().uuid("Vehicle id must be a valid UUID"),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type UpdateVehicleAvailabilityInput = z.infer<
  typeof updateVehicleAvailabilitySchema
>;
