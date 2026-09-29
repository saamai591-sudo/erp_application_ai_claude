"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("express-async-errors");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_1 = require("./middleware/auth");
const fiscalScope_1 = require("./middleware/fiscalScope");
const sync_1 = require("./authz/sync");
const auth_2 = __importDefault(require("./routes/auth"));
const authz_1 = __importDefault(require("./routes/authz"));
const userPreferences_1 = __importDefault(require("./routes/userPreferences"));
const roles_1 = __importDefault(require("./routes/roles"));
const users_1 = __importDefault(require("./routes/users"));
const currencies_1 = __importDefault(require("./routes/currencies"));
const fiscalPeriods_1 = __importDefault(require("./routes/fiscalPeriods"));
const reportingPeriods_1 = __importDefault(require("./routes/reportingPeriods"));
const goodsPricing_1 = __importDefault(require("./routes/goodsPricing"));
const orgStructure_1 = __importDefault(require("./routes/orgStructure"));
const geoRegions_1 = __importDefault(require("./routes/geoRegions"));
const detailTypes_1 = __importDefault(require("./routes/detailTypes"));
const parties_1 = __importDefault(require("./routes/parties"));
const cashBoxes_1 = __importDefault(require("./routes/cashBoxes"));
const banking_1 = __importDefault(require("./routes/banking"));
const orgUnitsAndCostCenters_1 = __importDefault(require("./routes/orgUnitsAndCostCenters"));
const reportingLevels_1 = __importDefault(require("./routes/reportingLevels"));
const accounts_1 = __importDefault(require("./routes/accounts"));
const documentTypes_1 = __importDefault(require("./routes/documentTypes"));
const journalEntries_1 = __importDefault(require("./routes/journalEntries"));
const accountClosing_1 = __importDefault(require("./routes/accountClosing"));
const documentConfirmation_1 = __importDefault(require("./routes/documentConfirmation"));
const openingClosing_1 = __importDefault(require("./routes/openingClosing"));
const importProcessors_1 = require("./importProcessors");
const importJobs_1 = __importDefault(require("./routes/importJobs"));
const reports_1 = __importDefault(require("./routes/reports"));
const olapReports_1 = __importDefault(require("./routes/olapReports"));
const unitsOfMeasure_1 = __importDefault(require("./routes/unitsOfMeasure"));
const warehouses_1 = __importDefault(require("./routes/warehouses"));
const batches_1 = __importDefault(require("./routes/batches"));
const serials_1 = __importDefault(require("./routes/serials"));
const physicalLocations_1 = __importDefault(require("./routes/physicalLocations"));
const warehouseConfirmations_1 = __importDefault(require("./routes/warehouseConfirmations"));
const goodsGroups_1 = __importDefault(require("./routes/goodsGroups"));
const goodsAttributes_1 = __importDefault(require("./routes/goodsAttributes"));
const goodsAccounting_1 = __importDefault(require("./routes/goodsAccounting"));
const accountingSettings_1 = __importDefault(require("./routes/accountingSettings"));
const issueWarehouseJournalEntries_1 = __importDefault(require("./routes/issueWarehouseJournalEntries"));
const detailSelector_1 = __importDefault(require("./routes/detailSelector"));
const goodsRequestTypes_1 = __importDefault(require("./routes/goodsRequestTypes"));
const goodsItems_1 = __importDefault(require("./routes/goodsItems"));
const initialInventory_1 = __importDefault(require("./routes/initialInventory"));
const projects_1 = __importDefault(require("./routes/projects"));
const goodsRequests_1 = __importDefault(require("./routes/goodsRequests"));
const supplyRequests_1 = __importDefault(require("./routes/supplyRequests"));
const purchaseChain_1 = __importDefault(require("./routes/purchaseChain"));
const purchaseTypes_1 = __importDefault(require("./routes/purchaseTypes"));
const purchaseOperations_1 = __importDefault(require("./routes/purchaseOperations"));
const salesOperations_1 = __importDefault(require("./routes/salesOperations"));
const salesTypes_1 = __importDefault(require("./routes/salesTypes"));
const salesCenters_1 = __importDefault(require("./routes/salesCenters"));
const receiptTypes_1 = __importDefault(require("./routes/receiptTypes"));
const paymentTypes_1 = __importDefault(require("./routes/paymentTypes"));
const chequeTypes_1 = __importDefault(require("./routes/chequeTypes"));
const treasuryAccountSettings_1 = __importDefault(require("./routes/treasuryAccountSettings"));
const chequeBookLeaves_1 = __importDefault(require("./routes/chequeBookLeaves"));
const pettyCashes_1 = __importDefault(require("./routes/pettyCashes"));
const pettyCashCustodians_1 = __importDefault(require("./routes/pettyCashCustodians"));
const pettyCashPayments_1 = __importDefault(require("./routes/pettyCashPayments"));
const pettyCashSummaries_1 = __importDefault(require("./routes/pettyCashSummaries"));
const salesDeliveries_1 = __importDefault(require("./routes/salesDeliveries"));
const salesInvoices_1 = __importDefault(require("./routes/salesInvoices"));
const salesReturnInvoices_1 = __importDefault(require("./routes/salesReturnInvoices"));
const salesReview_1 = __importDefault(require("./routes/salesReview"));
const purchaseReview_1 = __importDefault(require("./routes/purchaseReview"));
const bankAccountReview_1 = __importDefault(require("./routes/bankAccountReview"));
const cashReview_1 = __importDefault(require("./routes/cashReview"));
const chequeReview_1 = __importDefault(require("./routes/chequeReview"));
const treasuryOpenings_1 = __importDefault(require("./routes/treasuryOpenings"));
const treasuryYearClose_1 = __importDefault(require("./routes/treasuryYearClose"));
const purchaseInvoices_1 = __importDefault(require("./routes/purchaseInvoices"));
const servicePurchaseInvoices_1 = __importDefault(require("./routes/servicePurchaseInvoices"));
const warehouseReview_1 = __importDefault(require("./routes/warehouseReview"));
const warehouseReceipts_1 = __importDefault(require("./routes/warehouseReceipts"));
const warehouseTransferOut_1 = __importDefault(require("./routes/warehouseTransferOut"));
const warehouseTransferIn_1 = __importDefault(require("./routes/warehouseTransferIn"));
const salesReturns_1 = __importDefault(require("./routes/salesReturns"));
const supplierReturns_1 = __importDefault(require("./routes/supplierReturns"));
const productionReceipts_1 = __importDefault(require("./routes/productionReceipts"));
const centerConsumptions_1 = __importDefault(require("./routes/centerConsumptions"));
const projectConsumptions_1 = __importDefault(require("./routes/projectConsumptions"));
const productionConsumptions_1 = __importDefault(require("./routes/productionConsumptions"));
const centerConsumptionReturns_1 = __importDefault(require("./routes/centerConsumptionReturns"));
const projectConsumptionReturns_1 = __importDefault(require("./routes/projectConsumptionReturns"));
const productionConsumptionReturns_1 = __importDefault(require("./routes/productionConsumptionReturns"));
const fixedAssetIssues_1 = __importDefault(require("./routes/fixedAssetIssues"));
const warehouseAdjustments_1 = __importDefault(require("./routes/warehouseAdjustments"));
const inventoryCountingShortages_1 = __importDefault(require("./routes/inventoryCountingShortages"));
const receipts_1 = __importDefault(require("./routes/receipts"));
const payments_1 = __importDefault(require("./routes/payments"));
const cheques_1 = __importDefault(require("./routes/cheques"));
const chequeDeposits_1 = __importDefault(require("./routes/chequeDeposits"));
const chequeDepositReturns_1 = __importDefault(require("./routes/chequeDepositReturns"));
const chequeClearingReceivable_1 = __importDefault(require("./routes/chequeClearingReceivable"));
const chequeClearingPayable_1 = __importDefault(require("./routes/chequeClearingPayable"));
const app = (0, express_1.default)();
(0, importProcessors_1.registerAllImportProcessors)();
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
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: "50mb" }));
app.get("/api/health", (_req, res) => res.json({ ok: true }));
// عمومی (بدون نیاز به ورود)
app.use("/api/auth", auth_2.default);
// همه مسیرهای زیر نیازمند احراز هویت هستند
app.use("/api", auth_1.requireAuth);
// دوره مالی جاری (هدر x-fiscal-period-id) را در RequestContext می‌گذارد تا lib/prisma.ts بتواند
// خودکار لیست موجودیت‌های دارای fiscalPeriodId را به همان دوره محدود کند — نگاه کنید به
// middleware/fiscalScope.ts و lib/requestContext.ts.
app.use("/api", fiscalScope_1.fiscalScopeContext);
app.use("/api", authz_1.default);
app.use("/api", userPreferences_1.default);
app.use("/api/roles", roles_1.default);
app.use("/api/users", users_1.default);
app.use("/api/currencies", currencies_1.default);
app.use("/api/fiscal-periods", fiscalPeriods_1.default);
app.use("/api/reporting-periods", reportingPeriods_1.default);
app.use("/api/goods-pricing", goodsPricing_1.default);
app.use("/api/org-structure", orgStructure_1.default);
app.use("/api/geo-regions", geoRegions_1.default);
app.use("/api/detail-types", detailTypes_1.default);
app.use("/api/parties", parties_1.default);
app.use("/api/cash-boxes", cashBoxes_1.default);
app.use("/api/petty-cashes", pettyCashes_1.default);
app.use("/api/petty-cash-custodians", pettyCashCustodians_1.default);
app.use("/api/petty-cash-payments", pettyCashPayments_1.default);
app.use("/api/petty-cash-summaries", pettyCashSummaries_1.default);
app.use("/api/banking", banking_1.default);
app.use("/api", orgUnitsAndCostCenters_1.default);
app.use("/api/reporting-levels", reportingLevels_1.default);
app.use("/api/accounts", accounts_1.default);
app.use("/api/document-types", documentTypes_1.default);
app.use("/api/journal-entries", journalEntries_1.default);
app.use("/api/account-closing", accountClosing_1.default);
app.use("/api/document-confirmation", documentConfirmation_1.default);
app.use("/api/opening-closing", openingClosing_1.default);
app.use("/api/import-jobs", importJobs_1.default);
app.use("/api/reports", reports_1.default);
app.use("/api/olap-reports", olapReports_1.default);
app.use("/api/units-of-measure", unitsOfMeasure_1.default);
app.use("/api", warehouses_1.default);
app.use("/api/batches", batches_1.default);
app.use("/api/serials", serials_1.default);
app.use("/api/physical-locations", physicalLocations_1.default);
app.use("/api", warehouseConfirmations_1.default);
app.use("/api", goodsGroups_1.default);
app.use("/api/goods-attributes", goodsAttributes_1.default);
app.use("/api", goodsAccounting_1.default);
app.use("/api", accountingSettings_1.default);
app.use("/api", issueWarehouseJournalEntries_1.default);
app.use("/api", detailSelector_1.default);
app.use("/api/goods-request-types", goodsRequestTypes_1.default);
app.use("/api", goodsItems_1.default);
app.use("/api/initial-inventories", initialInventory_1.default);
app.use("/api/projects", projects_1.default);
app.use("/api/goods-requests", goodsRequests_1.default);
app.use("/api/supply-requests", supplyRequests_1.default);
app.use("/api", purchaseChain_1.default);
app.use("/api", purchaseTypes_1.default);
app.use("/api", purchaseOperations_1.default);
app.use("/api", salesOperations_1.default);
app.use("/api", salesTypes_1.default);
app.use("/api", salesCenters_1.default);
app.use("/api", receiptTypes_1.default);
app.use("/api", paymentTypes_1.default);
app.use("/api", chequeTypes_1.default);
app.use("/api", treasuryAccountSettings_1.default);
app.use("/api", chequeBookLeaves_1.default);
app.use("/api", salesDeliveries_1.default);
app.use("/api", salesInvoices_1.default);
app.use("/api", salesReturnInvoices_1.default);
app.use("/api", salesReview_1.default);
app.use("/api", purchaseReview_1.default);
app.use("/api", bankAccountReview_1.default);
app.use("/api", cashReview_1.default);
app.use("/api", chequeReview_1.default);
app.use("/api", treasuryOpenings_1.default);
app.use("/api", treasuryYearClose_1.default);
app.use("/api", purchaseInvoices_1.default);
app.use("/api", servicePurchaseInvoices_1.default);
app.use("/api", warehouseReview_1.default);
app.use("/api", warehouseReceipts_1.default);
app.use("/api", warehouseTransferOut_1.default);
app.use("/api", warehouseTransferIn_1.default);
app.use("/api", warehouseAdjustments_1.default);
app.use("/api", salesReturns_1.default);
app.use("/api", supplierReturns_1.default);
app.use("/api", productionReceipts_1.default);
app.use("/api", centerConsumptions_1.default);
app.use("/api", projectConsumptions_1.default);
app.use("/api", productionConsumptions_1.default);
app.use("/api", centerConsumptionReturns_1.default);
app.use("/api", projectConsumptionReturns_1.default);
app.use("/api", productionConsumptionReturns_1.default);
app.use("/api", fixedAssetIssues_1.default);
app.use("/api", inventoryCountingShortages_1.default);
app.use("/api", receipts_1.default);
app.use("/api", payments_1.default);
app.use("/api", cheques_1.default);
app.use("/api", chequeDeposits_1.default);
app.use("/api", chequeDepositReturns_1.default);
app.use("/api", chequeClearingReceivable_1.default);
app.use("/api", chequeClearingPayable_1.default);
// محافظ سراسری خطا: با import "express-async-errors" در بالای فایل، خطاهای async
// درون route handlerها (حتی بدون try/catch صریح) به این middleware هدایت می‌شوند
// به‌جای اینکه درخواست بدون پاسخ بماند (نمونه: تلاش برای حذف رکوردی که در جدول دیگری
// به آن ارجاع داده شده و Prisma خطای P2003 صادر می‌کند).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
    console.error("Unhandled route error:", err);
    if (res.headersSent)
        return;
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
(0, sync_1.syncRegistryToDb)()
    .then(() => {
    app.listen(port, () => {
        console.log(`Backend listening on port ${port}`);
    });
})
    .catch((err) => {
    console.error("خطا در همگام‌سازی Registry با دیتابیس:", err);
    process.exit(1);
});
