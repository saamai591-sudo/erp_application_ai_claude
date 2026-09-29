"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePriceOperation = validatePriceOperation;
const prisma_1 = require("../lib/prisma");
const goodsPricingService_1 = require("./goodsPricingService");
const jalaliDate_1 = require("../utils/jalaliDate");
const documentItemAmountService_1 = require("./documentItemAmountService");
// لایه‌ی اعتبارسنجیِ مستقل از خودِ priceItem — طبق تصمیم صریح کاربر، دیگر در لحظه‌ی لود اطلاعات
// (GET /candidates) اجرا نمی‌شود؛ فقط وقتی کاربر ردیف‌ها را انتخاب کرده و دکمه‌ی «قیمت‌گذاری» را می‌زند
// (POST /validate، پیش از POST /run) صدا زده می‌شود. این فقط یک پیش‌بررسیِ سریعِ دسته‌ای است — تضمین
// نهاییِ صحت همچنان در لحظه‌ی اجرای priceItem/revertItem (با داده‌ی کاملاً زنده‌ی همان لحظه) انجام
// می‌شود؛ نگاه کنید به یادداشت‌های goodsPricingService.ts برای جزئیات این معماری دو‌لایه.
//
// همه‌ی بررسی‌ها روی کل مجموعه‌ی انتخاب‌شده اجرا می‌شوند (نه اینکه با اولین خطا متوقف شود) تا کاربر در
// یک‌بار تلاش، همه‌ی مشکلات را ببیند؛ خروجی یک لیست messages (یک پیام کلی به‌ازای هر بررسیِ ناموفق) به‌علاوه
// details (ردیف‌های قابل‌خروجی به اکسل، شامل کد/عنوان کالا و دلیل دقیق) است.
async function validatePriceOperation(reportingPeriodId, goodsItemIds) {
    const period = await prisma_1.prisma.reportingPeriod.findUnique({ where: { id: reportingPeriodId } });
    if (!period)
        return { valid: false, messages: ["دوره گزارشگری یافت نشد"], details: [] };
    const items = await prisma_1.prisma.goodsItem.findMany({ where: { id: { in: goodsItemIds } }, select: { id: true, fullCode: true, title: true } });
    const itemById = new Map(items.map((i) => [i.id, i]));
    const messages = [];
    const details = [];
    // ۱) ترتیب دوره‌ای: طبق تصمیم صریح کاربر، قیمت‌گذاری باید دوره‌به‌دوره و پشت‌سرهم انجام شود — اگر کالا
    // در دوره‌ی قبل قیمت‌گذاری نشده باشد، نباید در این دوره قیمت‌گذاری شود (priceItem خودش هم دقیقاً همین
    // قاعده را دارد؛ اینجا فقط زودتر و به‌صورت دسته‌ای همان بررسی تکرار می‌شود).
    const { predecessor } = await (0, goodsPricingService_1.findPredecessorPeriod)(reportingPeriodId);
    if (predecessor) {
        const pricedInPredecessor = await prisma_1.prisma.goodsPricingStatus.findMany({
            where: { reportingPeriodId: predecessor.id, goodsItemId: { in: goodsItemIds } },
            select: { goodsItemId: true },
        });
        const pricedIds = new Set(pricedInPredecessor.map((s) => s.goodsItemId));
        const notPriced = goodsItemIds.filter((id) => !pricedIds.has(id));
        if (notPriced.length > 0) {
            messages.push("برخی از کالاهای انتخاب‌شده در دوره قبل قیمت‌گذاری نشده‌اند.");
            for (const id of notPriced) {
                const item = itemById.get(id);
                if (item) {
                    details.push({
                        code: item.fullCode,
                        title: item.title,
                        reason: `دوره‌ی «${predecessor.title}» برای این کالا هنوز قیمت‌گذاری نشده است.`,
                    });
                }
            }
        }
    }
    // ۲) تایید انبار: انبارهای مرتبط با کالاهای انتخاب‌شده از جدول موقت GoodsPricingFlowWarehouse خوانده
    // می‌شوند (طبق تصمیم صریح کاربر، بدون کوئری دوباره‌ی InventoryDocumentLine) — این جدول هر بار که
    // «لود اطلاعات» زده می‌شود کامل بازسازی می‌شود. اما وضعیتِ خودِ تاییدِ انبار (confirmedDate) همیشه
    // زنده خوانده می‌شود، نه از این کش؛ اگر بین لود و کلیک قیمت‌گذاری کسی تاییدِ انباری را برگرداند، همین‌جا
    // گرفته می‌شود.
    const flows = await prisma_1.prisma.goodsPricingFlowWarehouse.findMany({
        where: { reportingPeriodId, goodsItemId: { in: goodsItemIds } },
        select: { goodsItemId: true, warehouseId: true },
    });
    const warehouseIds = Array.from(new Set(flows.map((f) => f.warehouseId)));
    if (warehouseIds.length > 0) {
        const unconfirmedWarehouses = await prisma_1.prisma.warehouse.findMany({
            where: {
                id: { in: warehouseIds },
                implementationDate: { not: null, lt: period.toDate },
                OR: [{ confirmedDate: null }, { confirmedDate: { lt: period.toDate } }],
            },
            select: { id: true, title: true, confirmedDate: true },
        });
        if (unconfirmedWarehouses.length > 0) {
            messages.push("برخی از انبارهای مرتبط با کالاهای انتخاب‌شده تا پایان این دوره تایید نشده‌اند.");
            const unconfirmedIds = new Set(unconfirmedWarehouses.map((w) => w.id));
            const warehouseById = new Map(unconfirmedWarehouses.map((w) => [w.id, w]));
            for (const f of flows) {
                if (!unconfirmedIds.has(f.warehouseId))
                    continue;
                const item = itemById.get(f.goodsItemId);
                const wh = warehouseById.get(f.warehouseId);
                if (item && wh) {
                    details.push({
                        code: item.fullCode,
                        title: item.title,
                        reason: `انبار «${wh.title}» تا پایان این دوره تایید نشده است (${wh.confirmedDate ? `تایید تا ${(0, jalaliDate_1.formatJalaliDateForMessage)(wh.confirmedDate)}` : "هرگز تایید نشده"}).`,
                    });
                }
            }
        }
    }
    // ۳) مبلغ اسناد کاربر-قیمت‌گذار: موجودی اول دوره/رسید انبار خرید/رسید تولید/اضافات انبارگردانی باید
    // مبلغ واقعی (بزرگ‌تر از صفر) داشته باشند — چون کاردکس این چهار نوع را عیناً (بدون محاسبه) به‌عنوان
    // مبنا می‌گیرد؛ اگر صفر مانده باشند، کل محاسبه‌ی بعدی غلط خواهد شد.
    const candidateLines = await prisma_1.prisma.inventoryDocumentLine.findMany({
        where: {
            goodsItemId: { in: goodsItemIds },
            document: { documentType: { in: Array.from(goodsPricingService_1.USER_PRICED_TYPES) }, date: { lte: period.toDate } },
        },
        select: { id: true, goodsItemId: true, document: { select: { documentType: true, number: true, date: true } } },
    });
    // مبلغ دیگر ستون خام نیست — SUM(Difference) هر ردیف باید محاسبه شود تا «مبلغ ندارد» (<= 0) تشخیص داده شود
    const amountByLineId = await (0, documentItemAmountService_1.getLineAmounts)(candidateLines.map((l) => l.id));
    const unpricedLines = candidateLines.filter((l) => Number(amountByLineId.get(l.id) ?? 0) <= 0);
    if (unpricedLines.length > 0) {
        messages.push("برخی از اسناد انبار مبلغ ندارند.");
        for (const l of unpricedLines) {
            const item = itemById.get(l.goodsItemId);
            if (item) {
                details.push({
                    code: item.fullCode,
                    title: item.title,
                    reason: `سند «${goodsPricingService_1.DOC_TYPE_FA[l.document.documentType] || l.document.documentType}» شماره ${l.document.number} مورخ ${(0, jalaliDate_1.formatJalaliDateForMessage)(l.document.date)} مبلغ ندارد.`,
                });
            }
        }
    }
    return { valid: messages.length === 0, messages, details };
}
