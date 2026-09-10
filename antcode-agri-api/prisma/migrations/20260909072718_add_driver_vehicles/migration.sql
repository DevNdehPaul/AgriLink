-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('MOTORBIKE', 'CAR', 'VAN', 'PICKUP', 'TRUCK');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "registrationNo" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL,
    "capacityKg" DECIMAL(12,2) NOT NULL,
    "currentCity" TEXT,
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_registrationNo_key" ON "Vehicle"("registrationNo");

-- CreateIndex
CREATE INDEX "Vehicle_driverId_idx" ON "Vehicle"("driverId");

-- CreateIndex
CREATE INDEX "Vehicle_status_isAvailable_idx" ON "Vehicle"("status", "isAvailable");

-- CreateIndex
CREATE INDEX "Vehicle_currentCity_idx" ON "Vehicle"("currentCity");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
