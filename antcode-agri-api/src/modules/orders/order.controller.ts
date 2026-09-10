import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../common/errors/app-error.js";
import { orderService } from "./order.service.js";
import {
  createOrderSchema,
  orderIdSchema,
  orderQuerySchema,
} from "./order.validation.js";

async function createOrder(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication is required", 401);
    }

    const input = createOrderSchema.parse(req.body);
    const order = await orderService.createOrder(req.user.id, input);

    res.status(201).json({
      success: true,
      message: "Order created and inventory reserved successfully.",
      data: { order },
    });
  } catch (error) {
    next(error);
  }
}

async function listMyOrders(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication is required", 401);
    }

    const query = orderQuerySchema.parse(req.query);
    const result = await orderService.listMyOrders(req.user.id, query);

    res.status(200).json({
      success: true,
      message: "Orders retrieved successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function getMyOrder(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication is required", 401);
    }

    const { id } = orderIdSchema.parse(req.params);
    const order = await orderService.getMyOrder(req.user.id, id);

    res.status(200).json({
      success: true,
      message: "Order retrieved successfully.",
      data: { order },
    });
  } catch (error) {
    next(error);
  }
}

async function cancelMyOrder(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication is required", 401);
    }

    const { id } = orderIdSchema.parse(req.params);
    const order = await orderService.cancelMyOrder(req.user.id, id);

    res.status(200).json({
      success: true,
      message: "Order cancelled and reserved inventory released successfully.",
      data: { order },
    });
  } catch (error) {
    next(error);
  }
}

export const orderController = {
  createOrder,
  listMyOrders,
  getMyOrder,
  cancelMyOrder,
};
