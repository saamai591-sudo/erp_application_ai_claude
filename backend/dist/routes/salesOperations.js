"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const coding_1 = require("../utils/coding");
const journalEntryValidation_1 = require("../utils/journalEntryValidation");
const fiscalPeriodValidation_1 = require("../utils/fiscalPeriodValidation");
const concurrency_1 = require("../utils/concurrency");
const vatCalculation_1 = require("../utils/vatCalculation");
const accountingSettingsService_1 = require("../services/accountingSettingsService");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const CUSTOMERS_FORM = (0, registry_1.findFormPrefix)("customers");
const SALES_QUOTES_FORM = (0, registry_1.findFormPrefix)("sales-quotes");
const SALES_ORDERS_FORM = (0, registry_1.findFormPrefix)("sales-orders");
// =========================================================================
// ماژول «فروش» > تنظیمات: مشتری | عملیات: پیش‌فاکتور، سفارش فروش
//
// این ماژول هیچ مستند تحلیل اختصاصی در پروژه ندارد؛ ساختار زیر حاصل بحث و تصمیم‌گیری مشترک با کاربر
// است (رجوع کنید به توضیحات کامل بالای بخش «فروش» در schema.prisma و claude/سرویس-فروش.md):
// - مشتری: طرف‌حساب ساده، دقیقاً مثل تامین‌کننده ولی بدون گروه/کارشناس فروش.
// - پیش‌فاکتور: بالاترین سند زنجیره، همیشه ردیف مستقیم (بدون مبنا).
// - سفارش فروش: مبنا بدون مبنا/پیش‌فاکتور — طبق الگوی سفارش خرید از استعلام قیمت، ردیف پیش‌فاکتور
//   مستقیماً کپی می‌شود (بدون ردیابی «مانده» در این سطح؛ کاربر «مانده‌ای» را فقط برای حواله فروش و
//   فاکتور فروش خواسته است).
// - وضعیت هر دو سند: SalesDocStatus (ثبت/تایید) — ساده و خطی طبق تصمیم صریح کاربر.
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
// =========================================================================
// مشتری (Customer)
// =========================================================================
router.get("/customers", async (_req, res) => {
    const items = await prisma_1.prisma.customer.findMany({ include: { party: true }, orderBy: { code: "asc" } });
    res.json(items.map((c) => ({
        id: c.id,
        code: c.code,
        partyId: c.partyId,
        party: c.party,
        isActive: c.isActive,
        hasTransactions: c.hasTransactions,
    })));
});
router.post("/customers", (0, guard_1.can)(`${CUSTOMERS_FORM}.create`), async (req, res) => {
    const body = req.body;
    if (!body.partyId)
        return res.status(400).json({ error: "طرف حساب الزامی است" });
    try {
        const party = await prisma_1.prisma.party.findUnique({ where: { id: body.partyId } });
        if (!party)
            return res.status(404).json({ error: "طرف حساب یافت نشد" });
        const dup = await prisma_1.prisma.customer.findUnique({ where: { partyId: body.partyId } });
        if (dup)
            return res.status(400).json({ error: "این طرف حساب قبلاً به‌عنوان مشتری تعریف شده است" });
        const finalCode = body.code ?? (await (0, coding_1.nextSerialNumber)(prisma_1.prisma.customer, "code"));
        const created = await prisma_1.prisma.customer.create({ data: { code: finalCode, partyId: body.partyId, isActive: body.isActive ?? true } });
        res.status(201).json(created);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "کد تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ثبت مشتری" });
    }
});
router.put("/customers/:id", (0, guard_1.can)(`${CUSTOMERS_FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.customer.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "مشتری یافت نشد" });
    try {
        if (body.partyId && body.partyId !== existing.partyId) {
            if (existing.hasTransactions)
                return res.status(400).json({ error: "این مشتری گردش دارد و طرف حساب آن قابل تغییر نیست" });
            const party = await prisma_1.prisma.party.findUnique({ where: { id: body.partyId } });
            if (!party)
                return res.status(404).json({ error: "طرف حساب یافت نشد" });
            const dup = await prisma_1.prisma.customer.findFirst({ where: { partyId: body.partyId, NOT: { id } } });
            if (dup)
                return res.status(400).json({ error: "این طرف حساب قبلاً به‌عنوان مشتری تعریف شده است" });
        }
        const updated = await prisma_1.prisma.customer.update({ where: { id }, data: { partyId: body.partyId, isActive: body.isActive } });
        res.json(updated);
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ویرایش مشتری" });
    }
});
router.delete("/customers/:id", (0, guard_1.can)(`${CUSTOMERS_FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const item = await prisma_1.prisma.customer.findUnique({ where: { id } });
    if (!item)
        return res.status(404).json({ error: "مشتری یافت نشد" });
    if (item.hasTransactions)
        return res.status(400).json({ error: "این مشتری گردش دارد و قابل حذف نیست" });
    await prisma_1.prisma.customer.delete({ where: { id } });
    res.status(204).send();
});
// طبق تصمیم صریح کاربر (۱۴۰۵/۰۶/۲۰): مالیات بر ارزش‌افزوده در این فرم برخلاف فاکتور خرید/فاکتور فروش
// همیشه به همان ارز هدر (نه ارز مبنا) محاسبه/ذخیره می‌شود — چون پیش‌فاکتور اصلاً fxRate ندارد (سندی
// صرفاً اطلاعاتی، بدون اثر حسابداری)، پس نیازی به تبدیل به ارز مبنا هم نیست؛ amount همان‌جا که هست
// (به ارز هدر) مستقیماً در فرمول مشترک utils/vatCalculation.ts به کار می‌رود.
async function validateSalesQuoteLines(lines, docDate) {
    if (!Array.isArray(lines) || lines.length === 0)
        throw new Error("پیش‌فاکتور باید حداقل یک ردیف کالا داشته باشد");
    const cleaned = [];
    for (const [idx, l] of lines.entries()) {
        const qty = Number(l.quantity);
        if (!(qty > 0))
            throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);
        const unitPrice = Number(l.unitPrice) || 0;
        const amount = Number(l.amount) || 0;
        if (!(unitPrice >= 0))
            throw new Error(`فی ردیف ${idx + 1} نامعتبر است`);
        if (!(amount >= 0))
            throw new Error(`مبلغ ردیف ${idx + 1} نامعتبر است`);
        if (!l.goodsItemId)
            throw new Error(`کالا برای ردیف ${idx + 1} الزامی است`);
        const item = await prisma_1.prisma.goodsItem.findUnique({ where: { id: l.goodsItemId } });
        if (!item)
            throw new Error(`کالای ردیف ${idx + 1} یافت نشد`);
        if (item.kind !== "GOODS")
            throw new Error(`ردیف ${idx + 1}: فقط کالا قابل انتخاب است`);
        if (!item.isActive)
            throw new Error(`کالای ردیف ${idx + 1} غیرفعال است`);
        const unitId = l.unitId || item.mainUnitId;
        const vatRatePercent = (0, vatCalculation_1.resolveVatRatePercent)(item, await (0, accountingSettingsService_1.getVatRatePercentForDate)(docDate));
        const suggestedVatAmount = (0, vatCalculation_1.computeLineVat)(amount, 0, vatRatePercent);
        const vatAmount = l.vatAmount !== undefined && l.vatAmount !== null ? Number(l.vatAmount) : suggestedVatAmount;
        if (!(vatAmount >= 0))
            throw new Error(`مالیات بر ارزش افزوده ردیف ${idx + 1} نامعتبر است`);
        cleaned.push({ goodsItemId: l.goodsItemId, unitId, quantity: qty, unitPrice, amount, vatAmount, description: l.description || null });
    }
    return cleaned;
}
router.get("/sales-quotes", (0, guard_1.can)(`${SALES_QUOTES_FORM}.view`), async (_req, res) => {
    const items = await prisma_1.prisma.salesQuote.findMany({
        include: { customer: { include: { party: true } }, salesType: true, salesCenter: true, fiscalPeriod: true, currency: true, lines: true },
        orderBy: { id: "desc" },
    });
    res.json(items.map((d) => ({
        id: d.id,
        number: d.number,
        date: d.date,
        customerId: d.customerId,
        customerTitle: partyDisplayName(d.customer.party),
        salesTypeId: d.salesTypeId,
        salesTypeTitle: d.salesType.title,
        salesCenterId: d.salesCenterId,
        salesCenterTitle: d.salesCenter.title,
        currencyTitle: d.currency.title,
        status: d.status,
        lineCount: d.lines.length,
        totalAmount: d.lines.reduce((s, l) => s + Number(l.amount), 0),
    })));
});
router.get("/sales-quotes/:id", (0, guard_1.can)(`${SALES_QUOTES_FORM}.view`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.salesQuote.findUnique({
        where: { id },
        include: {
            customer: { include: { party: true } },
            salesType: true,
            salesCenter: true,
            fiscalPeriod: true,
            currency: true,
            lines: { include: { goodsItem: true, unit: true }, orderBy: { rowOrder: "asc" } },
        },
    });
    if (!d)
        return res.status(404).json({ error: "پیش‌فاکتور یافت نشد" });
    res.json({
        id: d.id,
        number: d.number,
        date: d.date,
        customerId: d.customerId,
        customerTitle: partyDisplayName(d.customer.party),
        salesTypeId: d.salesTypeId,
        salesTypeTitle: d.salesType.title,
        salesCenterId: d.salesCenterId,
        salesCenterTitle: d.salesCenter.title,
        currencyId: d.currencyId,
        fiscalPeriodId: d.fiscalPeriodId,
        description: d.description,
        status: d.status,
        updatedAt: d.updatedAt,
        lines: d.lines.map((l) => ({
            id: l.id,
            goodsItemId: l.goodsItemId,
            goodsItemCode: l.goodsItem.fullCode,
            goodsItemTitle: l.goodsItem.title,
            unitId: l.unitId,
            unitTitle: l.unit.title,
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice),
            amount: Number(l.amount),
            vatAmount: Number(l.vatAmount),
            description: l.description,
        })),
    });
});
router.post("/sales-quotes", (0, guard_1.can)(`${SALES_QUOTES_FORM}.create`), async (req, res) => {
    const body = req.body;
    if (!body.date || !body.customerId || !body.salesTypeId || !body.salesCenterId || !body.currencyId) {
        return res.status(400).json({ error: "تاریخ، مشتری، نوع فروش، مرکز فروش و ارز الزامی است" });
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
        const lines = await validateSalesQuoteLines(body.lines, date);
        const number = await nextNumber(prisma_1.prisma.salesQuote, fiscalPeriod.id);
        const created = await prisma_1.prisma.salesQuote.create({
            data: {
                fiscalPeriodId: fiscalPeriod.id,
                number,
                date,
                customerId: body.customerId,
                salesTypeId: body.salesTypeId,
                salesCenterId: body.salesCenterId,
                currencyId: body.currencyId,
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
        res.status(400).json({ error: e.message || "خطا در ثبت پیش‌فاکتور" });
    }
});
router.put("/sales-quotes/:id", (0, guard_1.can)(`${SALES_QUOTES_FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.salesQuote.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "یافت نشد" });
    if (existing.status !== "DRAFT")
        return res.status(400).json({ error: "ویرایش فقط در حالت ثبت ممکن است" });
    if (!body.date || !body.customerId || !body.salesTypeId || !body.salesCenterId || !body.currencyId) {
        return res.status(400).json({ error: "تاریخ، مشتری، نوع فروش، مرکز فروش و ارز الزامی است" });
    }
    try {
        (0, concurrency_1.assertRecordNotStale)(existing.updatedAt, req.body.updatedAt, "این پیش‌فاکتور");
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
        const lines = await validateSalesQuoteLines(body.lines, date);
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.salesQuoteLine.deleteMany({ where: { salesQuoteId: id } }),
            prisma_1.prisma.salesQuote.update({
                where: { id },
                data: {
                    fiscalPeriodId: fiscalPeriod.id,
                    date,
                    customerId: body.customerId,
                    salesTypeId: body.salesTypeId,
                    salesCenterId: body.salesCenterId,
                    currencyId: body.currencyId,
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
async function salesQuoteHasDownstreamUsage(salesQuoteId) {
    const count = await prisma_1.prisma.salesOrderLine.count({ where: { sourceSalesQuoteLine: { salesQuoteId } } });
    // حواله فروش مستقیم بر مبنای پیش‌فاکتور هم مصرف پیش‌فاکتور است
    const deliveryCount = await prisma_1.prisma.inventoryDocumentLine.count({ where: { sourceSalesQuoteLine: { salesQuoteId } } });
    return count > 0 || deliveryCount > 0;
}
router.delete("/sales-quotes/:id", (0, guard_1.can)(`${SALES_QUOTES_FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.salesQuote.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "DRAFT")
        return res.status(400).json({ error: "حذف فقط در حالت ثبت ممکن است" });
    if (await salesQuoteHasDownstreamUsage(id))
        return res.status(400).json({ error: "این فرم گردش دارد و قابل حذف نیست" });
    await prisma_1.prisma.salesQuote.delete({ where: { id } });
    res.status(204).send();
});
router.post("/sales-quotes/:id/approve", (0, guard_1.can)(`${SALES_QUOTES_FORM}.approve`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.salesQuote.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "DRAFT")
        return res.status(400).json({ error: "فقط در وضعیت ثبت قابل تایید است" });
    await prisma_1.prisma.salesQuote.update({ where: { id }, data: { status: "APPROVED" } });
    res.json({ id, status: "APPROVED" });
});
router.post("/sales-quotes/:id/unapprove", (0, guard_1.can)(`${SALES_QUOTES_FORM}.unapprove`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.salesQuote.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "APPROVED")
        return res.status(400).json({ error: "فقط در وضعیت تایید قابل برگشت است" });
    if (await salesQuoteHasDownstreamUsage(id))
        return res.status(400).json({ error: "این فرم گردش دارد و امکان برگشت تایید وجود ندارد" });
    await prisma_1.prisma.salesQuote.update({ where: { id }, data: { status: "DRAFT" } });
    res.json({ id, status: "DRAFT" });
});
// طبق تصمیم صریح کاربر (۱۴۰۵/۰۶/۲۰، هم‌الگوی SalesQuote): مالیات بر ارزش‌افزوده همیشه به همان ارز هدر
// محاسبه/ذخیره می‌شود (نه ارز مبنا)، چون این فرم اصلاً fxRate ندارد.
async function validateSalesOrderLines(lines, basis, docDate) {
    if (!Array.isArray(lines) || lines.length === 0)
        throw new Error("سفارش فروش باید حداقل یک ردیف کالا داشته باشد");
    const cleaned = [];
    for (const [idx, l] of lines.entries()) {
        const qty = Number(l.quantity);
        if (!(qty > 0))
            throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);
        let goodsItemId = l.goodsItemId || 0;
        let unitId = l.unitId || 0;
        let unitPrice = Number(l.unitPrice) || 0;
        let amount = Number(l.amount) || 0;
        let sourceSalesQuoteLineId = null;
        if (basis === "QUOTE") {
            if (!l.sourceSalesQuoteLineId)
                throw new Error(`ردیف ${idx + 1}: انتخاب ردیف پیش‌فاکتور الزامی است`);
            const source = await prisma_1.prisma.salesQuoteLine.findUnique({ where: { id: l.sourceSalesQuoteLineId }, include: { salesQuote: true } });
            if (!source)
                throw new Error(`ردیف پیش‌فاکتور برای ردیف ${idx + 1} یافت نشد`);
            if (source.salesQuote.status !== "APPROVED")
                throw new Error(`پیش‌فاکتور ردیف ${idx + 1} در وضعیت تایید نیست`);
            sourceSalesQuoteLineId = source.id;
            goodsItemId = source.goodsItemId;
            unitId = source.unitId;
            unitPrice = Number(source.unitPrice);
            amount = Math.round(unitPrice * qty * 100) / 100;
        }
        else {
            if (!goodsItemId)
                throw new Error(`کالا برای ردیف ${idx + 1} الزامی است`);
            if (!(unitPrice >= 0))
                throw new Error(`فی ردیف ${idx + 1} نامعتبر است`);
            if (!(amount >= 0))
                throw new Error(`مبلغ ردیف ${idx + 1} نامعتبر است`);
        }
        const item = await prisma_1.prisma.goodsItem.findUnique({ where: { id: goodsItemId } });
        if (!item)
            throw new Error(`کالای ردیف ${idx + 1} یافت نشد`);
        if (item.kind !== "GOODS")
            throw new Error(`ردیف ${idx + 1}: فقط کالا قابل انتخاب است`);
        if (!item.isActive)
            throw new Error(`کالای ردیف ${idx + 1} غیرفعال است`);
        if (!unitId)
            unitId = item.mainUnitId;
        const vatRatePercent = (0, vatCalculation_1.resolveVatRatePercent)(item, await (0, accountingSettingsService_1.getVatRatePercentForDate)(docDate));
        const suggestedVatAmount = (0, vatCalculation_1.computeLineVat)(amount, 0, vatRatePercent);
        const vatAmount = l.vatAmount !== undefined && l.vatAmount !== null ? Number(l.vatAmount) : suggestedVatAmount;
        if (!(vatAmount >= 0))
            throw new Error(`مالیات بر ارزش افزوده ردیف ${idx + 1} نامعتبر است`);
        cleaned.push({ sourceSalesQuoteLineId, goodsItemId, unitId, quantity: qty, unitPrice, amount, vatAmount, description: l.description || null });
    }
    return cleaned;
}
router.get("/sales-orders/pickable-quote-lines", (0, guard_1.can)(`${SALES_ORDERS_FORM}.view`), async (req, res) => {
    const customerId = req.query.customerId ? Number(req.query.customerId) : null;
    const currencyId = req.query.currencyId ? Number(req.query.currencyId) : null;
    const salesCenterId = req.query.salesCenterId ? Number(req.query.salesCenterId) : null;
    const destDate = req.query.destDate ? new Date(req.query.destDate) : null;
    const excludeOrderId = req.query.excludeOrderId ? Number(req.query.excludeOrderId) : null;
    const lines = await prisma_1.prisma.salesQuoteLine.findMany({
        where: {
            salesQuote: {
                status: "APPROVED",
                ...(customerId ? { customerId } : {}),
                ...(currencyId ? { currencyId } : {}),
                ...(salesCenterId ? { salesCenterId } : {}),
                ...(destDate ? { date: { lte: destDate } } : {}),
            },
        },
        include: { salesQuote: true, goodsItem: true, unit: true, salesOrderLines: true, inventoryLines: { include: { document: true } } },
        orderBy: { id: "desc" },
    });
    const result = lines
        .map((l) => {
        // مصرف همین سفارش (در حال ویرایش) نباید در «مانده» لحاظ شود، وگرنه ردیفی که کل مانده‌اش را همین
        // سفارش قبلاً گرفته، از فهرست انتخابگر حذف می‌شود و در حالت ویرایش، ردیف پیش‌فاکتور قبلاً
        // انتخاب‌شده در گرید نمایش داده نمی‌شود — دقیقاً هم‌الگوی purchaseInvoices.ts/salesInvoices.ts.
        const done = l.salesOrderLines
            .filter((o) => !excludeOrderId || o.salesOrderId !== excludeOrderId)
            .reduce((s, o) => s + Number(o.quantity), 0) +
            // آنچه مستقیماً با حواله فروش (بر مبنای همین پیش‌فاکتور) تحویل شده هم از مانده کم می‌شود
            l.inventoryLines.filter((d) => d.document.documentType === "SALES_DELIVERY").reduce((s, d) => s + Number(d.quantity), 0);
        const quantity = Number(l.quantity);
        const remaining = quantity - done;
        return {
            id: l.id,
            sourceSalesQuoteLineId: l.id,
            salesQuoteId: l.salesQuote.id,
            number: l.salesQuote.number,
            date: l.salesQuote.date,
            goodsItemId: l.goodsItemId,
            goodsItemCode: l.goodsItem.fullCode,
            goodsItemTitle: l.goodsItem.title,
            unitId: l.unitId,
            unitTitle: l.unit.title,
            unitPrice: Number(l.unitPrice),
            quantity,
            done,
            remaining,
        };
    })
        .filter((r) => r.remaining > 0);
    res.json(result);
});
router.get("/sales-orders", (0, guard_1.can)(`${SALES_ORDERS_FORM}.view`), async (_req, res) => {
    const items = await prisma_1.prisma.salesOrder.findMany({
        include: { customer: { include: { party: true } }, salesType: true, salesCenter: true, fiscalPeriod: true, currency: true, lines: true },
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
        lineCount: d.lines.length,
        totalAmount: d.lines.reduce((s, l) => s + Number(l.amount), 0),
    })));
});
router.get("/sales-orders/:id", (0, guard_1.can)(`${SALES_ORDERS_FORM}.view`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.salesOrder.findUnique({
        where: { id },
        include: {
            customer: { include: { party: true } },
            salesType: true,
            salesCenter: true,
            fiscalPeriod: true,
            currency: true,
            lines: { include: { goodsItem: true, unit: true }, orderBy: { rowOrder: "asc" } },
        },
    });
    if (!d)
        return res.status(404).json({ error: "سفارش فروش یافت نشد" });
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
        fiscalPeriodId: d.fiscalPeriodId,
        description: d.description,
        status: d.status,
        updatedAt: d.updatedAt,
        lines: d.lines.map((l) => ({
            id: l.id,
            sourceSalesQuoteLineId: l.sourceSalesQuoteLineId,
            goodsItemId: l.goodsItemId,
            goodsItemCode: l.goodsItem.fullCode,
            goodsItemTitle: l.goodsItem.title,
            unitId: l.unitId,
            unitTitle: l.unit.title,
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice),
            amount: Number(l.amount),
            vatAmount: Number(l.vatAmount),
            description: l.description,
        })),
    });
});
router.post("/sales-orders", (0, guard_1.can)(`${SALES_ORDERS_FORM}.create`), async (req, res) => {
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
        const lines = await validateSalesOrderLines(body.lines, body.basis, date);
        const number = await nextNumber(prisma_1.prisma.salesOrder, fiscalPeriod.id);
        const created = await prisma_1.prisma.salesOrder.create({
            data: {
                fiscalPeriodId: fiscalPeriod.id,
                number,
                date,
                basis: body.basis,
                customerId: body.customerId,
                salesTypeId: body.salesTypeId,
                salesCenterId: body.salesCenterId,
                currencyId: body.currencyId,
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
        res.status(400).json({ error: e.message || "خطا در ثبت سفارش فروش" });
    }
});
router.put("/sales-orders/:id", (0, guard_1.can)(`${SALES_ORDERS_FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.salesOrder.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "یافت نشد" });
    if (existing.status !== "DRAFT")
        return res.status(400).json({ error: "ویرایش فقط در حالت ثبت ممکن است" });
    if (!body.date || !body.basis || !body.customerId || !body.salesTypeId || !body.salesCenterId || !body.currencyId) {
        return res.status(400).json({ error: "تاریخ، مبنا، مشتری، نوع فروش، مرکز فروش و ارز الزامی است" });
    }
    try {
        (0, concurrency_1.assertRecordNotStale)(existing.updatedAt, req.body.updatedAt, "این سفارش فروش");
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
        const lines = await validateSalesOrderLines(body.lines, body.basis, date);
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.salesOrderLine.deleteMany({ where: { salesOrderId: id } }),
            prisma_1.prisma.salesOrder.update({
                where: { id },
                data: {
                    fiscalPeriodId: fiscalPeriod.id,
                    date,
                    basis: body.basis,
                    customerId: body.customerId,
                    salesTypeId: body.salesTypeId,
                    salesCenterId: body.salesCenterId,
                    currencyId: body.currencyId,
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
async function salesOrderHasDownstreamUsage(salesOrderId) {
    const count = await prisma_1.prisma.inventoryDocumentLine.count({
        where: { document: { documentType: "SALES_DELIVERY" }, sourceSalesOrderLine: { salesOrderId } },
    });
    return count > 0;
}
router.delete("/sales-orders/:id", (0, guard_1.can)(`${SALES_ORDERS_FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.salesOrder.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "DRAFT")
        return res.status(400).json({ error: "حذف فقط در حالت ثبت ممکن است" });
    if (await salesOrderHasDownstreamUsage(id))
        return res.status(400).json({ error: "این فرم گردش دارد و قابل حذف نیست" });
    await prisma_1.prisma.salesOrder.delete({ where: { id } });
    res.status(204).send();
});
router.post("/sales-orders/:id/approve", (0, guard_1.can)(`${SALES_ORDERS_FORM}.approve`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.salesOrder.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "DRAFT")
        return res.status(400).json({ error: "فقط در وضعیت ثبت قابل تایید است" });
    await prisma_1.prisma.salesOrder.update({ where: { id }, data: { status: "APPROVED" } });
    res.json({ id, status: "APPROVED" });
});
router.post("/sales-orders/:id/unapprove", (0, guard_1.can)(`${SALES_ORDERS_FORM}.unapprove`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.salesOrder.findUnique({ where: { id } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status !== "APPROVED")
        return res.status(400).json({ error: "فقط در وضعیت تایید قابل برگشت است" });
    if (await salesOrderHasDownstreamUsage(id))
        return res.status(400).json({ error: "این فرم گردش دارد و امکان برگشت تایید وجود ندارد" });
    await prisma_1.prisma.salesOrder.update({ where: { id }, data: { status: "DRAFT" } });
    res.json({ id, status: "DRAFT" });
});
exports.default = router;
