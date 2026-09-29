"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertSafeToReverseEffects = assertSafeToReverseEffects;
exports.assertSafeToApplyEffects = assertSafeToApplyEffects;
exports.reverseDocumentEffects = reverseDocumentEffects;
exports.applyDocumentEffects = applyDocumentEffects;
const warehouseStockService_1 = require("./warehouseStockService");
const serialLifecycleService_1 = require("./serialLifecycleService");
// WAREHOUSE_ADJUSTMENT در SIGNED_TYPES نیست چون quantity آن از قبل امضادار ذخیره می‌شود (دقیقاً هم‌الگوی
// computeStockAsOf) — این‌جا با sign=1 (بدون تغییر علامت) و excludeKey مخصوص خودش نمایش داده می‌شود.
function signAndExcludeKey(documentType) {
    if (documentType === "WAREHOUSE_ADJUSTMENT")
        return { sign: 1, excludeKey: "excludeWarehouseAdjustmentId" };
    const rule = warehouseStockService_1.SIGNED_TYPES.find((r) => r.documentType === documentType);
    if (!rule)
        throw new Error(`نوع سند «${documentType}» در محاسبه‌ی موجودی تعریف نشده است`);
    return { sign: rule.sign, excludeKey: rule.excludeKey };
}
// طبق کد فعلیِ هر ۱۶ Route (نه یک قاعده‌ی یکدست، بلکه رفتار موجودِ هرکدام که این‌جا عیناً حفظ می‌شود):
// کنترل موجودی منفی برای اکثر انواع سند با پرچم warehouse.stockControl دروازه‌بانی می‌شود (اگر خاموش
// باشد، اصلاً چک نمی‌شود)، به‌جز این سه نوع که همیشه — صرف‌نظر از stockControl — چک می‌شوند.
const ALWAYS_CHECK_REGARDLESS_OF_STOCK_CONTROL = new Set(["WAREHOUSE_RECEIPT", "WAREHOUSE_TRANSFER_IN", "INITIAL_INVENTORY"]);
function mergeLinesByGoods(lines) {
    const byGoods = new Map();
    for (const l of lines)
        byGoods.set(l.goodsItemId, (byGoods.get(l.goodsItemId) || 0) + Number(l.quantity));
    return Array.from(byGoods.entries()).map(([goodsItemId, quantity]) => ({ goodsItemId, quantity }));
}
/** فقط‌خواندنی — پیش از هرگونه نوشتن فراخوانی شود. اگر پرتاب کند، فراخوان نباید هیچ جهشی انجام دهد.
 * warehouseStockControl: مقدار فعلیِ Warehouse.stockControl همان انبار (برای دروازه‌بانی چک موجودی منفی
 * — نگاه کنید به توضیح بالای ALWAYS_CHECK_REGARDLESS_OF_STOCK_CONTROL). */
async function assertSafeToReverseEffects(db, doc, lines, warehouseStockControl) {
    await (0, serialLifecycleService_1.assertSerialsRevertible)(db, doc.id);
    if (!warehouseStockControl && !ALWAYS_CHECK_REGARDLESS_OF_STOCK_CONTROL.has(doc.documentType))
        return;
    const { sign } = signAndExcludeKey(doc.documentType);
    // چند ردیف از یک کالا (مثلاً تفکیک به‌خاطر سریال/بچ/محل) باید با هم سنجیده شوند، نه هر ردیف مستقل با کل موجودی
    for (const line of mergeLinesByGoods(lines)) {
        // eslint-disable-next-line no-await-in-loop
        await (0, warehouseStockService_1.assertNoNegativeStockAfterChange)({ warehouseId: doc.warehouseId, goodsItemId: line.goodsItemId, asOfDate: doc.date, delta: -sign * line.quantity }, db);
    }
}
/**
 * فقط‌خواندنی — برای ویرایشِ سندی که همین الان هم قطعی است (سطرهای قبلی‌اش هنوز در پایگاه‌داده و در
 * محاسبه‌ی موجودی جاری حساب می‌شوند)، excludeSelfId الزامی است، وگرنه مقدار قبلی‌اش دوبار شمرده می‌شود.
 * برای ایجاد سند تازه لازم نیست (سندی که هنوز وجود ندارد نمی‌تواند در محاسبه حساب شده باشد).
 * warehouseStockControl: مثل assertSafeToReverseEffects.
 */
async function assertSafeToApplyEffects(db, doc, lines, warehouseStockControl, excludeSelfId) {
    if (!warehouseStockControl && !ALWAYS_CHECK_REGARDLESS_OF_STOCK_CONTROL.has(doc.documentType))
        return;
    const { sign, excludeKey } = signAndExcludeKey(doc.documentType);
    const excludeOpts = excludeSelfId != null ? { [excludeKey]: excludeSelfId } : {};
    for (const line of mergeLinesByGoods(lines)) {
        // eslint-disable-next-line no-await-in-loop
        await (0, warehouseStockService_1.assertNoNegativeStockAfterChange)({ ...excludeOpts, warehouseId: doc.warehouseId, goodsItemId: line.goodsItemId, asOfDate: doc.date, delta: sign * line.quantity }, db);
    }
}
/** جهش — باید داخل همان $transaction نوشتن/حذف سند فراخوانی شود؛ فرض می‌کند assertSafeToReverseEffects
 * از قبل با موفقیت اجرا شده است. */
async function reverseDocumentEffects(tx, doc) {
    await (0, serialLifecycleService_1.reverseSerialLifecycle)(tx, doc.id);
}
/** جهش — باید داخل همان $transaction ایجاد/بازنویسیِ سطرها فراخوانی شود (بعد از این‌که سطرهای جدید
 * واقعاً نوشته شده‌اند، چون applySerialLifecycle خودِ سند را دوباره با include سطرها می‌خواند). */
async function applyDocumentEffects(tx, doc, lines) {
    await (0, serialLifecycleService_1.applySerialLifecycle)(tx, doc.id);
    await tx.warehouse.update({ where: { id: doc.warehouseId }, data: { hasTransactions: true } });
    const goodsItemIds = Array.from(new Set(lines.map((l) => l.goodsItemId)));
    for (const goodsItemId of goodsItemIds) {
        // eslint-disable-next-line no-await-in-loop
        await tx.goodsItem.update({ where: { id: goodsItemId }, data: { hasTransactions: true } });
    }
}
