import { Prisma, DocumentAmountPriceType } from "@prisma/client";
import { prisma } from "../lib/prisma";

// طبق Documents/WareHouseAmountChanges.md: تنها نقطه‌ی خواندن/نوشتن جدول DocumentItemAmount در کل
// برنامه. هیچ کد دیگری نباید مستقیماً prisma.documentItemAmount را صدا بزند — همه از این‌جا عبور
// می‌کنند تا قانون «Difference همیشه سمت بک‌اند از روی SUM قبلی محاسبه می‌شود، هرگز از فرانت‌اند
// اعتماد نمی‌شود» و «هیچ رکوردی هرگز overwrite نمی‌شود، فقط رکورد تازه اضافه می‌شود» در یک‌جا تضمین شود.

export type { DocumentAmountPriceType };

// نوع کلاینت به‌صورت any گرفته می‌شود: هم prisma (که چون از یک $extends پویا (lib/prisma.ts) برمی‌گردد
// نوع دقیقش با Prisma.TransactionClient یکی نمی‌شود) و هم tx داخل $transaction باید بدون اصطکاک قابل
// پاس دادن باشند.
type Client = any;

/** SUM(difference) دقیق (Decimal) برای چند ردیف با هم — یک کوئری batched، برای جلوگیری از N+1 در فهرست‌ها. */
export async function getLineAmounts(lineIds: number[], client: Client = prisma): Promise<Map<number, Prisma.Decimal>> {
  if (lineIds.length === 0) return new Map();
  const rows = await client.documentItemAmount.groupBy({
    by: ["lineId"],
    where: { lineId: { in: lineIds } },
    _sum: { difference: true },
  });
  return new Map(rows.map((r: { lineId: number; _sum: { difference: Prisma.Decimal | null } }) => [r.lineId, r._sum.difference ?? new Prisma.Decimal(0)]));
}

export async function getLineAmount(lineId: number, client: Client = prisma): Promise<Prisma.Decimal> {
  const map = await getLineAmounts([lineId], client);
  return map.get(lineId) ?? new Prisma.Decimal(0);
}

export function computeUnitCost(amount: Prisma.Decimal | number | string, quantity: Prisma.Decimal | number | string): number {
  const q = Number(quantity);
  return q > 0 ? Number(amount) / q : 0;
}

/**
 * یک رکورد تاریخچه‌ی تازه ثبت می‌کند — Difference همیشه این‌جا (نه از فرانت‌اند) محاسبه می‌شود:
 * Difference = newAmount − SUM(Differenceهای قبلی همین ردیف). رکورد قبلی هرگز overwrite نمی‌شود.
 * اگر newAmount دقیقاً برابر مجموع فعلی باشد (Difference صفر)، باز هم یک رکورد ثبت می‌شود — تصمیم
 * این‌که «آیا اصلاً لازم است این تابع صدا زده شود» به عهده‌ی caller است (مثلاً برای خطوطی که هنوز اصلاً
 * قیمت‌گذاری نشده‌اند، معمولاً caller این تابع را صدا نمی‌زند، نه این‌که این‌جا رکورد صفر فیلتر شود).
 */
export async function setLineAmount(
  tx: Client,
  params: {
    lineId: number;
    newAmount: number;
    priceType: DocumentAmountPriceType;
    effectiveDate?: Date;
    journalEntryId?: number | null;
    goodsPricingStatusId?: number | null;
    servicePurchaseInvoiceAllocationId?: number | null;
    createdById?: number | null;
  }
): Promise<{ difference: number; amount: number }> {
  const current = await getLineAmount(params.lineId, tx);
  const difference = params.newAmount - Number(current);
  await tx.documentItemAmount.create({
    data: {
      lineId: params.lineId,
      priceType: params.priceType,
      amount: params.newAmount,
      difference,
      effectiveDate: params.effectiveDate ?? new Date(),
      journalEntryId: params.journalEntryId ?? null,
      goodsPricingStatusId: params.goodsPricingStatusId ?? null,
      servicePurchaseInvoiceAllocationId: params.servicePurchaseInvoiceAllocationId ?? null,
      createdById: params.createdById ?? null,
    },
  });
  return { difference, amount: params.newAmount };
}

/**
 * حذف کامل آخرین رکورد یک lineId+priceType خاص — استثنای عمدی روی قاعده‌ی «هیچ رکوردی هرگز overwrite/
 * حذف نمی‌شود»، فقط برای برگشت‌ازتاییدِ فاکتور خرید: طبق تصمیم صریح کاربر، برگشت‌ازتایید نباید یک
 * رکورد صفرکننده‌ی تازه اضافه کند (که مبلغ نهایی رسید را صفر می‌کرد)، بلکه باید همان رکورد CROSS_ENTITY
 * که در لحظه‌ی تایید ساخته شده بود را کامل حذف کند تا مبلغ به مقدار قبل از تایید (رکورد USER_ENTRY
 * اصلی) برگردد. اگر رکوردی با این lineId+priceType یافت نشود، بی‌صدا نادیده گرفته می‌شود.
 */
export async function deleteLatestLineAmount(tx: Client, params: { lineId: number; priceType: DocumentAmountPriceType }): Promise<void> {
  const row = await tx.documentItemAmount.findFirst({
    where: { lineId: params.lineId, priceType: params.priceType },
    orderBy: { id: "desc" },
  });
  if (row) {
    await tx.documentItemAmount.delete({ where: { id: row.id } });
  }
}

/**
 * هر شیء دارای id/quantity را با دو فیلد محاسبه‌شده amount/unitCost غنی می‌کند — دقیقاً همان دو نامی که
 * قبلاً ستون‌های خام روی InventoryDocumentLine بودند، تا کد مصرف‌کننده‌ی پایین‌دست (ساخت پاسخ JSON،
 * فرانت‌اند) بدون تغییر بماند. برای فهرست‌ها همیشه از این تابع استفاده شود، نه از یک حلقه‌ی جدا به‌ازای
 * هر ردیف (که یک کوئری اضافه به ازای هر ردیف می‌شد).
 */
export async function enrichLinesWithAmount<T extends { id: number; quantity: Prisma.Decimal | number | string }>(
  lines: T[],
  client: Client = prisma
): Promise<(T & { amount: number; unitCost: number })[]> {
  const map = await getLineAmounts(lines.map((l) => l.id), client);
  return lines.map((l) => {
    const amount = Number(map.get(l.id) ?? 0);
    return { ...l, amount, unitCost: computeUnitCost(amount, l.quantity) };
  });
}
