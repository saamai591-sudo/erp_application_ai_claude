"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const requestContext_1 = require("../lib/requestContext");
const concurrency_1 = require("../utils/concurrency");
const chequeUsage_1 = require("../utils/chequeUsage");
const guard_1 = require("../authz/guard");
const fiscalPeriodValidation_1 = require("../utils/fiscalPeriodValidation");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("treasury-openings");
// =========================================================================
// ماژول «خزانه‌داری» > افتتاحیه دریافت و پرداخت — Documents/افتتاحیه دریافت و پرداخت و بستن سال.md
//
// به‌ازای هر دوره مالی یک فرم افتتاحیه با چهار تب: چک‌های دریافتی و چک‌های پرداختی (خودِ ChequeItemهایی با
// isOpening=true در همان دوره؛ ردیف‌های ساخته‌شده توسط «بستن سال» parentChequeId به چک سال قبل دارند)، حساب‌های بانکی و
// صندوق‌ها (مانده‌ی اول دوره به ارز حساب/صندوق و به ارز پایه). هم برای استقرار اولیه (ورود دستی) و هم برای انتقال پایان سال
// (ایجاد خودکار توسط routes/treasuryYearClose.ts) استفاده می‌شود و می‌تواند مرحله‌به‌مرحله تکمیل شود.
//
// ذخیره (PUT) کل چهار تب را هم‌زمان جایگزین می‌کند؛ مگر چک‌های «قفل»: چکی که سندی (حتی پیش‌نویس) به آن ارجاع می‌دهد یا
// بعد از افتتاحیه گردش داشته (step ≠ ۱) دیگر از این فرم قابل تغییر/حذف نیست.
// =========================================================================
const router = (0, express_1.Router)();
const RECEIVABLE_STATUSES = ["IN_HAND", "IN_COLLECTION", "BOUNCED"];
const PAYABLE_STATUSES = ["ISSUED"];
function partyDisplay(p) {
    if (!p)
        return "";
    return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}
async function getBaseCurrency() {
    const c = await prisma_1.prisma.currency.findFirst({ where: { isBase: true } });
    if (!c)
        throw new Error("ارز پایه تعریف نشده است");
    return c;
}
async function loadOpeningCheques(fiscalPeriodId) {
    // fiscalPeriodId صراحتاً در where است، پس فیلتر خودکار دوره‌ی مالی دخالتی ندارد
    return prisma_1.prisma.chequeItem.findMany({
        where: { fiscalPeriodId, isOpening: true },
        include: { party: true, bankBranch: true, receivableChequeType: true, payableChequeType: true, openingReceiptType: true, openingPaymentType: true, ownerBankAccount: true },
        orderBy: { id: "asc" },
    });
}
async function isChequeLocked(c) {
    if (c.step !== 1)
        return true;
    return (await (0, chequeUsage_1.findChequeUses)(prisma_1.prisma, c.id, {})).length > 0;
}
async function serializeOpening(o) {
    const cheques = await loadOpeningCheques(o.fiscalPeriodId);
    const locks = await Promise.all(cheques.map((c) => isChequeLocked(c)));
    const mapCheque = (c, i) => ({
        id: c.id,
        number: c.number,
        typeId: c.direction === "RECEIVABLE" ? c.receivableChequeTypeId : c.payableChequeTypeId,
        typeTitle: c.direction === "RECEIVABLE" ? c.receivableChequeType?.title : c.payableChequeType?.title,
        receiptTypeId: c.openingReceiptTypeId,
        paymentTypeId: c.openingPaymentTypeId,
        receiptTypeTitle: c.openingReceiptType?.title,
        paymentTypeTitle: c.openingPaymentType?.title,
        bankBranchId: c.bankBranchId,
        bankBranchTitle: c.bankBranch?.title,
        bankAccountId: c.ownerBankAccountId,
        bankAccountNumber: c.ownerBankAccount?.accountNumber,
        dueDate: c.dueDate,
        amount: Number(c.amount),
        partyId: c.partyId,
        partyDisplay: partyDisplay(c.party),
        status: c.status,
        description: c.description,
        parentChequeId: c.parentChequeId,
        locked: locks[i],
    });
    const all = cheques.map((c, i) => ({ c, i }));
    return {
        id: o.id,
        date: o.date,
        fiscalPeriodId: o.fiscalPeriodId,
        fiscalPeriodTitle: o.fiscalPeriod.title,
        updatedAt: o.updatedAt,
        bankAccountLines: o.bankAccountLines.map((l) => ({
            bankAccountId: l.bankAccountId,
            bankAccountNumber: l.bankAccount.accountNumber,
            currencyId: l.currencyId,
            currencyTitle: l.currency.title,
            balance: Number(l.balance),
            baseBalance: Number(l.baseBalance),
        })),
        cashBoxLines: o.cashBoxLines.map((l) => ({
            cashBoxId: l.cashBoxId,
            cashBoxTitle: l.cashBox.title,
            currencyId: l.currencyId,
            currencyTitle: l.currency.title,
            balance: Number(l.balance),
            baseBalance: Number(l.baseBalance),
        })),
        receivableCheques: all.filter(({ c }) => c.direction === "RECEIVABLE").map(({ c, i }) => mapCheque(c, i)),
        payableCheques: all.filter(({ c }) => c.direction === "PAYABLE").map(({ c, i }) => mapCheque(c, i)),
    };
}
const DETAIL_INCLUDE = {
    fiscalPeriod: true,
    bankAccountLines: { include: { bankAccount: true, currency: true }, orderBy: { rowOrder: "asc" } },
    cashBoxLines: { include: { cashBox: true, currency: true }, orderBy: { rowOrder: "asc" } },
};
router.get("/treasury-openings", (0, guard_1.can)(`${FORM}.view`), async (_req, res) => {
    const items = await prisma_1.prisma.treasuryOpening.findMany({ include: { fiscalPeriod: true, bankAccountLines: true, cashBoxLines: true }, orderBy: { id: "desc" } });
    const result = [];
    for (const o of items) {
        const cheques = await loadOpeningCheques(o.fiscalPeriodId);
        result.push({
            id: o.id,
            date: o.date,
            fiscalPeriodTitle: o.fiscalPeriod.title,
            receivableChequeCount: cheques.filter((c) => c.direction === "RECEIVABLE").length,
            payableChequeCount: cheques.filter((c) => c.direction === "PAYABLE").length,
            bankAccountCount: o.bankAccountLines.length,
            cashBoxCount: o.cashBoxLines.length,
        });
    }
    res.json(result);
});
router.get("/treasury-openings/:id", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const o = await prisma_1.prisma.treasuryOpening.findUnique({ where: { id: Number(req.params.id) }, include: DETAIL_INCLUDE });
    if (!o)
        return res.status(404).json({ error: "افتتاحیه یافت نشد" });
    res.json(await serializeOpening(o));
});
// ---------------------------------------------------------------------------
// اعتبارسنجی و ساخت داده‌ی ذخیره‌شدنی ردیف‌ها
// ---------------------------------------------------------------------------
async function cleanBankLines(lines, baseCurrencyId) {
    const out = [];
    const seen = new Set();
    for (const [idx, l] of (lines || []).entries()) {
        if (!l.bankAccountId)
            throw new Error(`حساب‌های بانکی — ردیف ${idx + 1}: انتخاب حساب بانکی الزامی است`);
        if (seen.has(l.bankAccountId))
            throw new Error(`حساب‌های بانکی — ردیف ${idx + 1}: یک حساب بانکی نمی‌تواند دو بار ثبت شود`);
        seen.add(l.bankAccountId);
        // eslint-disable-next-line no-await-in-loop
        const acc = await prisma_1.prisma.bankAccount.findUnique({ where: { id: l.bankAccountId } });
        if (!acc)
            throw new Error(`حساب‌های بانکی — ردیف ${idx + 1}: حساب بانکی یافت نشد`);
        const currencyId = acc.currencyId ?? baseCurrencyId;
        const balance = Number(l.balance);
        if (Number.isNaN(balance))
            throw new Error(`حساب‌های بانکی — ردیف ${idx + 1}: مانده نامعتبر است`);
        // ارز از خودِ حساب بانکی می‌آید؛ برای ارز پایه، مانده‌ی ارز پایه همان مانده است و برای ارز غیرپایه هر دو مبلغ ثبت می‌شود
        const baseBalance = currencyId === baseCurrencyId ? balance : Number(l.baseBalance);
        if (Number.isNaN(baseBalance))
            throw new Error(`حساب‌های بانکی — ردیف ${idx + 1}: مانده به ارز پایه الزامی است`);
        out.push({ bankAccountId: l.bankAccountId, currencyId, balance, baseBalance });
    }
    return out;
}
async function cleanCashLines(lines, baseCurrencyId) {
    const out = [];
    const seen = new Set();
    for (const [idx, l] of (lines || []).entries()) {
        if (!l.cashBoxId)
            throw new Error(`صندوق‌ها — ردیف ${idx + 1}: انتخاب صندوق الزامی است`);
        if (!l.currencyId)
            throw new Error(`صندوق‌ها — ردیف ${idx + 1}: انتخاب ارز الزامی است`);
        const key = `${l.cashBoxId}:${l.currencyId}`;
        if (seen.has(key))
            throw new Error(`صندوق‌ها — ردیف ${idx + 1}: برای یک صندوق و ارز بیش از یک ردیف ثبت شده است`);
        seen.add(key);
        // eslint-disable-next-line no-await-in-loop
        const [box, cur] = await Promise.all([prisma_1.prisma.cashBox.findUnique({ where: { id: l.cashBoxId } }), prisma_1.prisma.currency.findUnique({ where: { id: l.currencyId } })]);
        if (!box)
            throw new Error(`صندوق‌ها — ردیف ${idx + 1}: صندوق یافت نشد`);
        if (!cur)
            throw new Error(`صندوق‌ها — ردیف ${idx + 1}: ارز یافت نشد`);
        const balance = Number(l.balance);
        if (Number.isNaN(balance))
            throw new Error(`صندوق‌ها — ردیف ${idx + 1}: مانده نامعتبر است`);
        const baseBalance = l.currencyId === baseCurrencyId ? balance : Number(l.baseBalance);
        if (Number.isNaN(baseBalance))
            throw new Error(`صندوق‌ها — ردیف ${idx + 1}: مانده به ارز پایه الزامی است`);
        out.push({ cashBoxId: l.cashBoxId, currencyId: l.currencyId, balance, baseBalance });
    }
    return out;
}
// unchangedAccountId: حساب فعلیِ خودِ چک (ردیف موجود) — اگر تغییر نکرده، شرط «دارای دسته چک» دوباره کنترل نمی‌شود (چک‌های منتقل‌شده‌ی قدیمی)
async function cleanCheque(l, idx, direction, tab, unchangedAccountId) {
    const label = `${tab} — ردیف ${idx + 1}`;
    if (!l.number || !String(l.number).trim())
        throw new Error(`${label}: شماره چک الزامی است`);
    if (!l.typeId)
        throw new Error(`${label}: نوع چک الزامی است`);
    if (!l.dueDate)
        throw new Error(`${label}: تاریخ سررسید الزامی است`);
    const amount = Number(l.amount);
    if (!(amount > 0))
        throw new Error(`${label}: مبلغ باید عددی مثبت باشد`);
    if (!l.partyId)
        throw new Error(`${label}: طرف حساب الزامی است`);
    const allowed = direction === "RECEIVABLE" ? RECEIVABLE_STATUSES : PAYABLE_STATUSES;
    if (!allowed.includes(l.status))
        throw new Error(`${label}: وضعیت چک نامعتبر است`);
    if (!(await prisma_1.prisma.party.findUnique({ where: { id: l.partyId } })))
        throw new Error(`${label}: طرف حساب یافت نشد`);
    if (direction === "RECEIVABLE") {
        if (!(await prisma_1.prisma.receivableChequeType.findUnique({ where: { id: l.typeId } })))
            throw new Error(`${label}: نوع چک دریافتی یافت نشد`);
        if (l.bankBranchId && !(await prisma_1.prisma.bankBranch.findUnique({ where: { id: l.bankBranchId } })))
            throw new Error(`${label}: شعبه بانک یافت نشد`);
    }
    else {
        if (!l.bankAccountId)
            throw new Error(`${label}: حساب بانکی الزامی است`);
        const acc = await prisma_1.prisma.bankAccount.findUnique({ where: { id: l.bankAccountId }, include: { accountType: true } });
        if (!acc)
            throw new Error(`${label}: حساب بانکی یافت نشد`);
        if (!acc.accountType.hasChequeBook && l.bankAccountId !== unchangedAccountId)
            throw new Error(`${label}: چک پرداختی فقط از حساب بانکیِ نوعِ «دارای دسته چک» قابل ثبت است`);
        if (!(await prisma_1.prisma.payableChequeType.findUnique({ where: { id: l.typeId } })))
            throw new Error(`${label}: نوع چک پرداختی یافت نشد`);
    }
    return amount;
}
function chequeData(l, direction, amount, baseCurrencyId) {
    return {
        number: String(l.number).trim(),
        dueDate: new Date(l.dueDate),
        amount,
        currencyId: baseCurrencyId, // چک همیشه با ارز پایه است
        partyId: l.partyId,
        status: l.status,
        description: l.description || null,
        bankBranchId: l.bankBranchId || null,
        ownerBankAccountId: direction === "PAYABLE" ? l.bankAccountId || null : null,
        receivableChequeTypeId: direction === "RECEIVABLE" ? l.typeId : null,
        payableChequeTypeId: direction === "PAYABLE" ? l.typeId : null,
        openingReceiptTypeId: direction === "RECEIVABLE" ? l.receiptTypeId || null : null,
        openingPaymentTypeId: direction === "PAYABLE" ? l.paymentTypeId || null : null,
    };
}
/** چک‌های یک جهت را با ردیف‌های ارسالی هم‌گام می‌کند (افزودن/ویرایش/حذف)، به‌جز چک‌های قفل که دست‌نخورده می‌مانند. */
async function syncCheques(tx, fiscalPeriodId, direction, rows, baseCurrencyId, tab) {
    const existing = await tx.chequeItem.findMany({ where: { fiscalPeriodId, isOpening: true, direction } });
    const byId = new Map(existing.map((c) => [c.id, c]));
    const seen = new Set();
    for (const [idx, l] of rows.entries()) {
        // eslint-disable-next-line no-await-in-loop
        const amount = await cleanCheque(l, idx, direction, tab, l.id ? byId.get(l.id)?.ownerBankAccountId : null);
        const data = chequeData(l, direction, amount, baseCurrencyId);
        if (l.id) {
            const ex = byId.get(l.id);
            if (!ex)
                throw new Error(`${tab} — ردیف ${idx + 1}: چک یافت نشد`);
            seen.add(l.id);
            // eslint-disable-next-line no-await-in-loop
            if (await isChequeLocked(ex)) {
                const changed = ex.number !== data.number || Math.abs(Number(ex.amount) - amount) > 0.001 || ex.status !== data.status || ex.partyId !== data.partyId;
                if (changed)
                    throw new Error(`${tab} — ردیف ${idx + 1}: این چک در سند دیگری استفاده شده یا گردش داشته و قابل ویرایش نیست`);
                continue;
            }
            // eslint-disable-next-line no-await-in-loop
            await tx.chequeItem.update({ where: { id: l.id }, data });
        }
        else {
            // eslint-disable-next-line no-await-in-loop
            await tx.chequeItem.create({ data: { ...data, direction, fiscalPeriodId, isOpening: true, step: 1 } });
        }
    }
    for (const ex of existing) {
        if (seen.has(ex.id))
            continue;
        // eslint-disable-next-line no-await-in-loop
        if (await isChequeLocked(ex))
            throw new Error(`${tab}: چک شماره ${ex.number} در سند دیگری استفاده شده یا گردش داشته و قابل حذف نیست`);
        // eslint-disable-next-line no-await-in-loop
        await tx.chequeItem.delete({ where: { id: ex.id } });
    }
}
async function resolvePeriod(body) {
    if (!body.date)
        throw new Error("تاریخ افتتاحیه الزامی است");
    const date = new Date(body.date);
    const period = body.fiscalPeriodId
        ? await prisma_1.prisma.fiscalPeriod.findUnique({ where: { id: body.fiscalPeriodId } })
        : await prisma_1.prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
    if (!period)
        throw new Error("دوره مالی این تاریخ تعریف نشده است");
    if (date < period.fromDate || date > period.toDate)
        throw new Error("تاریخ افتتاحیه باید در بازه‌ی دوره مالی باشد");
    await (0, fiscalPeriodValidation_1.assertDateWithinCurrentFiscalPeriod)(date);
    return { date, period };
}
router.post("/treasury-openings", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const body = req.body;
    try {
        const { date, period } = await resolvePeriod(body);
        if (await (0, requestContext_1.withoutFiscalPeriodScope)(() => prisma_1.prisma.treasuryOpening.findUnique({ where: { fiscalPeriodId: period.id } }))) {
            throw new Error("برای این دوره مالی قبلاً افتتاحیه ثبت شده است؛ همان را ویرایش کنید");
        }
        const base = await getBaseCurrency();
        const bankLines = await cleanBankLines(body.bankAccountLines, base.id);
        const cashLines = await cleanCashLines(body.cashBoxLines, base.id);
        const id = await prisma_1.prisma.$transaction(async (tx) => {
            const o = await tx.treasuryOpening.create({ data: { fiscalPeriodId: period.id, date } });
            for (const [i, l] of bankLines.entries())
                await tx.treasuryOpeningBankAccount.create({ data: { ...l, openingId: o.id, rowOrder: i } });
            for (const [i, l] of cashLines.entries())
                await tx.treasuryOpeningCashBox.create({ data: { ...l, openingId: o.id, rowOrder: i } });
            await syncCheques(tx, period.id, "RECEIVABLE", body.receivableCheques || [], base.id, "چک‌های دریافتی");
            await syncCheques(tx, period.id, "PAYABLE", body.payableCheques || [], base.id, "چک‌های پرداختی");
            return o.id;
        });
        res.status(201).json({ id });
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ذخیره" });
    }
});
router.put("/treasury-openings/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.treasuryOpening.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "افتتاحیه یافت نشد" });
    try {
        (0, concurrency_1.assertRecordNotStale)(existing.updatedAt, body.updatedAt, "این افتتاحیه");
        if (!body.date)
            throw new Error("تاریخ افتتاحیه الزامی است");
        const period = await prisma_1.prisma.fiscalPeriod.findUnique({ where: { id: existing.fiscalPeriodId } });
        const date = new Date(body.date);
        if (!period || date < period.fromDate || date > period.toDate)
            throw new Error("تاریخ افتتاحیه باید در بازه‌ی دوره مالی باشد");
        const base = await getBaseCurrency();
        const bankLines = await cleanBankLines(body.bankAccountLines, base.id);
        const cashLines = await cleanCashLines(body.cashBoxLines, base.id);
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.treasuryOpeningBankAccount.deleteMany({ where: { openingId: id } });
            await tx.treasuryOpeningCashBox.deleteMany({ where: { openingId: id } });
            for (const [i, l] of bankLines.entries())
                await tx.treasuryOpeningBankAccount.create({ data: { ...l, openingId: id, rowOrder: i } });
            for (const [i, l] of cashLines.entries())
                await tx.treasuryOpeningCashBox.create({ data: { ...l, openingId: id, rowOrder: i } });
            await syncCheques(tx, existing.fiscalPeriodId, "RECEIVABLE", body.receivableCheques || [], base.id, "چک‌های دریافتی");
            await syncCheques(tx, existing.fiscalPeriodId, "PAYABLE", body.payableCheques || [], base.id, "چک‌های پرداختی");
            await tx.treasuryOpening.update({ where: { id }, data: { date } });
        });
        res.json({ id });
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ذخیره" });
    }
});
router.delete("/treasury-openings/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma_1.prisma.treasuryOpening.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "افتتاحیه یافت نشد" });
    try {
        await prisma_1.prisma.$transaction(async (tx) => {
            await syncCheques(tx, existing.fiscalPeriodId, "RECEIVABLE", [], (await getBaseCurrency()).id, "چک‌های دریافتی");
            await syncCheques(tx, existing.fiscalPeriodId, "PAYABLE", [], (await getBaseCurrency()).id, "چک‌های پرداختی");
            // حذف افتتاحیه، بستن‌های دوره‌ی قبل را که این افتتاحیه را ساخته بودند باز می‌کند تا دوباره قابل بستن باشند
            const thisPeriod = await tx.fiscalPeriod.findUnique({ where: { id: existing.fiscalPeriodId } });
            const prev = thisPeriod ? await tx.fiscalPeriod.findFirst({ where: { toDate: { lt: thisPeriod.fromDate } }, orderBy: { toDate: "desc" } }) : null;
            if (prev)
                await tx.treasuryYearClose.deleteMany({ where: { fiscalPeriodId: prev.id } });
            await tx.treasuryOpening.delete({ where: { id } });
        });
        res.status(204).send();
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در حذف" });
    }
});
exports.default = router;
