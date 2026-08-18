import { prisma } from "../lib/prisma";

export interface TrackableLineInput {
  goodsItemId: number;
  serialNumber?: string | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  physicalLocation?: string | null;
}

/**
 * طبق «کالا.md» (تب ردیابی)، هر کالا می‌تواند مستقل «سریال‌پذیر»/«بچ»/«تاریخ انقضا»/«محل فیزیکی» باشد.
 * این تیک‌ها روی تعریف کالا فقط ظرفیت را مشخص می‌کنند؛ مقدار واقعی هر کدام باید در سطح هر ردیف هر سند
 * انبار ثبت شود — طبق بند ۴ «مستند عمومی عملیات انبار»: «اطلاعات اختصاصی هر کالا ... در زمان انجام
 * عملیات انبار دریافت و کنترل می‌شود ... این اطلاعات در ساختار عمومی تمامی اسناد انبار تکرار نمی‌شوند و
 * هر فرآیند صرفاً در صورت نیاز به آن‌ها ارجاع خواهد داد».
 *
 * این تابع مشترک، برای هر ۵ نوع سند انبار (موجودی اول دوره، رسید انبار خرید، حواله انبار، انتقال بین
 * انبارها، انبارگردانی)، اجباری‌بودن فیلدهای ردیابی هر ردیف را بر اساس تیک‌های کالای همان ردیف کنترل
 * می‌کند.
 *
 * تصمیم طراحی (چون متن مستندات صراحتاً «اجباری/اختیاری بودن مقدار در سند» را مشخص نکرده، فقط ظرفیت
 * کالا را): وقتی تیک مربوطه روی کالا فعال باشد، درج مقدار در همان ردیف سند اجباری فرض شد — دقیقاً مثل
 * الگوی «کد کالا/واحد سنجش اجباری» در بقیه‌ی فیلدهای ردیف.
 *
 * محدودیت شناخته‌شده (عمداً در این فاز پیاده نشده): این تابع فقط اجباری‌بودن را کنترل می‌کند، نه صحت
 * موجودی آن سریال/بچ/محل مشخص (مثلاً اینکه سریالی که در حواله انبار خارج می‌شود واقعاً قبلاً با رسید
 * وارد شده باشد). کنترل موجودی منفی (`warehouseStockService`) هم در سطح کل کالا در انبار محاسبه می‌شود،
 * نه به تفکیک سریال/بچ/تاریخ‌انقضا/محل — این یک ماژول ردیابی موجودی کامل (که خارج از محدوده‌ی درخواست
 * فعلی است) نیاز دارد.
 */
export async function validateTrackingFields<T extends TrackableLineInput>(lines: T[]): Promise<void> {
  const goodsItemIds = Array.from(new Set(lines.map((l) => l.goodsItemId).filter(Boolean)));
  if (!goodsItemIds.length) return;
  const goodsItems: any[] = await prisma.goodsItem.findMany({
    where: { id: { in: goodsItemIds } },
    select: { id: true, title: true, isSerialTracked: true, isBatchTracked: true, isExpiryTracked: true, isLocationTracked: true },
  });
  const byId = new Map(goodsItems.map((g: any) => [g.id, g]));

  lines.forEach((l, idx) => {
    const g: any = byId.get(l.goodsItemId);
    if (!g) return; // خطای «کالا یافت نشد» جای دیگری کنترل می‌شود
    if (g.isSerialTracked && !l.serialNumber) throw new Error(`سریال ردیف ${idx + 1} (کالای «${g.title}») الزامی است`);
    if (g.isBatchTracked && !l.batchNumber) throw new Error(`شماره بچ ردیف ${idx + 1} (کالای «${g.title}») الزامی است`);
    if (g.isExpiryTracked && !l.expiryDate) throw new Error(`تاریخ انقضای ردیف ${idx + 1} (کالای «${g.title}») الزامی است`);
    if (g.isLocationTracked && !l.physicalLocation) throw new Error(`محل فیزیکی ردیف ${idx + 1} (کالای «${g.title}») الزامی است`);
  });
}

/** فیلدهای ردیابی نرمال‌شده برای ذخیره — رشته‌ی خالی به null تبدیل می‌شود */
export function trackingFieldsForCreate(l: TrackableLineInput) {
  return {
    serialNumber: l.serialNumber || null,
    batchNumber: l.batchNumber || null,
    expiryDate: l.expiryDate ? new Date(l.expiryDate) : null,
    physicalLocation: l.physicalLocation || null,
  };
}

// =========================================================================
// فیلد GoodsItem.hasTransactions / Warehouse.hasTransactions یک کش ساده است که هر ۶ نوع سند انبار/فروش
// (رسید انبار خرید، حواله انبار، انتقال بین انبارها، انبارگردانی، موجودی اول دوره، حواله فروش) هنگام
// «قطعی‌کردن» آن را true می‌کنند تا حذف کالا/انبارِ دارای گردش مسدود شود. اما «برگشت از قطعی» فقط وضعیت
// خودِ سند را به DRAFT برمی‌گرداند و این کش را دست‌نخورده (true) رها می‌کند؛ در نتیجه حتی بعد از برگشت
// از قطعی و حذف کامل سند، کالا/انبار برای همیشه «دارای گردش» گزارش می‌شود و قابل حذف نیست، هرچند در
// دیتابیس هیچ سند قطعی‌ای دیگر به آن ارجاع نمی‌دهد. این دو تابع، بعد از هر «برگشت از قطعی»، وضعیت واقعی
// را با پرس‌وجوی مستقیم بین همه‌ی انواع سند دوباره محاسبه و کش را اصلاح می‌کنند.
// =========================================================================

export async function recomputeGoodsItemHasTransactions(goodsItemIds: number[]) {
  const ids = Array.from(new Set(goodsItemIds));
  for (const goodsItemId of ids) {
    // eslint-disable-next-line no-await-in-loop
    const [receipt, issue, transfer, adjustment, initial, delivery] = await Promise.all([
      prisma.warehouseReceiptLine.findFirst({ where: { goodsItemId, warehouseReceipt: { status: "FINALIZED" } } }),
      prisma.warehouseIssueLine.findFirst({ where: { goodsItemId, warehouseIssue: { status: "FINALIZED" } } }),
      prisma.warehouseTransferLine.findFirst({ where: { goodsItemId, warehouseTransfer: { status: "FINALIZED" } } }),
      prisma.warehouseAdjustmentLine.findFirst({ where: { goodsItemId, warehouseAdjustment: { status: "FINALIZED" } } }),
      prisma.initialInventoryLine.findFirst({ where: { goodsItemId, initialInventory: { status: "FINALIZED" } } }),
      prisma.salesDeliveryLine.findFirst({ where: { goodsItemId, salesDelivery: { status: "FINALIZED" } } }),
    ]);
    // eslint-disable-next-line no-await-in-loop
    await prisma.goodsItem.update({
      where: { id: goodsItemId },
      data: { hasTransactions: !!(receipt || issue || transfer || adjustment || initial || delivery) },
    });
  }
}

export async function recomputeWarehouseHasTransactions(warehouseIds: number[]) {
  const ids = Array.from(new Set(warehouseIds));
  for (const warehouseId of ids) {
    // eslint-disable-next-line no-await-in-loop
    const [receipt, issue, transferOut, transferIn, adjustment, initial, delivery] = await Promise.all([
      prisma.warehouseReceipt.findFirst({ where: { warehouseId, status: "FINALIZED" } }),
      prisma.warehouseIssue.findFirst({ where: { warehouseId, status: "FINALIZED" } }),
      prisma.warehouseTransfer.findFirst({ where: { sourceWarehouseId: warehouseId, status: "FINALIZED" } }),
      prisma.warehouseTransfer.findFirst({ where: { destWarehouseId: warehouseId, status: "FINALIZED" } }),
      prisma.warehouseAdjustment.findFirst({ where: { warehouseId, status: "FINALIZED" } }),
      prisma.initialInventory.findFirst({ where: { warehouseId, status: "FINALIZED" } }),
      prisma.salesDelivery.findFirst({ where: { warehouseId, status: "FINALIZED" } }),
    ]);
    // eslint-disable-next-line no-await-in-loop
    await prisma.warehouse.update({
      where: { id: warehouseId },
      data: { hasTransactions: !!(receipt || issue || transferOut || transferIn || adjustment || initial || delivery) },
    });
  }
}
