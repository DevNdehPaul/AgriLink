import { z } from "zod";

export const orderIdSchema = z.object({ orderId: z.string().uuid() });
export const shipmentIdSchema = z.object({ id: z.string().uuid() });
export const assignShipmentSchema = z.object({ vehicleId: z.string().uuid() });
export const shipmentEventBodySchema = z.object({
  city: z.string().trim().min(2).max(120).optional(),
  note: z.string().trim().max(500).optional(),
});
export type ShipmentEventBodyInput = z.infer<typeof shipmentEventBodySchema>;
