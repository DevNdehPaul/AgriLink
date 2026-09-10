import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../common/errors/app-error.js";
import { orderIdSchema } from "./order.validation.js";
import { orderPaymentService } from "./order-payment.service.js";

async function payOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError("Authentication is required", 401);
    const { id } = orderIdSchema.parse(req.params);
    const result = await orderPaymentService.payOrderFromWallet(req.user.id, id);

    res.status(200).json({
      success: true,
      message: "Order payment secured. Funds are held until delivery verification.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}


/**
 * Buyer confirms receipt after the driver has reported delivery.
 * The service performs delivery completion and fund release atomically.
 */
async function confirmDelivery(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError("Authentication is required", 401);
    const { id } = orderIdSchema.parse(req.params);
    const result = await orderPaymentService.confirmDeliveryAndReleaseFunds(
      req.user.id,
      id,
    );

    res.status(200).json({
      success: true,
      message: "Delivery verified. Held funds were released to the cooperative.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export const orderPaymentController = { payOrder, confirmDelivery };
