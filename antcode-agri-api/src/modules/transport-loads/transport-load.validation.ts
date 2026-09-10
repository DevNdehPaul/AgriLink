import { z } from "zod";

export const createTransportLoadSchema = z.object({
  vehicleId: z.string().uuid(),
  shipmentIds: z.array(z.string().uuid()).min(2, "A shared load requires at least two shipments").max(20),
}).superRefine((value, ctx) => {
  if (new Set(value.shipmentIds).size !== value.shipmentIds.length) {
    ctx.addIssue({ code: "custom", path: ["shipmentIds"], message: "shipmentIds must not contain duplicates" });
  }
});

export const transportLoadIdSchema = z.object({ id: z.string().uuid() });
export type CreateTransportLoadInput = z.infer<typeof createTransportLoadSchema>;
