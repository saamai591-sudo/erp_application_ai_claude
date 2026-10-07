import { prisma } from "../lib/prisma";

// «رکورد مؤثر» حسابداری کالا و خدمت — نقطه‌ی مرکزی و یکتا. هر رکورد (GoodsServiceAccountingSetting) یک «تاریخ اجرا» دارد؛
// برای یک سند، از بین رکوردهای هم‌کلید (نوع حساب / گروه حسابداری / گروه انبار / نوع فروش / نوع خرید / نوع سند / خدمت) آخرین رکوردی
// که effectiveDate آن ≤ تاریخ سند است مؤثر است. تغییر حساب = ثبت رکورد جدید با تاریخ اجرای جدید (رکورد قدیمی دست‌نخورده می‌ماند).
// همه‌ی صدور سندها (انبار، فاکتورها، دریافت/پرداخت و ...) باید رکورد را از همین‌جا بردارند، نه با جستجوی مستقیم.
// قفل: رکوردی که در یک سند حسابداری صادرشده استفاده شده، با markSettingsUsed علامت (hasTransactions) می‌خورد و دیگر قابل ویرایش/حذف نیست.

export interface EffectiveDated {
  id: number;
  effectiveDate: Date;
  accountType: string;
  accountingGroupId: number | null;
  warehouseGroupId: number | null;
  salesTypeId: number | null;
  warehouseDocType: string | null;
  purchaseTypeId: number | null;
  serviceId: number | null;
}

const dayValue = (d: Date | string) => new Date(d).getTime();

/** کلید هم‌ارزیِ رکوردها: رکوردهایی با این کلیدِ یکسان، نسخه‌های تاریخی یک تنظیم‌اند */
export function settingKey(s: Omit<EffectiveDated, "id" | "effectiveDate">): string {
  return [s.accountType, s.accountingGroupId ?? "", s.warehouseGroupId ?? "", s.salesTypeId ?? "", s.warehouseDocType ?? "", s.purchaseTypeId ?? "", s.serviceId ?? ""].join("|");
}

/**
 * از میان رکوردهای واکشی‌شده، آنهایی که با شرط match جور شده‌اند را می‌گیرد و برای هر کلید فقط رکورد مؤثر در تاریخ سند را برمی‌گرداند
 * (آخرین effectiveDate ≤ docDate). اگر برای یک کلید هیچ رکوردی تا آن تاریخ شروع نشده باشد، آن کلید نتیجه ندارد.
 */
export function pickEffective<T extends EffectiveDated>(settings: T[], docDate: Date, match?: (s: T) => boolean): T | undefined {
  const limit = dayValue(docDate);
  let best: T | undefined;
  for (const s of settings) {
    if (dayValue(s.effectiveDate) > limit) continue;
    if (match && !match(s)) continue;
    if (!best || dayValue(s.effectiveDate) > dayValue(best.effectiveDate)) best = s;
  }
  return best;
}

/**
 * جایگزین «settings.find(...)» در صدورهای دسته‌ای: رکوردها یک‌بار واکشی می‌شوند و برای هر سند/ردیف با تاریخ خودش انتخاب می‌شود.
 * رکوردهای برگردانده‌شده ثبت می‌شوند تا بعد از صدور موفق با markUsed() قفل شوند.
 */
export class EffectiveSettings<T extends EffectiveDated> {
  private used = new Set<number>();
  constructor(private settings: T[]) {}

  find(docDate: Date, match?: (s: T) => boolean): T | undefined {
    const s = pickEffective(this.settings, docDate, match);
    if (s) this.used.add(s.id);
    return s;
  }

  /** رکوردهای مؤثری که تا اینجا برداشته شده‌اند */
  get usedIds(): number[] {
    return [...this.used];
  }

  /** بعد از صدور موفقِ سند حسابداری صدا زده شود */
  async markUsed(db: any = prisma) {
    await markSettingsUsed(this.usedIds, db);
  }
}

/** رکوردهای استفاده‌شده در یک سند حسابداری صادرشده را قفل می‌کند (ماندگار؛ با حذف سند باز نمی‌شود) */
export async function markSettingsUsed(ids: number[], db: any = prisma) {
  if (ids.length === 0) return;
  await db.goodsServiceAccountingSetting.updateMany({ where: { id: { in: ids }, hasTransactions: false }, data: { hasTransactions: true } });
}

/** معادل findFirst با شرط where: رکورد مؤثر برای تاریخ docDate (برای مصرف‌کننده‌های تکی) */
export async function findEffectiveSetting(where: any, docDate: Date, include: any = { account: true }) {
  const rows = await prisma.goodsServiceAccountingSetting.findMany({ where: { ...where, effectiveDate: { lte: docDate } }, include, orderBy: { effectiveDate: "desc" }, take: 1 });
  return (rows[0] as any) ?? null;
}
