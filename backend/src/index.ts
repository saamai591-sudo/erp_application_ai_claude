import "express-async-errors";
import express from "express";
import cors from "cors";
import { requireAuth } from "./middleware/auth";
import { fiscalScopeContext } from "./middleware/fiscalScope";
import { syncRegistryToDb } from "./authz/sync";

import authRoutes from "./routes/auth";
import authzRoutes from "./routes/authz";
import userPreferencesRoutes from "./routes/userPreferences";
import roleRoutes from "./routes/roles";
import userRoutes from "./routes/users";
import currencyRoutes from "./routes/currencies";
import fiscalPeriodRoutes from "./routes/fiscalPeriods";
import reportingPeriodRoutes from "./routes/reportingPeriods";
import goodsPricingRoutes from "./routes/goodsPricing";
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
import warehouseConfirmationsRoutes from "./routes/warehouseConfirmations";
import goodsGroupsRoutes from "./routes/goodsGroups";
import goodsAttributesRoutes from "./routes/goodsAttributes";
import goodsAccountingRoutes from "./routes/goodsAccounting";
import accountingSettingsRoutes from "./routes/accountingSettings";
import issueWarehouseJournalEntriesRoutes from "./routes/issueWarehouseJournalEntries";
import detailSelectorRoutes from "./routes/detailSelector";
import goodsRequestTypeRoutes from "./routes/goodsRequestTypes";
import goodsItemsRoutes from "./routes/goodsItems";
import initialInventoryRoutes from "./routes/initialInventory";
import projectsRoutes from "./routes/projects";
import goodsRequestsRoutes from "./routes/goodsRequests";
import supplyRequestsRoutes from "./routes/supplyRequests";
import purchaseChainRoutes from "./routes/purchaseChain";
import purchaseTypesRoutes from "./routes/purchaseTypes";
import purchaseOperationsRoutes from "./routes/purchaseOperations";
import salesOperationsRoutes from "./routes/salesOperations";
import salesTypesRoutes from "./routes/salesTypes";
import salesCentersRoutes from "./routes/salesCenters";
import frequentDescriptionsRoutes from "./routes/frequentDescriptions";
import aboutRoutes from "./routes/about";
import receiptTypesRoutes from "./routes/receiptTypes";
import paymentTypesRoutes from "./routes/paymentTypes";
import chequeTypesRoutes from "./routes/chequeTypes";
import treasuryAccountSettingsRoutes from "./routes/treasuryAccountSettings";
import chequeBookLeavesRoutes from "./routes/chequeBookLeaves";
import pettyCashRoutes from "./routes/pettyCashes";
import pettyCashCustodianRoutes from "./routes/pettyCashCustodians";
import pettyCashPaymentRoutes from "./routes/pettyCashPayments";
import pettyCashSummaryRoutes from "./routes/pettyCashSummaries";
import salesDeliveriesRoutes from "./routes/salesDeliveries";
import salesInvoicesRoutes from "./routes/salesInvoices";
import salesReturnInvoicesRoutes from "./routes/salesReturnInvoices";
import salesReviewRoutes from "./routes/salesReview";
import purchaseReviewRoutes from "./routes/purchaseReview";
import bankAccountReviewRoutes from "./routes/bankAccountReview";
import cashReviewRoutes from "./routes/cashReview";
import pettyCashReviewRoutes from "./routes/pettyCashReview";
import chequeReviewRoutes from "./routes/chequeReview";
import treasuryOpeningsRoutes from "./routes/treasuryOpenings";
import treasuryYearCloseRoutes from "./routes/treasuryYearClose";
import purchaseInvoicesRoutes from "./routes/purchaseInvoices";
import servicePurchaseInvoicesRoutes from "./routes/servicePurchaseInvoices";
import warehouseReviewRoutes from "./routes/warehouseReview";
import warehouseReceiptsRoutes from "./routes/warehouseReceipts";
import warehouseTransferOutRoutes from "./routes/warehouseTransferOut";
import warehouseTransferInRoutes from "./routes/warehouseTransferIn";
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
import inventoryCountingShortagesRoutes from "./routes/inventoryCountingShortages";
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
// دوره مالی جاری (هدر x-fiscal-period-id) را در RequestContext می‌گذارد تا lib/prisma.ts بتواند
// خودکار لیست موجودیت‌های دارای fiscalPeriodId را به همان دوره محدود کند — نگاه کنید به
// middleware/fiscalScope.ts و lib/requestContext.ts.
app.use("/api", fiscalScopeContext);
app.use("/api", authzRoutes);
app.use("/api", userPreferencesRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);
app.use("/api/currencies", currencyRoutes);
app.use("/api/fiscal-periods", fiscalPeriodRoutes);
app.use("/api/reporting-periods", reportingPeriodRoutes);
app.use("/api/goods-pricing", goodsPricingRoutes);
app.use("/api/org-structure", orgStructureRoutes);
app.use("/api/geo-regions", geoRegionRoutes);
app.use("/api/detail-types", detailTypeRoutes);
app.use("/api/parties", partyRoutes);
app.use("/api/cash-boxes", cashBoxRoutes);
app.use("/api/petty-cashes", pettyCashRoutes);
app.use("/api/petty-cash-custodians", pettyCashCustodianRoutes);
app.use("/api/petty-cash-payments", pettyCashPaymentRoutes);
app.use("/api/petty-cash-summaries", pettyCashSummaryRoutes);
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
app.use("/api", warehouseConfirmationsRoutes);
app.use("/api", goodsGroupsRoutes);
app.use("/api/goods-attributes", goodsAttributesRoutes);
app.use("/api", goodsAccountingRoutes);
app.use("/api", accountingSettingsRoutes);
app.use("/api", issueWarehouseJournalEntriesRoutes);
app.use("/api", detailSelectorRoutes);
app.use("/api/goods-request-types", goodsRequestTypeRoutes);
app.use("/api", goodsItemsRoutes);
app.use("/api/initial-inventories", initialInventoryRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/goods-requests", goodsRequestsRoutes);
app.use("/api/supply-requests", supplyRequestsRoutes);
app.use("/api", purchaseChainRoutes);
app.use("/api", purchaseTypesRoutes);
app.use("/api", purchaseOperationsRoutes);
app.use("/api", salesOperationsRoutes);
app.use("/api", salesTypesRoutes);
app.use("/api", salesCentersRoutes);
app.use("/api", frequentDescriptionsRoutes);
app.use("/api", aboutRoutes);
app.use("/api", receiptTypesRoutes);
app.use("/api", paymentTypesRoutes);
app.use("/api", chequeTypesRoutes);
app.use("/api", treasuryAccountSettingsRoutes);
app.use("/api", chequeBookLeavesRoutes);
app.use("/api", salesDeliveriesRoutes);
app.use("/api", salesInvoicesRoutes);
app.use("/api", salesReturnInvoicesRoutes);
app.use("/api", salesReviewRoutes);
app.use("/api", purchaseReviewRoutes);
app.use("/api", bankAccountReviewRoutes);
app.use("/api", cashReviewRoutes);
app.use("/api", pettyCashReviewRoutes);
app.use("/api", chequeReviewRoutes);
app.use("/api", treasuryOpeningsRoutes);
app.use("/api", treasuryYearCloseRoutes);
app.use("/api", purchaseInvoicesRoutes);
app.use("/api", servicePurchaseInvoicesRoutes);
app.use("/api", warehouseReviewRoutes);
app.use("/api", warehouseReceiptsRoutes);
app.use("/api", warehouseTransferOutRoutes);
app.use("/api", warehouseTransferInRoutes);
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
app.use("/api", inventoryCountingShortagesRoutes);
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
// همگام‌سازی Registry با جدول Action در هر بار بالا آمدن سرور (نه فقط seed) — یعنی افزودن/حذف یک
// Action در registry.ts، بدون نیاز به اجرای دستیِ seed، در همان اولین ری‌استارت بعدی اعمال می‌شود.
syncRegistryToDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`Backend listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("خطا در همگام‌سازی Registry با دیتابیس:", err);
    process.exit(1);
  });
