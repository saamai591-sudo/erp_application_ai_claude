import { prisma } from "../lib/prisma";

// قفل «زنده»ی رکوردهای «حسابداری کالا و خدمت» (GoodsServiceAccountingSetting) و «تعیین حسابهای معین» (TreasuryAccountSetting):
// هنگام صدور هر سند حسابداری، رکوردهایی که واقعاً در آن سند استفاده شده‌اند در جدول واسط AccountingSettingUsage (سند ↔ رکورد) ثبت می‌شوند.
// رکوردی که حداقل یک ردیف استفاده دارد قابل ویرایش/حذف نیست؛ با حذف سند حسابداری، ردیف‌های استفاده cascade پاک می‌شوند و قفل خودکار آزاد
// می‌شود (جایگزین پرچم ماندگار hasTransactions که با حذف سند هرگز باز نمی‌شد). تنها محل این منطق است.

/** بعد از صدور موفقِ سند حسابداری صدا زده شود: رکوردهای مورداستفاده‌ی همین سند را ثبت می‌کند (تکراری‌ها نادیده گرفته می‌شوند) */
export async function recordSettingUsage(
  journalEntryId: number,
  ids: { goodsIds?: number[]; treasuryIds?: number[] },
  db: any = prisma
) {
  const rows = [
    ...Array.from(new Set(ids.goodsIds ?? [])).map((goodsSettingId) => ({ journalEntryId, goodsSettingId })),
    ...Array.from(new Set(ids.treasuryIds ?? [])).map((treasurySettingId) => ({ journalEntryId, treasurySettingId })),
  ];
  if (rows.length === 0) return;
  await db.accountingSettingUsage.createMany({ data: rows, skipDuplicates: true });
}

/** شناسه‌ی رکوردهای «حسابداری کالا و خدمت» که حداقل در یک سند حسابداری زنده استفاده شده‌اند (برای قفل فهرست) */
export async function goodsSettingIdsInUse(): Promise<Set<number>> {
  const rows = await prisma.accountingSettingUsage.groupBy({ by: ["goodsSettingId"], where: { goodsSettingId: { not: null } } });
  return new Set(rows.map((r) => r.goodsSettingId as number));
}

/** شناسه‌ی رکوردهای «تعیین حسابهای معین» که حداقل در یک سند حسابداری زنده استفاده شده‌اند */
export async function treasurySettingIdsUsedInJournals(): Promise<Set<number>> {
  const rows = await prisma.accountingSettingUsage.groupBy({ by: ["treasurySettingId"], where: { treasurySettingId: { not: null } } });
  return new Set(rows.map((r) => r.treasurySettingId as number));
}

async function usageNumbers(where: { goodsSettingId?: number; treasurySettingId?: number }): Promise<{ numbers: number[]; more: boolean } | null> {
  const rows = await prisma.accountingSettingUsage.findMany({
    where,
    select: { journalEntry: { select: { referenceNumber: true } } },
    orderBy: { journalEntryId: "asc" },
    take: 6,
  });
  if (rows.length === 0) return null;
  return { numbers: rows.slice(0, 5).map((r) => r.journalEntry.referenceNumber), more: rows.length > 5 };
}

function usageMessage(u: { numbers: number[]; more: boolean }, forDelete: boolean): string {
  const list = `${u.numbers.join("، ")}${u.more ? " و ..." : ""}`;
  return `این تنظیم در سند(های) حسابداری شماره ${list} استفاده شده و قابل ${forDelete ? "حذف" : "ویرایش/حذف"} نیست؛ برای تغییر حساب، رکورد جدید با تاریخ اجرای جدید ثبت کنید یا ابتدا آن سند(ها) را حذف کنید تا قفل آزاد شود`;
}

/** پیام قفل برای رکورد «حسابداری کالا و خدمت»؛ null = قفل نیست */
export async function goodsSettingUsageMessage(id: number, forDelete = false): Promise<string | null> {
  const u = await usageNumbers({ goodsSettingId: id });
  return u ? usageMessage(u, forDelete) : null;
}

/** پیام قفل برای رکورد «تعیین حسابهای معین» از جهت سند حسابداری صادرشده؛ null = قفل نیست */
export async function treasurySettingJournalUsageMessage(id: number, forDelete = false): Promise<string | null> {
  const u = await usageNumbers({ treasurySettingId: id });
  return u ? usageMessage(u, forDelete) : null;
}
