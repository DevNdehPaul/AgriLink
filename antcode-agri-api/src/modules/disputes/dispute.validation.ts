import { z } from "zod";
import { DisputeResolution } from "../../generated/prisma/enums.js";

export const disputeIdSchema = z.object({
  id: z.string().uuid(),
});

export const createDisputeSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Please explain the delivery problem in at least 10 characters")
    .max(1000, "Dispute reason cannot exceed 1000 characters"),
});

export const resolveDisputeSchema = z.object({
  resolution: z.nativeEnum(DisputeResolution),
  adminNote: z.string().trim().min(3).max(1000),
});

export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;
