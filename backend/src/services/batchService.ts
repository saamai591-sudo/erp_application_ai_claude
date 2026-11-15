import { prisma, Db } from "../lib/prisma";
import { SIGNED_TYPES, CARRY_FORWARD_OPENING_WHERE } from "./warehouseStockService";

/**
 * سرویس مرکزی بچ، طبق stockAnalysis.md بند ۱۶: «تمام ایجاد و Validation مربوط به Batch باید از یک
 * Service مرکزی انجام شود» — هر مسیری که بچ ایجاد می‌کند (فرم دستی، رسید خرید، تولید) باید از همین
 * توابع استفاده کند تا در نهایت یک Batch Master مشترک ایجاد شود (بند ۱۴).
 */

export interface CreateBatchInput {
  goodsItemId: number;
  batchNumber: string;
  productionDate?: string | null;
  expiryDate?: string | null;
  sourceType?: "MANUAL" | "PURCHASE" | "PRODUCTION";
  supplierId?: number | null;
  /** بچ تولیدی: دستور تولیدی که بچ برای آن ساخته شده */
  productionOrderId?: number | null;
  description?: string | null;
}

export async function createBatch(input: CreateBatchInput, db: Db = prisma) {
  if (!input.goodsItemId) throw new Error("کالا الزامی است");
  if (!input.batchNumber || !input.batchNumber.trim()) throw new Error("شماره بچ الزامی است");

  const goodsItem = await db.goodsItem.findUnique({ where: { id: input.goodsItemId } });
  if (!goodsItem) throw new Error("کالا یافت نشد");

  const dup = await db.batch.findUnique({
    where: { goodsItemId_batchNumber: { goodsItemId: input.goodsItemId, batchNumber: input.batchNumber.trim() } },
  });
  if (dup) throw new Error("این شماره بچ قبلا برای همین کالا ثبت شده است");

  return db.batch.create({
    data: {
      goodsItemId: input.goodsItemId,
      batchNumber: input.batchNumber.trim(),
      productionDate: input.productionDate ? new Date(input.productionDate) : null,
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
      sourceType: input.sourceType ?? "MANUAL",
      supplierId: input.supplierId ?? null,
      productionOrderId: input.productionOrderId ?? null,
      description: input.description ?? null,
    },
  });
}

export async function getBatches(filter: { goodsItemId?: number } = {}) {
  return prisma.batch.findMany({
    where: filter.goodsItemId ? { goodsItemId: filter.goodsItemId } : undefined,
    include: { goodsItem: true, supplier: true, productionOrder: { select: { id: true, number: true } } },
    orderBy: { batchNumber: "asc" },
  });
}

/** پیشنهاد شماره بچ بعدی برای یک کالا (صرفا پیشنهاد — کاربر می‌تواند آن را تغییر دهد) */
export async function generateBatchNumber(goodsItemId: number, db: Db = prisma): Promise<string> {
  // شماره‌ی بعدی بعد از تعداد بچ‌های کالا؛ اگر شماره‌ی B#### هم‌نام (مثلاً دستی) وجود داشته باشد، جلوتر می‌رود
  let n = (await db.batch.count({ where: { goodsItemId } })) + 1;
  for (;;) {
    const candidate = `B${String(n).padStart(4, "0")}`;
    // eslint-disable-next-line no-await-in-loop
    if (!(await db.batch.findUnique({ where: { goodsItemId_batchNumber: { goodsItemId, batchNumber: candidate } }, select: { id: true } }))) return candidate;
    n++;
  }
}

/**
 * موجودی فعلی یک بچ (اطلاعاتی، برای ستون «تعداد» پیکر بچ طبق «انتخاب سریال و بچ») — دقیقا هم‌الگوی
 * SIGNED_TYPES در warehouseStockService.ts (وارده +۱ / صادره -۱)، فقط به‌جای گروه‌بندی بر اساس انبار،
 * بر اساس همین بچ (از طریق InventoryLineBatch) جمع می‌شود. مقدار سقف موجودی برای هر بچ کنترل نمی‌شود
 * (طبق مستند، فقط تجمیع تخصیص‌های یک ردیف باید با مقدار ردیف برابر باشد، نه سقف موجودی بچ).
 */
export async function computeBatchAvailableQuantity(batchId: number): Promise<number> {
  const sums = await Promise.all(
    SIGNED_TYPES.map((rule) =>
      prisma.inventoryLineBatch
        .findMany({
          // سند انتقال مانده‌ی سیستمی فقط رکورد توصیفی است (نگاه کنید به CARRY_FORWARD_OPENING_WHERE) — وگرنه مانده‌ی بچ دوبار شمرده می‌شد
          where: { batchId, line: { document: { documentType: rule.documentType as any, NOT: CARRY_FORWARD_OPENING_WHERE } } },
          select: { quantity: true },
        })
        .then((rows) => rule.sign * rows.reduce((s, r) => s + Number(r.quantity), 0))
    )
  );
  return sums.reduce((s, v) => s + v, 0);
}

/** موجودی هر بچ یک کالا در یک انبار تا (و شامل) یک تاریخ — همان علامت‌های SIGNED_TYPES (وارده +۱ / صادره −۱)، به‌تفکیک انبار */
export async function batchStockInWarehouse(goodsItemId: number, warehouseId: number, asOf: Date, db: Db = prisma): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  await Promise.all(
    SIGNED_TYPES.map(async (rule) => {
      const rows = await db.inventoryLineBatch.findMany({
        where: {
          batch: { goodsItemId },
          line: { document: { documentType: rule.documentType as any, [rule.warehouseField]: warehouseId, date: { lte: asOf }, NOT: CARRY_FORWARD_OPENING_WHERE } },
        },
        select: { batchId: true, quantity: true },
      });
      for (const r of rows) out.set(r.batchId, (out.get(r.batchId) ?? 0) + rule.sign * Number(r.quantity));
    })
  );
  return out;
}

export interface BatchAllocationPlan {
  allocations: { batchId: number; batchNumber: string; quantity: number }[];
  /** مقداری که بچ‌های موجود پوشش نداده‌اند (۰ = کامل تخصیص یافت) */
  shortage: number;
  available: number;
}

/**
 * تخصیص خودکار یک مقدار به بچ‌های موجود در انبار به ترتیب FEFO: اول نزدیک‌ترین تاریخ انقضا (بدون انقضا آخر)،
 * بعد قدیمی‌ترین تاریخ تولید، بعد شناسه. فقط بچ‌های فعالِ دارای موجودی مثبت در همان انبار.
 */
export async function planBatchAllocationFefo(goodsItemId: number, warehouseId: number, quantity: number, asOf: Date, db: Db = prisma): Promise<BatchAllocationPlan> {
  const stock = await batchStockInWarehouse(goodsItemId, warehouseId, asOf, db);
  const ids = [...stock.entries()].filter(([, q]) => q > 1e-9).map(([id]) => id);
  const batches = ids.length ? await db.batch.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true, batchNumber: true, expiryDate: true, productionDate: true } }) : [];
  const t = (d: Date | null) => (d ? d.getTime() : Number.POSITIVE_INFINITY);
  batches.sort((a, b) => t(a.expiryDate) - t(b.expiryDate) || t(a.productionDate) - t(b.productionDate) || a.id - b.id);
  let left = quantity;
  let available = 0;
  const allocations: BatchAllocationPlan["allocations"] = [];
  for (const b of batches) {
    const q = stock.get(b.id) ?? 0;
    available += q;
    if (left <= 1e-9) continue;
    const take = Math.min(left, q);
    allocations.push({ batchId: b.id, batchNumber: b.batchNumber, quantity: Math.round(take * 1e6) / 1e6 });
    left -= take;
  }
  return { allocations, shortage: Math.max(0, Math.round(left * 1e6) / 1e6), available: Math.round(available * 1e6) / 1e6 };
}
