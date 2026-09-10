import { z } from "zod";

export const directPayDepositSchema = z.object({
  amount: z.coerce
    .number()
    .int("Amount must be a whole XAF value")
    .min(100, "Fapshi Direct Pay requires at least 100 XAF"),
  phone: z
    .string()
    .trim()
    .regex(/^(?:237)?6\d{8}$/, "Enter a valid Cameroon mobile number"),
  medium: z.enum(["mobile money", "orange money"]).optional(),
});

export const depositIdSchema = z.object({
  id: z.string().uuid("Deposit id must be a valid UUID"),
});

export const walletHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type DirectPayDepositInput = z.infer<typeof directPayDepositSchema>;

export const withdrawalSchema = z.object({
  amount: z.coerce.number().int("Amount must be a whole XAF value").min(100, "Fapshi payout requires at least 100 XAF"),
  phone: z.string().trim().regex(/^(?:237)?6\d{8}$/, "Enter a valid Cameroon mobile number"),
  medium: z.enum(["mobile money", "orange money"]).optional(),
});

export const withdrawalIdSchema = z.object({
  id: z.string().uuid("Withdrawal id must be a valid UUID"),
});

export type WithdrawalInput = z.infer<typeof withdrawalSchema>;
