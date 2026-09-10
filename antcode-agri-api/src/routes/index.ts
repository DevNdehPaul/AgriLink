import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes.js";
import { produceRouter } from "../modules/produce/produce.routes.js";
import { orderRouter } from "../modules/orders/order.routes.js";
import { walletRouter } from "../modules/wallet/wallet.routes.js";
import { vehicleRouter } from "../modules/vehicles/vehicle.routes.js";
import { driverRouter } from "../modules/drivers/driver.routes.js";
import { shipmentRouter } from "../modules/shipments/shipment.routes.js";
import { disputeRouter } from "../modules/disputes/dispute.routes.js";
import { transportLoadRouter } from "../modules/transport-loads/transport-load.routes.js";
import { adminRouter } from "../modules/admin/admin.routes.js";
const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "AntCode Agri API is running",
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
    },
  });
});

router.use("/auth", authRouter);
router.use("/produce", produceRouter);
router.use("/orders", orderRouter);
router.use("/wallet", walletRouter);
router.use("/vehicles", vehicleRouter);
router.use("/drivers", driverRouter);
router.use("/shipments", shipmentRouter);
router.use("/disputes", disputeRouter);
router.use("/transport-loads", transportLoadRouter);
router.use("/admin", adminRouter);

export const apiRouter = router;
