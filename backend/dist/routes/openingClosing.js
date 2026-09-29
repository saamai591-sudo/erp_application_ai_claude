"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const journalEntryService_1 = require("../services/journalEntryService");
const requestContext_1 = require("../lib/requestContext");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("opening-closing");
const router = (0, express_1.Router)();
// همان قرارداد resolveFiscalPeriod در routes/reportingPeriods.ts — نگاه کنید به توضیح مشابه در
// services/warehouseConfirmationService.ts برای علت این تغییر (قبلاً انتخاب صریح کاربر را نادیده می‌گرفت).
async function currentFiscalPeriod() {
    const ctx = (0, requestContext_1.getRequestContext)();
    if (ctx?.fiscalPeriodId) {
        const period = await prisma_1.prisma.fiscalPeriod.findUnique({ where: { id: ctx.fiscalPeriodId } });
        if (period)
            return period;
    }
    return prisma_1.prisma.fiscalPeriod.findFirst({ orderBy: { toDate: "desc" } });
}
async function rootNatureGroup(accountId, byId) {
    let cur = byId.get(accountId);
    while (cur) {
        if (!cur.parentId)
            return cur.natureGroup || null;
        const parent = byId.get(cur.parentId);
        if (!parent)
            return cur.natureGroup || null;
        cur = parent;
    }
    return null;
}
router.get("/", (0, guard_1.can)(`${FORM}.view`), async (_req, res) => {
    const items = await prisma_1.prisma.openingClosingEntry.findMany({
        include: { fiscalPeriod: true, journalEntry: true },
        orderBy: { id: "desc" },
    });
    res.json(items.map((e) => ({
        id: e.id,
        number: e.number,
        date: e.date,
        type: e.type,
        description: e.description,
        fiscalPeriodTitle: e.fiscalPeriod.title,
        issued: !!e.journalEntryId,
        journalEntryId: e.journalEntryId,
        journalEntryNumber: e.journalEntry?.number ?? null,
        journalEntryReferenceNumber: e.journalEntry?.referenceNumber ?? null,
        journalEntryDate: e.journalEntry?.date ?? null,
        journalEntryStatus: e.journalEntry?.status ?? null,
    })));
});
router.get("/:id", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const id = Number(req.params.id);
    const e = await prisma_1.prisma.openingClosingEntry.findUnique({
        where: { id },
        include: { fiscalPeriod: true, journalEntry: true },
    });
    if (!e)
        return res.status(404).json({ error: "رکورد یافت نشد" });
    res.json({
        id: e.id,
        number: e.number,
        date: e.date,
        type: e.type,
        description: e.description,
        fiscalPeriodId: e.fiscalPeriodId,
        fiscalPeriodTitle: e.fiscalPeriod.title,
        issued: !!e.journalEntryId,
        journalEntryId: e.journalEntryId,
        journalEntryNumber: e.journalEntry?.number ?? null,
        journalEntryReferenceNumber: e.journalEntry?.referenceNumber ?? null,
        journalEntryDate: e.journalEntry?.date ?? null,
        journalEntryStatus: e.journalEntry?.status ?? null,
    });
});
router.post("/", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const body = req.body;
    if (!body.date || !body.type)
        return res.status(400).json({ error: "تاریخ و نوع الزامی است" });
    if (!body.description || !body.description.trim())
        return res.status(400).json({ error: "شرح الزامی است" });
    try {
        const period = await currentFiscalPeriod();
        if (!period)
            return res.status(400).json({ error: "دوره مالی تعریف نشده است" });
        const date = new Date(body.date);
        if (date < period.fromDate || date > period.toDate) {
            return res.status(400).json({ error: "تاریخ وارد شده باید در بازه دوره مالی جاری باشد" });
        }
        const dup = await prisma_1.prisma.openingClosingEntry.findFirst({ where: { fiscalPeriodId: period.id, type: body.type } });
        if (dup)
            return res.status(400).json({ error: "قبلا نوع دیگری با همین نوع در دوره مالی جاری، تعریف شده است" });
        const lastNumber = await prisma_1.prisma.openingClosingEntry.findFirst({ where: { fiscalPeriodId: period.id }, orderBy: { number: "desc" } });
        const number = lastNumber ? lastNumber.number + 1 : 1;
        const created = await prisma_1.prisma.openingClosingEntry.create({
            data: { fiscalPeriodId: period.id, number, date, type: body.type, description: body.description },
        });
        res.status(201).json(created);
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ذخیره" });
    }
});
/** اگر برای دوره‌ی مالی بعد «افتتاحیه» (حتی صادرنشده) وجود داشته باشد، اختتامیه‌ی دوره‌ی جاری (خودِ رکورد یا سند حسابداری‌اش) قابل حذف نیست. */
async function nextOpeningBlocksClosingDelete(e) {
    if (e.type !== "CLOSING")
        return null;
    const period = e.fiscalPeriod ?? (await prisma_1.prisma.fiscalPeriod.findUnique({ where: { id: e.fiscalPeriodId } }));
    if (!period)
        return null;
    const nextPeriod = await prisma_1.prisma.fiscalPeriod.findFirst({ where: { fromDate: { gt: period.toDate } }, orderBy: { fromDate: "asc" } });
    if (!nextPeriod)
        return null;
    const nextOpening = await prisma_1.prisma.openingClosingEntry.findFirst({ where: { fiscalPeriodId: nextPeriod.id, type: "OPENING" } });
    return nextOpening ? `برای دوره مالی بعد (${nextPeriod.title}) سند افتتاحیه وجود دارد؛ ابتدا افتتاحیه‌ی دوره مالی بعد را حذف کنید، سپس اختتامیه‌ی این دوره قابل حذف است` : null;
}
router.delete("/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const e = await prisma_1.prisma.openingClosingEntry.findUnique({ where: { id }, include: { fiscalPeriod: true } });
    if (!e)
        return res.status(404).json({ error: "رکورد یافت نشد" });
    if (e.journalEntryId) {
        return res.status(400).json({ error: "این رکورد سند صادرشده دارد؛ ابتدا سند صادرشده را حذف کنید" });
    }
    const blocked = await nextOpeningBlocksClosingDelete(e);
    if (blocked)
        return res.status(400).json({ error: blocked });
    await prisma_1.prisma.openingClosingEntry.delete({ where: { id } });
    res.status(204).send();
});
// حذف سند حسابداریِ صادرشده برای این رکورد افتتاحیه/اختتامیه (امکان صدور مجدد بعد از حذف)
router.delete("/:id/journal-entry", (0, guard_1.can)(`${FORM}.revertIssue`), async (req, res) => {
    const id = Number(req.params.id);
    const e = await prisma_1.prisma.openingClosingEntry.findUnique({ where: { id } });
    if (!e)
        return res.status(404).json({ error: "رکورد یافت نشد" });
    if (!e.journalEntryId)
        return res.status(400).json({ error: "برای این رکورد سندی صادر نشده است" });
    const blocked = await nextOpeningBlocksClosingDelete(e);
    if (blocked)
        return res.status(400).json({ error: blocked });
    try {
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.openingClosingEntry.update({ where: { id }, data: { journalEntryId: null } }),
            prisma_1.prisma.journalEntry.delete({ where: { id: e.journalEntryId } }),
        ]);
        res.status(204).send();
    }
    catch (err) {
        res.status(400).json({ error: err.message || "خطا در حذف سند" });
    }
});
router.post("/:id/issue", (0, guard_1.can)(`${FORM}.issue`), async (req, res) => {
    const id = Number(req.params.id);
    const e = await prisma_1.prisma.openingClosingEntry.findUnique({ where: { id }, include: { fiscalPeriod: true } });
    if (!e)
        return res.status(404).json({ error: "رکورد یافت نشد" });
    if (e.journalEntryId)
        return res.status(400).json({ error: "قبلاً برای این رکورد سند صادر شده است" });
    try {
        if (e.type === "CLOSING") {
            const result = await issueClosing(e);
            return res.json(result);
        }
        else {
            const result = await issueOpening(e);
            return res.json(result);
        }
    }
    catch (err) {
        res.status(400).json({ error: err.message || "خطا در صدور سند" });
    }
});
async function issueClosing(e) {
    const docType = await prisma_1.prisma.documentType.findFirst({ where: { systemKey: "CLOSING" } });
    if (!docType)
        throw new Error("نوع سند «اختتامیه» در سیستم تعریف نشده است");
    const baseCurrency = await prisma_1.prisma.currency.findFirst({ where: { isBase: true } });
    if (!baseCurrency)
        throw new Error("ارز پایه تعریف نشده است");
    // کنترل: تمامی اسناد دوره مالی جاری باید در وضعیت «تایید» باشند
    const notApprovedCount = await prisma_1.prisma.journalEntry.count({
        where: { fiscalPeriodId: e.fiscalPeriodId, status: { not: "APPROVED" } },
    });
    if (notApprovedCount > 0) {
        throw new Error("برای صدور سند اختتامیه، تمامی اسناد دوره مالی جاری باید در وضعیت «تایید» باشند");
    }
    const allAccounts = await prisma_1.prisma.account.findMany();
    const byId = new Map(allAccounts.map((a) => [a.id, a]));
    const leafIds = new Set(allAccounts.map((a) => a.id));
    for (const a of allAccounts)
        if (a.parentId)
            leafIds.delete(a.parentId);
    const nonPlAccountIds = [];
    for (const accId of leafIds) {
        const group = await rootNatureGroup(accId, byId);
        if (group !== "PROFIT_LOSS")
            nonPlAccountIds.push(accId);
    }
    if (nonPlAccountIds.length === 0)
        throw new Error("هیچ حساب دائمی (غیر سود و زیانی) دارای مانده‌ای یافت نشد");
    const entryWhere = { fiscalPeriodId: e.fiscalPeriodId };
    const baseGroups = await prisma_1.prisma.journalEntryLine.groupBy({
        by: ["accountId", "detail1Code", "detail2Code", "detail3Code"],
        where: { accountId: { in: nonPlAccountIds }, journalEntry: entryWhere },
        _sum: { baseDebit: true, baseCredit: true },
    });
    const fxGroups = await prisma_1.prisma.journalEntryLine.groupBy({
        by: ["accountId", "detail1Code", "detail2Code", "detail3Code", "currencyId"],
        where: { accountId: { in: nonPlAccountIds }, currencyId: { not: baseCurrency.id }, journalEntry: entryWhere },
        _sum: { debit: true, credit: true },
    });
    const reversedLines = [];
    for (const g of baseGroups) {
        const baseDebit = Number(g._sum.baseDebit || 0);
        const baseCredit = Number(g._sum.baseCredit || 0);
        if (baseDebit === baseCredit)
            continue; // فقط حسابهای دارای مانده
        const fx = fxGroups.find((f) => f.accountId === g.accountId && f.detail1Code === g.detail1Code && f.detail2Code === g.detail2Code && f.detail3Code === g.detail3Code);
        const fxDebitRaw = fx ? Number(fx._sum.debit || 0) : 0;
        const fxCreditRaw = fx ? Number(fx._sum.credit || 0) : 0;
        // فقط مانده (نتِ گردش بدهکار/بستانکار) در نظر گرفته شود، نه جمع خام گردش هر دو طرف
        const baseBalance = baseDebit - baseCredit;
        const fxBalance = fxDebitRaw - fxCreditRaw;
        // کنترل: مانده ارزی و مانده به ارز پایه نباید ماهیت متفاوت داشته باشند
        const baseSign = Math.sign(baseBalance);
        const fxSign = Math.sign(fxBalance);
        if (fxBalance !== 0 && baseSign !== 0 && fxSign !== 0 && baseSign !== fxSign) {
            throw new Error("مانده ارزی و مانده به ارز پایه صحیح نمی‌باشد");
        }
        const account = byId.get(g.accountId);
        const currencyId = fx ? fx.currencyId : baseCurrency.id;
        const netBase = Math.abs(baseBalance);
        const netNative = account?.isCurrency ? Math.abs(fxBalance) : netBase;
        const fxRate = account?.isCurrency && netNative > 0 ? netBase / netNative : 1;
        const isDebitBalance = baseBalance > 0;
        // معکوس‌سازی: مانده بدهکار -> ردیف بستانکار، مانده بستانکار -> ردیف بدهکار
        reversedLines.push({
            accountId: g.accountId,
            detail1Code: g.detail1Code,
            detail2Code: g.detail2Code,
            detail3Code: g.detail3Code,
            currencyId,
            debit: isDebitBalance ? 0 : netNative,
            credit: isDebitBalance ? netNative : 0,
            fxRate,
            description: e.description,
        });
    }
    if (reversedLines.length === 0)
        throw new Error("هیچ حساب دائمی دارای مانده‌ای برای بستن یافت نشد");
    const entry = await (0, journalEntryService_1.issueJournalEntry)({
        date: e.fiscalPeriod.toDate,
        documentTypeId: docType.id,
        description: e.description,
        issuingSystem: "OPENING_CLOSING",
        isManual: false,
        status: "APPROVED",
        lines: reversedLines,
        sources: [{ label: `اختتامیه دوره مالی ${e.fiscalPeriod.title}`, path: `/opening-closing/${e.id}` }],
    });
    await prisma_1.prisma.openingClosingEntry.update({ where: { id: e.id }, data: { journalEntryId: entry.id } });
    return { journalEntryId: entry.id, message: entry.message };
}
async function issueOpening(e) {
    const docType = await prisma_1.prisma.documentType.findFirst({ where: { systemKey: "OPENING" } });
    if (!docType)
        throw new Error("نوع سند «افتتاحیه» در سیستم تعریف نشده است");
    const prevPeriod = await prisma_1.prisma.fiscalPeriod.findFirst({
        where: { toDate: { lt: e.fiscalPeriod.fromDate } },
        orderBy: { toDate: "desc" },
    });
    if (!prevPeriod)
        throw new Error("سند اختتامیه برای دوره مالی قبل صادر نشده است و امکان صدور سند نیست");
    const prevClosing = await prisma_1.prisma.openingClosingEntry.findFirst({
        where: { fiscalPeriodId: prevPeriod.id, type: "CLOSING" },
        include: { journalEntry: { include: { lines: true } } },
    });
    if (!prevClosing || !prevClosing.journalEntry) {
        throw new Error("سند اختتامیه برای دوره مالی قبل صادر نشده است و امکان صدور سند نیست");
    }
    const sourceLines = prevClosing.journalEntry.lines;
    const reversedLines = sourceLines.map((l) => ({
        accountId: l.accountId,
        detail1Code: l.detail1Code,
        detail2Code: l.detail2Code,
        detail3Code: l.detail3Code,
        currencyId: l.currencyId,
        debit: Number(l.credit),
        credit: Number(l.debit),
        fxRate: Number(l.fxRate),
        description: e.description,
    }));
    const entry = await (0, journalEntryService_1.issueJournalEntry)({
        date: e.date,
        documentTypeId: docType.id,
        description: e.description,
        issuingSystem: "OPENING_CLOSING",
        isManual: false,
        status: "REVIEW",
        lines: reversedLines,
        sources: [{ label: `افتتاحیه دوره مالی ${e.fiscalPeriod.title}`, path: `/opening-closing/${e.id}` }],
    });
    await prisma_1.prisma.openingClosingEntry.update({ where: { id: e.id }, data: { journalEntryId: entry.id } });
    return { journalEntryId: entry.id, message: entry.message };
}
exports.default = router;
