"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const fiscalPeriodValidation_1 = require("../utils/fiscalPeriodValidation");
const concurrency_1 = require("../utils/concurrency");
const paymentBasisCandidates_1 = require("../services/paymentBasisCandidates");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const pettyCashBalanceService_1 = require("../services/pettyCashBalanceService");
// «پرداخت تنخواه» (مدیریت خزانه › پرداخت): سند ساده‌ی ثبتِ برداشت از یک تنخواه — طبق تصمیم صریح کاربر، فعلاً بدون
// سند حسابداری/گردش تایید (فقط ثبت اطلاعات). basisType از خودِ PaymentType انتخاب‌شده می‌آید (هر نوع پرداخت
// دقیقاً یک basisType ثابت دارد — routes/paymentTypes.ts)؛ سند مبنا (در صورت لزوم) و کنترل‌هایش هم‌الگوی
// «موضوعات پرداخت» سند پرداخت است (routes/payments.ts، منطق مشترکِ مانده در services/paymentBasisCandidates.ts):
//  - basisType=NONE ⇐⇒ هیچ‌کدام از سه فیلد سند مبنا پر نمی‌شود.
//  - وگرنه دقیقاً یکی از purchaseInvoiceId/salesInvoiceId/purchaseOrderId (متناظر با basisType) الزامی است، طرف‌حساب باید
//    تامین‌کننده (فاکتور/سفارش خرید) یا مشتری (فاکتور فروش) باشد، و تاریخ سند مبنا باید از تاریخ این پرداخت کوچکتر باشد.
// کنترل مانده منفی: اگر تنخواه‌دارِ انتخاب‌شده controlNegativeBalance=true باشد، مانده‌ی جاریِ تنخواه (از صفر شروع
// می‌شود، نه از سقف تنخواه — services/pettyCashBalanceService.ts) در هیچ لحظه‌ای از ترتیب زمانیِ تراکنش‌ها نباید منفی شود.
const BASIS_FIELD = {
    PURCHASE_INVOICE: "purchaseInvoiceId",
    SALES_INVOICE: "salesInvoiceId",
    PURCHASE_ORDER: "purchaseOrderId",
};
const FORM = (0, registry_1.findFormPrefix)("petty-cash-payments");
const router = (0, express_1.Router)();
const INCLUDE = {
    custodian: {
        select: {
            id: true,
            detailCode: true,
            pettyCash: { select: { id: true, detailCode: true, title: true, currencyId: true, limitAmount: true, currency: { select: { title: true, decimalPlaces: true } } } },
            party: { select: { id: true, detailCode: true, category: true, firstName: true, lastName: true, name: true } },
        },
    },
    party: { select: { id: true, detailCode: true, category: true, firstName: true, lastName: true, name: true } },
    paymentType: { select: { id: true, title: true, nature: true, basisType: true } },
    purchaseInvoice: { select: { id: true, number: true, date: true } },
    salesInvoice: { select: { id: true, number: true, date: true } },
    purchaseOrder: { select: { id: true, number: true, date: true } },
};
router.get("/", async (_req, res) => {
    res.json(await prisma_1.prisma.pettyCashPayment.findMany({ include: INCLUDE, orderBy: { date: "desc" } }));
});
router.get("/:id", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const item = await prisma_1.prisma.pettyCashPayment.findUnique({ where: { id: Number(req.params.id) }, include: INCLUDE });
    if (!item)
        return res.status(404).json({ error: "پرداخت تنخواه یافت نشد" });
    res.json(item);
});
/** اعتبارسنجی/محاسبه‌ی سند مبنا طبق basisType نوع پرداخت؛ خروجی چیزی است که مستقیم در data ذخیره می‌شود.
 * این فرم تک‌ردیفی است و تبدیل ارز ندارد (برخلاف «موضوعات پرداخت» سند پرداخت)، پس سند مبنا باید دقیقاً هم‌ارز تنخواه باشد. */
async function resolveBasis(basisType, body, excludePettyCashPaymentId, date, amount, pettyCashCurrencyId) {
    const ids = {
        purchaseInvoiceId: body.purchaseInvoiceId || null,
        salesInvoiceId: body.salesInvoiceId || null,
        purchaseOrderId: body.purchaseOrderId || null,
    };
    if (basisType === "NONE") {
        if (ids.purchaseInvoiceId || ids.salesInvoiceId || ids.purchaseOrderId) {
            throw new Error("نوع پرداخت انتخاب‌شده «بدون مبنا» است؛ سند مبنا نباید انتخاب شود");
        }
        return { purchaseInvoiceId: null, salesInvoiceId: null, purchaseOrderId: null };
    }
    const field = BASIS_FIELD[basisType];
    const basisId = ids[field];
    if (!basisId)
        throw new Error("انتخاب سند مبنا الزامی است");
    for (const [f, v] of Object.entries(ids)) {
        if (f !== field && v)
            throw new Error("فقط سند مبنای متناسب با نوع پرداخت باید انتخاب شود");
    }
    const candidates = await (0, paymentBasisCandidates_1.candidatesForBasisType)(basisType, body.partyId, { excludePettyCashPaymentId });
    const info = candidates.find((c) => c.id === basisId);
    if (!info)
        throw new Error("سند مبنای انتخاب‌شده یافت نشد یا متعلق به این طرف‌حساب نیست");
    if (info.currencyId !== pettyCashCurrencyId)
        throw new Error("ارز سند مبنا باید با ارز تنخواه یکسان باشد");
    if (info.date >= date)
        throw new Error("تاریخ سند مبنا باید از تاریخ پرداخت کوچکتر باشد");
    if (amount > info.remaining + 0.001)
        throw new Error(`مبلغ پرداخت از مانده‌ی قابل تسویه‌ی سند مبنا (${info.remaining.toLocaleString("fa-IR")}) بیشتر است`);
    return { purchaseInvoiceId: null, salesInvoiceId: null, purchaseOrderId: null, [field]: basisId };
}
router.post("/", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const body = req.body;
    if (!body.date)
        return res.status(400).json({ error: "تاریخ الزامی است" });
    if (!body.custodianId)
        return res.status(400).json({ error: "تنخواه‌دار الزامی است" });
    if (!body.partyId)
        return res.status(400).json({ error: "طرف‌حساب الزامی است" });
    if (!body.paymentTypeId)
        return res.status(400).json({ error: "نوع پرداخت الزامی است" });
    const amount = Number(body.amount);
    if (!body.amount || !Number.isFinite(amount) || amount <= 0)
        return res.status(400).json({ error: "مبلغ الزامی است و باید بزرگتر از صفر باشد" });
    try {
        const date = new Date(body.date);
        const fiscalPeriod = await prisma_1.prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
        if (!fiscalPeriod)
            return res.status(400).json({ error: "این تاریخ در هیچ دوره مالی تعریف نشده است" });
        await (0, fiscalPeriodValidation_1.assertDateWithinCurrentFiscalPeriod)(date);
        const custodian = await prisma_1.prisma.pettyCashCustodian.findUnique({ where: { id: body.custodianId }, include: { pettyCash: true } });
        if (!custodian)
            return res.status(400).json({ error: "تنخواه‌دار نامعتبر است" });
        if (!custodian.isActive)
            return res.status(400).json({ error: "تنخواه‌دار انتخاب‌شده غیرفعال است" });
        if (!custodian.pettyCash.isActive)
            return res.status(400).json({ error: "تنخواه انتخاب‌شده غیرفعال است" });
        const party = await prisma_1.prisma.party.findUnique({ where: { id: body.partyId }, include: { supplier: true, customer: true } });
        if (!party)
            return res.status(400).json({ error: "طرف‌حساب نامعتبر است" });
        if (!party.isActive)
            return res.status(400).json({ error: "طرف‌حساب انتخاب‌شده غیرفعال است" });
        const paymentType = await prisma_1.prisma.paymentType.findUnique({ where: { id: body.paymentTypeId } });
        if (!paymentType)
            return res.status(400).json({ error: "نوع پرداخت نامعتبر است" });
        if (!paymentType.isActive)
            return res.status(400).json({ error: "نوع پرداخت انتخاب‌شده غیرفعال است" });
        if (paymentType.nature === "TO_BANK" || paymentType.nature === "TO_CASH_BOX" || paymentType.nature === "TO_PETTY_CASH") {
            return res.status(400).json({ error: "این ماهیت نوع پرداخت (به بانک/به صندوق/به تنخواه) برای پرداخت تنخواه قابل استفاده نیست" });
        }
        const basisType = paymentType.basisType;
        if (basisType === "PURCHASE_INVOICE" || basisType === "PURCHASE_ORDER") {
            if (!party.supplier)
                return res.status(400).json({ error: "طرف‌حساب باید در «تامین‌کنندگان» تعریف شده باشد" });
        }
        else if (basisType === "SALES_INVOICE") {
            if (!party.customer)
                return res.status(400).json({ error: "طرف‌حساب باید در «مشتریان» تعریف شده باشد" });
        }
        const basisIds = await resolveBasis(basisType, body, undefined, date, amount, custodian.pettyCash.currencyId);
        if (custodian.controlNegativeBalance) {
            await (0, pettyCashBalanceService_1.assertPettyCashRunningBalanceNotNegative)(custodian.pettyCashId, { pendingEvents: [{ date, amount: -amount }] });
        }
        const created = await prisma_1.prisma.pettyCashPayment.create({
            data: {
                fiscalPeriodId: fiscalPeriod.id,
                date,
                custodianId: custodian.id,
                partyId: party.id,
                paymentTypeId: paymentType.id,
                ...basisIds,
                amount,
                description: body.description || null,
            },
            include: INCLUDE,
        });
        res.status(201).json(created);
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ثبت پرداخت تنخواه" });
    }
});
router.put("/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.pettyCashPayment.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "پرداخت تنخواه یافت نشد" });
    if (!body.date)
        return res.status(400).json({ error: "تاریخ الزامی است" });
    if (!body.custodianId)
        return res.status(400).json({ error: "تنخواه‌دار الزامی است" });
    if (!body.partyId)
        return res.status(400).json({ error: "طرف‌حساب الزامی است" });
    if (!body.paymentTypeId)
        return res.status(400).json({ error: "نوع پرداخت الزامی است" });
    const amount = Number(body.amount);
    if (!body.amount || !Number.isFinite(amount) || amount <= 0)
        return res.status(400).json({ error: "مبلغ الزامی است و باید بزرگتر از صفر باشد" });
    try {
        (0, concurrency_1.assertRecordNotStale)(existing.updatedAt, body.updatedAt, "این پرداخت تنخواه");
        const date = new Date(body.date);
        const fiscalPeriod = await prisma_1.prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
        if (!fiscalPeriod)
            return res.status(400).json({ error: "این تاریخ در هیچ دوره مالی تعریف نشده است" });
        await (0, fiscalPeriodValidation_1.assertDateWithinCurrentFiscalPeriod)(date);
        const custodian = await prisma_1.prisma.pettyCashCustodian.findUnique({ where: { id: body.custodianId }, include: { pettyCash: true } });
        if (!custodian)
            return res.status(400).json({ error: "تنخواه‌دار نامعتبر است" });
        if (!custodian.isActive && custodian.id !== existing.custodianId)
            return res.status(400).json({ error: "تنخواه‌دار انتخاب‌شده غیرفعال است" });
        if (!custodian.pettyCash.isActive && custodian.pettyCashId !== (await prisma_1.prisma.pettyCashCustodian.findUnique({ where: { id: existing.custodianId } }))?.pettyCashId) {
            return res.status(400).json({ error: "تنخواه انتخاب‌شده غیرفعال است" });
        }
        const party = await prisma_1.prisma.party.findUnique({ where: { id: body.partyId }, include: { supplier: true, customer: true } });
        if (!party)
            return res.status(400).json({ error: "طرف‌حساب نامعتبر است" });
        if (!party.isActive && party.id !== existing.partyId)
            return res.status(400).json({ error: "طرف‌حساب انتخاب‌شده غیرفعال است" });
        const paymentType = await prisma_1.prisma.paymentType.findUnique({ where: { id: body.paymentTypeId } });
        if (!paymentType)
            return res.status(400).json({ error: "نوع پرداخت نامعتبر است" });
        if (!paymentType.isActive && paymentType.id !== existing.paymentTypeId)
            return res.status(400).json({ error: "نوع پرداخت انتخاب‌شده غیرفعال است" });
        if (paymentType.nature === "TO_BANK" || paymentType.nature === "TO_CASH_BOX" || paymentType.nature === "TO_PETTY_CASH") {
            return res.status(400).json({ error: "این ماهیت نوع پرداخت (به بانک/به صندوق/به تنخواه) برای پرداخت تنخواه قابل استفاده نیست" });
        }
        const basisType = paymentType.basisType;
        if (basisType === "PURCHASE_INVOICE" || basisType === "PURCHASE_ORDER") {
            if (!party.supplier)
                return res.status(400).json({ error: "طرف‌حساب باید در «تامین‌کنندگان» تعریف شده باشد" });
        }
        else if (basisType === "SALES_INVOICE") {
            if (!party.customer)
                return res.status(400).json({ error: "طرف‌حساب باید در «مشتریان» تعریف شده باشد" });
        }
        const basisIds = await resolveBasis(basisType, body, id, date, amount, custodian.pettyCash.currencyId);
        if (custodian.controlNegativeBalance) {
            await (0, pettyCashBalanceService_1.assertPettyCashRunningBalanceNotNegative)(custodian.pettyCashId, {
                excludePettyCashPaymentId: id,
                pendingEvents: [{ date, amount: -amount }],
            });
        }
        const updated = await prisma_1.prisma.pettyCashPayment.update({
            where: { id },
            data: {
                fiscalPeriodId: fiscalPeriod.id,
                date,
                custodianId: custodian.id,
                partyId: party.id,
                paymentTypeId: paymentType.id,
                ...basisIds,
                amount,
                description: body.description || null,
            },
            include: INCLUDE,
        });
        res.json(updated);
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ویرایش پرداخت تنخواه" });
    }
});
router.delete("/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma_1.prisma.pettyCashPayment.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "پرداخت تنخواه یافت نشد" });
    await prisma_1.prisma.pettyCashPayment.delete({ where: { id } });
    res.status(204).send();
});
// اسناد مبنای قابل انتخاب برای این پرداخت — دقیقاً هم‌الگوی /payments/pickable-basis-documents (منطق مشترک در paymentBasisCandidates.ts)
router.get("/basis/pickable-documents", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const basisType = req.query.basisType;
    const partyId = req.query.partyId ? Number(req.query.partyId) : null;
    const excludePettyCashPaymentId = req.query.excludeId ? Number(req.query.excludeId) : undefined;
    if (!basisType || basisType === "NONE" || !partyId)
        return res.json([]);
    const candidates = await (0, paymentBasisCandidates_1.candidatesForBasisType)(basisType, partyId, { excludePettyCashPaymentId });
    res.json(candidates.filter((c) => c.remaining > 0.001));
});
exports.default = router;
