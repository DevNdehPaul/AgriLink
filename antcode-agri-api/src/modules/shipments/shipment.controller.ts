import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../common/errors/app-error.js";
import { shipmentService } from "./shipment.service.js";
import { dispatchService } from "./dispatch.service.js";
import { assignShipmentSchema, orderIdSchema, shipmentEventBodySchema, shipmentIdSchema } from "./shipment.validation.js";

async function createForOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { if (!req.user) throw new AppError("Authentication is required", 401); const { orderId } = orderIdSchema.parse(req.params); const shipment = await shipmentService.createForOrder(req.user.id, orderId); res.status(201).json({ success: true, message: "Shipment created and queued for assignment.", data: { shipment } }); } catch (e) { next(e); }
}
async function assignVehicle(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { const { id } = shipmentIdSchema.parse(req.params); const { vehicleId } = assignShipmentSchema.parse(req.body); const shipment = await shipmentService.assignVehicle(id, vehicleId); res.status(200).json({ success: true, message: "Driver and vehicle assigned successfully.", data: { shipment } }); } catch (e) { next(e); }
}
async function listMine(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { if (!req.user) throw new AppError("Authentication is required", 401); const shipments = await shipmentService.listMyShipments(req.user.id); res.status(200).json({ success: true, data: { shipments } }); } catch (e) { next(e); }
}
function transition(nextStatus: "PICKED_UP" | "IN_TRANSIT" | "DELIVERY_REPORTED") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => { try { if (!req.user) throw new AppError("Authentication is required", 401); const { id } = shipmentIdSchema.parse(req.params); const body = shipmentEventBodySchema.parse(req.body); const shipment = await shipmentService.driverTransition(req.user.id, id, nextStatus, body); res.status(200).json({ success: true, message: `Shipment moved to ${nextStatus}.`, data: { shipment } }); } catch (e) { next(e); } };
}
async function recommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = shipmentIdSchema.parse(req.params);
    const dispatch = await dispatchService.recommendVehicles(id);
    res.status(200).json({
      success: true,
      message: dispatch.candidateCount > 0 ? "Smart dispatch candidates ranked successfully." : "No eligible vehicles are currently available.",
      data: { dispatch },
    });
  } catch (e) { next(e); }
}

export const shipmentController = { createForOrder, recommendations, assignVehicle, listMine, pickup: transition("PICKED_UP"), startTransit: transition("IN_TRANSIT"), reportDelivery: transition("DELIVERY_REPORTED") };
