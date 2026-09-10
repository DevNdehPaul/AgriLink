import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../common/errors/app-error.js";
import { orderIdSchema } from "../orders/order.validation.js";
import { disputeService } from "./dispute.service.js";
import { createDisputeSchema, disputeIdSchema, resolveDisputeSchema } from "./dispute.validation.js";

async function open(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError("Authentication is required", 401);
    const { id } = orderIdSchema.parse(req.params);
    const input = createDisputeSchema.parse(req.body);
    const dispute = await disputeService.openDispute(req.user.id, id, input);
    res.status(201).json({ success: true, message: "Dispute opened. Held funds are frozen for admin review.", data: { dispute } });
  } catch (error) { next(error); }
}

async function mine(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError("Authentication is required", 401);
    const disputes = await disputeService.listMyDisputes(req.user.id);
    res.status(200).json({ success: true, data: { disputes } });
  } catch (error) { next(error); }
}

async function all(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const disputes = await disputeService.listAllDisputes();
    res.status(200).json({ success: true, data: { disputes } });
  } catch (error) { next(error); }
}

async function resolve(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError("Authentication is required", 401);
    const { id } = disputeIdSchema.parse(req.params);
    const input = resolveDisputeSchema.parse(req.body);
    const dispute = await disputeService.resolveDispute(req.user.id, id, input);
    res.status(200).json({ success: true, message: "Dispute resolved and protected funds processed.", data: { dispute } });
  } catch (error) { next(error); }
}

export const disputeController = { open, mine, all, resolve };
