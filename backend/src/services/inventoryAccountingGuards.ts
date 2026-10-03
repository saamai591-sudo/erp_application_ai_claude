import { prisma, Db } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";

// =========================================================================
// «بستن حسابداری موجودی» (services/inventoryAccountingCloseService.ts) — کمک‌های مشترکی که موتور قیمت‌گذاری
// (goodsPricingService/goodsPricingValidation) هم از آن‌ها استفاده می‌کند؛ در فایل جدا تا بین این دو سرویس چرخه‌ی import نباشد.
//
// قفل هم‌زمانی: شیء قفل = «دوره مالی‌ای که مبلغ افتتاحیه‌اش در میان است» (دوره‌ی بعدِ بسته‌شونده).
//  • قیمت‌گذاری یک دوره‌ی گزارشگری در دوره مالی M قفل «مشترک» (M) می‌گیرد؛
//  • بستن حسابداری دوره M-1 و برگشت آن قفل «انحصاری» (M) می‌گیرند.
// پس قیمت‌گذاریِ در حال انجام در دوره بعد، تا commit مانع برگشت می‌شود (و برگشت پس از آن، قیمت‌گذاری را می‌بیند و رد
// می‌شود)، و برعکس قیمت‌گذاری‌ای که بعد از برگشت شروع شود، نبودنِ بستن را می‌بیند و رد می‌شود.
// =========================================================================

export const INVENTORY_ACCOUNTING_CLOSE_LOCK_KEY = 7100004;

export async function lockOpeningYearShared(tx: Db, fiscalPeriodId: number): Promise<void> {
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock_shared(${INVENTORY_ACCOUNTING_CLOSE_LOCK_KEY}, ${Number(fiscalPeriodId)})`);
}

export async function lockOpeningYearExclusive(tx: Db, fiscalPeriodId: number): Promise<void> {
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${INVENTORY_ACCOUNTING_CLOSE_LOCK_KEY}, ${Number(fiscalPeriodId)})`);
}

export async function findPreviousFiscalPeriod(fiscalPeriodId: number, db: Db = prisma) {
  const fp = await db.fiscalPeriod.findUnique({ where: { id: fiscalPeriodId } });
  if (!fp) return null;
  return db.fiscalPeriod.findFirst({ where: { toDate: { lt: fp.fromDate } }, orderBy: { toDate: "desc" } });
}

/**
 * تنها کنترل «پیش‌نیاز دوره‌ی قبل» برای ارزش‌گذاری (طبق تصمیم صریح کاربر، جایگزین کنترل سطح‌کالای «در دوره قبل قیمت‌گذاری
 * شده؟»): اگر دوره مالیِ دوره‌ی گزارشگری دوره مالی قبل دارد، بستن حسابداری موجودی آن دوره باید انجام شده باشد. پیام برمی‌گرداند
 * (null = مشکلی نیست) تا هم لایه‌ی اعتبارسنجی پیام بدهد و هم priceItem (داخل تراکنش، زیر قفل مشترک) پرتاب کند.
 */
export async function getPreviousYearAccountingCloseProblem(fiscalPeriodId: number, db: Db = prisma): Promise<string | null> {
  const prev = await findPreviousFiscalPeriod(fiscalPeriodId, db);
  if (!prev) return null;
  const close = await withoutFiscalPeriodScope(() => db.inventoryAccountingClose.findUnique({ where: { fiscalPeriodId: prev.id }, select: { id: true } }));
  if (close) return null;
  return `بستن حسابداری موجودی دوره مالی قبل («${prev.title}») انجام نشده است؛ ابتدا آن را از «عملیات پایان دوره › بستن حسابداری موجودی» انجام دهید`;
}

export async function findNextFiscalPeriod(fiscalPeriodId: number, db: Db = prisma) {
  const fp = await db.fiscalPeriod.findUnique({ where: { id: fiscalPeriodId } });
  if (!fp) return null;
  return db.fiscalPeriod.findFirst({ where: { fromDate: { gt: fp.toDate } }, orderBy: { fromDate: "asc" } });
}

/**
 * «قفل تغییر قیمت در سال بسته‌شده»: وقتی «بستن حسابداری موجودی» یک دوره مالی انجام شده، مبلغ اسناد آن سال (و مبالغ افتتاحیه‌ی
 * سال بعد که از آن‌ها ساخته شده) نباید تغییر کند — نه قیمت‌گذاری/برگشت قیمت‌گذاری موتور، نه هیچ نوشتن/حذف مبلغ دیگر
 * (تایید/برگشت فاکتور خرید، هزینه‌های مرتبط، موجودی اول دوره دستی، ...). تنها راه: «برگشت بستن حسابداری موجودی».
 *
 * هم‌زمانی: بستن/برگشت بستن دوره M قفل انحصاری (M+1) می‌گیرد؛ این تابع قبل از خواندن، قفل «مشترک» همان (M+1) را می‌گیرد تا
 * تغییرِ در حال انجام یا قبل از بستن کامل شود (و بستن، نتیجه‌اش را ببیند) یا بعد از آن دیده شود و رد گردد. اگر دوره‌ی بعد تعریف
 * نشده باشد بستنی هم نمی‌تواند وجود داشته باشد. نتیجه‌ی «بسته نیست» در همان تراکنش به‌ازای هر دوره کش می‌شود (قفل تا پایان
 * تراکنش نگه داشته می‌شود، پس معتبر می‌ماند) تا نوشتن‌های پشت‌سرهم (مثلاً موتور قیمت‌گذاری) کوئری اضافه نزنند.
 */
const openYearsChecked = new WeakMap<object, Set<number>>();

export async function assertFiscalYearNotAccountingClosed(tx: Db, fiscalPeriodId: number, action: string): Promise<void> {
  // کش فقط برای tx تراکنشی (هر تراکنش یک شیء تازه)؛ کلاینت سراسری prisma هرگز کش نمی‌شود
  const cacheable = (tx as unknown) !== (prisma as unknown);
  const cache = cacheable ? openYearsChecked.get(tx as object) : undefined;
  if (cache?.has(fiscalPeriodId)) return;
  const next = await findNextFiscalPeriod(fiscalPeriodId, tx);
  if (next) {
    await lockOpeningYearShared(tx, next.id);
    const close = await withoutFiscalPeriodScope(() => tx.inventoryAccountingClose.findUnique({ where: { fiscalPeriodId }, select: { id: true } }));
    if (close) {
      const fp = await tx.fiscalPeriod.findUnique({ where: { id: fiscalPeriodId }, select: { title: true } });
      throw new Error(
        `بستن حسابداری موجودی دوره مالی «${fp?.title ?? fiscalPeriodId}» انجام شده است و ${action} مجاز نیست؛ ابتدا «برگشت بستن حسابداری موجودی» را انجام دهید`
      );
    }
  }
  if (cacheable) {
    const set = cache ?? new Set<number>();
    set.add(fiscalPeriodId);
    openYearsChecked.set(tx as object, set);
  }
}

/** کنترل نوشتن/حذف مبلغ یک ردیف سند انبار: دوره مالیِ سندِ ردیف نباید «بستن حسابداری موجودی» شده باشد. */
export async function assertLineAmountChangeAllowed(tx: Db, lineId: number): Promise<void> {
  const line = await withoutFiscalPeriodScope(() =>
    tx.inventoryDocumentLine.findUnique({ where: { id: lineId }, select: { document: { select: { fiscalPeriodId: true } } } })
  );
  if (!line) return;
  await assertFiscalYearNotAccountingClosed(tx, line.document.fiscalPeriodId, "تغییر مبلغ اسناد آن");
}
