"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOC_TYPE_FA = exports.PRICING_DOC_TYPES = exports.USER_PRICED_TYPES = void 0;
exports.findPredecessorPeriod = findPredecessorPeriod;
exports.getPricingStatusMap = getPricingStatusMap;
exports.priceItem = priceItem;
exports.revertItem = revertItem;
const prisma_1 = require("../lib/prisma");
const documentItemAmountService_1 = require("./documentItemAmountService");
// طبق مستند «قیمت‌گذاری اسناد انبار»: وضعیت/قفل قیمت‌گذاری (GoodsPricingStatus) در سطح کالا+دوره است
// (انبار بخشی از کلید آن جدول نیست) — یعنی یک اجرای priceItem همه‌ی انبارهای کالا را با هم قیمت‌گذاری
// و قفل می‌کند. اما خودِ محاسبه‌ی کاردکس (میانگین موزون متحرک) باید جدا برای هر انبار انجام شود، نه
// یک‌جا برای کل کالا در همه‌ی انبارها — طبق تأیید صریح کاربر و تأیید موتور مرجع (Documents/
// pricingAlghoritm.sql: کاردکس با partition by Position اجرا می‌شود، و Position از روی
// Selected.stuffid + Selected.StockID ساخته می‌شود — یعنی کلید کاردکس (کالا، انبار) است، نه فقط کالا؛
// نگاه کنید به @ConditionalInnerJoin که صریحاً "Selected.StockID = p.StockID" شرط می‌کند). مخلوط کردن
// موجودی چند انبار در یک میانگین واحد اشتباه است — یک صادره از انبار X فقط باید بر اساس ورودی‌های خودِ
// انبار X میانگین‌گیری شود، نه ورودی‌های سایر انبارها با فی متفاوت. به همین دلیل walkKardex به‌جای دو
// متغیر runningQty/runningValue سراسری، یک وضعیت جدا به ازای هر warehouseId نگه می‌دارد (نگاه کنید به
// getState) و هر ردیف فقط وضعیت انبارِ خودِ سندش را می‌خواند/به‌روزرسانی می‌کند؛ ترتیب پردازش هنوز
// سراسری (بر اساس تاریخ در کل کالا) است، چون بعضی روابط (مثل WAREHOUSE_TRANSFER_IN که به ردیف
// WAREHOUSE_TRANSFER_OUT در انبار مبدا ارجاع می‌دهد) بین‌انباری هستند.
//
// طبقه‌بندی جهت هر نوع سند دقیقاً همان جدول SIGNED_TYPES موجود در warehouseStockService.ts است.
//
// انتقال بین انبارها (WAREHOUSE_TRANSFER_OUT/IN): برخلاف تصور اولیه («چون در سطح کالا خالص صفر است
// نادیده گرفته می‌شود»)، طبق موتور مرجع (Documents/pricingAlghoritm.sql، بخش «انتقالی» —
// DocumentType=5) این دو باید قیمت‌گذاری شوند، نه نادیده گرفته شوند: صفر بودن خالص فقط در مجموع کل
// تاریخچه درست است، نه در هر لحظه — چون سند ارسال و سند دریافت اغلب تاریخ (و گاهی دوره‌ی گزارشگری)
// متفاوتی دارند، در فاصله‌ی بین آن دو تاریخ کالا واقعاً «در راه» است و باید به همین صورت (خروج در تاریخ
// ارسال، ورود در تاریخ دریافت) در کاردکس جاری کالا لحاظ شود. رفتار:
// - WAREHOUSE_TRANSFER_OUT دقیقاً مثل بقیه‌ی OUT_COMPUTED_TYPES است (فی میانگین موزون در همان لحظه × مقدار).
// - WAREHOUSE_TRANSFER_IN بر خلاف بقیه‌ی انواع ورودی، فی میانگین جاری خودش را نمی‌گیرد؛ مبلغش سهم
//   متناسب (بر اساس مقدار) از مبلغ همان ردیف WAREHOUSE_TRANSFER_OUT است که ارجاع می‌دهد (تا کالا با
//   همان بهایی که از انبار مبدا خارج شده، وارد انبار مقصد شود) — دقیقاً معادل
//   COALESCE(pt.Amount, oi.Price, CardexFee*Quantity) در موتور مرجع، با این تفاوت که چون این پروژه
//   ترتیب تاریخ سند ارسال <= سند دریافت را از قبل در سطح اپلیکیشن اجباری کرده (نگاه کنید به
//   warehouseTransferIn.ts)، ردیف OUT همیشه زودتر از IN در همین کاردکس پردازش و مبلغش «شناخته‌شده»
//   است — نیازی به COALESCE/fallback یا لوپ همگرایی جداگانه (مثل برگشت تامین‌کننده) نیست.
//
// منبع مبلغ:
// - INITIAL_INVENTORY / WAREHOUSE_RECEIPT / PRODUCTION_RECEIPT / WAREHOUSE_ADJUSTMENT (اضافات
//   انبارگردانی): مبلغ «داده‌شده» (ستون amount سند) — طبق تصمیم صریح کاربر، این چهار نوع سند باید
//   توسط خودِ کاربر قیمت‌گذاری شوند (نه موتور)؛ لایه‌ی اعتبارسنجی جداگانه (goodsPricingValidation.ts)
//   پیش از اجرا بررسی می‌کند که amount این‌ها صفر نمانده باشد — این سرویس خودش کنترل/مسدودسازی خاصی
//   روی صفر بودن آن‌ها اعمال نمی‌کند (فرض بر این است که لایه‌ی اعتبارسنجی قبلاً همه‌چیز را تایید کرده).
// - بقیه‌ی انواع (صادره‌ها، برگشت‌ها، انتقالی): مبلغ توسط همین موتور محاسبه می‌شود — صادره‌ها و
//   WAREHOUSE_TRANSFER_OUT بر اساس میانگین موزون متحرک، WAREHOUSE_TRANSFER_IN بر اساس سهم متناسب از
//   ردیف ارسال مرتبط (بالا توضیح داده شد).
//
// طبق مستند «موتور قیمت‌گذاری در حالت برگشت»: وقتی به یک برگشت به تامین‌کننده می‌رسیم که به ردیف رسید
// مشخصی ارجاع دارد —
// ۱) اگر برگشت، کل مقدار آن رسید را برمی‌گرداند: مبلغ رسید مستقیماً «ست» (جایگزین، نه کم) می‌شود با
//    مبلغ تازه‌محاسبه‌شده‌ی برگشت (بر مبنای کاردکس در همان لحظه)، و کاردکس دوباره محاسبه می‌شود؛ این
//    فرایند تا همگرایی مبلغ برگشت با مبلغ رسید تکرار می‌شود.
// ۲) اگر برگشت فقط بخشی از مقدار رسید را برمی‌گرداند: رسید به دو «سهم» تقسیم می‌شود — سهم بازگشتی
//    (متناسب با مقدار برگشتی از مبلغ اصلی رسید، که مثل حالت ۱ در لوپ همگرا می‌شود) و سهم باقیمانده
//    (ثابت، بقیه‌ی مبلغ اصلی). این تقسیم فقط برای محاسبه‌ی کاردکس است؛ ردیف رسید در دیتابیس هیچ‌وقت
//    شکسته نمی‌شود — نتیجه‌ی نهایی (سهم باقیمانده + سهم(های) همگراشده‌ی برگشت) در همان یک ردیف نوشته
//    می‌شود. اگر چند برگشت جداگانه به یک رسید ارجاع داشته باشند، هرکدام سهم بازگشتی مستقل خودشان را
//    دارند (بر اساس مقدار خودشان) و همه‌ی سهم‌ها هم‌زمان با هم همگرا می‌شوند.
//
// قفل بودن دوره (طبق Documents/WareHouseAmountChanges.md، این بخش کاملاً بازنویسی شده): چون دیگر هیچ
// ستون خام amount/unitCost ای روی خودِ سند نیست (فقط تاریخچه‌ی DocumentItemAmount)، مفهوم «overwrite
// نکردن ردیف قفل‌شده» دیگر لازم نیست — هر تغییر، قفل باشد یا نه، فقط یک رکورد تازه‌ی DocumentItemAmount
// اضافه می‌کند (هرگز رکورد قبلی را دست نمی‌زند). «قفل بودن» فقط برای برچسب‌گذاریِ گزارشی به کار می‌رود:
// اگر ردیف در دوره‌ی در حال قیمت‌گذاری باشد priceType=ENGINE_PRICING، اگر در دوره‌ای زودتر (قبلاً
// قیمت‌گذاری‌شده) باشد priceType=ENGINE_CORRECTION — دقیقاً همان تمایزی که قبلاً appliedToLine در
// GoodsPricingAdjustment (اکنون بازنشسته) نشان می‌داد، و گزارش «اصلاحیه‌های قیمت‌گذاری» حالا با فیلتر
// priceType=ENGINE_CORRECTION روی همین جدول کار می‌کند (نگاه کنید به routes/goodsPricing.ts).
// طبق تصمیم صریح کاربر: «اضافات انبارگردانی» (WAREHOUSE_ADJUSTMENT) هم باید توسط کاربر قیمت‌گذاری شود
// (نه موتور) — دقیقاً مثل رسید انبار خرید/رسید تولید/موجودی اول دوره. این سند فقط برای مقدار مثبت
// (مازاد) استفاده می‌شود؛ کسری انبارگردانی نوع سند کاملاً جدایی دارد (INVENTORY_COUNTING_SHORTAGE، در
// OUT_COMPUTED_TYPES، همچنان توسط موتور محاسبه می‌شود).
// این چهار نوع سند («اسنادی که باید توسط کاربر قیمت‌گذاری شوند») از goodsPricingValidation.ts هم برای
// بررسی «آیا مبلغ این‌ها صفر مانده» استفاده می‌شود — به همین دلیل به‌جای ماندن در حالت private، با یک
// نام صریح‌تر (USER_PRICED_TYPES) هم export می‌شود.
const IN_GIVEN_TYPES = new Set(["INITIAL_INVENTORY", "WAREHOUSE_RECEIPT", "PRODUCTION_RECEIPT", "WAREHOUSE_ADJUSTMENT"]);
exports.USER_PRICED_TYPES = IN_GIVEN_TYPES;
const IN_COMPUTED_TYPES = new Set(["SALES_RETURN", "CENTER_CONSUMPTION_RETURN", "PROJECT_CONSUMPTION_RETURN", "PRODUCTION_CONSUMPTION_RETURN"]);
const OUT_COMPUTED_TYPES = new Set([
    "SALES_DELIVERY",
    "CENTER_CONSUMPTION",
    "PROJECT_CONSUMPTION",
    "PRODUCTION_CONSUMPTION",
    "FIXED_ASSET_ISSUE",
    "WAREHOUSE_TRANSFER_OUT",
    "INVENTORY_COUNTING_SHORTAGE",
]);
exports.PRICING_DOC_TYPES = [
    ...IN_GIVEN_TYPES,
    ...IN_COMPUTED_TYPES,
    ...OUT_COMPUTED_TYPES,
    "SUPPLIER_RETURN",
    "WAREHOUSE_TRANSFER_IN",
];
// عنوان فارسی هر نوع سند انبار — هم در گزارش «اصلاحیه‌های قیمت‌گذاری» (goodsPricing.ts) و هم در پیام‌های
// لایه‌ی اعتبارسنجی (goodsPricingValidation.ts) استفاده می‌شود؛ یک‌جا نگه داشته می‌شود تا دو کپی از هم
// جدا نشوند.
exports.DOC_TYPE_FA = {
    INITIAL_INVENTORY: "موجودی اول دوره",
    WAREHOUSE_RECEIPT: "رسید انبار خرید",
    WAREHOUSE_ADJUSTMENT: "اضافات انبارگردانی",
    SALES_DELIVERY: "حواله فروش",
    SALES_RETURN: "برگشت از فروش",
    SUPPLIER_RETURN: "برگشت به تامین‌کننده",
    PRODUCTION_RECEIPT: "رسید تولید",
    CENTER_CONSUMPTION: "مصرف مرکز هزینه",
    PROJECT_CONSUMPTION: "مصرف پروژه",
    PRODUCTION_CONSUMPTION: "مصرف تولید",
    CENTER_CONSUMPTION_RETURN: "برگشت مصرف مرکز هزینه",
    PROJECT_CONSUMPTION_RETURN: "برگشت مصرف پروژه",
    PRODUCTION_CONSUMPTION_RETURN: "برگشت مصرف تولید",
    FIXED_ASSET_ISSUE: "حواله دارایی ثابت",
    INVENTORY_COUNTING_SHORTAGE: "کسری انبارگردانی",
    WAREHOUSE_TRANSFER_IN: "رسید انتقال",
};
const MAX_ITERATIONS = 25;
async function getBaseCurrencyDecimalPlaces() {
    const baseCurrency = await prisma_1.prisma.currency.findFirst({ where: { isBase: true } });
    if (!baseCurrency)
        throw new Error("ارز پایه تعریف نشده است؛ ابتدا یک ارز را به‌عنوان ارز پایه مشخص کنید");
    return baseCurrency.decimalPlaces;
}
function round(value, decimalPlaces) {
    const factor = Math.pow(10, decimalPlaces);
    return Math.round(value * factor) / factor;
}
// یک بار کامل کاردکس را (با یک تخمین فعلی از سهم‌های بازگشتی هر برگشت تامین‌کننده) طی می‌کند
function walkKardex(lines, returningLinesByReceipt, fixedRemainingAmount, returnWorkingValue, decimalPlaces) {
    // کاردکس به ازای هر انبار جدا نگه داشته می‌شود (نگاه کنید به یادداشت بالای فایل)؛ ترتیب پردازش
    // ردیف‌ها هنوز سراسری (بر اساس تاریخ) است، فقط انباشت qty/value هر ردیف در وضعیت انبارِ خودش می‌رود
    const state = new Map();
    function getState(warehouseId) {
        let s = state.get(warehouseId);
        if (!s) {
            s = { qty: 0, value: 0 };
            state.set(warehouseId, s);
        }
        return s;
    }
    const computed = new Map();
    const newReturnWorkingValue = new Map();
    const linesById = new Map(lines.map((l) => [l.id, l]));
    for (const line of lines) {
        const qty = Number(line.quantity);
        const type = line.document.documentType;
        const s = getState(line.document.warehouseId);
        if (IN_GIVEN_TYPES.has(type)) {
            const returningLines = returningLinesByReceipt.get(line.id);
            if (!returningLines || returningLines.length === 0) {
                s.qty += qty;
                s.value += Number(line.amount);
            }
            else {
                const returnedQty = returningLines.reduce((sum, r) => sum + Number(r.quantity), 0);
                const remainingQty = qty - returnedQty;
                s.qty += remainingQty;
                s.value += fixedRemainingAmount.get(line.id) || 0;
                for (const r of returningLines) {
                    s.qty += Number(r.quantity);
                    s.value += returnWorkingValue.get(r.id) || 0;
                }
            }
            continue;
        }
        if (type === "WAREHOUSE_TRANSFER_IN") {
            // بر خلاف بقیه‌ی ورودی‌ها، فی میانگین جاری کاردکس (انبار مقصد) را نمی‌گیرد؛ سهم متناسب (بر اساس
            // مقدار) از مبلغِ همان ردیف WAREHOUSE_TRANSFER_OUT مرتبط (در انبار مبدا، کاردکس مستقل خودش) است
            // — همیشه قبلاً در همین کاردکس محاسبه شده، چون ترتیب تاریخ ارسال<=دریافت در سطح اپلیکیشن اجباری
            // است (نگاه کنید به یادداشت بالای فایل). فقط qty/value انبار مقصد (s، همین ردیف) به‌روزرسانی
            // می‌شود؛ انبار مبدا با ردیف OUT خودش (که در محاسبه‌ی خودش، از وضعیت انبار مبدا کم شده) قبلاً
            // به‌روزرسانی شده است.
            const outLine = line.sourceWarehouseTransferOutLineId ? linesById.get(line.sourceWarehouseTransferOutLineId) : undefined;
            const outQty = outLine ? Number(outLine.quantity) : 0;
            const outAmount = outLine ? computed.get(outLine.id) || 0 : 0;
            const amt = outQty > 0 ? round((outAmount * qty) / outQty, decimalPlaces) : 0;
            computed.set(line.id, amt);
            s.qty += qty;
            s.value += amt;
            continue;
        }
        if (IN_COMPUTED_TYPES.has(type)) {
            const avgCost = s.qty > 0 ? s.value / s.qty : 0;
            const amt = round(qty * avgCost, decimalPlaces);
            computed.set(line.id, amt);
            s.qty += qty;
            s.value += amt;
            continue;
        }
        // OUT_COMPUTED_TYPES + SUPPLIER_RETURN
        const avgCost = s.qty > 0 ? s.value / s.qty : 0;
        const amt = round(qty * avgCost, decimalPlaces);
        computed.set(line.id, amt);
        s.qty -= qty;
        s.value -= amt;
        if (type === "SUPPLIER_RETURN") {
            newReturnWorkingValue.set(line.id, amt);
        }
    }
    return { computed, newReturnWorkingValue };
}
function mapsEqual(a, b, epsilon) {
    const keys = new Set([...a.keys(), ...b.keys()]);
    for (const k of keys) {
        if (Math.abs((a.get(k) || 0) - (b.get(k) || 0)) > epsilon)
            return false;
    }
    return true;
}
async function findPredecessorPeriod(reportingPeriodId) {
    const period = await prisma_1.prisma.reportingPeriod.findUnique({ where: { id: reportingPeriodId } });
    if (!period)
        throw new Error("دوره گزارشگری یافت نشد");
    const predecessor = await prisma_1.prisma.reportingPeriod.findFirst({
        where: { toDate: { lt: period.fromDate } },
        orderBy: { toDate: "desc" },
    });
    return { period, predecessor };
}
async function findSuccessorPeriod(reportingPeriodId) {
    const period = await prisma_1.prisma.reportingPeriod.findUnique({ where: { id: reportingPeriodId } });
    if (!period)
        throw new Error("دوره گزارشگری یافت نشد");
    const successor = await prisma_1.prisma.reportingPeriod.findFirst({
        where: { fromDate: { gt: period.toDate } },
        orderBy: { fromDate: "asc" },
    });
    return { period, successor };
}
// این کالا در این دوره (یا هر دوره‌ی دیگری) قیمت‌گذاری شده یا نه
async function getPricingStatusMap(goodsItemIds, reportingPeriodId) {
    const rows = await prisma_1.prisma.goodsPricingStatus.findMany({
        where: { goodsItemId: { in: goodsItemIds }, reportingPeriodId },
        select: { goodsItemId: true },
    });
    return new Set(rows.map((r) => r.goodsItemId));
}
async function priceItem(goodsItemId, reportingPeriodId, userId) {
    const { period, predecessor } = await findPredecessorPeriod(reportingPeriodId);
    const already = await prisma_1.prisma.goodsPricingStatus.findUnique({
        where: { goodsItemId_reportingPeriodId: { goodsItemId, reportingPeriodId } },
    });
    if (already)
        throw new Error("این کالا قبلاً در این دوره قیمت‌گذاری شده است");
    if (predecessor) {
        const predecessorPriced = await prisma_1.prisma.goodsPricingStatus.findUnique({
            where: { goodsItemId_reportingPeriodId: { goodsItemId, reportingPeriodId: predecessor.id } },
        });
        if (!predecessorPriced) {
            throw new Error(`ابتدا باید دوره‌ی «${predecessor.title}» برای این کالا قیمت‌گذاری شود`);
        }
    }
    const decimalPlaces = await getBaseCurrencyDecimalPlaces();
    const epsilon = Math.pow(10, -decimalPlaces) / 2;
    const rawLines = await prisma_1.prisma.inventoryDocumentLine.findMany({
        where: {
            goodsItemId,
            document: { date: { lte: period.toDate }, documentType: { in: exports.PRICING_DOC_TYPES } },
        },
        select: {
            id: true,
            quantity: true,
            sourceWarehouseReceiptLineId: true,
            sourceWarehouseTransferOutLineId: true,
            document: { select: { documentType: true, date: true, warehouseId: true } },
        },
        orderBy: [{ document: { date: "asc" } }, { documentId: "asc" }, { rowOrder: "asc" }, { id: "asc" }],
    });
    // مبلغ فعلی هر ردیف دیگر ستون خام نیست — طبق Documents/WareHouseAmountChanges.md، SUM(Difference)
    // تاریخچه‌ی همان ردیف است؛ یک کوئری batched برای همه‌ی ردیف‌های این اجرا، نه یک کوئری جدا به ازای هرکدام.
    const currentAmounts = await (0, documentItemAmountService_1.getLineAmounts)(rawLines.map((l) => l.id));
    const lines = rawLines.map((l) => ({ ...l, amount: Number(currentAmounts.get(l.id) ?? 0) }));
    // پیش‌پردازش برگشت‌های تامین‌کننده: برای هر رسیدی که برگشت(های) به آن ارجاع دارند، سهم ثابتِ
    // «باقیمانده» و سهم اولیه‌ی هر برگشت (متناسب با مقدار خودش از مبلغ اصلی رسید) یک‌بار محاسبه می‌شود؛
    // این سهم‌ها هرگز در طول همگرایی دوباره از amount اصلی بازمحاسبه نمی‌شوند
    const returningLinesByReceipt = new Map();
    for (const l of lines) {
        if (l.document.documentType === "SUPPLIER_RETURN" && l.sourceWarehouseReceiptLineId) {
            const arr = returningLinesByReceipt.get(l.sourceWarehouseReceiptLineId) || [];
            arr.push(l);
            returningLinesByReceipt.set(l.sourceWarehouseReceiptLineId, arr);
        }
    }
    const fixedRemainingAmount = new Map();
    const initialReturnShare = new Map();
    for (const [receiptId, returningLines] of returningLinesByReceipt) {
        const receipt = lines.find((l) => l.id === receiptId);
        if (!receipt)
            continue; // رسید خارج از بازه‌ی این اجرا (نباید معمولاً پیش بیاید)
        const originalAmount = Number(receipt.amount);
        const originalQty = Number(receipt.quantity);
        let sumShares = 0;
        for (const r of returningLines) {
            const share = originalQty > 0 ? round((originalAmount * Number(r.quantity)) / originalQty, decimalPlaces) : 0;
            initialReturnShare.set(r.id, share);
            sumShares += share;
        }
        fixedRemainingAmount.set(receiptId, round(originalAmount - sumShares, decimalPlaces));
    }
    let returnWorkingValue = new Map(initialReturnShare);
    let computed = new Map();
    let converged = false;
    for (let i = 0; i < MAX_ITERATIONS; i++) {
        const result = walkKardex(lines, returningLinesByReceipt, fixedRemainingAmount, returnWorkingValue, decimalPlaces);
        computed = result.computed;
        if (mapsEqual(result.newReturnWorkingValue, returnWorkingValue, epsilon)) {
            returnWorkingValue = result.newReturnWorkingValue;
            converged = true;
            break;
        }
        returnWorkingValue = result.newReturnWorkingValue;
    }
    if (!converged)
        throw new Error("محاسبه قیمت‌گذاری همگرا نشد؛ لطفاً اسناد کالا را بررسی کنید");
    // نهایی‌سازی: خودِ رسید هرگز توسط قیمت‌گذاری اصلاح نمی‌شود (همیشه با مبلغ اصلی خودش باقی می‌ماند) —
    // سهم ثابت باقیمانده و همگرایی لوپ فقط برای محاسبه‌ی درستِ سایر ردیف‌های بین رسید و برگشت (مثلاً
    // مصرف) به کار می‌روند. مبلغ نهایی خودِ برگشت هم مقدار همگراشده‌ی کاردکس نیست؛ سهم متناسب از مبلغ
    // اصلی رسید است (همان initialReturnShare). بقیه‌ی ردیف‌های محاسبه‌شده از computed خوانده می‌شوند.
    const changes = [];
    for (const line of lines) {
        let newTotal;
        if (line.document.documentType === "SUPPLIER_RETURN" && line.sourceWarehouseReceiptLineId && initialReturnShare.has(line.id)) {
            newTotal = initialReturnShare.get(line.id);
        }
        else if (computed.has(line.id)) {
            newTotal = computed.get(line.id);
        }
        if (newTotal === undefined)
            continue;
        // مبلغ «مؤثر فعلی» دیگر نیازی به شاخه‌ی قفل/غیرقفل ندارد — line.amount همین حالا SUM(Difference)ی
        // کامل تاریخچه‌ی ردیف است (شامل هر اصلاحیه‌ی قبلی، مهم نیست در چه اجرایی نوشته شده)
        const locked = line.document.date < period.fromDate;
        const currentEffective = Number(line.amount);
        const delta = round(newTotal - currentEffective, decimalPlaces);
        if (Math.abs(delta) > epsilon) {
            changes.push({ lineId: line.id, delta, newTotal, quantity: Number(line.quantity), locked });
        }
    }
    const status = await prisma_1.prisma.$transaction(async (tx) => {
        const created = await tx.goodsPricingStatus.create({
            data: { goodsItemId, reportingPeriodId, createdById: userId },
        });
        for (const c of changes) {
            await (0, documentItemAmountService_1.setLineAmount)(tx, {
                lineId: c.lineId,
                newAmount: c.newTotal,
                priceType: c.locked ? "ENGINE_CORRECTION" : "ENGINE_PRICING",
                effectiveDate: period.toDate,
                goodsPricingStatusId: created.id,
                createdById: userId ?? null,
            });
        }
        return created;
    });
    return { status, adjustmentCount: changes.length };
}
async function revertItem(goodsItemId, reportingPeriodId) {
    const status = await prisma_1.prisma.goodsPricingStatus.findUnique({
        where: { goodsItemId_reportingPeriodId: { goodsItemId, reportingPeriodId } },
    });
    if (!status)
        throw new Error("این کالا در این دوره قیمت‌گذاری نشده است");
    const { successor } = await findSuccessorPeriod(reportingPeriodId);
    if (successor) {
        const successorPriced = await prisma_1.prisma.goodsPricingStatus.findUnique({
            where: { goodsItemId_reportingPeriodId: { goodsItemId, reportingPeriodId: successor.id } },
        });
        if (successorPriced) {
            throw new Error(`ابتدا باید برگشت قیمت‌گذاری دوره‌ی «${successor.title}» برای این کالا انجام شود`);
        }
    }
    // برخلاف قبل (که یک «کم‌کردن دلتا» دستی روی ستون خام لازم بود)، الان کافی است دقیقاً همان رکوردهای
    // DocumentItemAmount ای که این اجرا اضافه کرده بود حذف شوند — SUM(Difference) هر ردیف خودکار به
    // مقدار پیش از این اجرا برمی‌گردد. safe به‌خاطر بررسی «ابتدا باید دوره‌ی بعدی برگشت بخورد» بالا: هیچ
    // اجرای دیگری بعد از این یکی، روی همین کالا لایه‌ای اضافه نکرده است.
    await prisma_1.prisma.$transaction(async (tx) => {
        await tx.documentItemAmount.deleteMany({ where: { goodsPricingStatusId: status.id } });
        await tx.goodsPricingStatus.delete({ where: { id: status.id } });
    });
}
