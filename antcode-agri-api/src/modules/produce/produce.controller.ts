import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../common/errors/app-error.js";
import { produceService } from "./produce.service.js";
import {
  createProduceSchema,
  myProduceQuerySchema,
  produceIdSchema,
  produceQuerySchema,
  updateProduceSchema,
  updateProduceStatusSchema,
} from "./produce.validation.js";

/**
 * Controllers stay intentionally thin:
 * - validate transport/input concerns,
 * - call the business service,
 * - format the HTTP response.
 *
 * Ownership, inventory rules and database operations belong in the service.
 */
async function createProduce(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication is required", 401);
    }

    const input = createProduceSchema.parse(req.body);
    const listing = await produceService.createProduce(req.user.id, input);

    res.status(201).json({
      success: true,
      message: "Produce listing created successfully.",
      data: { listing },
    });
  } catch (error) {
    next(error);
  }
}

async function listMarketplace(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = produceQuerySchema.parse(req.query);
    const result = await produceService.listMarketplace(query);

    res.status(200).json({
      success: true,
      message: "Produce marketplace retrieved successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function getProduceById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = produceIdSchema.parse(req.params);
    const listing = await produceService.getProduceById(id);

    res.status(200).json({
      success: true,
      message: "Produce listing retrieved successfully.",
      data: { listing },
    });
  } catch (error) {
    next(error);
  }
}

async function listMyProduce(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication is required", 401);
    }

    const query = myProduceQuerySchema.parse(req.query);
    const result = await produceService.listMyProduce(req.user.id, query);

    res.status(200).json({
      success: true,
      message: "Cooperative produce listings retrieved successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function updateProduce(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication is required", 401);
    }

    const { id } = produceIdSchema.parse(req.params);
    const input = updateProduceSchema.parse(req.body);
    const listing = await produceService.updateProduce(req.user.id, id, input);

    res.status(200).json({
      success: true,
      message: "Produce listing updated successfully.",
      data: { listing },
    });
  } catch (error) {
    next(error);
  }
}

async function updateProduceStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication is required", 401);
    }

    const { id } = produceIdSchema.parse(req.params);
    const input = updateProduceStatusSchema.parse(req.body);
    const listing = await produceService.updateProduceStatus(
      req.user.id,
      id,
      input,
    );

    res.status(200).json({
      success: true,
      message: "Produce listing status updated successfully.",
      data: { listing },
    });
  } catch (error) {
    next(error);
  }
}

async function removeProduce(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication is required", 401);
    }

    const { id } = produceIdSchema.parse(req.params);
    const listing = await produceService.removeProduce(req.user.id, id);

    res.status(200).json({
      success: true,
      message: "Produce listing removed from the marketplace successfully.",
      data: { listing },
    });
  } catch (error) {
    next(error);
  }
}

export const produceController = {
  createProduce,
  listMarketplace,
  getProduceById,
  listMyProduce,
  updateProduce,
  updateProduceStatus,
  removeProduce,
};
