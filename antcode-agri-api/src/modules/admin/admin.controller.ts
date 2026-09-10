import type { NextFunction, Request, Response } from "express";
import { adminService } from "./admin.service.js";
import { adminCooperativeQuerySchema, adminDriverQuerySchema, adminIdSchema, adminOrderQuerySchema, adminShipmentQuerySchema, adminVehicleQuerySchema, adminWithdrawalQuerySchema } from "./admin.validation.js";

const ok = (res: Response, data: unknown) => res.status(200).json({ success: true, data });
async function dashboard(_req: Request, res: Response, next: NextFunction) { try { ok(res, { dashboard: await adminService.dashboard() }); } catch (e) { next(e); } }
async function orders(req: Request, res: Response, next: NextFunction) { try { ok(res, await adminService.listOrders(adminOrderQuerySchema.parse(req.query))); } catch (e) { next(e); } }
async function order(req: Request, res: Response, next: NextFunction) { try { const { id } = adminIdSchema.parse(req.params); ok(res, { order: await adminService.getOrder(id) }); } catch (e) { next(e); } }
async function shipments(req: Request, res: Response, next: NextFunction) { try { ok(res, await adminService.listShipments(adminShipmentQuerySchema.parse(req.query))); } catch (e) { next(e); } }
async function shipment(req: Request, res: Response, next: NextFunction) { try { const { id } = adminIdSchema.parse(req.params); ok(res, { shipment: await adminService.getShipment(id) }); } catch (e) { next(e); } }
async function cooperatives(req: Request, res: Response, next: NextFunction) { try { ok(res, await adminService.listCooperatives(adminCooperativeQuerySchema.parse(req.query))); } catch (e) { next(e); } }
async function cooperative(req: Request, res: Response, next: NextFunction) { try { const { id } = adminIdSchema.parse(req.params); ok(res, { cooperative: await adminService.getCooperative(id) }); } catch (e) { next(e); } }
async function drivers(req: Request, res: Response, next: NextFunction) { try { ok(res, await adminService.listDrivers(adminDriverQuerySchema.parse(req.query))); } catch (e) { next(e); } }
async function vehicles(req: Request, res: Response, next: NextFunction) { try { ok(res, await adminService.listVehicles(adminVehicleQuerySchema.parse(req.query))); } catch (e) { next(e); } }
async function alerts(_req: Request, res: Response, next: NextFunction) { try { ok(res, { alerts: await adminService.alerts() }); } catch (e) { next(e); } }
async function withdrawals(req: Request, res: Response, next: NextFunction) {
  try { ok(res, await adminService.listWithdrawals(adminWithdrawalQuerySchema.parse(req.query))); } catch (e) { next(e); }
}

export const adminController = { dashboard, orders, order, shipments, shipment, cooperatives, cooperative, drivers, vehicles, withdrawals, alerts };
