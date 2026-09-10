import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../common/errors/app-error.js";
import { walletService } from "./wallet.service.js";
import {
  depositIdSchema,
  directPayDepositSchema,
  walletHistoryQuerySchema,
  withdrawalSchema,
  withdrawalIdSchema,
} from "./wallet.validation.js";

function authenticatedUserId(req: Request): string {
  if (!req.user) throw new AppError("Authentication is required", 401);
  return req.user.id;
}

async function getWallet(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = authenticatedUserId(req);
    const query = walletHistoryQuerySchema.parse(req.query);
    const result = await walletService.getWallet(
      userId,
      query.limit,
      query.offset,
    );

    res.status(200).json({
      success: true,
      message: "Wallet retrieved successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function requestDeposit(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = authenticatedUserId(req);
    const input = directPayDepositSchema.parse(req.body);
    const deposit = await walletService.requestDirectPayDeposit(userId, input);

    res.status(201).json({
      success: true,
      message: "Direct Pay request sent. Approve the payment on your phone.",
      data: { deposit },
    });
  } catch (error) {
    next(error);
  }
}

async function syncDeposit(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = authenticatedUserId(req);
    const { id } = depositIdSchema.parse(req.params);
    const deposit = await walletService.syncDeposit(userId, id);

    res.status(200).json({
      success: true,
      message: "Deposit status synchronized with Fapshi.",
      data: { deposit },
    });
  } catch (error) {
    next(error);
  }
}

async function listDeposits(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = authenticatedUserId(req);
    const query = walletHistoryQuerySchema.parse(req.query);
    const result = await walletService.listDeposits(
      userId,
      query.limit,
      query.offset,
    );

    res.status(200).json({
      success: true,
      message: "Deposits retrieved successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function requestWithdrawal(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = authenticatedUserId(req);
    const input = withdrawalSchema.parse(req.body);
    const withdrawal = await walletService.requestWithdrawal(userId, input);
    res.status(201).json({ success: true, message: "Withdrawal reserved and payout submitted to Fapshi.", data: { withdrawal } });
  } catch (error) { next(error); }
}

async function syncWithdrawal(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = authenticatedUserId(req);
    const { id } = withdrawalIdSchema.parse(req.params);
    const withdrawal = await walletService.syncWithdrawal(userId, id);
    res.status(200).json({ success: true, message: "Withdrawal status synchronized with Fapshi.", data: { withdrawal } });
  } catch (error) { next(error); }
}

async function listWithdrawals(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = authenticatedUserId(req);
    const query = walletHistoryQuerySchema.parse(req.query);
    const result = await walletService.listWithdrawals(userId, query.limit, query.offset);
    res.status(200).json({ success: true, message: "Withdrawals retrieved successfully.", data: result });
  } catch (error) { next(error); }
}

export const walletController = {
  getWallet,
  requestDeposit,
  syncDeposit,
  listDeposits,
  requestWithdrawal,
  syncWithdrawal,
  listWithdrawals,
};
