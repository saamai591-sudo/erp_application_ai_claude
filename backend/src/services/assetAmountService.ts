import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

// بهای ردیف رسید دارایی (هم‌الگوی documentItemAmountService.ts برای رسید انبار): رکوردهای AssetReceiptLineAmount؛ بهای ردیف = Σ difference و بدون رکورد = «هنوز قیمت‌گذاری نشده».
// تنها محل نوشتن/حذف این رکوردها همین فایل است (قیمت‌گذاری حواله انبار، تایید/برگشت فاکتور خرید و در آینده تسهیم «سایر هزینه‌ها»).

type Db = any; // prisma یا tx

/** بهای ردیف‌ها؛ ردیفِ بدون هیچ رکوردی در نتیجه نیست (نه صفر) */
export async function getAssetLineAmounts(lineIds: number[], client: Db = prisma): Promise<Map<number, Prisma.Decimal>> {
  if (!lineIds.length) return new Map();
  const rows = await client.assetReceiptLineAmount.groupBy({
    by: ["assetReceiptLineId"],
    where: { assetReceiptLineId: { in: lineIds } },
    _sum: { difference: true },
  });
  return new Map(rows.map((r: { assetReceiptLineId: number; _sum: { difference: Prisma.Decimal | null } }) => [r.assetReceiptLineId, r._sum.difference ?? new Prisma.Decimal(0)]));
}

/** رکورد بهای تازه: ردیف را به newAmount می‌رساند (difference = newAmount − بهای فعلی) */
export async function setAssetLineAmount(
  tx: Db,
  p: { lineId: number; priceType: "WAREHOUSE_PRICING" | "PURCHASE_INVOICE" | "RELATED_COST"; newAmount: number | Prisma.Decimal; purchaseInvoiceLineId?: number | null; createdById?: number | null }
) {
  const current = (await getAssetLineAmounts([p.lineId], tx)).get(p.lineId) ?? new Prisma.Decimal(0);
  const next = new Prisma.Decimal(p.newAmount);
  await tx.assetReceiptLineAmount.create({
    data: {
      assetReceiptLineId: p.lineId,
      priceType: p.priceType,
      amount: next,
      difference: next.sub(current),
      purchaseInvoiceLineId: p.purchaseInvoiceLineId ?? null,
      createdById: p.createdById ?? null,
    },
  });
}

/** حذف رکوردهای یک نوع از ردیف‌ها (برگشت تایید رسید/فاکتور)؛ رکوردهای نوع‌های دیگر (مثلاً هزینه‌ی جانبی) سر جایشان می‌مانند */
export async function deleteAssetLineAmounts(tx: Db, p: { lineIds: number[]; priceType: "WAREHOUSE_PRICING" | "PURCHASE_INVOICE" | "RELATED_COST" }) {
  if (!p.lineIds.length) return;
  await tx.assetReceiptLineAmount.deleteMany({ where: { assetReceiptLineId: { in: p.lineIds }, priceType: p.priceType } });
}
