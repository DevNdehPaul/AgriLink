import type { NextFunction, Request, Response } from "express";
import { createTransportLoadSchema, transportLoadIdSchema } from "./transport-load.validation.js";
import { transportLoadService } from "./transport-load.service.js";

async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createTransportLoadSchema.parse(req.body);
    const load = await transportLoadService.createSharedLoad(input);
    res.status(201).json({ success: true, message: "Shared transport load created and shipments assigned.", data: { load } });
  } catch (error) { next(error); }
}
async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { const { id } = transportLoadIdSchema.parse(req.params); const load = await transportLoadService.getById(id); res.status(200).json({ success: true, data: { load } }); } catch (error) { next(error); }
}
async function list(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try { const loads = await transportLoadService.list(); res.status(200).json({ success: true, data: { loads } }); } catch (error) { next(error); }
}
export const transportLoadController = { create, getById, list };
