import { z } from "zod";
import { OrderStatus } from "../../generated/prisma/enums.js";

const positiveQuantity = z.coerce
  .number()
  .finite("Quantity must be a finite number")
  .positive("Quantity must be greater than 0");

export const createOrderSchema = z.object({
  listingId: z.string().uuid("Listing id must be a valid UUID"),
  quantityKg: positiveQuantity,
  deliveryCity: z.string().trim().min(2).max(120),
  deliveryAddress: z.string().trim().min(3).max(255),
});

export const orderIdSchema = z.object({
  id: z.string().uuid("Order id must be a valid UUID"),
});

export const orderQuerySchema = z.object({
  status: z
    .enum([
      OrderStatus.PENDING_PAYMENT,
      OrderStatus.PAYMENT_SECURED,
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.IN_TRANSIT,
      OrderStatus.DELIVERY_REPORTED,
      OrderStatus.COMPLETED,
      OrderStatus.CANCELLED,
      OrderStatus.DISPUTED,
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrderQueryInput = z.infer<typeof orderQuerySchema>;
