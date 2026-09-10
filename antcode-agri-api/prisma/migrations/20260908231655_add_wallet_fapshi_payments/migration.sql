-- CreateEnum
CREATE TYPE "WalletEntryType" AS ENUM ('DEPOSIT', 'ORDER_HOLD', 'ORDER_RELEASE', 'REFUND', 'WITHDRAWAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "WalletEntryDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('CREATED', 'PENDING', 'SUCCESSFUL', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentHoldStatus" AS ENUM ('ACTIVE', 'RELEASED', 'REFUNDED', 'DISPUTED');

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "availableBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "heldBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletLedgerEntry" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "WalletEntryType" NOT NULL,
    "direction" "WalletEntryDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletDeposit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "phone" TEXT NOT NULL,
    "medium" TEXT,
    "status" "DepositStatus" NOT NULL DEFAULT 'CREATED',
    "provider" TEXT NOT NULL DEFAULT 'FAPSHI',
    "providerTransactionId" TEXT,
    "externalId" TEXT NOT NULL,
    "creditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentHold" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "PaymentHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentHold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "WalletLedgerEntry_walletId_createdAt_idx" ON "WalletLedgerEntry"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletLedgerEntry_reference_idx" ON "WalletLedgerEntry"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "WalletDeposit_providerTransactionId_key" ON "WalletDeposit"("providerTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletDeposit_externalId_key" ON "WalletDeposit"("externalId");

-- CreateIndex
CREATE INDEX "WalletDeposit_userId_createdAt_idx" ON "WalletDeposit"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletDeposit_status_idx" ON "WalletDeposit"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentHold_orderId_key" ON "PaymentHold"("orderId");

-- CreateIndex
CREATE INDEX "PaymentHold_walletId_status_idx" ON "PaymentHold"("walletId", "status");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedgerEntry" ADD CONSTRAINT "WalletLedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletDeposit" ADD CONSTRAINT "WalletDeposit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentHold" ADD CONSTRAINT "PaymentHold_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentHold" ADD CONSTRAINT "PaymentHold_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
