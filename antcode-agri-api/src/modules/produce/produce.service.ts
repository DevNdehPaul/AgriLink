import { Prisma } from "../../generated/prisma/client.js";
import { ListingStatus } from "../../generated/prisma/enums.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";

import type {
  CreateProduceInput,
  MyProduceQueryInput,
  ProduceQueryInput,
  UpdateProduceInput,
  UpdateProduceStatusInput,
} from "./produce.validation.js";

/**
 * Resolve the cooperative profile that belongs to the authenticated user.
 *
 * We intentionally resolve ownership from req.user.id rather than accepting a
 * cooperativeId from the client. This prevents a cooperative from creating or
 * modifying stock on behalf of another cooperative.
 */
async function getCooperativeForUser(userId: string) {
  const cooperative = await prisma.cooperativeProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      verificationStatus: true,
      name: true,
    },
  });

  if (!cooperative) {
    throw new AppError("Cooperative profile not found", 404);
  }

  return cooperative;
}

/**
 * Create a supply listing.
 *
 * New listings start as DRAFT. This prevents accidentally publishing an
 * incomplete listing before the cooperative deliberately activates it.
 *
 * reservedQuantityKg starts at zero and availableQuantityKg starts equal to
 * totalQuantityKg. Later, the Orders module will change these values inside a
 * database transaction when inventory is reserved/released.
 */
async function createProduce(userId: string, input: CreateProduceInput) {
  const cooperative = await getCooperativeForUser(userId);

  return prisma.produceListing.create({
    data: {
      cooperativeId: cooperative.id,
      name: input.name,
      description: input.description ?? null,
      pricePerKg: new Prisma.Decimal(input.pricePerKg),
      totalQuantityKg: new Prisma.Decimal(input.totalQuantityKg),
      availableQuantityKg: new Prisma.Decimal(input.totalQuantityKg),
      reservedQuantityKg: new Prisma.Decimal(0),
      harvestDate: input.harvestDate,
      originCity: input.originCity,
      pickupLocation: input.pickupLocation ?? null,
      status: ListingStatus.DRAFT,
    },
    include: {
      cooperative: {
        select: {
          id: true,
          name: true,
          city: true,
          verificationStatus: true,
        },
      },
    },
  });
}

/**
 * Public marketplace.
 *
 * Only ACTIVE listings with positive available stock are exposed. Internal
 * DRAFT/PAUSED/SOLD_OUT/EXPIRED records remain visible only to their owner.
 */
async function listMarketplace(query: ProduceQueryInput) {
  const where: Prisma.ProduceListingWhereInput = {
    status: ListingStatus.ACTIVE,
    availableQuantityKg: { gt: new Prisma.Decimal(0) },
  };

  if (query.name !== undefined) {
    where.name = {
      contains: query.name,
      mode: "insensitive",
    };
  }

  if (query.city !== undefined) {
    where.originCity = {
      contains: query.city,
      mode: "insensitive",
    };
  }

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    const priceFilter: Prisma.DecimalFilter<"ProduceListing"> = {};

    if (query.minPrice !== undefined) {
      priceFilter.gte = new Prisma.Decimal(query.minPrice);
    }

    if (query.maxPrice !== undefined) {
      priceFilter.lte = new Prisma.Decimal(query.maxPrice);
    }

    where.pricePerKg = priceFilter;
  }

  const orderBy: Prisma.ProduceListingOrderByWithRelationInput =
    query.sort === "price_asc"
      ? { pricePerKg: "asc" }
      : query.sort === "price_desc"
        ? { pricePerKg: "desc" }
        : query.sort === "harvest_asc"
          ? { harvestDate: "asc" }
          : query.sort === "harvest_desc"
            ? { harvestDate: "desc" }
            : { createdAt: "desc" };

  const items = await prisma.produceListing.findMany({
  where,
  orderBy,
  take: query.limit,
  skip: query.offset,
  include: {
    cooperative: {
      select: {
        id: true,
        name: true,
        city: true,
        region: true,
        verificationStatus: true,
      },
    },
  },
});

const total = await prisma.produceListing.count({
  where,
});

  return {
    items,
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

/** Return one public listing. Non-active listings are deliberately hidden. */
async function getProduceById(id: string) {
  const listing = await prisma.produceListing.findFirst({
    where: {
      id,
      status: ListingStatus.ACTIVE,
      availableQuantityKg: { gt: new Prisma.Decimal(0) },
    },
    include: {
      cooperative: {
        select: {
          id: true,
          name: true,
          city: true,
          region: true,
          locality: true,
          verificationStatus: true,
        },
      },
    },
  });

  if (!listing) {
    throw new AppError("Produce listing not found", 404);
  }

  return listing;
}

/** Cooperative inventory view, including unpublished and unavailable stock. */
async function listMyProduce(userId: string, query: MyProduceQueryInput) {
  const cooperative = await getCooperativeForUser(userId);

  const where: Prisma.ProduceListingWhereInput = {
    cooperativeId: cooperative.id,
  };

  if (query.status !== undefined) {
    where.status = query.status;
  }

  const [items, total] = await prisma.$transaction([
  prisma.produceListing.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: query.limit,
    skip: query.offset,
  }),
  prisma.produceListing.count({ where }),
]);
  return {
    items,
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

/**
 * Update a cooperative-owned listing.
 *
 * Inventory invariant:
 *   total = available + reserved
 *
 * A cooperative may change totalQuantityKg, but it may NEVER reduce total
 * below stock that is already reserved by buyers. Available quantity is
 * recalculated instead of trusting a client-supplied inventory value.
 */
async function updateProduce(
  userId: string,
  id: string,
  input: UpdateProduceInput,
) {
  const cooperative = await getCooperativeForUser(userId);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.produceListing.findFirst({
      where: {
        id,
        cooperativeId: cooperative.id,
      },
    });

    if (!existing) {
      throw new AppError("Produce listing not found", 404);
    }

    let totalQuantityKg: Prisma.Decimal | undefined;
    let availableQuantityKg: Prisma.Decimal | undefined;

    if (input.totalQuantityKg !== undefined) {
      totalQuantityKg = new Prisma.Decimal(input.totalQuantityKg);

      if (totalQuantityKg.lessThan(existing.reservedQuantityKg)) {
        throw new AppError(
          "Total quantity cannot be lower than the quantity already reserved",
          409,
        );
      }

      availableQuantityKg = totalQuantityKg.minus(
        existing.reservedQuantityKg,
      );
    }

    const updated = await tx.produceListing.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.pricePerKg !== undefined
          ? { pricePerKg: new Prisma.Decimal(input.pricePerKg) }
          : {}),
        ...(totalQuantityKg !== undefined ? { totalQuantityKg } : {}),
        ...(availableQuantityKg !== undefined ? { availableQuantityKg } : {}),
        ...(input.harvestDate !== undefined
          ? { harvestDate: input.harvestDate }
          : {}),
        ...(input.originCity !== undefined
          ? { originCity: input.originCity }
          : {}),
        ...(input.pickupLocation !== undefined
          ? { pickupLocation: input.pickupLocation }
          : {}),
      },
    });

    // Keep status aligned with inventory. A zero-available listing should not
    // remain advertised as ACTIVE.
    if (
      updated.availableQuantityKg.lessThanOrEqualTo(0) &&
      updated.status === ListingStatus.ACTIVE
    ) {
      return tx.produceListing.update({
        where: { id: updated.id },
        data: { status: ListingStatus.SOLD_OUT },
      });
    }

    return updated;
  });
}

/**
 * Change publication status.
 *
 * SOLD_OUT is system-derived from inventory and should not be used as a manual
 * "pause" button. A cooperative can explicitly use PAUSED instead.
 */
async function updateProduceStatus(
  userId: string,
  id: string,
  input: UpdateProduceStatusInput,
) {
  const cooperative = await getCooperativeForUser(userId);

  const existing = await prisma.produceListing.findFirst({
    where: {
      id,
      cooperativeId: cooperative.id,
    },
  });

  if (!existing) {
    throw new AppError("Produce listing not found", 404);
  }

  if (
    input.status === ListingStatus.ACTIVE &&
    existing.availableQuantityKg.lessThanOrEqualTo(0)
  ) {
    throw new AppError(
      "A listing with no available stock cannot be activated",
      409,
    );
  }

  return prisma.produceListing.update({
    where: { id: existing.id },
    data: { status: input.status },
  });
}

/**
 * Safe removal for the sprint MVP.
 *
 * We do NOT physically delete the database row because it may later be needed
 * by orders, audit trails and dispute resolution. DELETE therefore performs a
 * soft operational removal by moving the listing to PAUSED.
 */
async function removeProduce(userId: string, id: string) {
  const cooperative = await getCooperativeForUser(userId);

  const existing = await prisma.produceListing.findFirst({
    where: {
      id,
      cooperativeId: cooperative.id,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!existing) {
    throw new AppError("Produce listing not found", 404);
  }

  if (existing.status === ListingStatus.PAUSED) {
    return prisma.produceListing.findUniqueOrThrow({
      where: { id: existing.id },
    });
  }

  return prisma.produceListing.update({
    where: { id: existing.id },
    data: { status: ListingStatus.PAUSED },
  });
}

export const produceService = {
  createProduce,
  listMarketplace,
  getProduceById,
  listMyProduce,
  updateProduce,
  updateProduceStatus,
  removeProduce,
};
