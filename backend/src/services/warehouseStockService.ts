import { prisma } from "../lib/prisma";

/**
 * سرویس مرکزی و مشترکِ کنترل موجودی منفی، طبق «مستند عمومی عملیات انبار» (بخش کنترل موجودی منفی):
 * هر سند انباری که پرچم «کنترل موجودی منفی» آن فعال است، باید پیش از قطعی‌کردن/حذف/برگشت از قطعی،
 * این سرویس را فراخوانی کند تا از منفی نشدن موجودی کالا در انبار، از تاریخ سند به بعد، مطمئن شود.
 *
 * طبق stockAnalysis.md، هر ۶ نوع سند انبار اکنون روی یک جدول یکپارچه (InventoryDocument/
 * InventoryDocumentLine، به تفکیک documentType) ذخیره می‌شوند؛ این سرویس هم به همان جدول واحد
 * مهاجرت کرده — منطق جمع/تفریق هر نوع (وارده/صادره) دقیقاً همان قبلی مانده، فقط منبع داده عوض شده.
 *
 * توجه (محدودیت شناخته‌شده، از فاز اول به ارث رسیده): کنترل موجودی منفی در این پیاده‌سازی فقط موجودی
 * را دقیقاً در تاریخ خود سند بررسی می‌کند، نه برای همه‌ی تاریخ‌های بزرگتر مساوی آن (که متن کامل مستند
 * عمومی عملیات انبار می‌خواهد). این ساده‌سازی عمداً حفظ شده تا رفتار یکدست بماند؛ اصلاح کامل آن (اسکن
 * رو به جلو) یک تغییر معماری جداگانه است.
 */

export interface StockExcludeOptions {
  excludeInitialInventoryId?: number;
  excludeWarehouseReceiptId?: number;
  excludeWarehouseIssueId?: number;
  excludeWarehouseTransferId?: number;
  excludeWarehouseAdjustmentId?: number;
  excludeSalesDeliveryId?: number;
}

function sum(rows: { quantity: any }[]): number {
  return rows.reduce((s: number, l: any) => s + Number(l.quantity), 0);
}

// موجودی کالا در یک انبار، تا (و شامل) یک تاریخ مشخص، بر اساس تمام اسناد انباریِ قطعی‌شده
export async function computeStockAsOf(
  warehouseId: number,
  goodsItemId: number,
  asOfDate: Date,
  opts: StockExcludeOptions = {}
): Promise<number> {
  const [initialLines, receiptLines, issueLines, transferOutLines, transferInLines, adjustmentLines, salesDeliveryLines] = await Promise.all([
    prisma.inventoryDocumentLine.findMany({
      where: {
        goodsItemId,
        document: {
          documentType: "INITIAL_INVENTORY",
          warehouseId,
          status: "FINALIZED",
          date: { lte: asOfDate },
          ...(opts.excludeInitialInventoryId ? { NOT: { id: opts.excludeInitialInventoryId } } : {}),
        },
      },
      select: { quantity: true },
    }),
    prisma.inventoryDocumentLine.findMany({
      where: {
        goodsItemId,
        document: {
          documentType: "WAREHOUSE_RECEIPT",
          warehouseId,
          status: "FINALIZED",
          date: { lte: asOfDate },
          ...(opts.excludeWarehouseReceiptId ? { NOT: { id: opts.excludeWarehouseReceiptId } } : {}),
        },
      },
      select: { quantity: true },
    }),
    prisma.inventoryDocumentLine.findMany({
      where: {
        goodsItemId,
        document: {
          documentType: "WAREHOUSE_ISSUE",
          warehouseId,
          status: "FINALIZED",
          date: { lte: asOfDate },
          ...(opts.excludeWarehouseIssueId ? { NOT: { id: opts.excludeWarehouseIssueId } } : {}),
        },
      },
      select: { quantity: true },
    }),
    prisma.inventoryDocumentLine.findMany({
      where: {
        goodsItemId,
        document: {
          documentType: "WAREHOUSE_TRANSFER",
          sourceWarehouseId: warehouseId,
          status: "FINALIZED",
          date: { lte: asOfDate },
          ...(opts.excludeWarehouseTransferId ? { NOT: { id: opts.excludeWarehouseTransferId } } : {}),
        },
      },
      select: { quantity: true },
    }),
    prisma.inventoryDocumentLine.findMany({
      where: {
        goodsItemId,
        document: {
          documentType: "WAREHOUSE_TRANSFER",
          destWarehouseId: warehouseId,
          status: "FINALIZED",
          date: { lte: asOfDate },
          ...(opts.excludeWarehouseTransferId ? { NOT: { id: opts.excludeWarehouseTransferId } } : {}),
        },
      },
      select: { quantity: true },
    }),
    prisma.inventoryDocumentLine.findMany({
      where: {
        goodsItemId,
        document: {
          documentType: "WAREHOUSE_ADJUSTMENT",
          warehouseId,
          status: "FINALIZED",
          date: { lte: asOfDate },
          ...(opts.excludeWarehouseAdjustmentId ? { NOT: { id: opts.excludeWarehouseAdjustmentId } } : {}),
        },
      },
      select: { quantity: true },
    }),
    prisma.inventoryDocumentLine.findMany({
      where: {
        goodsItemId,
        document: {
          documentType: "SALES_DELIVERY",
          warehouseId,
          status: "FINALIZED",
          date: { lte: asOfDate },
          ...(opts.excludeSalesDeliveryId ? { NOT: { id: opts.excludeSalesDeliveryId } } : {}),
        },
      },
      select: { quantity: true },
    }),
  ]);

  // adjustmentLines.quantity در جدول یکپارچه از قبل امضادار ذخیره می‌شود (adjustmentQuantity قدیم)،
  // پس مستقیم جمع می‌شود؛ بقیه‌ی انواع مثل قبل بی‌علامت‌اند و جهت‌شان اینجا با +/- اعمال می‌شود.
  return (
    sum(initialLines) +
    sum(receiptLines) -
    sum(issueLines) -
    sum(transferOutLines) +
    sum(transferInLines) +
    sum(adjustmentLines) -
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
