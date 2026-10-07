import { prisma } from "../lib/prisma";
import { recordSettingUsage } from "./settingUsageService";

// «تعیین حسابهای معین» (TreasuryAccountSetting) — رکورد مؤثر طبق «تاریخ اجرا»: برای یک سند، از میان رکوردهای هم‌هدف (نوع حساب + همان بانک/صندوق/نوع...)
// آخرین رکوردی که effectiveDate آن ≤ تاریخ سند است مؤثر است. تغییر حساب = رکورد جدید با تاریخ اجرای جدید. همه‌ی صدورهای سند باید رکورد را از همین‌جا بردارند.
// قفل: رکوردی که در سند حسابداری زنده استفاده شده (جدول واسط AccountingSettingUsage؛ services/settingUsageService.ts) یا ردیف حسابداریِ سند خزانه به آن وصل است، قابل ویرایش/حذف نیست.

const day = (d: Date | string) => new Date(d).getTime();

export interface DatedTreasurySetting {
  id: number;
  effectiveDate: Date;
}

/** از میان رکوردهای جور (pred)، مؤثرترین برای تاریخ سند را برمی‌گرداند */
export function pickEffectiveTreasury<T extends DatedTreasurySetting>(list: T[], docDate: Date, pred?: (s: T) => boolean): T | undefined {
  const limit = day(docDate);
  let best: T | undefined;
  for (const s of list) {
    if (day(s.effectiveDate) > limit) continue;
    if (pred && !pred(s)) continue;
    if (!best || day(s.effectiveDate) > day(best.effectiveDate)) best = s;
  }
  return best;
}

/** جایگزین «settings.find(...)» در صدورهای خزانه؛ رکوردهای برگردانده‌شده ثبت می‌شوند تا بعد از صدور موفق با markUsed() قفل شوند */
export class EffectiveTreasurySettings {
  private used = new Set<number>();
  constructor(private settings: any[]) {}

  find(docDate: Date, pred?: (s: any) => boolean): any | undefined {
    const s = pickEffectiveTreasury(this.settings, docDate, pred);
    if (s) this.used.add(s.id);
    return s;
  }

  get usedIds(): number[] {
    return [...this.used];
  }

  async markUsed(journalEntryId: number, db: any = prisma) {
    await markTreasurySettingsUsed(journalEntryId, this.usedIds, db);
  }
}

export async function markTreasurySettingsUsed(journalEntryId: number, ids: number[], db: any = prisma) {
  await recordSettingUsage(journalEntryId, { treasuryIds: ids }, db);
}

/** معادل findFirst با شرط where: رکورد مؤثر برای تاریخ docDate (با معین) */
export async function findEffectiveTreasurySetting(where: any, docDate: Date) {
  const rows = await prisma.treasuryAccountSetting.findMany({ where: { ...where, effectiveDate: { lte: docDate } }, include: { account: true }, orderBy: { effectiveDate: "desc" }, take: 1 });
  return (rows[0] as any) ?? null;
}

/**
 * رکوردِ «تعیین حسابهای معین» وقتی که ردیف حسابداریِ یک دریافت/پرداخت به آن وصل است قفل است؛ پیام، شماره‌ی چند سند اول را می‌آورد تا کاربر
 * بداند برای «حذف اطلاعات حسابداری» کجا برود (یا به‌جای ویرایش، رکورد جدید با تاریخ اجرای جدید بسازد).
 */
export async function treasurySettingUsageMessage(id: number): Promise<string | null> {
  const [r, p] = await Promise.all([
    prisma.receiptAccountingLine.findMany({ where: { treasurySettingId: id }, select: { receipt: { select: { number: true } } }, distinct: ["receiptId"], take: 6 }),
    prisma.paymentAccountingLine.findMany({ where: { treasurySettingId: id }, select: { payment: { select: { number: true } } }, distinct: ["paymentId"], take: 6 }),
  ]);
  if (r.length === 0 && p.length === 0) return null;
  const parts: string[] = [];
  if (r.length) parts.push(`دریافت شماره ${r.slice(0, 5).map((x) => x.receipt.number).join("، ")}${r.length > 5 ? " و ..." : ""}`);
  if (p.length) parts.push(`پرداخت شماره ${p.slice(0, 5).map((x) => x.payment.number).join("، ")}${p.length > 5 ? " و ..." : ""}`);
  return `این تنظیم در اطلاعات حسابداری اسناد خزانه استفاده شده (${parts.join("؛ ")}) و قابل ویرایش/حذف نیست؛ برای تغییر حساب، رکورد جدید با تاریخ اجرای جدید ثبت کنید یا ابتدا «حذف اطلاعات حسابداری» آن اسناد را انجام دهید`;
}

/** شناسه‌ی رکوردهایی که ردیف حسابداری به آن‌ها وصل است (برای نمایش قفل در فهرست) */
export async function treasurySettingIdsInUse(): Promise<Set<number>> {
  const [r, p] = await Promise.all([
    prisma.receiptAccountingLine.groupBy({ by: ["treasurySettingId"], where: { treasurySettingId: { not: null } } }),
    prisma.paymentAccountingLine.groupBy({ by: ["treasurySettingId"], where: { treasurySettingId: { not: null } } }),
  ]);
  return new Set<number>([...r, ...p].map((x) => x.treasurySettingId as number));
}
