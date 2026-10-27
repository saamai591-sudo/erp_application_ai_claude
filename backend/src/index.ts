import "express-async-errors";
import express from "express";
import cors from "cors";
import { requireAuth } from "./middleware/auth";
import { lightUserGuard } from "./middleware/lightGuard";
import { ensureLightRole } from "./services/userAccountService";
import { errorDisclosureGuard, GENERIC_ERROR } from "./middleware/errorDisclosure";
import { usageResponse } from "./middleware/usageResponse";
import { corsPolicy, securityHeaders } from "./middleware/securityHeaders";
import { fiscalScopeContext } from "./middleware/fiscalScope";
import { syncRegistryToDb } from "./authz/sync";

import authRoutes from "./routes/auth";
import authzRoutes from "./routes/authz";
import userPreferencesRoutes from "./routes/userPreferences";
import journalConsolidationRoutes from "./routes/journalConsolidation";
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
import warehouseQuantityCloseRoutes from "./routes/warehouseQuantityClose";
import inventoryAccountingCloseRoutes from "./routes/inventoryAccountingClose";
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
import salesPriceListsRoutes from "./routes/salesPriceLists";
import salesStationsRoutes from "./routes/salesStations";
import storeSalesRoutes from "./routes/storeSales";
import storeReceiptsRoutes from "./routes/storeReceipts";
import salesCentersRoutes from "./routes/salesCenters";
import salesQuoteFollowUpRoutes from "./routes/salesQuoteFollowUp";
import frequentDescriptionsRoutes from "./routes/frequentDescriptions";
import aboutRoutes from "./routes/about";
import receiptTypesRoutes from "./routes/receiptTypes";
import paymentTypesRoutes from "./routes/paymentTypes";
import chequeTypesRoutes from "./routes/chequeTypes";
import treasuryAccountSettingsRoutes from "./routes/treasuryAccountSettings";
import chequeBookLeavesRoutes from "./routes/chequeBookLeaves";
import pettyCashRoutes from "./routes/pettyCashes";
import taxMemoryRoutes from "./routes/taxMemories";
import hrMasterRoutes from "./routes/hrMasters";
import positionRoutes from "./routes/positions";
import employeeRoutes from "./routes/employees";
import employeeRecordRoutes from "./routes/employeeRecords";
import employeeSalaryAccountRoutes from "./routes/employeeSalaryAccounts";
import payrollPaymentPrepRoutes from "./routes/payrollPaymentPreps";
import workflowRoutes from "./routes/workflow";
import workflowProcessRoutes from "./routes/workflowProcesses";
import decreeComponentRoutes from "./routes/decreeComponents";
import employmentDecreeRoutes from "./routes/employmentDecrees";
import payrollParameterRoutes from "./routes/payrollParameters";
import payrollCalculationRoutes from "./routes/payrollCalculation";
import payrollDataEntryRoutes from "./routes/payrollDataEntry";
import personnelConstantRoutes from "./routes/personnelConstants";
import payrollLoanRoutes from "./routes/payrollLoans";
import jobRoutes from "./routes/jobs";
import attendancePunchRoutes from "./routes/attendancePunches";
import attendanceShiftRoutes from "./routes/attendanceShifts";
import attendanceShiftAssignmentRoutes from "./routes/attendanceShiftAssignments";
import attendanceWorksheetRoutes from "./routes/attendanceWorksheet";
import attendanceFactorRoutes from "./routes/attendanceFactors";
import attendanceTimeBandRoutes from "./routes/attendanceTimeBands";
import attendanceDayExceptionRoutes from "./routes/attendanceDayExceptions";
import attendanceLeaveRoutes from "./routes/attendanceLeave";
import attendanceLeaveBalanceRoutes from "./routes/attendanceLeaveBalance";
import attendanceMissionRoutes from "./routes/attendanceMission";
import attendanceCalculationRoutes from "./routes/attendanceCalculation";
import attendancePermitRoutes from "./routes/attendancePermits";
import attendanceEmployeeRoutes from "./routes/attendanceEmployees";
import beneficiaryOrgRoutes from "./routes/beneficiaryOrgs";
import payrollAccountingRoutes from "./routes/payrollAccounting";
import payrollPaymentTypeRoutes from "./routes/payrollPaymentTypes";
import fileStructureRoutes from "./routes/fileStructures";
import workCalendarRoutes from "./routes/workCalendars";
import tradeLedgerRoutes from "./routes/tradeLedgers";
import taxInvoiceRoutes from "./routes/taxInvoices";
import scheduledJobRoutes from "./routes/scheduledJobs";
import companyProfileRoutes from "./routes/companyProfile";
import printTemplateRoutes from "./routes/printTemplates";
import printShareRoutes from "./routes/printShare";
import brandingRoutes from "./routes/branding";
import managementRoutes from "./routes/management";
import { licenseGate } from "./license/licenseGate";
import managementBackupRoutes from "./routes/managementBackup";
import { startBackupScheduler } from "./services/backupService";
import { stampUnmarkedTaxMemories } from "./services/taxMemoryLicense";
import { ensureDefaultFileStructures } from "./services/fileStructureService";
import { fxOffBodyNormalizer } from "./license/fxOff";
import { startScheduler } from "./jobs/scheduler";
import warehouseDocDetailSettingRoutes from "./routes/warehouseDocDetailSettings";
import detailRuleRoutes from "./routes/detailRules";
import numberingPatternRoutes from "./routes/numberingPatterns";
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
app.disable("x-powered-by");
app.use(securityHeaders);
app.use(corsPolicy);
app.use(express.json({ limit: "50mb" }));
// هیچ متن خطای داخلی (Prisma/SQL، مسیر فایل، stack) در پاسخ‌ها به کلاینت نمی‌رسد؛ جزئیات فقط در لاگ سرور می‌ماند (middleware/errorDisclosure.ts)
app.use(errorDisclosureGuard);
// فهرست ساختاریافته‌ی «موارد استفاده» در پاسخ خطای حذف (middleware/usageResponse.ts)
app.use(usageResponse);

app.get("/api/health", (_req, res) => res.json({ ok: true }));
// نام و لوگوی شرکت برای عنوان/آیکن تب (عمومی، قبل از دروازه‌ی لایسنس)
app.use("/api/branding", brandingRoutes);

// «مدیریت» (لایسنس): جدا از ورود ERP و مجوزهایش؛ باید قبل از دروازه‌ی لایسنس و requireAuth ثبت شود
app.use("/api", managementRoutes);
// پشتیبان‌گیری خودکار (سیاست و دانلود) — فقط با نشست مدیریت؛ قبل از دروازه‌ی لایسنس تا انقضای لایسنس دسترسی به پشتیبان را نبندد
app.use("/api", managementBackupRoutes);
// قفل کامل بدون لایسنس معتبر (همه‌ی مسیرها به‌جز health و management)
app.use("/api", licenseGate);

// عمومی (بدون نیاز به ورود)
app.use("/api/auth", authRoutes);
// نمایش عمومی لینک اشتراک‌گذاری سند چاپی (توکن تصادفی؛ فقط همان یک عکس‌فوری)
app.use("/api/share", printShareRoutes);

// همه مسیرهای زیر نیازمند احراز هویت هستند
app.use("/api", requireAuth);
app.use("/api", lightUserGuard);
// دوره مالی جاری (هدر x-fiscal-period-id) را در RequestContext می‌گذارد تا lib/prisma.ts بتواند
// خودکار لیست موجودیت‌های دارای fiscalPeriodId را به همان دوره محدود کند — نگاه کنید به
// middleware/fiscalScope.ts و lib/requestContext.ts.
app.use("/api", fiscalScopeContext);
// بدون قابلیت FX در لایسنس: بدنه‌ی هر ثبت/ویرایش به ارز پایه (و نرخ ۱) نرمال می‌شود
app.use("/api", fxOffBodyNormalizer);
app.use("/api", authzRoutes);
app.use("/api", userPreferencesRoutes);
app.use("/api/journal-consolidation", journalConsolidationRoutes);
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
app.use("/api/tax-memories", taxMemoryRoutes);
app.use("/api", hrMasterRoutes);
app.use("/api", positionRoutes);
app.use("/api", employeeRoutes);
app.use("/api", employeeRecordRoutes);
app.use("/api", employeeSalaryAccountRoutes);
app.use("/api", payrollPaymentPrepRoutes);
app.use("/api", workflowRoutes);
app.use("/api", workflowProcessRoutes);
app.use("/api", decreeComponentRoutes);
app.use("/api", employmentDecreeRoutes);
app.use("/api", payrollParameterRoutes);
app.use("/api", payrollCalculationRoutes);
app.use("/api", payrollDataEntryRoutes);
app.use("/api", personnelConstantRoutes);
app.use("/api", payrollLoanRoutes);
app.use("/api", jobRoutes);
app.use("/api", attendancePunchRoutes);
app.use("/api", attendanceShiftRoutes);
app.use("/api", attendanceShiftAssignmentRoutes);
app.use("/api", attendanceWorksheetRoutes);
app.use("/api", attendanceFactorRoutes);
app.use("/api", attendanceTimeBandRoutes);
app.use("/api", attendanceDayExceptionRoutes);
app.use("/api", attendanceLeaveRoutes);
app.use("/api", attendanceLeaveBalanceRoutes);
app.use("/api", attendanceMissionRoutes);
app.use("/api", attendanceCalculationRoutes);
app.use("/api", attendancePermitRoutes);
app.use("/api", attendanceEmployeeRoutes);
app.use("/api", beneficiaryOrgRoutes);
app.use("/api", payrollAccountingRoutes);
app.use("/api", payrollPaymentTypeRoutes);
app.use("/api", fileStructureRoutes);
app.use("/api", workCalendarRoutes);
app.use("/api/trade-ledgers", tradeLedgerRoutes);
app.use("/api/tax-invoices", taxInvoiceRoutes);
app.use("/api", scheduledJobRoutes);
app.use("/api", companyProfileRoutes);
app.use("/api", printTemplateRoutes);
app.use("/api/warehouse-doc-detail-settings", warehouseDocDetailSettingRoutes);
app.use("/api/detail-rules", detailRuleRoutes);
app.use("/api/numbering-patterns", numberingPatternRoutes);
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
app.use("/api", warehouseQuantityCloseRoutes);
app.use("/api", inventoryAccountingCloseRoutes);
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
app.use("/api", salesPriceListsRoutes);
app.use("/api", salesStationsRoutes);
app.use("/api", storeSalesRoutes);
app.use("/api", storeReceiptsRoutes);
app.use("/api", salesCentersRoutes);
app.use("/api", salesQuoteFollowUpRoutes);
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

// هر مسیر ناشناخته (داخل یا بیرون از /api): پاسخ JSON ثابت، بدون صفحه‌ی HTML پیش‌فرض Express (که مسیر درخواست و CSP خودش را برمی‌گرداند)
app.use((_req, res) => res.status(404).json({ error: "مسیر یافت نشد" }));

// محافظ سراسری خطا: با import "express-async-errors" در بالای فایل، خطاهای async
// درون route handlerها (حتی بدون try/catch صریح) به این middleware هدایت می‌شوند
// به‌جای اینکه درخواست بدون پاسخ بماند (نمونه: تلاش برای حذف رکوردی که در جدول دیگری
// به آن ارجاع داده شده و Prisma خطای P2003 صادر می‌کند).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // جزئیات کامل (stack، پیام Prisma، مسیر فایل) فقط در لاگ سرور؛ هیچ‌کدام به کلاینت نمی‌رود
  console.error(`Unhandled route error: ${req.method} ${req.originalUrl.split("?")[0]}`, err);
  if (res.headersSent) return;
  // خطای خواندن بدنه‌ی درخواست (JSON خراب / حجم زیاد)
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "بدنه‌ی درخواست نامعتبر است" });
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "حجم درخواست بیش از حد مجاز است" });
  // حذف ممنوع به‌خاطر ارجاع (lib/deleteUsage.ts): پیام دقیق + فهرست ساختاریافته‌ی موارد استفاده
  if (err?.code === "DELETE_BLOCKED") return res.status(400).json({ error: err.message, header: err.header, usageGroups: err.groups });
  if (err?.code === "P2003") {
    return res.status(400).json({ error: "این رکورد در جای دیگری استفاده شده است و قابل حذف/ثبت نیست" });
  }
  if (err?.code === "P2002") {
    return res.status(400).json({ error: "این مقدار تکراری است" });
  }
  res.status(500).json({ error: GENERIC_ERROR });
});

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
// همگام‌سازی Registry با جدول Action در هر بار بالا آمدن سرور (نه فقط seed) — یعنی افزودن/حذف یک
// Action در registry.ts، بدون نیاز به اجرای دستیِ seed، در همان اولین ری‌استارت بعدی اعمال می‌شود.
syncRegistryToDb()
  .then(() => ensureLightRole().catch((e) => console.error("[users] ساخت نقش کاربر سبک", e)))
  .then(() => {
    app.listen(port, () => {
      console.log(`Backend listening on port ${port}`);
      // زمان‌بند کارها (فقط با SCHEDULER_ENABLED=true روشن می‌شود) — نگاه کنید به jobs/scheduler.ts
      startScheduler().catch((e) => console.error("[scheduler] خطا در راه‌اندازی", e));
      // زمان‌سنج پشتیبان‌گیری (مستقل از SCHEDULER_ENABLED؛ فقط وقتی سیاست از «مدیریت» روشن شود کار می‌کند)
      startBackupScheduler().catch((e) => console.error("[backup] خطا در راه‌اندازی", e));
      // حافظه‌های مالیاتیِ بدون سریال (قدیمی) با سریال لایسنس جاری علامت می‌خورند
      ensureDefaultFileStructures().catch((e) => console.error("[file-structures] ساخت ساختارهای پیش‌فرض نصب", e));
      stampUnmarkedTaxMemories().catch((e) => console.error("[tax-memory] علامت‌گذاری با سریال لایسنس", e));
    });
  })
  .catch((err) => {
    console.error("خطا در همگام‌سازی Registry با دیتابیس:", err);
    process.exit(1);
  });
