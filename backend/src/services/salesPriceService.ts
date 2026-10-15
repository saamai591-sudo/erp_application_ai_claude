import { prisma } from "../lib/prisma";

// «اعلامیه قیمت فروش»: تنها محل محاسبه‌ی فی پیشنهادیِ سیستم برای پیش‌فاکتور.
// - اعلامیه‌ی مؤثر هر ترکیب (مرکز فروش × نوع فروش × ارز) = آخرین اعلامیه‌ی فعال با تاریخ اجرای ≤ تاریخ سند
//   (یکتایی دیتابیسی `SalesPriceListScope` تضمین می‌کند در هر تاریخ فقط یک اعلامیه برای هر ترکیب هست).
// - قیمت یک کالا = فی پایه‌ی اعلامیه، یا اگر پله‌ی مقدار جور شد: پله‌ی برنده = بزرگ‌ترین minQuantity که ≤ مقدار ردیف است
//   (فقط یک پله برنده می‌شود؛ ترکیب پله‌ها نداریم).
// - کلاینت جدول پله‌های کالا را یک‌بار می‌گیرد و با همین تابع (آینه در فرانت) برای نمایش محاسبه می‌کند؛ مرجع نهایی همیشه سرور است.

export interface PriceTier {
  ruleId: number;
  minQuantity: number;
  effect: "ABSOLUTE" | "PERCENT";
  value: number;
  /** قیمت حاصل از این پله (گردشده به اعشار ارز) */
  price: number;
}

export interface ItemPricing {
  priceListId: number;
  basePrice: number;
  tiers: PriceTier[];
}

export interface ComputedPrice {
  priceListId: number;
  basePrice: number;
  listPrice: number;
  ruleId: number | null;
}

const roundTo = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;

/** قیمت یک پله نسبت به فی پایه (PERCENT: مثبت = اضافه، منفی = کسر) */
export function tierPrice(basePrice: number, effect: "ABSOLUTE" | "PERCENT", value: number, decimalPlaces: number): number {
  return effect === "ABSOLUTE" ? roundTo(value, decimalPlaces) : roundTo(basePrice * (1 + value / 100), decimalPlaces);
}

/** اعلامیه‌ی مؤثر برای ترکیب مرکز×نوع×ارز در تاریخ؛ null = اعلامیه‌ای نیست */
export async function findEffectivePriceListId(p: { salesCenterId: number; salesTypeId: number; currencyId: number; date: Date }): Promise<number | null> {
  const scope = await prisma.salesPriceListScope.findFirst({
    where: {
      salesCenterId: p.salesCenterId,
      salesTypeId: p.salesTypeId,
      currencyId: p.currencyId,
      effectiveDate: { lte: p.date },
      priceList: { isActive: true },
    },
    orderBy: { effectiveDate: "desc" },
    select: { priceListId: true },
  });
  return scope?.priceListId ?? null;
}

/** فی پایه و پله‌های چند کالا از یک اعلامیه (دو کوئری ایندکس‌دار برای همه‌ی کالاها) */
export async function loadItemPricing(priceListId: number, goodsItemIds: number[], decimalPlaces: number): Promise<Map<number, ItemPricing>> {
  const out = new Map<number, ItemPricing>();
  if (goodsItemIds.length === 0) return out;
  const [lines, rules] = await Promise.all([
    prisma.salesPriceListLine.findMany({ where: { priceListId, goodsItemId: { in: goodsItemIds } } }),
    prisma.salesPriceRule.findMany({ where: { priceListId, goodsItemId: { in: goodsItemIds } }, orderBy: { minQuantity: "asc" } }),
  ]);
  for (const l of lines) out.set(l.goodsItemId, { priceListId, basePrice: Number(l.price), tiers: [] });
  for (const r of rules) {
    const entry = out.get(r.goodsItemId);
    if (!entry) continue; // پله بدون فی پایه در اعلامیه نمی‌آید (اعتبارسنجی ذخیره هم همین را می‌خواهد)
    const effect = r.effect as "ABSOLUTE" | "PERCENT";
    const value = Number(r.value);
    entry.tiers.push({ ruleId: r.id, minQuantity: Number(r.minQuantity), effect, value, price: tierPrice(entry.basePrice, effect, value, decimalPlaces) });
  }
  return out;
}

/** قیمت سیستم برای یک مقدار: پله‌ی برنده یا فی پایه */
export function computePrice(pricing: ItemPricing, quantity: number): ComputedPrice {
  let winner: PriceTier | null = null;
  for (const t of pricing.tiers) if (t.minQuantity <= quantity && (!winner || t.minQuantity > winner.minQuantity)) winner = t;
  return {
    priceListId: pricing.priceListId,
    basePrice: pricing.basePrice,
    listPrice: winner ? winner.price : pricing.basePrice,
    ruleId: winner ? winner.ruleId : null,
  };
}

/** اعلامیه‌ای که حداقل یک ردیف پیش‌فاکتور به آن ارجاع دارد = «استفاده‌شده» و قفل است (مشتق، نه پرچم ذخیره‌شده) */
export async function isPriceListUsed(priceListId: number): Promise<boolean> {
  return !!(await prisma.salesQuoteLine.findFirst({ where: { priceListId }, select: { id: true } }));
}
