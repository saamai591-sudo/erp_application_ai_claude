"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLineAmounts = getLineAmounts;
exports.getLineAmount = getLineAmount;
exports.computeUnitCost = computeUnitCost;
exports.setLineAmount = setLineAmount;
exports.deleteLatestLineAmount = deleteLatestLineAmount;
exports.enrichLinesWithAmount = enrichLinesWithAmount;
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
/** SUM(difference) دقیق (Decimal) برای چند ردیف با هم — یک کوئری batched، برای جلوگیری از N+1 در فهرست‌ها. */
async function getLineAmounts(lineIds, client = prisma_1.prisma) {
    if (lineIds.length === 0)
        return new Map();
    const rows = await client.documentItemAmount.groupBy({
        by: ["lineId"],
        where: { lineId: { in: lineIds } },
        _sum: { difference: true },
    });
    return new Map(rows.map((r) => [r.lineId, r._sum.difference ?? new client_1.Prisma.Decimal(0)]));
}
async function getLineAmount(lineId, client = prisma_1.prisma) {
    const map = await getLineAmounts([lineId], client);
    return map.get(lineId) ?? new client_1.Prisma.Decimal(0);
}
function computeUnitCost(amount, quantity) {
    const q = Number(quantity);
    return q > 0 ? Number(amount) / q : 0;
}
/**
 * یک رکورد تاریخچه‌ی تازه ثبت می‌کند — Difference همیشه این‌جا (نه از فرانت‌اند) محاسبه می‌شود:
 * Difference = newAmount − SUM(Differenceهای قبلی همین ردیف). رکورد قبلی هرگز overwrite نمی‌شود.
 * اگر newAmount دقیقاً برابر مجموع فعلی باشد (Difference صفر)، باز هم یک رکورد ثبت می‌شود — تصمیم
 * این‌که «آیا اصلاً لازم است این تابع صدا زده شود» به عهده‌ی caller است (مثلاً برای خطوطی که هنوز اصلاً
 * قیمت‌گذاری نشده‌اند، معمولاً caller این تابع را صدا نمی‌زند، نه این‌که این‌جا رکورد صفر فیلتر شود).
 */
async function setLineAmount(tx, params) {
    const current = await getLineAmount(params.lineId, tx);
    const difference = params.newAmount - Number(current);
    await tx.documentItemAmount.create({
        data: {
            lineId: params.lineId,
            priceType: params.priceType,
            amount: params.newAmount,
            difference,
            effectiveDate: params.effectiveDate ?? new Date(),
            journalEntryId: params.journalEntryId ?? null,
            goodsPricingStatusId: params.goodsPricingStatusId ?? null,
            purchaseCostAllocationId: params.purchaseCostAllocationId ?? null,
            createdById: params.createdById ?? null,
        },
    });
    return { difference, amount: params.newAmount };
}
/**
 * حذف کامل آخرین رکورد یک lineId+priceType خاص — استثنای عمدی روی قاعده‌ی «هیچ رکوردی هرگز overwrite/
 * حذف نمی‌شود»، فقط برای برگشت‌ازتاییدِ فاکتور خرید: طبق تصمیم صریح کاربر، برگشت‌ازتایید نباید یک
 * رکورد صفرکننده‌ی تازه اضافه کند (که مبلغ نهایی رسید را صفر می‌کرد)، بلکه باید همان رکورد CROSS_ENTITY
 * که در لحظه‌ی تایید ساخته شده بود را کامل حذف کند تا مبلغ به مقدار قبل از تایید (رکورد USER_ENTRY
 * اصلی) برگردد. اگر رکوردی با این lineId+priceType یافت نشود، بی‌صدا نادیده گرفته می‌شود.
 */
async function deleteLatestLineAmount(tx, params) {
    const row = await tx.documentItemAmount.findFirst({
        where: { lineId: params.lineId, priceType: params.priceType },
        orderBy: { id: "desc" },
    });
    if (row) {
        await tx.documentItemAmount.delete({ where: { id: row.id } });
    }
}
/**
 * هر شیء دارای id/quantity را با دو فیلد محاسبه‌شده amount/unitCost غنی می‌کند — دقیقاً همان دو نامی که
 * قبلاً ستون‌های خام روی InventoryDocumentLine بودند، تا کد مصرف‌کننده‌ی پایین‌دست (ساخت پاسخ JSON،
 * فرانت‌اند) بدون تغییر بماند. برای فهرست‌ها همیشه از این تابع استفاده شود، نه از یک حلقه‌ی جدا به‌ازای
 * هر ردیف (که یک کوئری اضافه به ازای هر ردیف می‌شد).
 */
async function enrichLinesWithAmount(lines, client = prisma_1.prisma) {
    const map = await getLineAmounts(lines.map((l) => l.id), client);
    return lines.map((l) => {
        const amount = Number(map.get(l.id) ?? 0);
        return { ...l, amount, unitCost: computeUnitCost(amount, l.quantity) };
    });
}
