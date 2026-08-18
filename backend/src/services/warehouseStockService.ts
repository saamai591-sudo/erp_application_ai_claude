import { prisma } from "../lib/prisma";

/**
 * سرویس مرکزی و مشترکِ کنترل موجودی منفی، طبق «مستند عمومی عملیات انبار» (بخش کنترل موجودی منفی):
 * هر سند انباری که پرچم «کنترل موجودی منفی» آن فعال است، باید پیش از قطعی‌کردن/حذف/برگشت از قطعی،
 * این سرویس را فراخوانی کند تا از منفی نشدن موجودی کالا در انبار، از تاریخ سند به بعد، مطمئن شود.
 *
 * انواع سند انبار پیاده‌سازی‌شده تا این فاز:
 * - «موجودی اول دوره» (وارده) و «رسید انبار خرید» (وارده) — فاز اول
 * - «حواله انبار» (صادره/مصرف)، «انتقال بین انبارها» (صادره از مبدا + وارده به مقصد)، و
 *   «انبارگردانی/تعدیل موجودی» (تعدیل امضادار) — فاز دوم
 * - «حواله فروش» (صادره/فروش، ماژول فروش) — دقیقاً مثل حواله انبار مصرف، صادره
 *
 * با افزوده شدن انواع دیگر سند انبار در آینده، کافی‌ست گردش آن‌ها هم به تابع computeStockAsOf افزوده
 * شود (وارده: جمع می‌شود؛ صادره: کم می‌شود)؛ فراخوانی‌کننده‌ها (این فایل و امضای
 * assertNoNegativeStockAfterChange) بدون تغییر باقی می‌مانند.
 *
 * توجه (محدودیت شناخته‌شده، از فاز اول به ارث رسیده): کنترل موجودی منفی در این پیاده‌سازی فقط موجودی
 * را دقیقاً در تاریخ خود سند بررسی می‌کند، نه برای همه‌ی تاریخ‌های بزرگتر مساوی آن (که متن کامل مستند
 * عمومی عملیات انبار می‌خواهد). این ساده‌سازی از پیاده‌سازی فاز اول (موجودی اول دوره/رسید انبار خرید)
 * به ارث رسیده و عمداً برای این سه سند جدید هم حفظ شده تا رفتار یکدست بماند؛ اصلاح کامل آن (اسکن رو به
 * جلو) یک تغییر معماری جداگانه است.
 */

export interface StockExcludeOptions {
  excludeInitialInventoryId?: number;
  excludeWarehouseReceiptId?: number;
  excludeWarehouseIssueId?: number;
  excludeWarehouseTransferId?: number;
  excludeWarehouseAdjustmentId?: number;
  excludeSalesDeliveryId?: number;
}

function sum(rows: { quantity?: any; adjustmentQuantity?: any }[], field: "quantity" | "adjustmentQuantity" = "quantity"): number {
  return rows.reduce((s: number, l: any) => s + Number(l[field]), 0);
}

// موجودی کالا در یک انبار، تا (و شامل) یک تاریخ مشخص، بر اساس تمام اسناد انباریِ قطعی‌شده
export async function computeStockAsOf(
  warehouseId: number,
  goodsItemId: number,
  asOfDate: Date,
  opts: StockExcludeOptions = {}
): Promise<number> {
  const [initialLines, receiptLines, issueLines, transferOutLines, transferInLines, adjustmentLines, salesDeliveryLines] = await Promise.all([
    prisma.initialInventoryLine.findMany({
      where: {
        goodsItemId,
        initialInventory: {
          warehouseId,
          status: "FINALIZED",
          date: { lte: asOfDate },
          ...(opts.excludeInitialInventoryId ? { NOT: { id: opts.excludeInitialInventoryId } } : {}),
        },
      },
      select: { quantity: true },
    }),
    prisma.warehouseReceiptLine.findMany({
      where: {
        goodsItemId,
        warehouseReceipt: {
          warehouseId,
          status: "FINALIZED",
          date: { lte: asOfDate },
          ...(opts.excludeWarehouseReceiptId ? { NOT: { id: opts.excludeWarehouseReceiptId } } : {}),
        },
      },
      select: { quantity: true },
    }),
    prisma.warehouseIssueLine.findMany({
      where: {
        goodsItemId,
        warehouseIssue: {
          warehouseId,
          status: "FINALIZED",
          date: { lte: asOfDate },
          ...(opts.excludeWarehouseIssueId ? { NOT: { id: opts.excludeWarehouseIssueId } } : {}),
        },
      },
      select: { quantity: true },
    }),
    prisma.warehouseTransferLine.findMany({
      where: {
        goodsItemId,
        warehouseTransfer: {
          sourceWarehouseId: warehouseId,
          status: "FINALIZED",
          date: { lte: asOfDate },
          ...(opts.excludeWarehouseTransferId ? { NOT: { id: opts.excludeWarehouseTransferId } } : {}),
        },
      },
      select: { quantity: true },
    }),
    prisma.warehouseTransferLine.findMany({
      where: {
        goodsItemId,
        warehouseTransfer: {
          destWarehouseId: warehouseId,
          status: "FINALIZED",
          date: { lte: asOfDate },
          ...(opts.excludeWarehouseTransferId ? { NOT: { id: opts.excludeWarehouseTransferId } } : {}),
        },
      },
      select: { quantity: true },
    }),
    prisma.warehouseAdjustmentLine.findMany({
      where: {
        goodsItemId,
        warehouseAdjustment: {
          warehouseId,
          status: "FINALIZED",
          date: { lte: asOfDate },
          ...(opts.excludeWarehouseAdjustmentId ? { NOT: { id: opts.excludeWarehouseAdjustmentId } } : {}),
        },
      },
      select: { adjustmentQuantity: true },
    }),
    prisma.salesDeliveryLine.findMany({
      where: {
        goodsItemId,
        salesDelivery: {
          warehouseId,
          status: "FINALIZED",
          date: { lte: asOfDate },
          ...(opts.excludeSalesDeliveryId ? { NOT: { id: opts.excludeSalesDeliveryId } } : {}),
        },
      },
      select: { quantity: true },
    }),
  ]);

  return (
    sum(initialLines) +
    sum(receiptLines) -
    sum(issueLines) -
    sum(transferOutLines) +
    sum(transferInLines) +
    sum(adjustmentLines, "adjustmentQuantity") -
    sum(salesDeliveryLines)
  );
}

/**
 * کنترل می‌کند که اعمال یک تغییر کاهشی (حذف سند/برگشت از قطعی/کاهش مقدار ردیف/قطعی‌کردن یک سند صادره)
 * موجودی کالا را از تاریخ سند به بعد منفی نمی‌کند. برای تغییرات افزایشی (delta >= 0) کنترلی لازم نیست،
 * چون طبق قانون ۸ مستند موجودی اول دوره (و همان قاعده‌ی عمومی برای بقیه‌ی اسناد انبار)، مقدار منفی از
 * ابتدا مجاز نیست.
 */
export async function assertNoNegativeStockAfterChange(
  opts: StockExcludeOptions & {
    warehouseId: number;
    goodsItemId: number;
    asOfDate: Date;
    delta: number; // تغییر خالص مقدار (منفی برای کاهش/حذف/برگشت از قطعی/قطعی‌کردن سند صادره)
  }
): Promise<void> {
  if (opts.delta >= 0) return;
  const current = await computeStockAsOf(opts.warehouseId, opts.goodsItemId, opts.asOfDate, opts);
  if (current + opts.delta < 0) {
    throw new Error("این تغییر باعث منفی شدن موجودی کالا در انبار می‌شود");
  }
}
