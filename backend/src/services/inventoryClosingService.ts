import { prisma } from "../lib/prisma";
import { computeStockAsOf } from "./warehouseStockService";

/**
 * سرویس «بستن موجودی انبار» / «برگشت بستن موجودی»، طبق stockAnalysis.md بند ۴-۹ و ۴۸-۶۰.
 *
 * نکته‌ی مهم درباره‌ی «Closing جاری» یک انبار (بند ۵۹ + مثال بند ۵۳-۵۶): «جاری» یعنی آخرین عملیاتِ
 * انجام‌شده (Close یا Rollback)، نه ردیف با بزرگ‌ترین closingDate. Rollback عمداً یک ردیف تازه با
 * closingDate عقب‌تر از ردیف قبلی درج می‌کند و همان ردیف تازه، «جاری» محسوب می‌شود؛ ردیف‌های قبلی هرگز
 * ویرایش/حذف نمی‌شوند تا تاریخچه حفظ شود. پس «جاری» = آخرین ردیف INSERT-شده برای آن انبار (id DESC).
 *
 * محدودیت شناخته‌شده (وابسته به فاز ۵ که هنوز ساخته نشده): Snapshot این فاز فقط در سطح (کالا، انبار)
 * محاسبه می‌شود، نه به‌تفکیک کامل Dimensionها (PhysicalLocation/Batch/Serial — بند ۷-۹). ستون‌های
 * physicalLocationId/batchId/serialId روی InventoryClosingLine برای همین از قبل در شِما وجود دارند،
 * ولی تا پیاده‌سازی فاز ۵ (محاسبه‌ی موجودی به‌تفکیک Dimension) همیشه null ذخیره می‌شوند. رفتار
 * CurrentStock (بند ۳٫۲ و ۶۰) در همین سطح (کالا، انبار) صحیح و کامل است؛ فقط شکستن آن به زیرِ محل/بچ/
 * سریال هنوز پیاده نشده.
 */

export interface CloseResult {
  closingId: number;
  closingDate: Date;
  lineCount: number;
}

export async function getCurrentClosing(warehouseId: number) {
  return prisma.inventoryClosing.findFirst({
    where: { warehouseId },
    orderBy: { id: "desc" },
  });
}

/**
 * طبق بند ۵۰-۵۱: سندی با DocumentDate <= LastClosingDate آن انبار، دیگر قابل Create/Update/Delete
 * نیست. اگر انبار هیچ Closing‌ای نداشته باشد، محدودیتی وجود ندارد.
 */
export async function assertWarehouseOpenForDate(warehouseId: number, date: Date): Promise<void> {
  const current = await getCurrentClosing(warehouseId);
  if (!current) return;
  if (date.getTime() <= current.closingDate.getTime()) {
    throw new Error(
      `این انبار تا تاریخ ${current.closingDate.toISOString().slice(0, 10)} بسته شده است؛ برای اصلاح اسناد این بازه ابتدا باید «برگشت بستن موجودی» انجام شود`
    );
  }
}

// مجموعه‌ی distinct کالاهایی که تا closingDate، حداقل یک سند قطعی‌شده در این انبار دارند (به هر سه
// نقش warehouseId/sourceWarehouseId/destWarehouseId — دقیقاً همان دامنه‌ای که computeStockAsOf می‌بیند)
async function listGoodsItemIdsWithActivity(warehouseId: number, closingDate: Date): Promise<number[]> {
  const rows = await prisma.inventoryDocumentLine.findMany({
    where: {
      document: {
        status: "FINALIZED",
        date: { lte: closingDate },
        OR: [{ warehouseId }, { sourceWarehouseId: warehouseId }, { destWarehouseId: warehouseId }],
      },
    },
    select: { goodsItemId: true },
    distinct: ["goodsItemId"],
  });
  return rows.map((r) => r.goodsItemId);
}

// طبق بند ۵۴: Snapshot جدید هرگز از یک Snapshot قبلی محاسبه نمی‌شود — همیشه مستقیم از اسناد.
async function buildSnapshotLines(warehouseId: number, closingDate: Date) {
  const goodsItemIds = await listGoodsItemIdsWithActivity(warehouseId, closingDate);
  const quantities = await Promise.all(goodsItemIds.map((goodsItemId) => computeStockAsOf(warehouseId, goodsItemId, closingDate)));
  return goodsItemIds
    .map((goodsItemId, idx) => ({ goodsItemId, quantity: quantities[idx] }))
    .filter((l) => l.quantity !== 0);
}

/**
 * بستن موجودی انبار تا closingDate. طبق منطق عمومی «بستن»، تاریخ جدید باید از آخرین Closing این انبار
 * (در صورت وجود) جلوتر باشد — حرکت به عقب کار «برگشت بستن موجودی» (rollback) است، نه «بستن».
 */
export async function closeInventory(warehouseId: number, closingDate: Date, userId: number | null): Promise<CloseResult> {
  const current = await getCurrentClosing(warehouseId);
  if (current && closingDate.getTime() <= current.closingDate.getTime()) {
    throw new Error("تاریخ بستن جدید باید از تاریخ آخرین بستن این انبار جلوتر باشد");
  }

  const lines = await buildSnapshotLines(warehouseId, closingDate);

  const closing = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryClosing.create({
      data: {
        warehouseId,
        closingDate,
        createdById: userId,
        lines: { create: lines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity })) },
      },
    });
    await tx.inventoryClosingAudit.create({
      data: {
        action: "CLOSE",
        warehouseId,
        oldClosingDate: current?.closingDate ?? null,
        newClosingDate: closingDate,
        userId,
      },
    });
    return created;
  });

  return { closingId: closing.id, closingDate: closing.closingDate, lineCount: lines.length };
}

/**
 * برگشت بستن موجودی: طبق بند ۵۲-۵۷، انتقال Closing جاری این انبار به یک تاریخ قدیمی‌تر (newClosingDate
 * باید حتماً از closingDate فعلی عقب‌تر باشد). Snapshot جدید هم مثل closeInventory کاملاً از اسناد
 * واقعی (نه از Snapshot قبلی) بازمحاسبه می‌شود.
 */
export async function rollbackClosing(warehouseId: number, newClosingDate: Date, reason: string, userId: number | null): Promise<CloseResult> {
  const current = await getCurrentClosing(warehouseId);
  if (!current) throw new Error("این انبار هیچ Closing‌ای ندارد که قابل برگشت باشد");
  if (newClosingDate.getTime() >= current.closingDate.getTime()) {
    throw new Error("تاریخ برگشت باید از تاریخ Closing جاری این انبار قدیمی‌تر باشد");
  }

  const lines = await buildSnapshotLines(warehouseId, newClosingDate);

  const closing = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryClosing.create({
      data: {
        warehouseId,
        closingDate: newClosingDate,
        createdById: userId,
        lines: { create: lines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity })) },
      },
    });
    await tx.inventoryClosingAudit.create({
      data: {
        action: "ROLLBACK",
        warehouseId,
        oldClosingDate: current.closingDate,
        newClosingDate,
        reason,
        userId,
      },
    });
    return created;
  });

  return { closingId: closing.id, closingDate: closing.closingDate, lineCount: lines.length };
}
