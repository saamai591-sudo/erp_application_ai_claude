"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertDateInCurrentFiscalPeriod = assertDateInCurrentFiscalPeriod;
exports.assertWarehouseOpenForDate = assertWarehouseOpenForDate;
exports.listConfirmCandidates = listConfirmCandidates;
exports.listRevertCandidates = listRevertCandidates;
exports.confirmWarehouses = confirmWarehouses;
exports.revertWarehouses = revertWarehouses;
const prisma_1 = require("../lib/prisma");
const warehouseStockService_1 = require("./warehouseStockService");
const requestContext_1 = require("../lib/requestContext");
const jalaliDate_1 = require("../utils/jalaliDate");
/**
 * «تایید انبار» / «برگشت از تایید» — طبق سند «تایید انبار.md». برخلاف پیاده‌سازی قبلی («بستن موجودی
 * انبار»، حذف‌شده)، طبق تصمیم صریح کاربر بدون تاریخچه است: هر انبار دقیقاً یک تاریخ تایید
 * (Warehouse.confirmedDate) و یک Snapshot جاری (WarehouseConfirmationLine) دارد که با هر تایید/برگشت
 * از تایید، جایگزین (نه اضافه بر) نسخه‌ی قبلی می‌شود.
 */
/**
 * دوره مالی جاری — همان قرارداد resolveFiscalPeriod در routes/reportingPeriods.ts: دوره‌ای که کاربر در
 * تنظیمات انتخاب کرده (RequestContext.fiscalPeriodId، از هدر x-fiscal-period-id — نگاه کنید به
 * middleware/fiscalScope.ts)، وگرنه آخرین دوره مالی تعریف‌شده. قبلاً این تابع همیشه فقط آخرین دوره را
 * برمی‌گرداند و انتخاب صریح کاربر را نادیده می‌گرفت — باگ: کاربری که دوره مالی جاری‌اش را عمداً به یک
 * دوره‌ی قدیمی‌تر (مثلاً برای اصلاح داده‌ی همان دوره) تغییر می‌داد، همچنان با «باید در دوره مالی جاری
 * باشد» روی تاریخ‌های همان دوره مواجه می‌شد.
 */
async function currentFiscalPeriod() {
    const ctx = (0, requestContext_1.getRequestContext)();
    if (ctx?.fiscalPeriodId) {
        const period = await prisma_1.prisma.fiscalPeriod.findUnique({ where: { id: ctx.fiscalPeriodId } });
        if (period)
            return period;
    }
    return prisma_1.prisma.fiscalPeriod.findFirst({ orderBy: { toDate: "desc" } });
}
async function previousFiscalPeriod(period) {
    return prisma_1.prisma.fiscalPeriod.findFirst({ where: { toDate: { lt: period.fromDate } }, orderBy: { toDate: "desc" } });
}
async function assertDateInCurrentFiscalPeriod(date) {
    const period = await currentFiscalPeriod();
    if (!period)
        throw new Error("دوره مالی تعریف نشده است");
    if (date < period.fromDate || date > period.toDate) {
        throw new Error("تاریخ وارد شده باید در دوره مالی جاری باشد");
    }
    return period;
}
/**
 * آخرین تاریخ تایید «مؤثر» یک انبار: اگر واقعاً تایید شده، همان confirmedDate؛ وگرنه (هرگز تایید نشده)
 * یک روز قبل از تاریخ راه‌اندازی انبار — چون طبق تصمیم صریح کاربر، قبل از راه‌اندازی هیچ سندی روی این
 * انبار در سیستم ثبت نشده، پس معادل «تا همان تاریخ تایید شده» در نظر گرفته می‌شود. اگر تاریخ راه‌اندازی
 * هم تعریف نشده باشد، null برمی‌گردد (یعنی قابل ارزیابی نیست، کاربر باید ابتدا آن را تنظیم کند).
 */
function effectiveLastConfirmedDate(w) {
    if (w.confirmedDate)
        return w.confirmedDate;
    if (w.implementationDate) {
        const d = new Date(w.implementationDate);
        d.setUTCDate(d.getUTCDate() - 1);
        return d;
    }
    return null;
}
/**
 * طبق تصمیم صریح کاربر: برای «تایید»، آخرین تاریخ تایید مؤثر انبار (نگاه کنید به
 * effectiveLastConfirmedDate) باید یا داخل بازه‌ی دوره مالی جاری باشد (تایید مجدد/جلوتر در همان دوره)،
 * یا دقیقاً برابر با آخرین روز دوره مالی قبلی (یعنی آن دوره کامل بسته شده) — تا امکان پرش از روی یک
 * دوره مالی تایید‌نشده وجود نداشته باشد (باید دوره‌ها را به‌ترتیب تایید کرد).
 */
async function assertWarehouseFiscalYearSequenceForConfirm(w, period) {
    const effective = effectiveLastConfirmedDate(w);
    if (!effective) {
        throw new Error(`برای انبار «${w.title}» تاریخ راه‌اندازی تعریف نشده است؛ ابتدا آن را در فرم انبار تنظیم کنید`);
    }
    if (effective >= period.fromDate && effective <= period.toDate)
        return;
    const prevPeriod = await previousFiscalPeriod(period);
    if (prevPeriod && effective.getTime() === prevPeriod.toDate.getTime())
        return;
    throw new Error(`انبار «${w.title}» تا تاریخ ${(0, jalaliDate_1.formatJalaliDateForMessage)(effective)} تایید شده؛ برای تایید در دوره مالی جاری باید ابتدا تا پایان دوره مالی قبل تایید شود`);
}
/** طبق درخواست صریح کاربر: برای «برگشت از تایید»، آخرین تاریخ تایید انبار باید داخل بازه‌ی دوره مالی
 * جاری باشد — برگشتِ انباری که تاریخ تاییدش متعلق به دوره‌ی دیگری است، از این مسیر مجاز نیست. */
function assertWarehouseConfirmedWithinCurrentFiscalYear(w, period) {
    if (!w.confirmedDate || w.confirmedDate < period.fromDate || w.confirmedDate > period.toDate) {
        throw new Error(`آخرین تاریخ تایید انبار «${w.title}» در بازه‌ی دوره مالی جاری نیست`);
    }
}
/**
 * سندی با تاریخ <= تاریخ تایید انبار، دیگر قابل ثبت/ویرایش/حذف نیست. اگر انبار هرگز تایید نشده باشد
 * (confirmedDate=null)، این محدودیت وجود ندارد. جایگزین مستقیم assertWarehouseOpenForDate قدیمی (همان
 * نام/امضا حفظ شده تا همه‌ی ۱۶ مسیر سند انبار بدون تغییر منطق، فقط با تغییر مسیر import کار کنند) —
 * این تنها Controlِ واقعاً مشترک بین همه‌ی آن مسیرهاست (هرکدام validateWarehouseAndPeriod محلی خودشان
 * را دارند، اما همه از همین یک تابع عبور می‌کنند)، پس کنترل «تاریخ سند قبل از تاریخ راه‌اندازی انبار
 * نباشد» هم طبق درخواست صریح کاربر دقیقاً همین‌جا اضافه شده تا خودکار روی همه‌ی آن‌ها اعمال شود.
 */
async function assertWarehouseOpenForDate(warehouseId, date) {
    const warehouse = await prisma_1.prisma.warehouse.findUnique({
        where: { id: warehouseId },
        select: { confirmedDate: true, implementationDate: true },
    });
    if (!warehouse)
        return;
    if (warehouse.implementationDate && date.getTime() < warehouse.implementationDate.getTime()) {
        throw new Error(`تاریخ سند نمی‌تواند قبل از تاریخ راه‌اندازی انبار (${(0, jalaliDate_1.formatJalaliDateForMessage)(warehouse.implementationDate)}) باشد`);
    }
    if (!warehouse.confirmedDate)
        return;
    if (date.getTime() <= warehouse.confirmedDate.getTime()) {
        throw new Error(`این انبار تا تاریخ ${(0, jalaliDate_1.formatJalaliDateForMessage)(warehouse.confirmedDate)} تایید شده است؛ برای اصلاح اسناد این بازه ابتدا باید «برگشت از تایید» انجام شود`);
    }
}
/** حالت «تایید»: انبارهایی که آخرین تاریخ تایید آنها کوچکتر از تاریخ وارد‌شده باشد — انبار هرگز‌
 * تایید‌نشده (confirmedDate=null) هم چون معادل «هیچ‌وقت» است، همیشه واجد شرایط تایید محسوب می‌شود. */
async function listConfirmCandidates(date) {
    return prisma_1.prisma.warehouse.findMany({
        where: { OR: [{ confirmedDate: null }, { confirmedDate: { lt: date } }] },
        select: { id: true, code: true, title: true, confirmedDate: true },
        orderBy: { code: "asc" },
    });
}
/** حالت «برگشت از تایید»: انبارهایی که آخرین تاریخ تایید آنها بزرگتر از تاریخ وارد‌شده باشد. */
async function listRevertCandidates(date) {
    return prisma_1.prisma.warehouse.findMany({
        where: { confirmedDate: { gt: date } },
        select: { id: true, code: true, title: true, confirmedDate: true },
        orderBy: { code: "asc" },
    });
}
// همان مجموعه‌ی دامنه‌ای که computeStockAsOf می‌بیند (warehouseId/sourceWarehouseId/destWarehouseId)
async function listGoodsItemIdsWithActivity(warehouseId, asOfDate, db) {
    const rows = await db.inventoryDocumentLine.findMany({
        where: {
            document: {
                date: { lte: asOfDate },
                OR: [{ warehouseId }, { sourceWarehouseId: warehouseId }, { destWarehouseId: warehouseId }],
            },
        },
        select: { goodsItemId: true },
        distinct: ["goodsItemId"],
    });
    return rows.map((r) => r.goodsItemId);
}
/**
 * کنترل موجودی منفی طبق درخواست صریح کاربر برای «تایید»: برخلاف کنترل عمومی موجودی منفی سیستم (که طبق
 * محدودیت شناخته‌شده‌ی warehouseStockService فقط دقیقاً تاریخ خود سند را می‌بیند)، اینجا از (بعد از)
 * آخرین تاریخ تایید این انبار — یا از ابتدا اگر هرگز تایید نشده — تا تاریخ تایید جدید، موجودی هیچ کالایی
 * نباید در هیچ تاریخی منفی شود، نه فقط در تاریخ نهایی؛ یعنی یک اسکن رو به جلو روی همه‌ی تاریخ‌های
 * سندهای آن بازه.
 */
async function assertNoNegativeStockInRange(warehouseId, warehouseTitle, fromDateExclusive, toDate, db) {
    const rows = await db.inventoryDocumentLine.findMany({
        where: {
            document: {
                date: fromDateExclusive ? { gt: fromDateExclusive, lte: toDate } : { lte: toDate },
                OR: [{ warehouseId }, { sourceWarehouseId: warehouseId }, { destWarehouseId: warehouseId }],
            },
        },
        select: { goodsItemId: true, document: { select: { date: true } } },
    });
    const datesByItem = new Map();
    for (const r of rows) {
        if (!datesByItem.has(r.goodsItemId))
            datesByItem.set(r.goodsItemId, new Set());
        datesByItem.get(r.goodsItemId).add(r.document.date.getTime());
    }
    for (const [goodsItemId, dateSet] of datesByItem) {
        const dates = Array.from(dateSet).sort((a, b) => a - b);
        for (const t of dates) {
            // eslint-disable-next-line no-await-in-loop
            const qty = await (0, warehouseStockService_1.computeStockAsOf)(warehouseId, goodsItemId, new Date(t), {}, db);
            if (qty < 0) {
                // eslint-disable-next-line no-await-in-loop
                const item = await db.goodsItem.findUnique({ where: { id: goodsItemId }, select: { title: true } });
                throw new Error(`موجودی کالای «${item?.title}» در انبار «${warehouseTitle}» در تاریخ ${(0, jalaliDate_1.formatJalaliDateForMessage)(new Date(t))} منفی می‌شود؛ تایید انجام نشد`);
            }
        }
    }
}
// Snapshot همیشه مستقیم از اسناد محاسبه می‌شود، نه از یک Snapshot قبلی.
async function buildSnapshotLines(warehouseId, asOfDate, db) {
    const goodsItemIds = await listGoodsItemIdsWithActivity(warehouseId, asOfDate, db);
    const quantities = await Promise.all(goodsItemIds.map((goodsItemId) => (0, warehouseStockService_1.computeStockAsOf)(warehouseId, goodsItemId, asOfDate, {}, db)));
    return goodsItemIds.map((goodsItemId, idx) => ({ goodsItemId, quantity: quantities[idx] })).filter((l) => l.quantity !== 0);
}
async function replaceSnapshot(tx, warehouseId, confirmedDate, lines) {
    await tx.warehouseConfirmationLine.deleteMany({ where: { warehouseId } });
    if (lines.length) {
        await tx.warehouseConfirmationLine.createMany({
            data: lines.map((l) => ({ warehouseId, goodsItemId: l.goodsItemId, quantity: l.quantity })),
        });
    }
    await tx.warehouse.update({ where: { id: warehouseId }, data: { confirmedDate } });
}
/**
 * قفل بدبینانه (pessimistic) روی ردیف انبار طبق تصمیم صریح کاربر — تا وقتی تراکنشِ یک انبار تمام نشده،
 * هیچ درخواست هم‌زمان دیگری (چه تایید چه برگشت از تایید، حتی از یک کاربر دیگر) روی همان انبار جلوتر
 * نمی‌رود؛ به‌جای ادامه دادن با داده‌ی احتمالاً کهنه، منتظر آزاد شدن قفل می‌ماند و بعد دوباره confirmedDate
 * را از پایگاه‌داده می‌خواند. این تنها الگوی قفل صریح در کل پروژه است — عمداً محدود به همین عملیات کم‌تکرار
 * مدیریتی، نه یک الگوی عمومی برای بقیه‌ی اسناد انبار.
 */
async function lockWarehouseRow(tx, warehouseId) {
    const rows = await tx.$queryRaw `SELECT "id", "title", "confirmedDate", "implementationDate" FROM "Warehouse" WHERE "id" = ${warehouseId} FOR UPDATE`;
    return rows[0] ?? null;
}
/**
 * قطعی‌کردن دسته‌ای اسناد انبار تا تاریخ تایید — طبق کامنت مدل InventoryDocument.finalizedAt: رسید انبار
 * خرید فقط با تایید فاکتور خرید مبتنی بر آن قطعی می‌شود (نگاه کنید به warehouseReceipts.ts/
 * purchaseInvoices.ts)، نه با این تایید انبار دسته‌ای؛ پس WAREHOUSE_RECEIPT عمداً از این پویش کنار
 * گذاشته می‌شود (هم اینجا و هم در برگشتِ آن) تا با وضعیت مستقلی که تایید فاکتور خرید ممکن است از قبل
 * روی آن گذاشته باشد تداخل نکند.
 */
async function finalizeWarehouseDocumentsUpTo(warehouseId, date, tx) {
    await tx.inventoryDocument.updateMany({
        where: {
            OR: [{ warehouseId }, { sourceWarehouseId: warehouseId }, { destWarehouseId: warehouseId }],
            date: { lte: date },
            status: { not: "FINALIZED" },
            documentType: { not: "WAREHOUSE_RECEIPT" },
        },
        data: { status: "FINALIZED", finalizedAt: new Date() },
    });
}
/**
 * برگشتِ قطعی‌شدنِ دسته‌ای — فقط اسناد بعد از تاریخ تایید جدید (یعنی خارج از بازه‌ای که هنوز تایید
 * دارد) واقعی می‌شوند. رسید انبار خرید طبق تابع بالا هرگز با این مسیر Finalized نمی‌شود، پس اینجا هم
 * عمداً از پویش کنار گذاشته می‌شود تا وضعیت مستقلِ ناشی از تایید فاکتور خرید دست‌نخورده بماند.
 */
async function revertFinalizedWarehouseDocumentsAfter(warehouseId, newConfirmedDate, tx) {
    await tx.inventoryDocument.updateMany({
        where: {
            OR: [{ warehouseId }, { sourceWarehouseId: warehouseId }, { destWarehouseId: warehouseId }],
            date: { gt: newConfirmedDate },
            status: "FINALIZED",
            documentType: { not: "WAREHOUSE_RECEIPT" },
        },
        data: { status: "REGISTERED", finalizedAt: null },
    });
}
/**
 * تایید دسته‌ای انبارهای انتخاب‌شده در یک تاریخ مشخص — طبق سند: موجودی هر انبار محاسبه و Snapshot
 * قبلی همان انبار جایگزین می‌شود، و تاریخ تایید انبار به‌روز می‌گردد. طبق درخواست صریح کاربر، هر انبار
 * کاملاً مستقل پردازش می‌شود (تراکنش جدا، با قفل ردیف خودش) — خطای یک انبار مانع اجرای بقیه‌ی انبارهای
 * انتخاب‌شده نمی‌شود؛ فقط پیش‌شرط تاریخ (بازه‌ی دوره مالی جاری) که به همه‌ی انبارها مشترک است، پیش از
 * هر پردازشی بررسی می‌شود و در صورت رد شدن، کل درخواست را (نه فقط یک ردیف را) رد می‌کند.
 */
async function confirmWarehouses(warehouseIds, date) {
    if (!warehouseIds.length)
        throw new Error("حداقل یک انبار باید انتخاب شود");
    const period = await assertDateInCurrentFiscalPeriod(date);
    const results = [];
    for (const warehouseId of warehouseIds) {
        try {
            // eslint-disable-next-line no-await-in-loop
            await prisma_1.prisma.$transaction(async (tx) => {
                const w = await lockWarehouseRow(tx, warehouseId);
                if (!w)
                    throw new Error("انبار یافت نشد");
                if (w.confirmedDate && date.getTime() <= w.confirmedDate.getTime()) {
                    throw new Error(`انبار «${w.title}» قبلاً تا تاریخ ${(0, jalaliDate_1.formatJalaliDateForMessage)(w.confirmedDate)} تایید شده؛ تاریخ تایید جدید باید جلوتر باشد`);
                }
                await assertWarehouseFiscalYearSequenceForConfirm(w, period);
                await assertNoNegativeStockInRange(w.id, w.title, w.confirmedDate, date, tx);
                const lines = await buildSnapshotLines(w.id, date, tx);
                await replaceSnapshot(tx, w.id, date, lines);
                await finalizeWarehouseDocumentsUpTo(w.id, date, tx);
            });
            results.push({ warehouseId, success: true });
        }
        catch (e) {
            results.push({ warehouseId, success: false, error: e.message || "خطای نامشخص" });
        }
    }
    return results;
}
/**
 * برگشت از تایید دسته‌ای انبارهای انتخاب‌شده — طبق سند: تاریخ تایید به (تاریخ وارد‌شده منهای یک روز)
 * منتقل می‌شود و Snapshot دوباره در همان تاریخ جدید از روی اسناد محاسبه می‌شود (Snapshot قبلی حذف).
 * مثل confirmWarehouses، هر انبار مستقل و با قفل ردیف خودش پردازش می‌شود.
 */
async function revertWarehouses(warehouseIds, date) {
    if (!warehouseIds.length)
        throw new Error("حداقل یک انبار باید انتخاب شود");
    const period = await assertDateInCurrentFiscalPeriod(date);
    const newConfirmedDate = new Date(date);
    newConfirmedDate.setUTCDate(newConfirmedDate.getUTCDate() - 1);
    const results = [];
    for (const warehouseId of warehouseIds) {
        try {
            // eslint-disable-next-line no-await-in-loop
            await prisma_1.prisma.$transaction(async (tx) => {
                const w = await lockWarehouseRow(tx, warehouseId);
                if (!w)
                    throw new Error("انبار یافت نشد");
                if (!w.confirmedDate || w.confirmedDate.getTime() <= date.getTime()) {
                    throw new Error(`انبار «${w.title}» تاریخ تاییدِ بزرگتر از تاریخ وارد‌شده ندارد`);
                }
                assertWarehouseConfirmedWithinCurrentFiscalYear(w, period);
                const lines = await buildSnapshotLines(w.id, newConfirmedDate, tx);
                await replaceSnapshot(tx, w.id, newConfirmedDate, lines);
                await revertFinalizedWarehouseDocumentsAfter(w.id, newConfirmedDate, tx);
            });
            results.push({ warehouseId, success: true });
        }
        catch (e) {
            results.push({ warehouseId, success: false, error: e.message || "خطای نامشخص" });
        }
    }
    return results;
}
