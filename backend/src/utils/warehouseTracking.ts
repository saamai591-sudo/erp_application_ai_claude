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
 * این تابع مشترک، برای هر ۶ نوع سند انبار (موجودی اول دوره، رسید انبار خرید، حواله انبار، انتقال بین
 * انبارها، انبارگردانی، حواله فروش)، اجباری‌بودن فیلدهای ردیابی هر ردیف را بر اساس تیک‌های کالای همان
 * ردیف کنترل می‌کند.
 *
 * طبق stockAnalysis.md بند ۱۳: تاریخ انقضا فقط روی Batch نگه‌داری می‌شود، نه مستقل در سطر سند — پس اگر
 * تاریخ انقضا وارد شده، شماره بچ هم الزامی است (نمی‌شود تاریخ انقضا بدون بچ ثبت کرد).
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
    if (l.expiryDate && !l.batchNumber) throw new Error(`برای ثبت تاریخ انقضا در ردیف ${idx + 1}، شماره بچ الزامی است`);
  });
}

export interface ResolvedTrackingRefs {
  batchId: number | null;
  physicalLocationId: number | null;
  serialId: number | null;
}

async function findOrCreateBatch(goodsItemId: number, batchNumber: string, expiryDate: string | null): Promise<number> {
  const existing = await prisma.batch.findUnique({ where: { goodsItemId_batchNumber: { goodsItemId, batchNumber } } });
  if (existing) return existing.id;
  const created = await prisma.batch.create({
    data: { goodsItemId, batchNumber, expiryDate: expiryDate ? new Date(expiryDate) : null, sourceType: "MANUAL" },
  });
  return created.id;
}

async function findOrCreateSerial(goodsItemId: number, serialNumber: string): Promise<number> {
  const existing = await prisma.serial.findUnique({ where: { goodsItemId_serialNumber: { goodsItemId, serialNumber } } });
  if (existing) return existing.id;
  const created = await prisma.serial.create({ data: { goodsItemId, serialNumber } });
  return created.id;
}

// محل فیزیکی امروز در فرم‌های سند انبار صرفاً یک متن آزاد است (نه انتخاب از درخت) — به یک شاخه‌ی
// ریشه‌ی هم‌نام در درخت محل فیزیکی همان انبار نگاشت می‌شود (پیدا بر اساس عنوان، یا ساخت در صورت نبود).
// طراحی درست‌تر (انتخاب واقعی از درخت) در فاز فرانت‌اند (پیکرهای بچ/سریال/محل) پیاده می‌شود.
async function findOrCreateRootPhysicalLocation(warehouseId: number, title: string): Promise<number> {
  const existing = await prisma.physicalLocation.findFirst({ where: { warehouseId, parentId: null, title } });
  if (existing) return existing.id;
  const siblings = await prisma.physicalLocation.findMany({ where: { warehouseId, parentId: null }, orderBy: { code: "desc" }, take: 1 });
  const lastNum = siblings.length ? parseInt(siblings[0].code, 10) || 0 : 0;
  const created = await prisma.physicalLocation.create({ data: { warehouseId, parentId: null, code: String(lastNum + 1), title } });
  return created.id;
}

/** رشته‌های خام سریال/بچ/تاریخ‌انقضا/محل‌فیزیکی هر ردیف را به شناسه‌ی رکورد Master متناظر (پیدا یا
 * ساخت) تبدیل می‌کند — طبق stockAnalysis.md، این‌ها دیگر رشته‌ی آزاد روی خود سطر سند نیستند */
export async function resolveTrackingRefs<T extends TrackableLineInput>(lines: T[], warehouseId: number): Promise<ResolvedTrackingRefs[]> {
  const result: ResolvedTrackingRefs[] = [];
  for (const l of lines) {
    const batchId = l.batchNumber ? await findOrCreateBatch(l.goodsItemId, l.batchNumber, l.expiryDate || null) : null;
    const serialId = l.serialNumber ? await findOrCreateSerial(l.goodsItemId, l.serialNumber) : null;
    const physicalLocationId = l.physicalLocation ? await findOrCreateRootPhysicalLocation(warehouseId, l.physicalLocation) : null;
    result.push({ batchId, physicalLocationId, serialId });
  }
  return result;
}

// =========================================================================
// فیلد GoodsItem.hasTransactions / Warehouse.hasTransactions یک کش ساده است که هر ۶ نوع سند انبار
// (رسید انبار خرید، حواله انبار، انتقال بین انبارها، انبارگردانی، موجودی اول دوره، حواله فروش) هنگام
// «قطعی‌کردن» آن را true می‌کنند تا حذف کالا/انبارِ دارای گردش مسدود شود. اما «برگشت از قطعی» فقط وضعیت
// خودِ سند را به DRAFT برمی‌گرداند و این کش را دست‌نخورده (true) رها می‌کند؛ در نتیجه حتی بعد از برگشت
// از قطعی و حذف کامل سند، کالا/انبار برای همیشه «دارای گردش» گزارش می‌شود و قابل حذف نیست، هرچند در
// دیتابیس هیچ سند قطعی‌ای دیگر به آن ارجاع نمی‌دهد. این دو تابع، بعد از هر «برگشت از قطعی»، وضعیت واقعی
// را با پرس‌وجوی مستقیم بین همه‌ی انواع سند (روی جدول یکپارچه‌ی InventoryDocument) دوباره محاسبه و کش را
// اصلاح می‌کنند.
// =========================================================================

export async function recomputeGoodsItemHasTransactions(goodsItemIds: number[]) {
  const ids = Array.from(new Set(goodsItemIds));
  for (const goodsItemId of ids) {
    // eslint-disable-next-line no-await-in-loop
    const line = await prisma.inventoryDocumentLine.findFirst({ where: { goodsItemId, document: { status: "FINALIZED" } } });
    // eslint-disable-next-line no-await-in-loop
    await prisma.goodsItem.update({ where: { id: goodsItemId }, data: { hasTransactions: !!line } });
  }
}

export async function recomputeWarehouseHasTransactions(warehouseIds: number[]) {
  const ids = Array.from(new Set(warehouseIds));
  for (const warehouseId of ids) {
    // eslint-disable-next-line no-await-in-loop
    const [asWarehouse, asSource, asDest] = await Promise.all([
      prisma.inventoryDocument.findFirst({ where: { warehouseId, status: "FINALIZED" } }),
      prisma.inventoryDocument.findFirst({ where: { sourceWarehouseId: warehouseId, status: "FINALIZED" } }),
      prisma.inventoryDocument.findFirst({ where: { destWarehouseId: warehouseId, status: "FINALIZED" } }),
    ]);
    // eslint-disable-next-line no-await-in-loop
    await prisma.warehouse.update({ where: { id: warehouseId }, data: { hasTransactions: !!(asWarehouse || asSource || asDest) } });
  }
}
