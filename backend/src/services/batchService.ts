import { prisma } from "../lib/prisma";
import { SIGNED_TYPES } from "./warehouseStockService";

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
  productionReferenceId?: number | null;
  description?: string | null;
}

export async function createBatch(input: CreateBatchInput) {
  if (!input.goodsItemId) throw new Error("کالا الزامی است");
  if (!input.batchNumber || !input.batchNumber.trim()) throw new Error("شماره بچ الزامی است");

  const goodsItem = await prisma.goodsItem.findUnique({ where: { id: input.goodsItemId } });
  if (!goodsItem) throw new Error("کالا یافت نشد");

  const dup = await prisma.batch.findUnique({
    where: { goodsItemId_batchNumber: { goodsItemId: input.goodsItemId, batchNumber: input.batchNumber.trim() } },
  });
  if (dup) throw new Error("این شماره بچ قبلا برای همین کالا ثبت شده است");

  return prisma.batch.create({
    data: {
      goodsItemId: input.goodsItemId,
      batchNumber: input.batchNumber.trim(),
      productionDate: input.productionDate ? new Date(input.productionDate) : null,
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
      sourceType: input.sourceType ?? "MANUAL",
      supplierId: input.supplierId ?? null,
      productionReferenceId: input.productionReferenceId ?? null,
      description: input.description ?? null,
    },
  });
}

export async function getBatch(id: number) {
  return prisma.batch.findUnique({ where: { id }, include: { goodsItem: true, supplier: true } });
}

export async function getBatches(filter: { goodsItemId?: number } = {}) {
  return prisma.batch.findMany({
    where: filter.goodsItemId ? { goodsItemId: filter.goodsItemId } : undefined,
    include: { goodsItem: true, supplier: true },
    orderBy: { batchNumber: "asc" },
  });
}

/** بچ باید وجود داشته باشد، فعال باشد و متعلق به همان کالا باشد — استفاده در سطر سند انبار (فاز اتصال) */
export async function validateBatch(goodsItemId: number, batchId: number) {
  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error("بچ یافت نشد");
  if (batch.goodsItemId !== goodsItemId) throw new Error("این بچ متعلق به این کالا نیست");
  if (!batch.isActive) throw new Error("این بچ غیرفعال است");
  return batch;
}

/** پیشنهاد شماره بچ بعدی برای یک کالا (صرفا پیشنهاد — کاربر می‌تواند آن را تغییر دهد) */
export async function generateBatchNumber(goodsItemId: number): Promise<string> {
  const count = await prisma.batch.count({ where: { goodsItemId } });
  return `B${String(count + 1).padStart(4, "0")}`;
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
          where: { batchId, line: { document: { documentType: rule.documentType as any } } },
          select: { quantity: true },
        })
        .then((rows) => rule.sign * rows.reduce((s, r) => s + Number(r.quantity), 0))
    )
  );
  return sums.reduce((s, v) => s + v, 0);
}
