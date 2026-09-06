import { prisma, Db } from "../lib/prisma";

/**
 * سرویس مرکزی و مشترکِ محاسبه‌ی موجودی + کنترل موجودی منفی، طبق «مستند عمومی عملیات انبار» (بخش کنترل
 * موجودی منفی): هر سند انباری که پرچم «کنترل موجودی منفی» آن فعال است، باید پیش از قطعی‌کردن/حذف/
 * برگشت از قطعی، این سرویس را فراخوانی کند تا از منفی نشدن موجودی کالا در انبار، از تاریخ سند به بعد،
 * مطمئن شود.
 *
 * طبق stockAnalysis.md بند ۳۴، انواع سند انبار به مجموعه‌ی کامل عملیات مستند («Purchase Receipt»،
 * «Sales Return»، «Center/Project/Production Consumption» + برگشت‌های‌شان، «Production Receipt»،
 * «Fixed Asset Issue»، «Supplier Return»، ...) گسترش یافته؛ به همین دلیل این تابع از حالت دستیِ باز‌نویسی
 * هر نوع (که برای ۶ نوع اول قابل مدیریت بود) به یک جدول داده‌محور (SIGNED_TYPES) تبدیل شده — هر نوع
 * سند فقط با علامت (+۱ وارده / -۱ صادره) و فیلد انبار مربوطه‌اش تعریف می‌شود، به‌جز
 * WAREHOUSE_ADJUSTMENT که خودش امضادار ذخیره می‌شود (adjustmentQuantity قدیم). «انتقال بین انبارها»
 * به دو سند مستقل تک‌اثره تقسیم شده: WAREHOUSE_TRANSFER_OUT (کاهش در مبدا) و WAREHOUSE_TRANSFER_IN
 * (افزایش در مقصد، با ارجاع ردیف به ردیف مربوطه‌ی WAREHOUSE_TRANSFER_OUT)؛ دیگر یک سند با دو اثر
 * هم‌زمان وجود ندارد.
 *
 * توجه (محدودیت شناخته‌شده، از فاز اول به ارث رسیده): کنترل موجودی منفی در این پیاده‌سازی فقط موجودی
 * را دقیقاً در تاریخ خود سند بررسی می‌کند، نه برای همه‌ی تاریخ‌های بزرگتر مساوی آن (که متن کامل مستند
 * عمومی عملیات انبار می‌خواهد). این ساده‌سازی عمداً حفظ شده تا رفتار یکدست بماند؛ اصلاح کامل آن (اسکن
 * رو به جلو) یک تغییر معماری جداگانه است.
 */

export interface StockExcludeOptions {
  excludeInitialInventoryId?: number;
  excludeWarehouseReceiptId?: number;
  excludeWarehouseTransferOutId?: number;
  excludeWarehouseTransferInId?: number;
  excludeWarehouseAdjustmentId?: number;
  excludeSalesDeliveryId?: number;
  excludeSalesReturnId?: number;
  excludeSupplierReturnId?: number;
  excludeProductionReceiptId?: number;
  excludeCenterConsumptionId?: number;
  excludeProjectConsumptionId?: number;
  excludeProductionConsumptionId?: number;
  excludeCenterConsumptionReturnId?: number;
  excludeProjectConsumptionReturnId?: number;
  excludeProductionConsumptionReturnId?: number;
  excludeFixedAssetIssueId?: number;
  excludeInventoryCountingShortageId?: number;
}

type WarehouseField = "warehouseId" | "sourceWarehouseId" | "destWarehouseId";

interface SignedTypeRule {
  documentType: string;
  sign: 1 | -1;
  warehouseField: WarehouseField;
  excludeKey: keyof StockExcludeOptions;
}

// وارده (+۱) / صادره (-۱) — دقیقاً طبق بند ۳۴ سند stockAnalysis.md
export const SIGNED_TYPES: SignedTypeRule[] = [
  { documentType: "INITIAL_INVENTORY", sign: 1, warehouseField: "warehouseId", excludeKey: "excludeInitialInventoryId" },
  { documentType: "WAREHOUSE_RECEIPT", sign: 1, warehouseField: "warehouseId", excludeKey: "excludeWarehouseReceiptId" },
  { documentType: "SALES_RETURN", sign: 1, warehouseField: "warehouseId", excludeKey: "excludeSalesReturnId" },
  { documentType: "PRODUCTION_RECEIPT", sign: 1, warehouseField: "warehouseId", excludeKey: "excludeProductionReceiptId" },
  { documentType: "CENTER_CONSUMPTION_RETURN", sign: 1, warehouseField: "warehouseId", excludeKey: "excludeCenterConsumptionReturnId" },
  { documentType: "PROJECT_CONSUMPTION_RETURN", sign: 1, warehouseField: "warehouseId", excludeKey: "excludeProjectConsumptionReturnId" },
  { documentType: "PRODUCTION_CONSUMPTION_RETURN", sign: 1, warehouseField: "warehouseId", excludeKey: "excludeProductionConsumptionReturnId" },
  { documentType: "WAREHOUSE_TRANSFER_OUT", sign: -1, warehouseField: "warehouseId", excludeKey: "excludeWarehouseTransferOutId" },
  { documentType: "WAREHOUSE_TRANSFER_IN", sign: 1, warehouseField: "warehouseId", excludeKey: "excludeWarehouseTransferInId" },
  { documentType: "SALES_DELIVERY", sign: -1, warehouseField: "warehouseId", excludeKey: "excludeSalesDeliveryId" },
  { documentType: "CENTER_CONSUMPTION", sign: -1, warehouseField: "warehouseId", excludeKey: "excludeCenterConsumptionId" },
  { documentType: "PROJECT_CONSUMPTION", sign: -1, warehouseField: "warehouseId", excludeKey: "excludeProjectConsumptionId" },
  { documentType: "PRODUCTION_CONSUMPTION", sign: -1, warehouseField: "warehouseId", excludeKey: "excludeProductionConsumptionId" },
  { documentType: "SUPPLIER_RETURN", sign: -1, warehouseField: "warehouseId", excludeKey: "excludeSupplierReturnId" },
  { documentType: "FIXED_ASSET_ISSUE", sign: -1, warehouseField: "warehouseId", excludeKey: "excludeFixedAssetIssueId" },
  { documentType: "INVENTORY_COUNTING_SHORTAGE", sign: -1, warehouseField: "warehouseId", excludeKey: "excludeInventoryCountingShortageId" },
];

function sum(rows: { quantity: any }[]): number {
  return rows.reduce((s: number, l: any) => s + Number(l.quantity), 0);
}

// موجودی کالا در یک انبار، تا (و شامل) یک تاریخ مشخص، بر اساس تمام اسناد انباریِ قطعی‌شده
export async function computeStockAsOf(
  warehouseId: number,
  goodsItemId: number,
  asOfDate: Date,
  opts: StockExcludeOptions = {},
  db: Db = prisma
): Promise<number> {
  const signedQueries = SIGNED_TYPES.map((rule) =>
    db.inventoryDocumentLine
      .findMany({
        where: {
          goodsItemId,
          document: {
            documentType: rule.documentType as any,
            [rule.warehouseField]: warehouseId,
            date: { lte: asOfDate },
            ...(opts[rule.excludeKey] ? { NOT: { id: opts[rule.excludeKey] } } : {}),
          },
        },
        select: { quantity: true },
      })
      .then((rows) => rule.sign * sum(rows))
  );

  const adjustmentQuery = db.inventoryDocumentLine
    .findMany({
      where: {
        goodsItemId,
        document: {
          documentType: "WAREHOUSE_ADJUSTMENT",
          warehouseId,
          date: { lte: asOfDate },
          ...(opts.excludeWarehouseAdjustmentId ? { NOT: { id: opts.excludeWarehouseAdjustmentId } } : {}),
        },
      },
      select: { quantity: true },
    })
    // WAREHOUSE_ADJUSTMENT.quantity در جدول یکپارچه از قبل امضادار ذخیره می‌شود (adjustmentQuantity قدیم)
    .then((rows) => sum(rows));

  const parts = await Promise.all([...signedQueries, adjustmentQuery]);
  return parts.reduce((s, p) => s + p, 0);
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
  },
  db: Db = prisma
): Promise<void> {
  if (opts.delta >= 0) return;
  const current = await computeStockAsOf(opts.warehouseId, opts.goodsItemId, opts.asOfDate, opts, db);
  if (current + opts.delta < 0) {
    throw new Error("این تغییر باعث منفی شدن موجودی کالا در انبار می‌شود");
  }
}
