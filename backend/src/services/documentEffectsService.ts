import { InventoryDocumentType } from "@prisma/client";
import { Db } from "../lib/prisma";
import { assertNoNegativeStockAfterChange, SIGNED_TYPES, StockExcludeOptions } from "./warehouseStockService";
import { assertSerialsRevertible, reverseSerialLifecycle, applySerialLifecycle } from "./serialLifecycleService";

/**
 * سرویس مشترک «اعمال/برگرداندن اثر سند انبار» — طبق تصمیم کاربر، مرحله‌ی جداگانه‌ی «قطعی‌کردن»/«برگشت
 * از قطعی» حذف شده: هر سند از همان لحظه‌ی ثبت اثر واقعی دارد (روی موجودی/گزارش‌ها)، و ویرایش/حذف یک
 * سندِ (همیشه) قطعی به‌جای «برگشت از قطعی دستی، سپس ویرایش/حذف»، همین اثر را به‌صورت شفاف و در یک
 * درخواست برمی‌گرداند — با همان دو کنترل ایمنی‌ای که پیش‌تر فقط در «قطعی‌کردن»/«برگشت از قطعی» اجرا
 * می‌شدند (کنترل موجودی منفی، و قاعده‌ی «فقط آخرین رویداد یک سریال قابل برگشت است»). هر ۱۶ Route این
 * چهار تابع را به‌جای تکرار این هماهنگی، مستقیم فراخوانی می‌کند.
 *
 * ترتیب استفاده در هر Route (همان الگوی قبلیِ قطعی‌کردن/برگشت، فقط بدون دکمه‌ی جدا):
 * - ایجاد: (چک منفی‌نشدن موجودی برای سطرهای جدید، بدون exclude) → یک $transaction: create سند + خط‌ها
 *   با status="FINALIZED" + applyDocumentEffects.
 * - ویرایش: assertSafeToReverseEffects روی سند/سطرهای موجود → اعتبارسنجی فیلدهای بدنه‌ی جدید (مثل قبل)
 *   → assertSafeToApplyEffects روی سطرهای جدید (حتماً با excludeSelfId) → اگر هر دو پاس شد: یک
 *   $transaction: reverseDocumentEffects → حذف سطرهای قدیم/ساخت سطرهای جدید → applyDocumentEffects →
 *   recomputeGoodsItemHasTransactions/recomputeWarehouseHasTransactions (اجتماع کالا/انبارهای قدیم و
 *   جدید، چون ممکن است عوض شده باشند).
 * - حذف: assertSafeToReverseEffects روی سند/سطرهای موجود → اگر پاس شد: یک $transaction:
 *   reverseDocumentEffects → inventoryDocument.delete (کسکید سطرها) → سپس (نه قبلش!) recompute —
 *   وگرنه recompute هنوز خودِ این سند را می‌بیند و پاسخ اشتباه می‌دهد.
 */

export interface EffectDocKey {
  documentType: InventoryDocumentType;
  warehouseId: number;
  date: Date;
}

export interface EffectDoc extends EffectDocKey {
  id: number;
}

export interface EffectLine {
  goodsItemId: number;
  quantity: number;
}

// WAREHOUSE_ADJUSTMENT در SIGNED_TYPES نیست چون quantity آن از قبل امضادار ذخیره می‌شود (دقیقاً هم‌الگوی
// computeStockAsOf) — این‌جا با sign=1 (بدون تغییر علامت) و excludeKey مخصوص خودش نمایش داده می‌شود.
function signAndExcludeKey(documentType: InventoryDocumentType): { sign: 1 | -1; excludeKey: keyof StockExcludeOptions } {
  if (documentType === "WAREHOUSE_ADJUSTMENT") return { sign: 1, excludeKey: "excludeWarehouseAdjustmentId" };
  const rule = SIGNED_TYPES.find((r) => r.documentType === documentType);
  if (!rule) throw new Error(`نوع سند «${documentType}» در محاسبه‌ی موجودی تعریف نشده است`);
  return { sign: rule.sign, excludeKey: rule.excludeKey };
}

// طبق کد فعلیِ هر ۱۶ Route (نه یک قاعده‌ی یکدست، بلکه رفتار موجودِ هرکدام که این‌جا عیناً حفظ می‌شود):
// کنترل موجودی منفی برای اکثر انواع سند با پرچم warehouse.stockControl دروازه‌بانی می‌شود (اگر خاموش
// باشد، اصلاً چک نمی‌شود)، به‌جز این سه نوع که همیشه — صرف‌نظر از stockControl — چک می‌شوند.
const ALWAYS_CHECK_REGARDLESS_OF_STOCK_CONTROL = new Set<InventoryDocumentType>(["WAREHOUSE_RECEIPT", "WAREHOUSE_TRANSFER_IN", "INITIAL_INVENTORY"]);

/** فقط‌خواندنی — پیش از هرگونه نوشتن فراخوانی شود. اگر پرتاب کند، فراخوان نباید هیچ جهشی انجام دهد.
 * warehouseStockControl: مقدار فعلیِ Warehouse.stockControl همان انبار (برای دروازه‌بانی چک موجودی منفی
 * — نگاه کنید به توضیح بالای ALWAYS_CHECK_REGARDLESS_OF_STOCK_CONTROL). */
export async function assertSafeToReverseEffects(db: Db, doc: EffectDoc, lines: EffectLine[], warehouseStockControl: boolean): Promise<void> {
  await assertSerialsRevertible(db, doc.id);
  if (!warehouseStockControl && !ALWAYS_CHECK_REGARDLESS_OF_STOCK_CONTROL.has(doc.documentType)) return;
  const { sign } = signAndExcludeKey(doc.documentType);
  for (const line of lines) {
    // eslint-disable-next-line no-await-in-loop
    await assertNoNegativeStockAfterChange(
      { warehouseId: doc.warehouseId, goodsItemId: line.goodsItemId, asOfDate: doc.date, delta: -sign * line.quantity },
      db
    );
  }
}

/**
 * فقط‌خواندنی — برای ویرایشِ سندی که همین الان هم قطعی است (سطرهای قبلی‌اش هنوز در پایگاه‌داده و در
 * محاسبه‌ی موجودی جاری حساب می‌شوند)، excludeSelfId الزامی است، وگرنه مقدار قبلی‌اش دوبار شمرده می‌شود.
 * برای ایجاد سند تازه لازم نیست (سندی که هنوز وجود ندارد نمی‌تواند در محاسبه حساب شده باشد).
 * warehouseStockControl: مثل assertSafeToReverseEffects.
 */
export async function assertSafeToApplyEffects(
  db: Db,
  doc: EffectDocKey,
  lines: EffectLine[],
  warehouseStockControl: boolean,
  excludeSelfId?: number
): Promise<void> {
  if (!warehouseStockControl && !ALWAYS_CHECK_REGARDLESS_OF_STOCK_CONTROL.has(doc.documentType)) return;
  const { sign, excludeKey } = signAndExcludeKey(doc.documentType);
  const excludeOpts: StockExcludeOptions = excludeSelfId != null ? { [excludeKey]: excludeSelfId } : {};
  for (const line of lines) {
    // eslint-disable-next-line no-await-in-loop
    await assertNoNegativeStockAfterChange(
      { ...excludeOpts, warehouseId: doc.warehouseId, goodsItemId: line.goodsItemId, asOfDate: doc.date, delta: sign * line.quantity },
      db
    );
  }
}

/** جهش — باید داخل همان $transaction نوشتن/حذف سند فراخوانی شود؛ فرض می‌کند assertSafeToReverseEffects
 * از قبل با موفقیت اجرا شده است. */
export async function reverseDocumentEffects(tx: Db, doc: EffectDoc): Promise<void> {
  await reverseSerialLifecycle(tx, doc.id);
}

/** جهش — باید داخل همان $transaction ایجاد/بازنویسیِ سطرها فراخوانی شود (بعد از این‌که سطرهای جدید
 * واقعاً نوشته شده‌اند، چون applySerialLifecycle خودِ سند را دوباره با include سطرها می‌خواند). */
export async function applyDocumentEffects(tx: Db, doc: EffectDoc, lines: EffectLine[]): Promise<void> {
  await applySerialLifecycle(tx, doc.id);
  await tx.warehouse.update({ where: { id: doc.warehouseId }, data: { hasTransactions: true } });
  const goodsItemIds = Array.from(new Set(lines.map((l) => l.goodsItemId)));
  for (const goodsItemId of goodsItemIds) {
    // eslint-disable-next-line no-await-in-loop
    await tx.goodsItem.update({ where: { id: goodsItemId }, data: { hasTransactions: true } });
  }
}
