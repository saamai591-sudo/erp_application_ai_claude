import { prisma } from "../lib/prisma";

// =========================================================================
// «رویه‌ها و تنظیمات حسابداری» (Documents/رویه ها و تنظیمات حسابداری.md) — تنظیمات تاریخ‌محور سطح حسابداری.
// هر رکورد یک «تاریخ شروع اعتبار» دارد و مقدار معتبر برای یک تاریخ = آخرین رکوردی که تاریخ شروعش کمتر یا مساوی آن تاریخ است.
// ثبت رکورد جدید فقط از تاریخ شروع خودش اثر می‌گذارد؛ اسنادِ ذخیره‌شده مقدارهای خودشان را نگه می‌دارند.
// تنها محل خواندن این تنظیمات برای موتور حسابداری همین سرویس است (نه ذخیره‌ی موازی در فرم‌های عملیاتی).
// کش درون‌پردازه‌ای است و با هر تغییر تنظیمات (invalidateAccountingSettingsCache) و پس از ۶۰ ثانیه تازه می‌شود.
// =========================================================================

const CACHE_TTL_MS = 60_000;

interface VatRow { startDate: Date; ratePercent: number }
interface MethodRow { startDate: Date; method: string }

let vatCache: { at: number; rows: VatRow[] } | null = null;
let methodCache: { at: number; rows: MethodRow[] } | null = null;
let purchaseMethodCache: { at: number; rows: MethodRow[] } | null = null;

export function invalidateAccountingSettingsCache() {
  vatCache = null;
  methodCache = null;
  purchaseMethodCache = null;
}

async function loadVatRows(): Promise<VatRow[]> {
  if (!vatCache || Date.now() - vatCache.at > CACHE_TTL_MS) {
    const rows = await prisma.accountingVatRate.findMany({ orderBy: { startDate: "asc" } });
    vatCache = { at: Date.now(), rows: rows.map((r) => ({ startDate: r.startDate, ratePercent: Number(r.ratePercent) })) };
  }
  return vatCache.rows;
}

async function loadMethodRows(): Promise<MethodRow[]> {
  if (!methodCache || Date.now() - methodCache.at > CACHE_TTL_MS) {
    const rows = await prisma.accountingAdvanceReceiptSetting.findMany({ orderBy: { startDate: "asc" } });
    methodCache = { at: Date.now(), rows: rows.map((r) => ({ startDate: r.startDate, method: r.method })) };
  }
  return methodCache.rows;
}

function latestOnOrBefore<T extends { startDate: Date }>(rows: T[], date: Date): T | null {
  let found: T | null = null;
  for (const r of rows) {
    if (r.startDate.getTime() <= date.getTime()) found = r;
    else break;
  }
  return found;
}

/** نرخ پیش‌فرض ارزش افزوده (درصد) معتبر در تاریخ سند؛ اگر تا آن تاریخ نرخی تعریف نشده باشد خطا می‌دهد */
export async function getVatRatePercentForDate(date: Date): Promise<number> {
  const row = latestOnOrBefore(await loadVatRows(), date);
  if (!row) throw new Error("برای تاریخ سند، نرخ ارزش افزوده در «رویه‌ها و تنظیمات حسابداری» تعریف نشده است");
  return row.ratePercent;
}

/** روش شناسایی پیش‌دریافت ارزی معتبر در تاریخ معامله (null اگر رکوردی تا آن تاریخ تعریف نشده باشد) */
export async function getAdvanceReceiptMethodForDate(date: Date): Promise<"HISTORICAL_RATE" | "TRANSACTION_DATE_RATE" | null> {
  const row = latestOnOrBefore(await loadMethodRows(), date);
  return (row?.method as any) ?? null;
}

async function loadPurchaseMethodRows(): Promise<MethodRow[]> {
  if (!purchaseMethodCache || Date.now() - purchaseMethodCache.at > CACHE_TTL_MS) {
    const rows = await prisma.accountingAdvancePaymentSetting.findMany({ orderBy: { startDate: "asc" } });
    purchaseMethodCache = { at: Date.now(), rows: rows.map((r) => ({ startDate: r.startDate, method: r.method })) };
  }
  return purchaseMethodCache.rows;
}

/** روش شناسایی پیش‌پرداخت ارزی خرید معتبر در تاریخ معامله — رویه‌ای کاملاً جدا از پیش‌دریافت فروش (null اگر رکوردی تا آن تاریخ تعریف نشده باشد) */
export async function getAdvancePaymentMethodForDate(date: Date): Promise<"HISTORICAL_RATE" | "TRANSACTION_DATE_RATE" | null> {
  const row = latestOnOrBefore(await loadPurchaseMethodRows(), date);
  return (row?.method as any) ?? null;
}
