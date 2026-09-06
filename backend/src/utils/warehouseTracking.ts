import { InventoryDocumentType } from "@prisma/client";
import { prisma, Db } from "../lib/prisma";
import { getPickableSerialIds } from "../services/serialLifecycleService";

export interface TrackableLineInput {
  goodsItemId: number;
  quantity: number;
  batchAllocations?: { batchId: number; quantity: number }[];
  serialIds?: number[];
  /** فقط برای انواع «با مبنا» (برگشت‌ها، انتقال-ورود) — id سطر مبنایی که این ردیف به آن ارجاع می‌دهد؛
   * پیکر سریال آن بر همین اساس محدود می‌شود (نگاه کنید به serialLifecycleService.ts). */
  sourceLineId?: number | null;
  physicalLocation?: string | null;
}

/**
 * طبق «انتخاب سریال و بچ»: هر کالا دقیقا یک trackingMethod دارد.
 * - Serial: تعداد سریال‌های انتخاب‌شده باید دقیقا با مقدار ردیف برابر باشد (هر واحد یک سریال مستقل)،
 *   و هر سریال باید طبق نوع سند/سطر مبنا در حال حاضر «قابل‌انتخاب» باشد (getPickableSerialIds).
 * - Batch: یک ردیف می‌تواند چند بچ داشته باشد، هرکدام با تعداد اختصاصی خودش؛ مجموع این تعدادها باید
 *   دقیقا با مقدار ردیف برابر باشد.
 * - isLocationTracked مستقل و بدون تغییر باقی مانده.
 */
export async function validateTrackingFields<T extends TrackableLineInput>(
  lines: T[],
  documentType: InventoryDocumentType,
  // سریال‌هایی که همین الان روی سند در حال ویرایش قرار دارند — چون در ویرایش، اعتبارسنجی ردیف‌های جدید
  // قبل از هرگونه نوشتن (و قبل از reverseDocumentEffects واقعی) اجرا می‌شود، getPickableSerialIds هنوز
  // وضعیت «قبل از این ویرایش» را می‌بیند که برای این سند خودش دیگر from نیست (چون خودِ همین سند قبلا
  // آن را جلو برده)؛ بدون این استثنا، ویرایش هر سند سریال‌دارِ از‌قبل‌ذخیره‌شده حتی بدون تغییر سریال هم
  // با خطای «قابل انتخاب نیست» رد می‌شود.
  currentlyAssignedSerialIds?: Set<number>
): Promise<void> {
  const goodsItemIds = Array.from(new Set(lines.map((l) => l.goodsItemId).filter(Boolean)));
  if (!goodsItemIds.length) return;
  const goodsItems: any[] = await prisma.goodsItem.findMany({
    where: { id: { in: goodsItemIds } },
    select: { id: true, title: true, trackingMethod: true, isLocationTracked: true },
  });
  const byId = new Map(goodsItems.map((g: any) => [g.id, g]));

  const allBatchIds = Array.from(new Set(lines.flatMap((l) => (l.batchAllocations || []).map((a) => a.batchId))));
  const batches = allBatchIds.length ? await prisma.batch.findMany({ where: { id: { in: allBatchIds } } }) : [];
  const batchById = new Map(batches.map((b: any) => [b.id, b]));

  for (const [idx, l] of lines.entries()) {
    const g: any = byId.get(l.goodsItemId);
    if (!g) continue; // خطای «کالا یافت نشد» جای دیگری کنترل می‌شود

    if (g.trackingMethod === "SERIAL") {
      if (l.batchAllocations?.length) throw new Error(`ردیف ${idx + 1} (کالای «${g.title}») بچ‌پذیر نیست`);
      const serialIds = l.serialIds || [];
      if (serialIds.length !== Number(l.quantity)) {
        throw new Error(`ردیف ${idx + 1} (کالای «${g.title}»): تعداد سریال‌های انتخاب‌شده (${serialIds.length}) باید با مقدار ردیف (${l.quantity}) برابر باشد`);
      }
      if (new Set(serialIds).size !== serialIds.length) throw new Error(`ردیف ${idx + 1} (کالای «${g.title}»): یک سریال دوبار انتخاب شده است`);
      // eslint-disable-next-line no-await-in-loop
      const pickable = await getPickableSerialIds(documentType, l.goodsItemId, l.sourceLineId ?? null);
      for (const sid of serialIds) {
        if (!pickable.has(sid) && !currentlyAssignedSerialIds?.has(sid)) {
          throw new Error(`ردیف ${idx + 1} (کالای «${g.title}»): سریال انتخاب‌شده در حال حاضر قابل انتخاب نیست`);
        }
      }
    } else if (g.trackingMethod === "BATCH") {
      if (l.serialIds?.length) throw new Error(`ردیف ${idx + 1} (کالای «${g.title}») سریال‌پذیر نیست`);
      const allocations = l.batchAllocations || [];
      if (!allocations.length) throw new Error(`بچ ردیف ${idx + 1} (کالای «${g.title}») الزامی است`);
      const sum = allocations.reduce((s, a) => s + Number(a.quantity), 0);
      if (Math.abs(sum - Number(l.quantity)) > 1e-9) {
        throw new Error(`ردیف ${idx + 1} (کالای «${g.title}»): مجموع مقدار بچ‌های انتخاب‌شده (${sum}) باید با مقدار ردیف (${l.quantity}) برابر باشد`);
      }
      const seenBatchIds = new Set<number>();
      for (const a of allocations) {
        if (seenBatchIds.has(a.batchId)) throw new Error(`ردیف ${idx + 1} (کالای «${g.title}»): یک بچ دوبار انتخاب شده است`);
        seenBatchIds.add(a.batchId);
        const batch = batchById.get(a.batchId);
        if (!batch || batch.goodsItemId !== l.goodsItemId) throw new Error(`بچ ردیف ${idx + 1} متعلق به کالای «${g.title}» نیست`);
        if (!batch.isActive) throw new Error(`بچ ردیف ${idx + 1} غیرفعال است`);
        if (!(Number(a.quantity) > 0)) throw new Error(`مقدار بچ ردیف ${idx + 1} باید عددی مثبت باشد`);
      }
    } else {
      if (l.batchAllocations?.length || l.serialIds?.length) throw new Error(`ردیف ${idx + 1} (کالای «${g.title}») بچ/سریال‌پذیر نیست`);
    }

    if (g.isLocationTracked && !l.physicalLocation) throw new Error(`محل فیزیکی ردیف ${idx + 1} (کالای «${g.title}») الزامی است`);
  }
}

export interface ResolvedTrackingRefs {
  batchAllocations: { batchId: number; quantity: number }[];
  physicalLocationId: number | null;
  serialIds: number[];
}

// محل فیزیکی امروز در فرم‌های سند انبار صرفاً یک متن آزاد است (نه انتخاب از درخت) — به یک شاخه‌ی
// ریشه‌ی هم‌نام در درخت محل فیزیکی همان انبار نگاشت می‌شود (پیدا بر اساس عنوان، یا ساخت در صورت نبود).
async function findOrCreateRootPhysicalLocation(warehouseId: number, title: string): Promise<number> {
  const existing = await prisma.physicalLocation.findFirst({ where: { warehouseId, parentId: null, title } });
  if (existing) return existing.id;
  const siblings = await prisma.physicalLocation.findMany({ where: { warehouseId, parentId: null }, orderBy: { code: "desc" }, take: 1 });
  const lastNum = siblings.length ? parseInt(siblings[0].code, 10) || 0 : 0;
  const created = await prisma.physicalLocation.create({ data: { warehouseId, parentId: null, code: String(lastNum + 1), title } });
  return created.id;
}

/** batchAllocations/serialIds ردیف را به مرجع نهایی قابل‌ذخیره تبدیل می‌کند (validateTrackingFields
 * از قبل صحت آن‌ها را کنترل کرده)؛ صرفا محل فیزیکی هنوز نیاز به پیدا/ساخت رکورد Master دارد. */
export async function resolveTrackingRefs<T extends TrackableLineInput>(lines: T[], warehouseId: number): Promise<ResolvedTrackingRefs[]> {
  const result: ResolvedTrackingRefs[] = [];
  for (const l of lines) {
    const physicalLocationId = l.physicalLocation ? await findOrCreateRootPhysicalLocation(warehouseId, l.physicalLocation) : null;
    result.push({ batchAllocations: l.batchAllocations || [], physicalLocationId, serialIds: l.serialIds || [] });
  }
  return result;
}

/** step فعلی هر سریال را (برای ذخیره‌ی اولیه‌ی InventoryLineSerial.serialStep در لحظه‌ی ثبت/ویرایش
 * پیش‌نویس) برمی‌گرداند — طبق قاعده‌ی عمومی پروژه، گذار واقعی وضعیت/step فقط در لحظه‌ی قطعی‌شدن سند رخ
 * می‌دهد (serialLifecycleService.ts)، نه در ثبت اولیه؛ این مقدار فقط یک عکس‌ فوری از step لحظه‌ی ثبت
 * است که با قطعی‌شدن، رونویسی می‌شود. */
export async function fetchCurrentSerialSteps(serialIds: number[]): Promise<Map<number, number>> {
  if (!serialIds.length) return new Map();
  const serials = await prisma.serial.findMany({ where: { id: { in: serialIds } }, select: { id: true, step: true } });
  return new Map(serials.map((s: any) => [s.id, s.step]));
}

/**
 * زیرشیء `batches`/`physicalLocationId`/`serials` مشترکِ همه‌ی create/update ردیف سند انبار — تا در
 * هر یک از ۱۶ نوع سند به‌جای تکرار همین ۶-۷ خط، فقط `...trackingCreateData(refs[idx], serialSteps)`
 * داخل شیء create آن ردیف Spread شود (بقیه‌ی فیلدهای آن شیء مخصوص همان نوع سند باقی می‌مانند).
 */
export function trackingCreateData(ref: ResolvedTrackingRefs, serialSteps: Map<number, number>) {
  return {
    physicalLocationId: ref.physicalLocationId,
    batches: ref.batchAllocations.length ? { create: ref.batchAllocations.map((a) => ({ batchId: a.batchId, quantity: a.quantity })) } : undefined,
    serials: ref.serialIds.length ? { create: ref.serialIds.map((sid) => ({ serialId: sid, serialStep: serialSteps.get(sid)! })) } : undefined,
  };
}

/** فیلدهای ردیابی مشترکِ پاسخ GET هر ۱۶ نوع سند — `l` باید با `serials: {include:{serial:true}}` و
 * `batches: {include:{batch:true}}` واکشی شده باشد (نگاه کنید به include هر مسیر). */
export function trackingResponseFields(l: any) {
  return {
    serialIds: l.serials.map((s: any) => s.serialId),
    serialNumbers: l.serials.map((s: any) => s.serial.serialNumber),
    batchAllocations: l.batches.map((b: any) => ({ batchId: b.batchId, batchNumber: b.batch.batchNumber, expiryDate: b.batch.expiryDate, quantity: Number(b.quantity) })),
  };
}

// =========================================================================
// فیلد GoodsItem.hasTransactions / Warehouse.hasTransactions یک کش ساده است که هر ۱۶ نوع سند انبار
// هنگام «قطعی‌کردن» آن را true می‌کنند تا حذف کالا/انبارِ دارای گردش مسدود شود. اما «برگشت از قطعی» فقط
// وضعیت خودِ سند را به DRAFT برمی‌گرداند و این کش را دست‌نخورده (true) رها می‌کند؛ در نتیجه حتی بعد از
// برگشت از قطعی و حذف کامل سند، کالا/انبار برای همیشه «دارای گردش» گزارش می‌شود و قابل حذف نیست، هرچند
// در دیتابیس هیچ سند قطعی‌ای دیگر به آن ارجاع نمی‌دهد. این دو تابع، بعد از هر «برگشت از قطعی»، وضعیت
// واقعی را با پرس‌وجوی مستقیم بین همه‌ی انواع سند (روی جدول یکپارچه‌ی InventoryDocument) دوباره محاسبه و
// کش را اصلاح می‌کنند.
// =========================================================================

export async function recomputeGoodsItemHasTransactions(goodsItemIds: number[], db: Db = prisma) {
  const ids = Array.from(new Set(goodsItemIds));
  for (const goodsItemId of ids) {
    // eslint-disable-next-line no-await-in-loop
    const line = await db.inventoryDocumentLine.findFirst({ where: { goodsItemId } });
    // eslint-disable-next-line no-await-in-loop
    await db.goodsItem.update({ where: { id: goodsItemId }, data: { hasTransactions: !!line } });
  }
}

export async function recomputeWarehouseHasTransactions(warehouseIds: number[], db: Db = prisma) {
  const ids = Array.from(new Set(warehouseIds));
  for (const warehouseId of ids) {
    // eslint-disable-next-line no-await-in-loop
    const [asWarehouse, asSource, asDest] = await Promise.all([
      db.inventoryDocument.findFirst({ where: { warehouseId } }),
      db.inventoryDocument.findFirst({ where: { sourceWarehouseId: warehouseId } }),
      db.inventoryDocument.findFirst({ where: { destWarehouseId: warehouseId } }),
    ]);
    // eslint-disable-next-line no-await-in-loop
    await db.warehouse.update({ where: { id: warehouseId }, data: { hasTransactions: !!(asWarehouse || asSource || asDest) } });
  }
}
