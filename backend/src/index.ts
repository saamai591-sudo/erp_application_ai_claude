import "express-async-errors";
import express from "express";
import cors from "cors";
import { requireAuth } from "./middleware/auth";

import authRoutes from "./routes/auth";
import roleRoutes from "./routes/roles";
import userRoutes from "./routes/users";
import currencyRoutes from "./routes/currencies";
import fiscalPeriodRoutes from "./routes/fiscalPeriods";
import reportingPeriodRoutes from "./routes/reportingPeriods";
import orgStructureRoutes from "./routes/orgStructure";
import geoRegionRoutes from "./routes/geoRegions";
import detailTypeRoutes from "./routes/detailTypes";
import partyRoutes from "./routes/parties";
import cashBoxRoutes from "./routes/cashBoxes";
import bankingRoutes from "./routes/banking";
import orgUnitsAndCostCentersRoutes from "./routes/orgUnitsAndCostCenters";
import reportingLevelRoutes from "./routes/reportingLevels";
import accountRoutes from "./routes/accounts";
import documentTypeRoutes from "./routes/documentTypes";
import journalEntryRoutes from "./routes/journalEntries";
import accountClosingRoutes from "./routes/accountClosing";
import documentConfirmationRoutes from "./routes/documentConfirmation";
import openingClosingRoutes from "./routes/openingClosing";
import { registerAllImportProcessors } from "./importProcessors";
import importJobRoutes from "./routes/importJobs";
import reportRoutes from "./routes/reports";
import olapReportsRoutes from "./routes/olapReports";
import unitsOfMeasureRoutes from "./routes/unitsOfMeasure";
import warehousesRoutes from "./routes/warehouses";
import batchesRoutes from "./routes/batches";
import serialsRoutes from "./routes/serials";
import physicalLocationsRoutes from "./routes/physicalLocations";
import inventoryClosingsRoutes from "./routes/inventoryClosings";
import goodsGroupsRoutes from "./routes/goodsGroups";
import goodsAttributesRoutes from "./routes/goodsAttributes";
import goodsAccountingRoutes from "./routes/goodsAccounting";
import goodsRequestTypeRoutes from "./routes/goodsRequestTypes";
import goodsItemsRoutes from "./routes/goodsItems";
import initialInventoryRoutes from "./routes/initialInventory";
import projectsRoutes from "./routes/projects";
import goodsRequestsRoutes from "./routes/goodsRequests";
import supplyRequestsRoutes from "./routes/supplyRequests";
import purchaseChainRoutes from "./routes/purchaseChain";
import purchaseOperationsRoutes from "./routes/purchaseOperations";
import salesOperationsRoutes from "./routes/salesOperations";
import salesDeliveriesRoutes from "./routes/salesDeliveries";
import salesInvoicesRoutes from "./routes/salesInvoices";
import purchaseInvoicesRoutes from "./routes/purchaseInvoices";
import warehouseReviewRoutes from "./routes/warehouseReview";
import warehouseReceiptsRoutes from "./routes/warehouseReceipts";
import warehouseTransfersRoutes from "./routes/warehouseTransfers";
import salesReturnsRoutes from "./routes/salesReturns";
import supplierReturnsRoutes from "./routes/supplierReturns";
import productionReceiptsRoutes from "./routes/productionReceipts";
import centerConsumptionsRoutes from "./routes/centerConsumptions";
import projectConsumptionsRoutes from "./routes/projectConsumptions";
import productionConsumptionsRoutes from "./routes/productionConsumptions";
import centerConsumptionReturnsRoutes from "./routes/centerConsumptionReturns";
import projectConsumptionReturnsRoutes from "./routes/projectConsumptionReturns";
import productionConsumptionReturnsRoutes from "./routes/productionConsumptionReturns";
import fixedAssetIssuesRoutes from "./routes/fixedAssetIssues";
import warehouseAdjustmentsRoutes from "./routes/warehouseAdjustments";
import receiptsRoutes from "./routes/receipts";
import paymentsRoutes from "./routes/payments";
import chequesRoutes from "./routes/cheques";
import chequeDepositsRoutes from "./routes/chequeDeposits";
import chequeDepositReturnsRoutes from "./routes/chequeDepositReturns";
import chequeClearingReceivableRoutes from "./routes/chequeClearingReceivable";
import chequeClearingPayableRoutes from "./routes/chequeClearingPayable";

const app = express();

registerAllImportProcessors();

// محافظ سراسری: اگر در هر مسیری خطای async بدون try/catch رخ دهد (که در Express 4 خودکار
// مدیریت نمی‌شود)، به‌جای کرش کامل فرآیند Node (و قطع شدن اتصال همه‌ی کاربران فعلی)، فقط
// لاگ می‌شود. این باعث می‌شود عملیات‌های پرحجم مثل ورود گروهی از اکسل، با یک خطای تک‌ردیفی
// کل سرور را از کار نیندازند.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// عمومی (بدون نیاز به ورود)
app.use("/api/auth", authRoutes);

// همه مسیرهای زیر نیازمند احراز هویت هستند
app.use("/api", requireAuth);
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);
app.use("/api/currencies", currencyRoutes);
app.use("/api/fiscal-periods", fiscalPeriodRoutes);
app.use("/api/reporting-periods", reportingPeriodRoutes);
app.use("/api/org-structure", orgStructureRoutes);
app.use("/api/geo-regions", geoRegionRoutes);
app.use("/api/detail-types", detailTypeRoutes);
app.use("/api/parties", partyRoutes);
app.use("/api/cash-boxes", cashBoxRoutes);
app.use("/api/banking", bankingRoutes);
app.use("/api", orgUnitsAndCostCentersRoutes);
app.use("/api/reporting-levels", reportingLevelRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/document-types", documentTypeRoutes);
app.use("/api/journal-entries", journalEntryRoutes);
app.use("/api/account-closing", accountClosingRoutes);
app.use("/api/document-confirmation", documentConfirmationRoutes);
app.use("/api/opening-closing", openingClosingRoutes);
app.use("/api/import-jobs", importJobRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/olap-reports", olapReportsRoutes);
app.use("/api/units-of-measure", unitsOfMeasureRoutes);
app.use("/api", warehousesRoutes);
app.use("/api/batches", batchesRoutes);
app.use("/api/serials", serialsRoutes);
app.use("/api/physical-locations", physicalLocationsRoutes);
app.use("/api", inventoryClosingsRoutes);
app.use("/api", goodsGroupsRoutes);
app.use("/api/goods-attributes", goodsAttributesRoutes);
app.use("/api", goodsAccountingRoutes);
app.use("/api/goods-request-types", goodsRequestTypeRoutes);
app.use("/api", goodsItemsRoutes);
app.use("/api/initial-inventories", initialInventoryRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/goods-requests", goodsRequestsRoutes);
app.use("/api/supply-requests", supplyRequestsRoutes);
app.use("/api", purchaseChainRoutes);
app.use("/api", purchaseOperationsRoutes);
app.use("/api", salesOperationsRoutes);
app.use("/api", salesDeliveriesRoutes);
app.use("/api", salesInvoicesRoutes);
app.use("/api", purchaseInvoicesRoutes);
app.use("/api", warehouseReviewRoutes);
app.use("/api", warehouseReceiptsRoutes);
app.use("/api", warehouseTransfersRoutes);
app.use("/api", warehouseAdjustmentsRoutes);
app.use("/api", salesReturnsRoutes);
app.use("/api", supplierReturnsRoutes);
app.use("/api", productionReceiptsRoutes);
app.use("/api", centerConsumptionsRoutes);
app.use("/api", projectConsumptionsRoutes);
app.use("/api", productionConsumptionsRoutes);
app.use("/api", centerConsumptionReturnsRoutes);
app.use("/api", projectConsumptionReturnsRoutes);
app.use("/api", productionConsumptionReturnsRoutes);
app.use("/api", fixedAssetIssuesRoutes);
app.use("/api", receiptsRoutes);
app.use("/api", paymentsRoutes);
app.use("/api", chequesRoutes);
app.use("/api", chequeDepositsRoutes);
app.use("/api", chequeDepositReturnsRoutes);
app.use("/api", chequeClearingReceivableRoutes);
app.use("/api", chequeClearingPayableRoutes);

// محافظ سراسری خطا: با import "express-async-errors" در بالای فایل، خطاهای async
// درون route handlerها (حتی بدون try/catch صریح) به این middleware هدایت می‌شوند
// به‌جای اینکه درخواست بدون پاسخ بماند (نمونه: تلاش برای حذف رکوردی که در جدول دیگری
// به آن ارجاع داده شده و Prisma خطای P2003 صادر می‌کند).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled route error:", err);
  if (res.headersSent) return;
  if (err?.code === "P2003") {
    return res.status(400).json({ error: "این رکورد در جای دیگری استفاده شده است و قابل حذف/ثبت نیست" });
  }
  if (err?.code === "P2002") {
    return res.status(400).json({ error: "این مقدار تکراری است" });
  }
  res.status(500).json({ error: "خطای سرور، لطفاً دوباره تلاش کنید" });
});

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
