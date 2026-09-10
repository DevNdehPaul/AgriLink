import crypto from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import {
  DepositStatus,
  WithdrawalStatus,
  UserRole,
  VerificationStatus,
  WalletEntryDirection,
  WalletEntryType,
} from "../../generated/prisma/enums.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import { fapshiClient } from "../../integrations/fapshi/fapshi.client.js";
import type { DirectPayDepositInput, WithdrawalInput } from "./wallet.validation.js";

function externalDepositId(): string {
  return `DEP_${Date.now().toString(36).toUpperCase()}_${crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
}

async function getOrCreateWallet(userId: string) {
  return prisma.wallet.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

async function getWallet(userId: string, limit = 20, offset = 0) {
  const wallet = await getOrCreateWallet(userId);

  const entries = await prisma.walletLedgerEntry.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  const total = await prisma.walletLedgerEntry.count({
    where: { walletId: wallet.id },
  });

  return { wallet, entries, total, limit, offset };
}

/**
 * Creates our local deposit record BEFORE calling Fapshi.
 *
 * This means every provider request has a stable reconciliation externalId.
 * A provider/network failure therefore remains visible in our own database
 * instead of becoming an untraceable payment attempt.
 */
async function requestDirectPayDeposit(
  userId: string,
  input: DirectPayDepositInput,
) {
  await getOrCreateWallet(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, fullName: true, email: true },
  });

  if (!user) throw new AppError("User not found", 404);

  const externalId = externalDepositId();

  const deposit = await prisma.walletDeposit.create({
    data: {
      userId,
      amount: new Prisma.Decimal(input.amount),
      phone: input.phone,
      medium: input.medium ?? null,
      externalId,
      status: DepositStatus.CREATED,
    },
  });

  try {
    const provider = await fapshiClient.directPay({
      amount: input.amount,
      phone: input.phone,
      ...(input.medium !== undefined ? { medium: input.medium } : {}),
      name: user.fullName,
      ...(user.email !== null ? { email: user.email } : {}),
      userId: user.id,
      externalId,
      message: "AntCode Agri wallet deposit",
    });

    return prisma.walletDeposit.update({
      where: { id: deposit.id },
      data: {
        providerTransactionId: provider.transId,
        status: DepositStatus.PENDING,
      },
    });
  } catch (error) {
    await prisma.walletDeposit.update({
      where: { id: deposit.id },
      data: { status: DepositStatus.FAILED },
    });

    throw error;
  }
}

/**
 * Provider verification is authoritative.
 *
 * We never credit a wallet because the browser says "payment successful".
 * The backend asks Fapshi for the transaction and verifies:
 *   - provider transId
 *   - externalId
 *   - our userId
 *   - amount
 *   - SUCCESSFUL status
 *
 * `creditedAt` plus the transaction itself make repeated sync requests
 * idempotent: one successful provider transaction can credit the wallet once.
 */
async function syncDeposit(userId: string, depositId: string) {
  const deposit = await prisma.walletDeposit.findFirst({
    where: { id: depositId, userId },
  });

  if (!deposit) throw new AppError("Deposit not found", 404);
  if (!deposit.providerTransactionId) {
    throw new AppError("Deposit has no provider transaction to verify", 409);
  }

  // Already credited: return safely without adding money again.
  if (deposit.creditedAt !== null) return deposit;

  const provider = await fapshiClient.getPaymentStatus(
    deposit.providerTransactionId,
  );

  if (provider.transId !== deposit.providerTransactionId) {
    throw new AppError("Payment provider transaction mismatch", 409);
  }

  if (provider.externalId !== deposit.externalId) {
    throw new AppError("Payment reconciliation reference mismatch", 409);
  }

  if (provider.userId !== userId) {
    throw new AppError("Payment user reference mismatch", 409);
  }

  if (
    new Prisma.Decimal(provider.amount).comparedTo(deposit.amount) !== 0
  ) {
    throw new AppError("Payment amount mismatch", 409);
  }

  if (provider.status === "FAILED" || provider.status === "EXPIRED") {
    return prisma.walletDeposit.update({
      where: { id: deposit.id },
      data: { status: DepositStatus.FAILED },
    });
  }

  if (provider.status !== "SUCCESSFUL") {
    return prisma.walletDeposit.update({
      where: { id: deposit.id },
      data: { status: DepositStatus.PENDING },
    });
  }

  return prisma.$transaction(
    async (tx) => {
      // Re-read inside the transaction. Concurrent sync calls may both have
      // observed creditedAt=null before entering this transaction.
      const current = await tx.walletDeposit.findUniqueOrThrow({
        where: { id: deposit.id },
      });

      if (current.creditedAt !== null) return current;

      const wallet = await tx.wallet.upsert({
        where: { userId },
        update: {},
        create: { userId },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { increment: current.amount },
        },
      });

      await tx.walletLedgerEntry.create({
        data: {
          walletId: wallet.id,
          type: WalletEntryType.DEPOSIT,
          direction: WalletEntryDirection.CREDIT,
          amount: current.amount,
          reference: current.providerTransactionId,
          description: "Fapshi Direct Pay wallet deposit",
        },
      });

      return tx.walletDeposit.update({
        where: { id: current.id },
        data: {
          status: DepositStatus.SUCCESSFUL,
          creditedAt: new Date(),
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function listDeposits(userId: string, limit: number, offset: number) {
  const [items, total] = await Promise.all([
    prisma.walletDeposit.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.walletDeposit.count({ where: { userId } }),
  ]);

  return { items, total, limit, offset };
}


function externalWithdrawalId(): string {
  return `WDR_${Date.now().toString(36).toUpperCase()}_${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

/**
 * Reserve cooperative funds before contacting the payout provider.
 * This prevents two concurrent requests from spending the same balance.
 * The debit ledger entry is created at reservation time because the amount
 * immediately stops being spendable in the platform wallet.
 */
async function requestWithdrawal(userId: string, input: WithdrawalInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true, fullName: true, email: true, cooperativeProfile: { select: { verificationStatus: true } } },
  });
  if (!user) throw new AppError("User not found", 404);
  if (user.role !== UserRole.COOPERATIVE) throw new AppError("Only cooperatives can withdraw settlement funds", 403);
  if (user.status !== "ACTIVE") throw new AppError("Cooperative account must be active to withdraw", 403);
  if (user.cooperativeProfile?.verificationStatus !== VerificationStatus.VERIFIED) {
    throw new AppError("Cooperative must be verified before withdrawing settlement funds", 403);
  }

  const amount = new Prisma.Decimal(input.amount);
  const externalId = externalWithdrawalId();

  const withdrawal = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({ where: { userId }, update: {}, create: { userId } });

    // Conditional update is the concurrency guard: only one concurrent request
    // can reserve funds if both would exceed the available balance.
    const reserved = await tx.wallet.updateMany({
      where: { id: wallet.id, availableBalance: { gte: amount } },
      data: { availableBalance: { decrement: amount } },
    });
    if (reserved.count !== 1) throw new AppError("Insufficient available wallet balance", 409);

    const created = await tx.walletWithdrawal.create({
      data: {
        userId, walletId: wallet.id, amount, phone: input.phone,
        medium: input.medium ?? null, externalId, status: WithdrawalStatus.PROCESSING,
      },
    });

    await tx.walletLedgerEntry.create({
      data: {
        walletId: wallet.id, type: WalletEntryType.WITHDRAWAL,
        direction: WalletEntryDirection.DEBIT, amount,
        reference: externalId,
        description: "Cooperative mobile-money withdrawal reserved for Fapshi payout",
      },
    });
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 });

  try {
    const provider = await fapshiClient.payout({
      amount: input.amount, phone: input.phone,
      ...(input.medium !== undefined ? { medium: input.medium } : {}),
      name: user.fullName,
      ...(user.email !== null ? { email: user.email } : {}),
      userId: user.id, externalId,
      message: "AntCode Agri cooperative settlement withdrawal",
    });
    return prisma.walletWithdrawal.update({
      where: { id: withdrawal.id },
      data: { providerTransactionId: provider.transId },
    });
  } catch (error) {
    // Do NOT automatically restore funds here. A timeout can occur after the
    // provider accepted a payout, so refunding immediately could create a
    // double-spend. Operations can reconcile REVIEW_REQUIRED safely.
    await prisma.walletWithdrawal.update({
      where: { id: withdrawal.id },
      data: { status: WithdrawalStatus.REVIEW_REQUIRED },
    });
    throw error;
  }
}

/** Provider status is authoritative; terminal transitions are idempotent. */
async function syncWithdrawal(userId: string, withdrawalId: string) {
  const withdrawal = await prisma.walletWithdrawal.findFirst({ where: { id: withdrawalId, userId } });
  if (!withdrawal) throw new AppError("Withdrawal not found", 404);
  if (withdrawal.status === WithdrawalStatus.SUCCESSFUL || withdrawal.status === WithdrawalStatus.FAILED) return withdrawal;
  if (!withdrawal.providerTransactionId) throw new AppError("Withdrawal requires manual reconciliation because no provider transaction id is available", 409);

  const provider = await fapshiClient.getPayoutStatus(withdrawal.providerTransactionId);
  if (provider.transId !== withdrawal.providerTransactionId) throw new AppError("Payout provider transaction mismatch", 409);
  if (provider.externalId !== withdrawal.externalId) throw new AppError("Payout reconciliation reference mismatch", 409);
  if (provider.userId !== userId) throw new AppError("Payout user reference mismatch", 409);
  if (new Prisma.Decimal(provider.amount).comparedTo(withdrawal.amount) !== 0) throw new AppError("Payout amount mismatch", 409);

  if (provider.status === "SUCCESSFUL") {
    return prisma.walletWithdrawal.update({
      where: { id: withdrawal.id },
      data: { status: WithdrawalStatus.SUCCESSFUL, successfulAt: new Date() },
    });
  }

  if (provider.status === "FAILED" || provider.status === "EXPIRED") {
    return prisma.$transaction(async (tx) => {
      const current = await tx.walletWithdrawal.findUniqueOrThrow({ where: { id: withdrawal.id } });
      if (current.status === WithdrawalStatus.FAILED && current.refundedAt !== null) return current;
      if (current.status === WithdrawalStatus.SUCCESSFUL) return current;

      await tx.wallet.update({ where: { id: current.walletId }, data: { availableBalance: { increment: current.amount } } });
      await tx.walletLedgerEntry.create({
        data: {
          walletId: current.walletId, type: WalletEntryType.REFUND,
          direction: WalletEntryDirection.CREDIT, amount: current.amount,
          reference: current.providerTransactionId,
          description: "Failed Fapshi payout returned to cooperative wallet",
        },
      });
      return tx.walletWithdrawal.update({
        where: { id: current.id },
        data: { status: WithdrawalStatus.FAILED, refundedAt: new Date() },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 });
  }

  return prisma.walletWithdrawal.update({
    where: { id: withdrawal.id },
    data: { status: WithdrawalStatus.PROCESSING },
  });
}

async function listWithdrawals(userId: string, limit: number, offset: number) {
  const [items, total] = await Promise.all([
    prisma.walletWithdrawal.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit, skip: offset }),
    prisma.walletWithdrawal.count({ where: { userId } }),
  ]);
  return { items, total, limit, offset };
}

export const walletService = { getWallet, requestDirectPayDeposit, syncDeposit, listDeposits, requestWithdrawal, syncWithdrawal, listWithdrawals };
