-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('AWAITING_ASSIGNMENT', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERY_REPORTED', 'DELIVERED', 'DELAYED', 'REASSIGNMENT_REQUIRED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShipmentEventType" AS ENUM ('CREATED', 'DRIVER_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'LOCATION_UPDATED', 'DELIVERY_REPORTED', 'DELIVERED', 'DELAYED', 'REASSIGNMENT_REQUIRED', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "shipmentNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "driverId" TEXT,
    "vehicleId" TEXT,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'AWAITING_ASSIGNMENT',
    "pickupCity" TEXT NOT NULL,
    "pickupAddress" TEXT,
    "deliveryCity" TEXT NOT NULL,
    "deliveryAddress" TEXT NOT NULL,
    "loadWeightKg" DECIMAL(12,2) NOT NULL,
    "assignedAt" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "deliveryReportedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentEvent" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "type" "ShipmentEventType" NOT NULL,
    "city" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_shipmentNumber_key" ON "Shipment"("shipmentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_orderId_key" ON "Shipment"("orderId");

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");

-- CreateIndex
CREATE INDEX "Shipment_driverId_status_idx" ON "Shipment"("driverId", "status");

-- CreateIndex
CREATE INDEX "Shipment_vehicleId_status_idx" ON "Shipment"("vehicleId", "status");

-- CreateIndex
CREATE INDEX "Shipment_pickupCity_deliveryCity_idx" ON "Shipment"("pickupCity", "deliveryCity");

-- CreateIndex
CREATE INDEX "ShipmentEvent_shipmentId_createdAt_idx" ON "ShipmentEvent"("shipmentId", "createdAt");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
