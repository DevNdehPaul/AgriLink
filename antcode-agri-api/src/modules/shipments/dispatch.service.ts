import { ShipmentStatus, UserStatus, VehicleStatus, VerificationStatus } from "../../generated/prisma/enums.js";
import { AppError } from "../../common/errors/app-error.js";
import { prisma } from "../../config/prisma.js";

/**
 * Smart Dispatch is deliberately a transparent rules engine rather than an
 * opaque ML model. In a 48-hour MVP this is easier to audit, explain and
 * override, while still solving the real allocation problem.
 */
const MAX_SCORE = 100;

type UrgencyBand = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

function normalizeCity(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

function harvestAgeHours(harvestDate: Date): number {
  return Math.max(0, (Date.now() - harvestDate.getTime()) / 3_600_000);
}

/**
 * Produce urgency is intentionally explainable. Fresh vegetables/fruit get a
 * shorter dispatch window; roots/dry produce get a longer one. Unknown produce
 * receives a conservative medium window rather than pretending we know more.
 */
function perishabilityWindowHours(name: string): number {
  const produce = name.toLocaleLowerCase();
  const critical = ["tomato", "strawberry", "lettuce", "spinach", "leaf", "berry"];
  const high = ["banana", "plantain", "mango", "papaya", "pineapple", "pepper", "okra"];
  const medium = ["potato", "cassava", "yam", "carrot", "onion", "ginger"];

  if (critical.some((term) => produce.includes(term))) return 72;
  if (high.some((term) => produce.includes(term))) return 120;
  if (medium.some((term) => produce.includes(term))) return 240;
  return 168;
}

function urgencyFor(name: string, harvestDate: Date): { band: UrgencyBand; score: number; ageHours: number; windowHours: number } {
  const ageHours = harvestAgeHours(harvestDate);
  const windowHours = perishabilityWindowHours(name);
  const ratio = ageHours / windowHours;

  if (ratio >= 0.75) return { band: "CRITICAL", score: 20, ageHours, windowHours };
  if (ratio >= 0.5) return { band: "HIGH", score: 15, ageHours, windowHours };
  if (ratio >= 0.25) return { band: "MEDIUM", score: 10, ageHours, windowHours };
  return { band: "LOW", score: 5, ageHours, windowHours };
}

/**
 * Returns ranked eligible vehicles for an unassigned shipment.
 *
 * Hard filters (not scores): active vehicle, available vehicle, active +
 * verified + available driver, and enough payload capacity. These conditions
 * must never be traded away for a higher score.
 *
 * Score (100):
 * - 35 capacity utilisation: prefer the smallest vehicle that safely fits.
 * - 30 pickup proximity: same-city vehicles avoid unnecessary repositioning.
 * - 20 perishability urgency: makes the agricultural context visible.
 * - 15 route familiarity: driver/vehicle already operating at pickup city.
 */
async function recommendVehicles(shipmentId: string) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      order: {
        include: {
          items: { include: { listing: true } },
        },
      },
    },
  });

  if (!shipment) throw new AppError("Shipment not found", 404);
  if (shipment.status !== ShipmentStatus.AWAITING_ASSIGNMENT) {
    throw new AppError("Smart dispatch is only available for shipments awaiting assignment", 409);
  }

  const vehicles = await prisma.vehicle.findMany({
    where: {
      status: VehicleStatus.ACTIVE,
      isAvailable: true,
      capacityKg: { gte: shipment.loadWeightKg },
      driver: {
        is: {
          isAvailable: true,
          verificationStatus: VerificationStatus.VERIFIED,
          user: { is: { status: UserStatus.ACTIVE } },
        },
      },
    },
    include: {
      driver: { include: { user: { select: { fullName: true, phone: true, status: true } } } },
    },
  });

  const produceSignals = shipment.order.items.map((item) => ({
    name: item.produceName,
    ...urgencyFor(item.produceName, item.listing.harvestDate),
  }));
  const highestUrgency = produceSignals.reduce(
    (best, current) => current.score > best.score ? current : best,
    produceSignals[0] ?? { name: "Unknown produce", band: "LOW" as const, score: 5, ageHours: 0, windowHours: 168 },
  );

  const pickupCity = normalizeCity(shipment.pickupCity);

  const candidates = vehicles.map((vehicle) => {
    const capacity = Number(vehicle.capacityKg);
    const load = Number(shipment.loadWeightKg);
    const utilisationPercent = capacity > 0 ? (load / capacity) * 100 : 0;

    // 35 points: full utilisation scores best, while an oversized truck still
    // remains eligible. This is especially useful when pooling is added later.
    const capacityScore = Math.max(5, Math.min(35, Math.round((utilisationPercent / 100) * 35)));

    const vehicleAtPickup = normalizeCity(vehicle.currentCity) === pickupCity;
    const driverAtPickup = normalizeCity(vehicle.driver.city) === pickupCity;
    const proximityScore = vehicleAtPickup ? 30 : driverAtPickup ? 20 : 8;
    const routeScore = vehicleAtPickup && driverAtPickup ? 15 : vehicleAtPickup || driverAtPickup ? 10 : 4;
    const perishabilityScore = highestUrgency.score;
    const totalScore = Math.min(MAX_SCORE, capacityScore + proximityScore + routeScore + perishabilityScore);

    const reasons = [
      `${vehicle.registrationNo} can carry ${capacity.toFixed(0)} kg for this ${load.toFixed(0)} kg load (${utilisationPercent.toFixed(1)}% utilisation).`,
      vehicleAtPickup
        ? `Vehicle is already in ${shipment.pickupCity}, reducing repositioning delay.`
        : `Vehicle is currently in ${vehicle.currentCity ?? "an unknown city"}; pickup is ${shipment.pickupCity}.`,
      `${highestUrgency.name} dispatch urgency is ${highestUrgency.band} (${highestUrgency.ageHours.toFixed(1)} hours since harvest; ${highestUrgency.windowHours}h rule window).`,
      driverAtPickup
        ? `Driver is operating from ${shipment.pickupCity}.`
        : `Driver's recorded city is ${vehicle.driver.city ?? "unknown"}.`,
    ];

    return {
      vehicleId: vehicle.id,
      registrationNo: vehicle.registrationNo,
      vehicleType: vehicle.type,
      capacityKg: vehicle.capacityKg,
      currentCity: vehicle.currentCity,
      driver: {
        id: vehicle.driver.id,
        fullName: vehicle.driver.user.fullName,
        phone: vehicle.driver.user.phone,
        city: vehicle.driver.city,
      },
      score: totalScore,
      scoreBreakdown: {
        capacityUtilisation: { score: capacityScore, max: 35, utilisationPercent: Number(utilisationPercent.toFixed(1)) },
        pickupProximity: { score: proximityScore, max: 30 },
        perishabilityUrgency: { score: perishabilityScore, max: 20, band: highestUrgency.band },
        routeFamiliarity: { score: routeScore, max: 15 },
      },
      reasons,
    };
  }).sort((a, b) => b.score - a.score || Number(a.capacityKg) - Number(b.capacityKg));

  return {
    shipment: {
      id: shipment.id,
      shipmentNumber: shipment.shipmentNumber,
      pickupCity: shipment.pickupCity,
      deliveryCity: shipment.deliveryCity,
      loadWeightKg: shipment.loadWeightKg,
    },
    perishability: {
      highestUrgency,
      produce: produceSignals,
      note: "Perishability is a transparent rules-based dispatch signal, not an ML prediction.",
    },
    candidateCount: candidates.length,
    recommendedVehicleId: candidates[0]?.vehicleId ?? null,
    candidates,
  };
}

export const dispatchService = { recommendVehicles };
