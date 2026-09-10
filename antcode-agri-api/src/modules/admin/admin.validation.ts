import { z } from "zod";
import { OrderStatus, ShipmentStatus, VerificationStatus, VehicleStatus, WithdrawalStatus } from "../../generated/prisma/enums.js";

const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(20);
const search = z.string().trim().min(1).max(120).optional();

export const adminIdSchema = z.object({ id: z.string().uuid() });
export const adminOrderQuerySchema = z.object({ page, limit, status: z.enum(OrderStatus).optional(), search });
export const adminShipmentQuerySchema = z.object({ page, limit, status: z.enum(ShipmentStatus).optional(), search });
export const adminCooperativeQuerySchema = z.object({ page, limit, verificationStatus: z.enum(VerificationStatus).optional(), city: z.string().trim().min(1).max(80).optional(), search });
export const adminDriverQuerySchema = z.object({ page, limit, verificationStatus: z.enum(VerificationStatus).optional(), isAvailable: z.string().optional().transform((v) => v === undefined ? undefined : v === "true" ? true : v === "false" ? false : undefined), city: z.string().trim().min(1).max(80).optional(), search });
export const adminVehicleQuerySchema = z.object({ page, limit, status: z.enum(VehicleStatus).optional(), isAvailable: z.string().optional().transform((v) => v === undefined ? undefined : v === "true" ? true : v === "false" ? false : undefined), city: z.string().trim().min(1).max(80).optional(), search });

export type AdminOrderQuery = z.infer<typeof adminOrderQuerySchema>;
export type AdminShipmentQuery = z.infer<typeof adminShipmentQuerySchema>;
export type AdminCooperativeQuery = z.infer<typeof adminCooperativeQuerySchema>;
export type AdminDriverQuery = z.infer<typeof adminDriverQuerySchema>;
export type AdminVehicleQuery = z.infer<typeof adminVehicleQuerySchema>;

export const adminWithdrawalQuerySchema = z.object({ page, limit, status: z.enum(WithdrawalStatus).optional(), search });
export type AdminWithdrawalQuery = z.infer<typeof adminWithdrawalQuerySchema>;
