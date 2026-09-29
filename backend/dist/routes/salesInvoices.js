"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const journalEntryValidation_1 = require("../utils/journalEntryValidation");
const fiscalPeriodValidation_1 = require("../utils/fiscalPeriodValidation");
const concurrency_1 = require("../utils/concurrency");
const vatCalculation_1 = require("../utils/vatCalculation");
const accountingSettingsService_1 = require("../services/accountingSettingsService");
const salesInvoiceAdvanceService_1 = require("../services/salesInvoiceAdvanceService");
const currencyConversion_1 = require("../utils/currencyConversion");
const journalEntryService_1 = require("../services/journalEntryService");
const detailValues_1 = require("../utils/detailValues");
const jalaliDate_1 = require("../utils/jalaliDate");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("sales-invoices");
// =========================================================================
// ماژول «فروش» > عملیات > فاکتور فروش نهایی
//
// این سند هیچ مستند تحلیل اختصاصی در پروژه ندارد؛ ساختار زیر حاصل بحث و تصمیم‌گیری مشترک با کاربر
// است، با الگوبرداری از «فاکتور خرید» (سند مشابه در زنجیره خرید) با یک تفاوت کلیدی صریح:
// - مبنا: بدون مبنا / حواله فروش. برخلاف فاکتور خرید (که هر ردیف رسید انبار خرید را دقیقاً یک‌بار و
//   کامل مصرف می‌کرد — قید @@unique در schema)، اینجا طبق تصمیم صریح کاربر رابطه «مانده‌ای» است:
//   مشتری ممکن است طی چند حواله فروش (مثلاً چند مرسوله کوچک) یک فاکتور بگیرد یا برعکس، یک حواله طی
//   چند فاکتور جداگانه صورتحساب شود — پس sourceInventoryLineId نال‌پذیر و بدون @@unique است و
//   با الگوی استاندارد «باقیمانده» (مثل بقیه‌ی زنجیره خرید/فروش) کنترل می‌شود.
// - فقط حواله‌های «قطعی»‌شده قابل صورتحساب هستند (حواله در وضعیت ثبت هنوز واقعاً از انبار خارج نشده).
// - فی/مبلغ برخلاف حواله فروش، اینجا توسط کاربر وارد می‌شود (چه در ردیف بدون مبنا چه در ردیف مبتنی بر
//   حواله فروش — چون حواله فروش خودش فی صفر دارد) — دقیقاً مثل فاکتور خرید.
// - بدون اکشن تایید در این فاز (طبق تصمیم صریح کاربر، مشابه فاکتور خرید): وضعیت همیشه «ثبت» می‌ماند؛
//   به همین دلیل هیچ مسیر approve/unapprove‌ای در این فایل تعریف نشده است.
// - نوع فروش/نرخ ارز/ارزش‌افزوده: طبق تصمیم صریح کاربر (۱۴۰۵/۰۶/۱۷)، دقیقاً هم‌معماری PurchaseInvoice
//   پیاده شده‌اند — هدر «نوع فروش» (salesTypeId، الزامی) + fxRate دستی (نه از جدول نرخ ارز، اگر ارز
//   فاکتور همان ارز مبنا باشد همیشه ۱ ذخیره می‌شود)، هر ردیف baseAmount/baseDiscount/vatAmount (طبق
//   utils/vatCalculation.ts، فقط برای بایگانی/محاسبه، در UI/پاسخ API نمی‌آیند).
// - صدور سند حسابداری: طبق Documents/SaleInvoiceVoucher.md و تصمیم صریح کاربر (۱۴۰۵/۰۶/۱۸) — برخلاف
//   فاکتور خرید/فاکتور خرید خدمات (که هر دو نیازمند «تایید» قبل از صدور سند هستند)، اینجا چون اصلاً
//   وضعیت «تایید» وجود ندارد، صدور سند مستقیماً از همان وضعیت «ثبت» انجام می‌شود (فقط با شرط این‌که
//   قبلاً سندی صادر نشده باشد). با صدور سند، ویرایش/حذف فاکتور قفل می‌شود (نگاه کنید به PUT/DELETE).
//   ساختار سند (طبق تصمیم صریح کاربر در همان مستند، هر دو سوال زیر را با «بله» تایید کرد):
//     • بدهکار «دریافتنی فروش» (هم مبلغ ردیف و هم ارزش‌افزوده‌اش) با گروه حسابداری ردیف + نوع فروش
//       هدر کلید می‌خورد — دقیقاً هم‌الگوی بستانکار «درآمد فروش»/«ارزش‌افزوده فروش» (نه فقط گروه
//       حسابداری تنها، برخلاف برداشت اولیه از عبارت مستند).
//     • مبلغ ردیف/ارزش‌افزوده هرگز در یک خط سند با هم جمع نمی‌شوند، حتی وقتی هر دو روی یک معین
//       می‌نشینند (طبق «Aggregation rule» مستند) — ارزش‌افزوده همیشه به ارز مبنا، مبلغ ردیف به ارز
//       فاکتور اگر معین ارزی باشد وگرنه به ارز مبنا.
//     • قاعده‌ی «اگر بدهکار محاسبه‌شده منفی بود، به‌صورت بستانکار مثبت ثبت شود (و برعکس)» به‌عنوان یک
//       قاعده‌ی عمومی در journalEntryService.ts#issueJournalEntry پیاده شده، نه اینجا (طبق تصریح خودِ
//       مستند: «باید در کل سیستم اعمال شود»).
// =========================================================================
const router = (0, express_1.Router)();
async function resolveFiscalPeriod(date) {
    const fiscalPeriod = await prisma_1.prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
    if (!fiscalPeriod)
        throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
    await (0, fiscalPeriodValidation_1.assertWithinCurrentFiscalPeriod)(fiscalPeriod.id);
    await (0, journalEntryValidation_1.assertDateNotConfirmed)(prisma_1.prisma, date, fiscalPeriod.id);
    return fiscalPeriod;
}
async function nextNumber(model, fiscalPeriodId) {
    const last = await model.findFirst({ where: { fiscalPeriodId }, orderBy: { number: "desc" } });
    return last ? last.number + 1 : 1;
}
function partyDisplayName(party) {
    return party.category === "LEGAL" ? party.name : `${party.firstName || ""} ${party.lastName || ""}`.trim();
}
/** نرخ تبدیل ارز فاکتور را از بدنه‌ی درخواست resolve می‌کند — دقیقاً هم‌الگوی
 * purchaseInvoices.ts#resolveInvoiceFxRate: اگر ارز فاکتور همان ارز مبنا باشد همیشه ۱ برمی‌گردد، وگرنه
 * نرخ باید توسط کاربر وارد شده باشد (اجباری، بزرگ‌تر از صفر)، نه از جدول نرخ ارز. */
function resolveInvoiceFxRate(currencyId, baseCurrencyId, bodyFxRate) {
    if (currencyId === baseCurrencyId)
        return 1;
    const fxRate = Number(bodyFxRate);
    if (!(fxRate > 0))
        throw new Error("نرخ ارز الزامی است");
    return fxRate;
}
async function salesDeliveryLineRemaining(id, excludeInvoiceId) {
    const line = await prisma_1.prisma.inventoryDocumentLine.findFirst({
        where: { id, document: { documentType: "SALES_DELIVERY" } },
        include: { document: true, salesInvoiceLines: true },
    });
    if (!line)
        return null;
    const done = line.salesInvoiceLines
        .filter((i) => !excludeInvoiceId || i.salesInvoiceId !== excludeInvoiceId)
        .reduce((s, i) => s + Number(i.quantity), 0);
    const remaining = Number(line.quantity) - done;
    return { line, remaining };
}
async function validateLines(lines, basis, currency, fxRate, baseCurrency, docDate, excludeInvoiceId) {
    if (!Array.isArray(lines) || lines.length === 0)
        throw new Error("فاکتور فروش باید حداقل یک ردیف کالا داشته باشد");
    const cleaned = [];
    // یک ردیف حواله می‌تواند در چند ردیف فاکتور بیاید؛ مجموع مقدار ردیف‌های ارجاع‌دهنده به آن باید از مانده‌ی قابل صورتحسابش بیشتر نشود
    const allocatedToDeliveryLine = new Map();
    for (const [idx, l] of lines.entries()) {
        const qty = Number(l.quantity);
        if (!(qty > 0))
            throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);
        let goodsItemId = l.goodsItemId || 0;
        let unitId = l.unitId || 0;
        const unitPrice = Number(l.unitPrice) || 0;
        const amount = Number(l.amount) || 0;
        let sourceInventoryLineId = null;
        if (!(unitPrice >= 0))
            throw new Error(`فی ردیف ${idx + 1} نامعتبر است`);
        if (!(amount >= 0))
            throw new Error(`مبلغ ردیف ${idx + 1} نامعتبر است`);
        const discount = Number(l.discount) || 0;
        if (!(discount >= 0))
            throw new Error(`تخفیف ردیف ${idx + 1} نامعتبر است`);
        if (discount > amount)
            throw new Error(`تخفیف ردیف ${idx + 1} نمی‌تواند از مبلغ ردیف بیشتر باشد`);
        if (basis === "SALES_DELIVERY") {
            if (!l.sourceInventoryLineId)
                throw new Error(`ردیف ${idx + 1}: انتخاب ردیف حواله فروش الزامی است`);
            const info = await salesDeliveryLineRemaining(l.sourceInventoryLineId, excludeInvoiceId);
            if (!info)
                throw new Error(`ردیف حواله فروش برای ردیف ${idx + 1} یافت نشد`);
            const deliveryTotal = (allocatedToDeliveryLine.get(info.line.id) || 0) + qty;
            if (deliveryTotal > info.remaining)
                throw new Error(`ردیف ${idx + 1}: مجموع مقدار ردیف‌هایی که به این ردیف حواله فروش ارجاع می‌دهند (${deliveryTotal}) از باقیمانده‌ی قابل صورتحساب (${info.remaining}) بیشتر است`);
            allocatedToDeliveryLine.set(info.line.id, deliveryTotal);
            sourceInventoryLineId = info.line.id;
            goodsItemId = info.line.goodsItemId;
            unitId = info.line.unitId;
        }
        else {
            if (!goodsItemId)
                throw new Error(`کالا برای ردیف ${idx + 1} الزامی است`);
        }
        const item = await prisma_1.prisma.goodsItem.findUnique({ where: { id: goodsItemId } });
        if (!item)
            throw new Error(`کالای ردیف ${idx + 1} یافت نشد`);
        if (item.kind !== "GOODS")
            throw new Error(`ردیف ${idx + 1}: فقط کالا قابل انتخاب است`);
        if (!unitId)
            unitId = item.mainUnitId;
        // مبلغ/تخفیف به ارز مبنا و ارزش‌افزوده — دقیقاً هم‌الگوی purchaseInvoices.ts#validateLines: فقط برای
        // بایگانی/محاسبه نگه داشته می‌شوند (نه نمایش در UI)، و کاربر می‌تواند مقدار پیشنهادی مالیات را
        // ویرایش کند (اگر کلاینت صریحاً مقداری فرستاده باشد، همان معتبر است، نه مقدار محاسبه‌شده).
        const baseAmount = (0, currencyConversion_1.toBaseCurrencyAmount)(amount, fxRate, currency, baseCurrency);
        const baseDiscount = (0, currencyConversion_1.toBaseCurrencyAmount)(discount, fxRate, currency, baseCurrency);
        const vatRatePercent = (0, vatCalculation_1.resolveVatRatePercent)(item, await (0, accountingSettingsService_1.getVatRatePercentForDate)(docDate));
        const suggestedVatAmount = (0, vatCalculation_1.computeLineVat)(baseAmount, baseDiscount, vatRatePercent);
        const vatAmount = l.vatAmount !== undefined && l.vatAmount !== null ? Number(l.vatAmount) : suggestedVatAmount;
        if (!(vatAmount >= 0))
            throw new Error(`مالیات بر ارزش افزوده ردیف ${idx + 1} نامعتبر است`);
        cleaned.push({
            sourceInventoryLineId,
            goodsItemId,
            unitId,
            quantity: qty,
            unitPrice,
            amount,
            discount,
            baseAmount,
            baseDiscount,
            vatAmount,
            description: l.description || null,
        });
    }
    return cleaned;
}
// =========================================================================
// پیکر «باقیمانده» حواله فروش
// =========================================================================
router.get("/sales-invoices/pickable-sales-delivery-lines", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const destDate = req.query.destDate ? new Date(req.query.destDate) : null;
    const excludeInvoiceId = req.query.excludeInvoiceId ? Number(req.query.excludeInvoiceId) : null;
    const lines = await prisma_1.prisma.inventoryDocumentLine.findMany({
        where: { document: { documentType: "SALES_DELIVERY", ...(destDate ? { date: { lte: destDate } } : {}) } },
        include: { document: true, goodsItem: true, unit: true, salesInvoiceLines: true },
        orderBy: { id: "desc" },
    });
    const result = lines
        .map((l) => {
        // مصرف همین فاکتور (در حال ویرایش) نباید در «مانده» لحاظ شود، وگرنه ردیفی که کل مانده‌اش را
        // همین فاکتور قبلاً گرفته، از فهرست انتخابگر حذف می‌شود و در حالت ویرایش، ردیف مبدای قبلاً
        // انتخاب‌شده در گرید نمایش داده نمی‌شود — دقیقاً هم‌الگوی purchaseInvoices.ts's excludeInvoiceId.
        const done = l.salesInvoiceLines
            .filter((i) => !excludeInvoiceId || i.salesInvoiceId !== excludeInvoiceId)
            .reduce((s, i) => s + Number(i.quantity), 0);
        const quantity = Number(l.quantity);
        const remaining = quantity - done;
        return {
            id: l.id,
            sourceInventoryLineId: l.id,
            salesDeliveryId: l.document.id,
            number: l.document.number,
            date: l.document.date,
            goodsItemId: l.goodsItemId,
            goodsItemCode: l.goodsItem.fullCode,
            goodsItemTitle: l.goodsItem.title,
            unitId: l.unitId,
            unitTitle: l.unit.title,
            quantity,
            done,
            remaining,
        };
    })
        .filter((r) => r.remaining > 0);
    res.json(result);
});
router.get("/sales-invoices", (0, guard_1.can)(`${FORM}.view`), async (_req, res) => {
    const items = await prisma_1.prisma.salesInvoice.findMany({
        include: { customer: { include: { party: true } }, salesType: true, salesCenter: true, fiscalPeriod: true, currency: true, journalEntry: true, lines: true },
        orderBy: { id: "desc" },
    });
    res.json(items.map((d) => ({
        id: d.id,
        number: d.number,
        date: d.date,
        basis: d.basis,
        customerId: d.customerId,
        customerTitle: partyDisplayName(d.customer.party),
        salesTypeId: d.salesTypeId,
        salesTypeTitle: d.salesType.title,
        salesCenterId: d.salesCenterId,
        salesCenterTitle: d.salesCenter.title,
        currencyTitle: d.currency.title,
        status: d.status,
        journalEntryReferenceNumber: d.journalEntry?.referenceNumber ?? null,
        lineCount: d.lines.length,
        totalAmount: d.lines.reduce((s, l) => s + Number(l.amount), 0),
    })));
});
router.get("/sales-invoices/:id", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.salesInvoice.findUnique({
        where: { id },
        include: {
            customer: { include: { party: true } },
            salesType: true,
            salesCenter: true,
            fiscalPeriod: true,
            currency: true,
            journalEntry: true,
            lines: { include: { goodsItem: true, unit: true }, orderBy: { rowOrder: "asc" } },
        },
    });
    if (!d)
        return res.status(404).json({ error: "فاکتور فروش یافت نشد" });
    res.json({
        id: d.id,
        number: d.number,
        date: d.date,
        basis: d.basis,
        customerId: d.customerId,
        customerTitle: partyDisplayName(d.customer.party),
        salesTypeId: d.salesTypeId,
        salesTypeTitle: d.salesType.title,
        salesCenterId: d.salesCenterId,
        salesCenterTitle: d.salesCenter.title,
        currencyId: d.currencyId,
        fxRate: Number(d.fxRate),
        fiscalPeriodId: d.fiscalPeriodId,
        description: d.description,
        status: d.status,
        journalEntryId: d.journalEntryId,
        journalEntryReferenceNumber: d.journalEntry?.referenceNumber ?? null,
        updatedAt: d.updatedAt,
        lines: d.lines.map((l) => ({
            id: l.id,
            sourceInventoryLineId: l.sourceInventoryLineId,
            goodsItemId: l.goodsItemId,
            goodsItemCode: l.goodsItem.fullCode,
            goodsItemTitle: l.goodsItem.title,
            unitId: l.unitId,
            unitTitle: l.unit.title,
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice),
            amount: Number(l.amount),
            discount: Number(l.discount),
            vatAmount: Number(l.vatAmount),
            description: l.description,
        })),
    });
});
router.post("/sales-invoices", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const body = req.body;
    if (!body.date || !body.basis || !body.customerId || !body.salesTypeId || !body.salesCenterId || !body.currencyId) {
        return res.status(400).json({ error: "تاریخ، مبنا، مشتری، نوع فروش، مرکز فروش و ارز الزامی است" });
    }
    try {
        const date = new Date(body.date);
        const fiscalPeriod = await resolveFiscalPeriod(date);
        const customer = await prisma_1.prisma.customer.findUnique({ where: { id: body.customerId } });
        if (!customer)
            throw new Error("مشتری یافت نشد");
        const salesType = await prisma_1.prisma.salesType.findUnique({ where: { id: body.salesTypeId } });
        if (!salesType)
            throw new Error("نوع فروش یافت نشد");
        const salesCenter = await prisma_1.prisma.salesCenter.findUnique({ where: { id: body.salesCenterId } });
        if (!salesCenter)
            throw new Error("مرکز فروش یافت نشد");
        const currency = await prisma_1.prisma.currency.findUnique({ where: { id: body.currencyId } });
        if (!currency)
            throw new Error("ارز یافت نشد");
        const baseCurrency = await prisma_1.prisma.currency.findFirst({ where: { isBase: true } });
        if (!baseCurrency)
            throw new Error("ارز پایه تعریف نشده است");
        const fxRate = resolveInvoiceFxRate(body.currencyId, baseCurrency.id, body.fxRate);
        const lines = await validateLines(body.lines, body.basis, currency, fxRate, baseCurrency, date);
        const number = await nextNumber(prisma_1.prisma.salesInvoice, fiscalPeriod.id);
        const created = await prisma_1.prisma.salesInvoice.create({
            data: {
                fiscalPeriodId: fiscalPeriod.id,
                number,
                date,
                basis: body.basis,
                customerId: body.customerId,
                salesTypeId: body.salesTypeId,
                salesCenterId: body.salesCenterId,
                currencyId: body.currencyId,
                fxRate,
                description: body.description || null,
                status: "DRAFT",
                lines: { create: lines.map((l, idx) => ({ ...l, rowOrder: idx })) },
            },
        });
        res.status(201).json(created);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "شماره سند تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ثبت فاکتور فروش" });
    }
});
router.put("/sales-invoices/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.salesInvoice.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "یافت نشد" });
    if (existing.journalEntryId)
        return res.status(400).json({ error: "برای این فاکتور سند حسابداری صادر شده؛ ابتدا سند حسابداری را حذف کنید" });
    if (!body.date || !body.basis || !body.customerId || !body.salesTypeId || !body.salesCenterId || !body.currencyId) {
        return res.status(400).json({ error: "تاریخ، مبنا، مشتری، نوع فروش، مرکز فروش و ارز الزامی است" });
    }
    try {
        (0, concurrency_1.assertRecordNotStale)(existing.updatedAt, req.body.updatedAt, "این فاکتور فروش");
        const date = new Date(body.date);
        const fiscalPeriod = await resolveFiscalPeriod(date);
        const customer = await prisma_1.prisma.customer.findUnique({ where: { id: body.customerId } });
        if (!customer)
            throw new Error("مشتری یافت نشد");
        const salesType = await prisma_1.prisma.salesType.findUnique({ where: { id: body.salesTypeId } });
        if (!salesType)
            throw new Error("نوع فروش یافت نشد");
        const salesCenter = await prisma_1.prisma.salesCenter.findUnique({ where: { id: body.salesCenterId } });
        if (!salesCenter)
            throw new Error("مرکز فروش یافت نشد");
        const currency = await prisma_1.prisma.currency.findUnique({ where: { id: body.currencyId } });
        if (!currency)
            throw new Error("ارز یافت نشد");
        const baseCurrency = await prisma_1.prisma.currency.findFirst({ where: { isBase: true } });
        if (!baseCurrency)
            throw new Error("ارز پایه تعریف نشده است");
        const fxRate = resolveInvoiceFxRate(body.currencyId, baseCurrency.id, body.fxRate);
        const lines = await validateLines(body.lines, body.basis, currency, fxRate, baseCurrency, date, id);
        await (0, salesInvoiceAdvanceService_1.assertAdvanceAllocationsStillValid)(id, { customerId: body.customerId, currencyId: body.currencyId, date, netTotal: (0, salesInvoiceAdvanceService_1.salesInvoiceNetTotal)(lines), vatTotal: (0, salesInvoiceAdvanceService_1.salesInvoiceVatTotal)(lines, fxRate) });
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.salesInvoiceLine.deleteMany({ where: { salesInvoiceId: id } }),
            prisma_1.prisma.salesInvoice.update({
                where: { id },
                data: {
                    fiscalPeriodId: fiscalPeriod.id,
                    date,
                    basis: body.basis,
                    customerId: body.customerId,
                    salesTypeId: body.salesTypeId,
                    salesCenterId: body.salesCenterId,
                    currencyId: body.currencyId,
                    fxRate,
                    description: body.description || null,
                    lines: { create: lines.map((l, idx) => ({ ...l, rowOrder: idx })) },
                },
            }),
        ]);
        res.json({ id });
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ذخیره" });
    }
});
router.delete("/sales-invoices/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.salesInvoice.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.journalEntryId)
        return res.status(400).json({ error: "برای این فاکتور سند حسابداری صادر شده؛ ابتدا سند حسابداری را حذف کنید" });
    await prisma_1.prisma.salesInvoice.delete({ where: { id } });
    res.status(204).send();
});
// =========================================================================
// صدور سند حسابداری — طبق Documents/SaleInvoiceVoucher.md.
// =========================================================================
// =========================================================================
// تخصیص پیش‌دریافت (Documents/تخصیص پیش دریافت.md) — عملیات مستقل از ویرایش اطلاعات اصلی فاکتور؛ کنترل‌ها در
// services/salesInvoiceAdvanceService.ts (شامل قفل بر اساس «گردش» فاکتور، قابل توسعه با یک مورد به SALES_INVOICE_ADVANCE_LOCKS).
// =========================================================================
router.get("/sales-invoices/:id/advance-allocations", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    try {
        res.json(await (0, salesInvoiceAdvanceService_1.getSalesInvoiceAdvanceState)(Number(req.params.id)));
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در دریافت اطلاعات پیش‌دریافت" });
    }
});
router.put("/sales-invoices/:id/advance-allocations", (0, guard_1.can)(`${FORM}.allocateAdvance`), async (req, res) => {
    try {
        await (0, salesInvoiceAdvanceService_1.saveSalesInvoiceAdvanceAllocations)(Number(req.params.id), req.body?.allocations);
        res.json(await (0, salesInvoiceAdvanceService_1.getSalesInvoiceAdvanceState)(Number(req.params.id)));
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ثبت تخصیص پیش‌دریافت" });
    }
});
router.post("/sales-invoices/:id/issue-journal-entry", (0, guard_1.can)(`${FORM}.issueJournalEntry`), async (req, res) => {
    const id = Number(req.params.id);
    const invoice = await prisma_1.prisma.salesInvoice.findUnique({
        where: { id },
        include: {
            customer: { include: { party: true } },
            salesType: true,
            currency: true,
            lines: { include: { goodsItem: true }, orderBy: { rowOrder: "asc" } },
        },
    });
    if (!invoice)
        return res.status(404).json({ error: "فاکتور فروش یافت نشد" });
    if (invoice.journalEntryId)
        return res.status(400).json({ error: "قبلاً برای این فاکتور سند حسابداری صادر شده است" });
    try {
        const baseCurrency = await prisma_1.prisma.currency.findFirst({ where: { isBase: true } });
        if (!baseCurrency)
            throw new Error("ارز پایه تعریف نشده است");
        const fxRate = Number(invoice.fxRate);
        const partyDetailCode = invoice.customer.party.detailCode;
        const partyDetailTypeId = await (0, detailValues_1.resolveDetailTypeId)(partyDetailCode);
        const accountingGroupIds = Array.from(new Set(invoice.lines.map((l) => l.goodsItem.accountingGroupId)));
        // طبق تصمیم صریح کاربر: «دریافتنی فروش» دیگر به گروه حسابداری وابسته نیست (فقط نوع فروش) — پس
        // شرط OR لازم است تا این نوع، صرف‌نظر از این‌که کدام گروه‌های حسابداری در ردیف‌های این فاکتور
        // هستند، هم واکشی شود.
        const settings = await prisma_1.prisma.goodsServiceAccountingSetting.findMany({
            where: { OR: [{ accountingGroupId: { in: accountingGroupIds } }, { accountType: "SALES_RECEIVABLE" }] },
            include: { account: true },
        });
        function findSetting(accountingGroupId, accountType, match) {
            return settings.find((s) => s.accountingGroupId === accountingGroupId && s.accountType === accountType && match(s));
        }
        // «دریافتنی فروش» فقط با نوع فروش کلید می‌خورد — بدون قید گروه حسابداری.
        function findReceivableSetting(match) {
            return settings.find((s) => s.accountType === "SALES_RECEIVABLE" && match(s));
        }
        const customerName = partyDisplayName(invoice.customer.party) || "";
        const description = `بابت فاکتور فروش ${invoice.number} ${(0, jalaliDate_1.formatJalaliDateForMessage)(invoice.date)} ${customerName}`.trim();
        const vatDescription = `بابت ارزش‌افزوده فاکتور فروش ${invoice.number} ${(0, jalaliDate_1.formatJalaliDateForMessage)(invoice.date)} ${customerName}`.trim();
        const errors = [];
        // «دریافتنی فروش» دیگر به‌ازای هر ردیف/کالا متفاوت نیست (فقط یک بار، بر اساس نوع فروش هدر، بررسی می‌شود)
        const arSetting = findReceivableSetting((s) => s.salesTypeId === invoice.salesTypeId);
        if (!arSetting) {
            errors.push(`برای نوع فروش «${invoice.salesType.title}»، حساب «دریافتنی فروش» در حسابداری کالا و خدمت تعریف نشده است`);
        }
        // طبق «Aggregation rule» مستند: مبلغ ردیف و ارزش‌افزوده هرگز با هم در یک سطل جمع نمی‌شوند، حتی اگر
        // هر دو روی همان معین «دریافتنی فروش» بنشینند — برای همین چهار سطل کاملاً جدا.
        const arAmountByAccount = new Map();
        const arVatByAccount = new Map();
        const revenueByAccount = new Map();
        const vatCreditByAccount = new Map();
        for (const line of invoice.lines) {
            if (!arSetting)
                break;
            const amount = Number(line.amount);
            const discount = Number(line.discount);
            const baseAmount = Number(line.baseAmount);
            const baseDiscount = Number(line.baseDiscount);
            const vatAmount = Number(line.vatAmount);
            const goodsItem = line.goodsItem;
            const revenueSetting = findSetting(goodsItem.accountingGroupId, "SALES_REVENUE", (s) => s.salesTypeId === invoice.salesTypeId);
            if (!revenueSetting) {
                errors.push(`برای کالای «${goodsItem.title}» و نوع فروش «${invoice.salesType.title}»، حساب «درآمد فروش» در حسابداری کالا و خدمت تعریف نشده است`);
                continue;
            }
            let vatSetting;
            if (vatAmount > 0) {
                vatSetting = findSetting(goodsItem.accountingGroupId, "SALES_VAT", (s) => s.salesTypeId === invoice.salesTypeId);
                if (!vatSetting) {
                    errors.push(`برای کالای «${goodsItem.title}» و نوع فروش «${invoice.salesType.title}»، حساب «ارزش‌افزوده فروش» در حسابداری کالا و خدمت تعریف نشده است`);
                    continue;
                }
            }
            // مبلغ ردیف منهای تخفیف — طبق تصمیم صریح مستند، برخلاف فاکتور خرید که مبلغ ناخالص را ثبت می‌کند،
            // اینجا مبلغ خالص (پس از تخفیف) روی هر دو طرف بدهکار «دریافتنی فروش» و بستانکار «درآمد فروش»
            // نوشته می‌شود.
            const netAmount = amount - discount;
            const netBaseAmount = baseAmount - baseDiscount;
            const arIsCurrency = arSetting.account.isCurrency;
            const arValue = arIsCurrency ? netAmount : netBaseAmount;
            const arExisting = arAmountByAccount.get(arSetting.accountId);
            if (arExisting)
                arExisting.amount += arValue;
            else
                arAmountByAccount.set(arSetting.accountId, { amount: arValue, account: arSetting.account });
            if (vatAmount > 0) {
                const arVatExisting = arVatByAccount.get(arSetting.accountId);
                if (arVatExisting)
                    arVatExisting.amount += vatAmount;
                else
                    arVatByAccount.set(arSetting.accountId, { amount: vatAmount, account: arSetting.account });
            }
            const revIsCurrency = revenueSetting.account.isCurrency;
            const revValue = revIsCurrency ? netAmount : netBaseAmount;
            const revExisting = revenueByAccount.get(revenueSetting.accountId);
            if (revExisting)
                revExisting.amount += revValue;
            else
                revenueByAccount.set(revenueSetting.accountId, { amount: revValue, account: revenueSetting.account });
            if (vatSetting) {
                const vatExisting = vatCreditByAccount.get(vatSetting.accountId);
                if (vatExisting)
                    vatExisting.amount += vatAmount;
                else
                    vatCreditByAccount.set(vatSetting.accountId, { amount: vatAmount, account: vatSetting.account });
            }
        }
        if (errors.length > 0)
            return res.status(400).json({ error: errors.join("\n") });
        // ---------- تخصیص پیش‌دریافت (Documents/تخصیص پیش دریافت.md) ----------
        // هر تخصیص: بدهکار «پیش‌دریافت» (همان معینی که رسید دریافت بستانکار کرده) به ارزش دفتری/تاریخی، و کاهش بدهکار «دریافتنی فروش» به مبلغ تخصیص
        // با نرخ فاکتور. اختلاف ارزش ریالی (نرخ فاکتور − نرخ تاریخی) طبق «رویه‌ها و تنظیمات حسابداری» (روش معتبر در تاریخ فاکتور) شناسایی می‌شود:
        //  • نرخ تاریخ معامله/فاکتور: روی «سود و زیان تسعیر ارز» (اختلاف مثبت = زیان، بدهکار؛ منفی = سود، بستانکار)
        //  • نرخ تاریخی پیش‌دریافت: مبلغ فروش برای بخش پیش‌دریافت با نرخ تاریخی ثبت می‌شود (اصلاح درآمد فروش به‌اندازه‌ی اختلاف)، بدون تسعیر جدا
        // مبلغ ارزی تخصیص/مانده‌ی قابل پرداخت هرگز تحت‌تأثیر اختلاف نرخ نیست. سند همیشه بالانس است.
        // «پیش‌دریافت ارزش افزوده» (Documents/تغییرات تخصیص پیش‌دریافت.md) همین منطق را جدا از پیش‌دریافت عادی و روی دریافتنی/ارزش‌افزوده‌ی فاکتور دارد.
        const advanceDebitLines = [];
        const advanceAdjustLines = [];
        const allocations = await prisma_1.prisma.salesInvoiceAdvanceAllocation.findMany({
            where: { salesInvoiceId: id },
            include: { receiptSettlementLine: { include: { receipt: true, receiptType: { include: { account: true } } } } },
            orderBy: { id: "asc" },
        });
        if (allocations.length > 0) {
            const treasurySettings = await prisma_1.prisma.treasuryAccountSetting.findMany({
                where: { accountType: { in: ["RECEIPT_SUBJECT", "FX_GAIN_LOSS"] } },
                include: { account: true },
            });
            const invIsBase = invoice.currencyId === baseCurrency.id;
            // مجموع هر ماهیت جدا نگهداری می‌شود («پیش‌دریافت» روی دریافتنیِ مبلغ، «پیش‌دریافت ارزش افزوده» روی دریافتنیِ ارزش‌افزوده) و هرگز با هم جمع نمی‌شوند
            const acc = {
                ADVANCE_RECEIPT: { cur: 0, inv: 0, hist: 0 },
                ADVANCE_VAT_RECEIPT: { cur: 0, inv: 0, hist: 0 },
            };
            for (const a of allocations) {
                const l = a.receiptSettlementLine;
                const rt = l.receiptType;
                const amount = Number(a.amount);
                const bucket = a.nature === "ADVANCE_VAT_RECEIPT" ? acc.ADVANCE_VAT_RECEIPT : acc.ADVANCE_RECEIPT;
                const natureTitle = a.nature === "ADVANCE_VAT_RECEIPT" ? "پیش‌دریافت ارزش افزوده" : "پیش‌دریافت";
                const account = rt.basisType === "NONE" ? rt.account : treasurySettings.find((s) => s.accountType === "RECEIPT_SUBJECT" && s.receiptTypeId === rt.id)?.account;
                if (!account) {
                    errors.push(`برای نوع دریافت «${rt.title}» (${natureTitle} رسید شماره ${l.receipt.number}) معینِ ${natureTitle} تعریف نشده است`);
                    continue;
                }
                const rowRate = Number(l.fxRate);
                const hist = invIsBase ? amount : (0, currencyConversion_1.toBaseCurrencyAmount)(amount, rowRate, invoice.currency, baseCurrency);
                const atInvoice = invIsBase ? amount : (0, currencyConversion_1.toBaseCurrencyAmount)(amount, fxRate, invoice.currency, baseCurrency);
                bucket.cur += amount;
                bucket.inv += atInvoice;
                bucket.hist += hist;
                const details = (0, detailValues_1.resolveAccountDetailFields)(account, partyDetailTypeId, partyDetailCode);
                const advDescription = `بابت تخصیص ${natureTitle} رسید شماره ${l.receipt.number} به فاکتور فروش ${invoice.number} ${customerName}`.trim();
                if (account.isCurrency && !invIsBase) {
                    advanceDebitLines.push({ accountId: account.id, ...details, currencyId: invoice.currencyId, debit: amount, credit: 0, fxRate: rowRate, description: advDescription });
                }
                else {
                    advanceDebitLines.push({ accountId: account.id, ...details, currencyId: baseCurrency.id, debit: hist, credit: 0, fxRate: 1, description: advDescription });
                }
            }
            // کاهش بدهکار «دریافتنی فروش» (بخش مبلغ) به‌اندازه‌ی پیش‌دریافتِ عادی (مبلغ ارزی اگر معین ارزی است، وگرنه معادل ریالی با نرخ فاکتور)
            if (acc.ADVANCE_RECEIPT.cur > 0) {
                for (const [key, entry] of Array.from(arAmountByAccount.entries())) {
                    entry.amount -= entry.account.isCurrency ? acc.ADVANCE_RECEIPT.cur : acc.ADVANCE_RECEIPT.inv;
                    if (entry.amount < -0.005)
                        errors.push("مجموع پیش‌دریافت تخصیص‌یافته از مبلغ دریافتنی فاکتور بیشتر است");
                    if (entry.amount <= 0.005)
                        arAmountByAccount.delete(key);
                }
            }
            // کاهش بدهکار «دریافتنی ارزش افزوده» (همیشه به ارز مبنا) به‌اندازه‌ی پیش‌دریافت ارزش افزوده؛ چون سقف تخصیص به ارز فاکتور و گرد‌شده است،
            // مبلغ مؤثر حداکثر برابر ارزش‌افزوده‌ی فاکتور است (تا سند همیشه بالانس بماند)
            let vatEffectiveBase = acc.ADVANCE_VAT_RECEIPT.inv;
            if (acc.ADVANCE_VAT_RECEIPT.cur > 0) {
                const arVatTotal = Array.from(arVatByAccount.values()).reduce((s, e) => s + e.amount, 0);
                if (acc.ADVANCE_VAT_RECEIPT.inv > arVatTotal + 0.005 * Math.max(1, fxRate)) {
                    errors.push("مجموع پیش‌دریافت ارزش افزوده‌ی تخصیص‌یافته از ارزش افزوده‌ی فاکتور بیشتر است");
                }
                vatEffectiveBase = Math.min(acc.ADVANCE_VAT_RECEIPT.inv, arVatTotal);
                let left = vatEffectiveBase;
                for (const [key, entry] of Array.from(arVatByAccount.entries())) {
                    const take = Math.min(entry.amount, left);
                    entry.amount -= take;
                    left -= take;
                    if (entry.amount <= 0.005)
                        arVatByAccount.delete(key);
                }
            }
            // اختلاف ارزش ریالی (نرخ فاکتور − نرخ تاریخی) هر ماهیت جدا محاسبه و طبق روش معتبر در تاریخ فاکتور شناسایی می‌شود
            const diffRegular = Math.round((acc.ADVANCE_RECEIPT.inv - acc.ADVANCE_RECEIPT.hist) * 100) / 100;
            const diffVat = Math.round((vatEffectiveBase - acc.ADVANCE_VAT_RECEIPT.hist) * 100) / 100;
            if (!invIsBase && (Math.abs(diffRegular) > 0.005 || Math.abs(diffVat) > 0.005)) {
                const method = await (0, accountingSettingsService_1.getAdvanceReceiptMethodForDate)(invoice.date);
                if (!method) {
                    errors.push("روش شناسایی پیش‌دریافت ارزی برای تاریخ فاکتور در «رویه‌ها و تنظیمات حسابداری» (تنظیمات ارز) تعریف نشده است");
                }
                else {
                    const parts = [
                        { diff: diffRegular, title: "پیش‌دریافت", contra: Array.from(revenueByAccount.values())[0], contraTitle: "درآمد فروش" },
                        { diff: diffVat, title: "پیش‌دریافت ارزش افزوده", contra: Array.from(vatCreditByAccount.values())[0], contraTitle: "ارزش‌افزوده فروش" },
                    ];
                    const fxAccount = treasurySettings.find((s) => s.accountType === "FX_GAIN_LOSS")?.account;
                    for (const p of parts) {
                        if (Math.abs(p.diff) <= 0.005)
                            continue;
                        if (method === "TRANSACTION_DATE_RATE") {
                            if (!fxAccount) {
                                errors.push("حساب «سود و زیان تسعیر ارز» در «تعیین حسابهای معین» تعریف نشده است");
                                break;
                            }
                            advanceAdjustLines.push({
                                accountId: fxAccount.id,
                                currencyId: baseCurrency.id,
                                debit: p.diff > 0 ? p.diff : 0,
                                credit: p.diff < 0 ? -p.diff : 0,
                                fxRate: 1,
                                description: `تسعیر ${p.title} تخصیص‌یافته به ${description}`,
                            });
                        }
                        else if (!p.contra) {
                            errors.push(`حساب «${p.contraTitle}» برای اصلاح مبلغ بخش ${p.title} مشخص نیست`);
                        }
                        else {
                            const details = (0, detailValues_1.resolveAccountDetailFields)(p.contra.account, partyDetailTypeId, partyDetailCode);
                            advanceAdjustLines.push({
                                accountId: p.contra.account.id,
                                ...details,
                                currencyId: baseCurrency.id,
                                debit: p.diff > 0 ? p.diff : 0,
                                credit: p.diff < 0 ? -p.diff : 0,
                                fxRate: 1,
                                description: `فروش بخش ${p.title} با نرخ تاریخی — ${description}`,
                            });
                        }
                    }
                }
            }
            if (errors.length > 0)
                return res.status(400).json({ error: errors.join("\n") });
        }
        const debitLines = [];
        for (const { amount, account } of arAmountByAccount.values()) {
            const details = (0, detailValues_1.resolveAccountDetailFields)(account, partyDetailTypeId, partyDetailCode);
            const isCur = account.isCurrency;
            debitLines.push({
                accountId: account.id,
                ...details,
                currencyId: isCur ? invoice.currencyId : baseCurrency.id,
                debit: amount,
                credit: 0,
                fxRate: isCur ? fxRate : 1,
                description,
            });
        }
        // ارزش‌افزوده «دریافتنی فروش» طبق مستند همیشه به ارز مبنا است، صرف‌نظر از ارزی‌بودن خودِ معین —
        // دقیقاً هم‌الگوی purchaseInvoices.ts's vatDebitLines.
        for (const { amount, account } of arVatByAccount.values()) {
            const details = (0, detailValues_1.resolveAccountDetailFields)(account, partyDetailTypeId, partyDetailCode);
            debitLines.push({
                accountId: account.id,
                ...details,
                currencyId: baseCurrency.id,
                debit: amount,
                credit: 0,
                fxRate: 1,
                description: vatDescription,
            });
        }
        const creditLines = [];
        for (const { amount, account } of revenueByAccount.values()) {
            const details = (0, detailValues_1.resolveAccountDetailFields)(account, partyDetailTypeId, partyDetailCode);
            const isCur = account.isCurrency;
            creditLines.push({
                accountId: account.id,
                ...details,
                currencyId: isCur ? invoice.currencyId : baseCurrency.id,
                debit: 0,
                credit: amount,
                fxRate: isCur ? fxRate : 1,
                description,
            });
        }
        for (const { amount, account } of vatCreditByAccount.values()) {
            const details = (0, detailValues_1.resolveAccountDetailFields)(account, partyDetailTypeId, partyDetailCode);
            creditLines.push({
                accountId: account.id,
                ...details,
                currencyId: baseCurrency.id,
                debit: 0,
                credit: amount,
                fxRate: 1,
                description: vatDescription,
            });
        }
        const docType = await prisma_1.prisma.documentType.findFirst({ where: { systemKey: "SALES_INVOICE" } });
        if (!docType)
            return res.status(400).json({ error: "نوع سند «فاکتور فروش» در سیستم تعریف نشده است" });
        const entry = await (0, journalEntryService_1.issueJournalEntry)({
            date: invoice.date,
            documentTypeId: docType.id,
            description,
            issuingSystem: "SALES",
            isManual: false,
            lines: [...debitLines, ...advanceDebitLines, ...creditLines, ...advanceAdjustLines],
            sources: [{ label: `فاکتور فروش شماره ${invoice.number}`, path: `/sales-invoices/${invoice.id}/edit` }],
        });
        await prisma_1.prisma.salesInvoice.update({ where: { id }, data: { journalEntryId: entry.id } });
        res.json({ journalEntryId: entry.id, number: entry.number, referenceNumber: entry.referenceNumber, message: entry.message });
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در صدور سند حسابداری" });
    }
});
router.delete("/sales-invoices/:id/journal-entry", (0, guard_1.can)(`${FORM}.revertJournalEntry`), async (req, res) => {
    const id = Number(req.params.id);
    const invoice = await prisma_1.prisma.salesInvoice.findUnique({ where: { id } });
    if (!invoice)
        return res.status(404).json({ error: "فاکتور فروش یافت نشد" });
    if (!invoice.journalEntryId)
        return res.status(400).json({ error: "برای این فاکتور سندی صادر نشده است" });
    try {
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.salesInvoice.update({ where: { id }, data: { journalEntryId: null } }),
            prisma_1.prisma.journalEntry.delete({ where: { id: invoice.journalEntryId } }),
        ]);
        res.status(204).send();
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در حذف سند حسابداری" });
    }
});
exports.default = router;
