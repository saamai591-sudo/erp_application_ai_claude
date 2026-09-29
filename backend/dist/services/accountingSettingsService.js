"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidateAccountingSettingsCache = invalidateAccountingSettingsCache;
exports.getVatRatePercentForDate = getVatRatePercentForDate;
exports.getAdvanceReceiptMethodForDate = getAdvanceReceiptMethodForDate;
const prisma_1 = require("../lib/prisma");
// =========================================================================
// «رویه‌ها و تنظیمات حسابداری» (Documents/رویه ها و تنظیمات حسابداری.md) — تنظیمات تاریخ‌محور سطح حسابداری.
// هر رکورد یک «تاریخ شروع اعتبار» دارد و مقدار معتبر برای یک تاریخ = آخرین رکوردی که تاریخ شروعش کمتر یا مساوی آن تاریخ است.
// ثبت رکورد جدید فقط از تاریخ شروع خودش اثر می‌گذارد؛ اسنادِ ذخیره‌شده مقدارهای خودشان را نگه می‌دارند.
// تنها محل خواندن این تنظیمات برای موتور حسابداری همین سرویس است (نه ذخیره‌ی موازی در فرم‌های عملیاتی).
// کش درون‌پردازه‌ای است و با هر تغییر تنظیمات (invalidateAccountingSettingsCache) و پس از ۶۰ ثانیه تازه می‌شود.
// =========================================================================
const CACHE_TTL_MS = 60_000;
let vatCache = null;
let methodCache = null;
function invalidateAccountingSettingsCache() {
    vatCache = null;
    methodCache = null;
}
async function loadVatRows() {
    if (!vatCache || Date.now() - vatCache.at > CACHE_TTL_MS) {
        const rows = await prisma_1.prisma.accountingVatRate.findMany({ orderBy: { startDate: "asc" } });
        vatCache = { at: Date.now(), rows: rows.map((r) => ({ startDate: r.startDate, ratePercent: Number(r.ratePercent) })) };
    }
    return vatCache.rows;
}
async function loadMethodRows() {
    if (!methodCache || Date.now() - methodCache.at > CACHE_TTL_MS) {
        const rows = await prisma_1.prisma.accountingAdvanceReceiptSetting.findMany({ orderBy: { startDate: "asc" } });
        methodCache = { at: Date.now(), rows: rows.map((r) => ({ startDate: r.startDate, method: r.method })) };
    }
    return methodCache.rows;
}
function latestOnOrBefore(rows, date) {
    let found = null;
    for (const r of rows) {
        if (r.startDate.getTime() <= date.getTime())
            found = r;
        else
            break;
    }
    return found;
}
/** نرخ پیش‌فرض ارزش افزوده (درصد) معتبر در تاریخ سند؛ اگر تا آن تاریخ نرخی تعریف نشده باشد خطا می‌دهد */
async function getVatRatePercentForDate(date) {
    const row = latestOnOrBefore(await loadVatRows(), date);
    if (!row)
        throw new Error("برای تاریخ سند، نرخ ارزش افزوده در «رویه‌ها و تنظیمات حسابداری» تعریف نشده است");
    return row.ratePercent;
}
/** روش شناسایی پیش‌دریافت ارزی معتبر در تاریخ معامله (null اگر رکوردی تا آن تاریخ تعریف نشده باشد) */
async function getAdvanceReceiptMethodForDate(date) {
    const row = latestOnOrBefore(await loadMethodRows(), date);
    return row?.method ?? null;
}
