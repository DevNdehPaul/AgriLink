import { AppError } from "../../common/errors/app-error.js";
import { prisma } from "../../config/prisma.js";
import { DisputeStatus, OrderStatus, PaymentHoldStatus, ShipmentStatus, TransportLoadStatus, UserRole, VerificationStatus } from "../../generated/prisma/enums.js";
import type { AdminCooperativeQuery, AdminDriverQuery, AdminOrderQuery, AdminShipmentQuery, AdminVehicleQuery, AdminWithdrawalQuery } from "./admin.validation.js";

const paging = (page: number, limit: number, total: number) => ({ page, limit, total, totalPages: Math.ceil(total / limit) });

async function dashboard() {
  // Sequential reads are intentional: Neon has previously been more reliable for this project
  // than wrapping dashboard-only reads in an interactive transaction.
  const users = await prisma.user.groupBy({ by: ["role"], _count: { _all: true } });
  const cooperatives = await prisma.cooperativeProfile.count();
  const verifiedCooperatives = await prisma.cooperativeProfile.count({ where: { verificationStatus: VerificationStatus.VERIFIED } });
  const drivers = await prisma.driverProfile.count();
  const availableDrivers = await prisma.driverProfile.count({ where: { isAvailable: true, verificationStatus: VerificationStatus.VERIFIED } });
  const listings = await prisma.produceListing.count();
  const orders = await prisma.order.count();
  const completedOrders = await prisma.order.count({ where: { status: OrderStatus.COMPLETED } });
  const shipments = await prisma.shipment.count();
  const activeShipments = await prisma.shipment.count({ where: { status: { in: [ShipmentStatus.ASSIGNED, ShipmentStatus.PICKED_UP, ShipmentStatus.IN_TRANSIT, ShipmentStatus.DELIVERY_REPORTED] } } });
  const openDisputes = await prisma.dispute.count({ where: { status: DisputeStatus.OPEN } });
  const activeLoads = await prisma.transportLoad.count({ where: { status: { in: [TransportLoadStatus.ASSIGNED, TransportLoadStatus.IN_TRANSIT] } } });
  const activeHolds = await prisma.paymentHold.aggregate({ where: { status: PaymentHoldStatus.ACTIVE }, _count: { _all: true }, _sum: { amount: true } });
  const completedVolume = await prisma.order.aggregate({ where: { status: OrderStatus.COMPLETED }, _sum: { totalAmount: true } });
  const vehicles = await prisma.vehicle.count();
  const availableVehicles = await prisma.vehicle.count({ where: { isAvailable: true, status: "ACTIVE" } });
  const roleCounts = Object.fromEntries(users.map((row) => [row.role, row._count._all]));
  return { users: { total: Object.values(roleCounts).reduce((a, b) => a + b, 0), byRole: roleCounts }, cooperatives: { total: cooperatives, verified: verifiedCooperatives }, drivers: { total: drivers, verifiedAvailable: availableDrivers }, vehicles: { total: vehicles, available: availableVehicles }, listings: { total: listings }, orders: { total: orders, completed: completedOrders, completedVolumeXaf: completedVolume._sum.totalAmount ?? 0 }, shipments: { total: shipments, active: activeShipments }, disputes: { open: openDisputes }, transportLoads: { active: activeLoads }, protectedFunds: { activeHolds: activeHolds._count._all, heldAmountXaf: activeHolds._sum.amount ?? 0 } };
}

async function listOrders(q: AdminOrderQuery) {
  const where = { ...(q.status ? { status: q.status } : {}), ...(q.search ? { OR: [{ orderNumber: { contains: q.search, mode: "insensitive" as const } }, { deliveryCity: { contains: q.search, mode: "insensitive" as const } }, { cooperative: { name: { contains: q.search, mode: "insensitive" as const } } }] } : {}) };
  const total = await prisma.order.count({ where });
  const orders = await prisma.order.findMany({ where, skip: (q.page - 1) * q.limit, take: q.limit, orderBy: { createdAt: "desc" }, include: { buyer: { include: { user: { select: { fullName: true, phone: true, email: true } } } }, cooperative: { include: { user: { select: { phone: true, email: true } } } }, paymentHold: true, shipment: { select: { id: true, shipmentNumber: true, status: true, transportLoadId: true } }, dispute: { select: { id: true, status: true, resolution: true } } } });
  return { orders, pagination: paging(q.page, q.limit, total) };
}
async function getOrder(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },

    include: {
      // Buyer account attached to the order.
      buyer: {
        include: {
          user: {
            select: {
              fullName: true,
              phone: true,
              email: true,
              status: true,
            },
          },
        },
      },

      // Cooperative fulfilling the order.
      // Wallet information is useful for admin settlement visibility.
      cooperative: {
        include: {
          user: {
            select: {
              fullName: true,
              phone: true,
              email: true,
              status: true,
              wallet: true,
            },
          },
        },
      },

      // Products/produce contained in the order.
      items: {
        include: {
          listing: true,
        },
      },

      // Inventory reservations created for this order.
      reservations: true,

      // Escrow-style wallet hold associated with the order.
      paymentHold: true,

      // Dispute information, when one exists.
      dispute: true,

      // Shipment and its complete operational context.
      shipment: {
        include: {
          vehicle: true,

          driver: {
            include: {
              user: {
                select: {
                  fullName: true,
                  phone: true,
                },
              },
            },
          },

          transportLoad: true,

          events: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  return order;
}

async function listShipments(q: AdminShipmentQuery) { const where = { ...(q.status ? { status: q.status } : {}), ...(q.search ? { OR: [{ shipmentNumber: { contains: q.search, mode: "insensitive" as const } }, { pickupCity: { contains: q.search, mode: "insensitive" as const } }, { deliveryCity: { contains: q.search, mode: "insensitive" as const } }] } : {}) }; const total = await prisma.shipment.count({ where }); const shipments = await prisma.shipment.findMany({ where, skip: (q.page - 1) * q.limit, take: q.limit, orderBy: { createdAt: "desc" }, include: { order: { select: { orderNumber: true, status: true, totalAmount: true } }, vehicle: true, driver: { include: { user: { select: { fullName: true, phone: true } } } }, transportLoad: { select: { id: true, loadNumber: true, status: true } } } }); return { shipments, pagination: paging(q.page, q.limit, total) }; }
async function getShipment(id: string) { const shipment = await prisma.shipment.findUnique({ where: { id }, include: { order: { include: { buyer: { include: { user: { select: { fullName: true, phone: true, email: true } } } }, cooperative: true, paymentHold: true, dispute: true } }, vehicle: true, driver: { include: { user: { select: { fullName: true, phone: true, email: true } } } }, transportLoad: true, events: { orderBy: { createdAt: "asc" } } } }); if (!shipment) throw new AppError("Shipment not found", 404); return shipment; }

async function listCooperatives(q: AdminCooperativeQuery) { const where = { ...(q.verificationStatus ? { verificationStatus: q.verificationStatus } : {}), ...(q.city ? { city: { equals: q.city, mode: "insensitive" as const } } : {}), ...(q.search ? { OR: [{ name: { contains: q.search, mode: "insensitive" as const } }, { city: { contains: q.search, mode: "insensitive" as const } }, { user: { fullName: { contains: q.search, mode: "insensitive" as const } } }] } : {}) }; const total = await prisma.cooperativeProfile.count({ where }); const cooperatives = await prisma.cooperativeProfile.findMany({ where, skip: (q.page - 1) * q.limit, take: q.limit, orderBy: { createdAt: "desc" }, include: { user: { select: { fullName: true, phone: true, email: true, status: true, wallet: true } }, _count: { select: { listings: true, orders: true } } } }); return { cooperatives, pagination: paging(q.page, q.limit, total) }; }
async function getCooperative(id: string) { const cooperative = await prisma.cooperativeProfile.findUnique({ where: { id }, include: { user: { select: { fullName: true, phone: true, email: true, status: true, wallet: { include: { entries: { take: 20, orderBy: { createdAt: "desc" } } } } } }, listings: { orderBy: { createdAt: "desc" } }, orders: { take: 20, orderBy: { createdAt: "desc" }, include: { paymentHold: true, shipment: { select: { shipmentNumber: true, status: true } } } } } }); if (!cooperative) throw new AppError("Cooperative not found", 404); return cooperative; }

async function listDrivers(q: AdminDriverQuery) { const where = { ...(q.verificationStatus ? { verificationStatus: q.verificationStatus } : {}), ...(q.isAvailable !== undefined ? { isAvailable: q.isAvailable } : {}), ...(q.city ? { city: { equals: q.city, mode: "insensitive" as const } } : {}), ...(q.search ? { OR: [{ licenseNumber: { contains: q.search, mode: "insensitive" as const } }, { user: { fullName: { contains: q.search, mode: "insensitive" as const } } }] } : {}) }; const total = await prisma.driverProfile.count({ where }); const drivers = await prisma.driverProfile.findMany({ where, skip: (q.page - 1) * q.limit, take: q.limit, orderBy: { createdAt: "desc" }, include: { user: { select: { fullName: true, phone: true, email: true, status: true } }, vehicles: true, _count: { select: { shipments: true, transportLoads: true } } } }); return { drivers, pagination: paging(q.page, q.limit, total) }; }
async function listVehicles(q: AdminVehicleQuery) { const where = { ...(q.status ? { status: q.status } : {}), ...(q.isAvailable !== undefined ? { isAvailable: q.isAvailable } : {}), ...(q.city ? { currentCity: { equals: q.city, mode: "insensitive" as const } } : {}), ...(q.search ? { OR: [{ registrationNo: { contains: q.search, mode: "insensitive" as const } }, { currentCity: { contains: q.search, mode: "insensitive" as const } }] } : {}) }; const total = await prisma.vehicle.count({ where }); const vehicles = await prisma.vehicle.findMany({ where, skip: (q.page - 1) * q.limit, take: q.limit, orderBy: { createdAt: "desc" }, include: { driver: { include: { user: { select: { fullName: true, phone: true, status: true } } } }, _count: { select: { shipments: true, transportLoads: true } } } }); return { vehicles, pagination: paging(q.page, q.limit, total) }; }

async function alerts() {
  const unassignedShipments = await prisma.shipment.findMany({ where: { status: ShipmentStatus.AWAITING_ASSIGNMENT }, take: 20, orderBy: { createdAt: "asc" }, select: { id: true, shipmentNumber: true, pickupCity: true, deliveryCity: true, loadWeightKg: true, createdAt: true } });
  const awaitingBuyerConfirmation = await prisma.shipment.findMany({ where: { status: ShipmentStatus.DELIVERY_REPORTED }, take: 20, orderBy: { deliveryReportedAt: "asc" }, select: { id: true, shipmentNumber: true, deliveryReportedAt: true, order: { select: { id: true, orderNumber: true, totalAmount: true } } } });
  const openDisputes = await prisma.dispute.findMany({ where: { status: DisputeStatus.OPEN }, take: 20, orderBy: { createdAt: "asc" }, include: { order: { select: { orderNumber: true, totalAmount: true } }, openedBy: { select: { fullName: true, phone: true } } } });
  const pendingCooperatives = await prisma.cooperativeProfile.findMany({ where: { verificationStatus: VerificationStatus.PENDING }, take: 20, orderBy: { createdAt: "asc" }, select: { id: true, name: true, city: true, createdAt: true } });
  const pendingDrivers = await prisma.driverProfile.findMany({ where: { verificationStatus: VerificationStatus.PENDING }, take: 20, orderBy: { createdAt: "asc" }, include: { user: { select: { fullName: true, phone: true } } } });
  return { counts: { unassignedShipments: unassignedShipments.length, awaitingBuyerConfirmation: awaitingBuyerConfirmation.length, openDisputes: openDisputes.length, pendingCooperatives: pendingCooperatives.length, pendingDrivers: pendingDrivers.length }, unassignedShipments, awaitingBuyerConfirmation, openDisputes, pendingCooperatives, pendingDrivers };
}

async function listWithdrawals(q: AdminWithdrawalQuery) {
  const where = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.search ? { OR: [
      { externalId: { contains: q.search, mode: "insensitive" as const } },
      { providerTransactionId: { contains: q.search, mode: "insensitive" as const } },
      { phone: { contains: q.search, mode: "insensitive" as const } },
      { user: { fullName: { contains: q.search, mode: "insensitive" as const } } },
    ] } : {}),
  };
  const total = await prisma.walletWithdrawal.count({ where });
  const withdrawals = await prisma.walletWithdrawal.findMany({
    where, skip: (q.page - 1) * q.limit, take: q.limit, orderBy: { createdAt: "desc" },
    include: { user: { select: { fullName: true, phone: true, email: true, status: true, cooperativeProfile: { select: { id: true, name: true, verificationStatus: true } } } } },
  });
  return { withdrawals, pagination: paging(q.page, q.limit, total) };
}

export const adminService = { dashboard, listOrders, getOrder, listShipments, getShipment, listCooperatives, getCooperative, listDrivers, listVehicles, listWithdrawals, alerts };
