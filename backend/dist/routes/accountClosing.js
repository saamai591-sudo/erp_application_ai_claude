"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const detailValues_1 = require("../utils/detailValues");
const journalEntryService_1 = require("../services/journalEntryService");
const accountCode_1 = require("../utils/accountCode");
const jalaliDate_1 = require("../utils/jalaliDate");
const fiscalPeriodValidation_1 = require("../utils/fiscalPeriodValidation");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("account-closing");
const router = (0, express_1.Router)();
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
// حسابهای سود و زیانیِ دارای مانده تا تاریخ مشخص‌شده، به تفکیک حساب و تفصیل‌ها
router.get("/available-lines", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const toDate = req.query.toDate;
    if (!toDate)
        return res.status(400).json({ error: "تاریخ مشخص نشده است" });
    const date = new Date(toDate);
    const fiscalPeriod = await prisma_1.prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
    if (!fiscalPeriod)
        return res.status(400).json({ error: "این تاریخ در هیچ دوره مالی تعریف نشده است" });
    // طبق تصمیم صریح کاربر: پیش از بارگذاری اطلاعات، هر انباری که تا تاریخ پایان دوره‌ی انتخاب‌شده در
    // سرصفحه راه‌اندازی شده (implementationDate آن قبل از این تاریخ باشد) باید حداقل تا همین تاریخ
    // «تایید انبار» شده باشد (confirmedDate >= تاریخ پایان دوره)؛ وگرنه مانده‌های حسابداریِ بارگذاری‌شده
    // ممکن است بر مبنای موجودی/قیمت‌گذاری هنوز نهایی‌نشده‌ی انبار باشند.
    const unconfirmedWarehouses = await prisma_1.prisma.warehouse.findMany({
        where: {
            implementationDate: { not: null, lt: date },
            OR: [{ confirmedDate: null }, { confirmedDate: { lt: date } }],
        },
        select: { title: true, confirmedDate: true },
    });
    if (unconfirmedWarehouses.length > 0) {
        const list = unconfirmedWarehouses
            .map((w) => `«${w.title}» (${w.confirmedDate ? `تایید تا ${(0, jalaliDate_1.formatJalaliDateForMessage)(w.confirmedDate)}` : "هرگز تایید نشده"})`)
            .join("، ");
        return res.status(400).json({
            error: `انبارهای زیر تا تاریخ پایان دوره‌ی انتخاب‌شده تایید نشده‌اند؛ ابتدا باید تا این تاریخ «تایید انبار» شوند: ${list}`,
        });
    }
    const baseCurrency = await prisma_1.prisma.currency.findFirst({ where: { isBase: true } });
    if (!baseCurrency)
        return res.status(400).json({ error: "ارز پایه تعریف نشده است" });
    const allAccounts = await prisma_1.prisma.account.findMany();
    const byId = new Map(allAccounts.map((a) => [a.id, a]));
    const leafIds = new Set(allAccounts.map((a) => a.id));
    for (const a of allAccounts)
        if (a.parentId)
            leafIds.delete(a.parentId);
    const plAccountIds = [];
    for (const id of leafIds) {
        const group = await rootNatureGroup(id, byId);
        if (group === "PROFIT_LOSS")
            plAccountIds.push(id);
    }
    if (plAccountIds.length === 0)
        return res.json([]);
    const entryWhere = { fiscalPeriodId: fiscalPeriod.id, date: { lte: date } };
    const baseGroups = await prisma_1.prisma.journalEntryLine.groupBy({
        by: ["accountId", "detail1Code", "detail2Code", "detail3Code"],
        where: { accountId: { in: plAccountIds }, journalEntry: entryWhere },
        _sum: { baseDebit: true, baseCredit: true },
    });
    const fxGroups = await prisma_1.prisma.journalEntryLine.groupBy({
        by: ["accountId", "detail1Code", "detail2Code", "detail3Code", "currencyId"],
        where: { accountId: { in: plAccountIds }, currencyId: { not: baseCurrency.id }, journalEntry: entryWhere },
        _sum: { debit: true, credit: true },
    });
    const codes = baseGroups.flatMap((g) => [g.detail1Code, g.detail2Code, g.detail3Code]);
    const titles = await (0, detailValues_1.resolveDetailTitles)(codes);
    const results = baseGroups
        .map((g) => {
        const account = byId.get(g.accountId);
        const debit = Number(g._sum.baseDebit || 0);
        const credit = Number(g._sum.baseCredit || 0);
        if (debit === credit)
            return null; // فقط حسابهای دارای مانده
        const fx = fxGroups.find((f) => f.accountId === g.accountId && f.detail1Code === g.detail1Code && f.detail2Code === g.detail2Code && f.detail3Code === g.detail3Code);
        const fxDebitRaw = fx ? Number(fx._sum.debit || 0) : 0;
        const fxCreditRaw = fx ? Number(fx._sum.credit || 0) : 0;
        // فقط مانده (نتِ گردش بدهکار/بستانکار) نمایش داده شود، نه جمع خام گردش هر دو طرف
        const baseBalance = debit - credit;
        const fxBalance = fxDebitRaw - fxCreditRaw;
        return {
            id: `${g.accountId}-${g.detail1Code || ""}-${g.detail2Code || ""}-${g.detail3Code || ""}`,
            accountId: g.accountId,
            code: account ? (0, accountCode_1.computeFullAccountCode)(g.accountId, byId) : undefined,
            title: account?.title,
            isCurrency: account?.isCurrency || false,
            detail1Code: g.detail1Code,
            detail1Title: g.detail1Code ? titles[g.detail1Code] : null,
            detail2Code: g.detail2Code,
            detail2Title: g.detail2Code ? titles[g.detail2Code] : null,
            detail3Code: g.detail3Code,
            detail3Title: g.detail3Code ? titles[g.detail3Code] : null,
            debit: baseBalance > 0 ? baseBalance : 0,
            credit: baseBalance < 0 ? Math.abs(baseBalance) : 0,
            debitFx: fxBalance > 0 ? fxBalance : 0,
            creditFx: fxBalance < 0 ? Math.abs(fxBalance) : 0,
            currencyId: fx ? fx.currencyId : baseCurrency.id,
        };
    })
        .filter(Boolean);
    res.json(results);
});
router.get("/", (0, guard_1.can)(`${FORM}.view`), async (_req, res) => {
    const items = await prisma_1.prisma.accountClosing.findMany({
        include: { destinationAccount: true, journalEntry: true, lines: true },
        orderBy: { id: "desc" },
    });
    const allAccounts = await prisma_1.prisma.account.findMany({ select: { id: true, code: true, parentId: true } });
    const byId = new Map(allAccounts.map((a) => [a.id, a]));
    res.json(items.map((c) => ({
        id: c.id,
        number: c.number,
        date: c.date,
        description: c.description,
        totalDebit: Number(c.totalDebit),
        totalCredit: Number(c.totalCredit),
        difference: Number(c.difference),
        destinationAccount: { id: c.destinationAccount.id, code: (0, accountCode_1.computeFullAccountCode)(c.destinationAccount.id, byId), title: c.destinationAccount.title },
        issued: !!c.journalEntryId,
        journalEntryId: c.journalEntryId,
        journalEntryReferenceNumber: c.journalEntry?.referenceNumber ?? null,
        lineCount: c.lines.length,
    })));
});
router.get("/:id", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const id = Number(req.params.id);
    const c = await prisma_1.prisma.accountClosing.findUnique({
        where: { id },
        include: {
            destinationAccount: true,
            journalEntry: true,
            lines: { include: { account: true, currency: true } },
        },
    });
    if (!c)
        return res.status(404).json({ error: "سند بستن حسابها یافت نشد" });
    const allAccounts = await prisma_1.prisma.account.findMany({ select: { id: true, code: true, parentId: true } });
    const byId = new Map(allAccounts.map((a) => [a.id, a]));
    const codes = [c.detail1Code, c.detail2Code, c.detail3Code, ...c.lines.flatMap((l) => [l.detail1Code, l.detail2Code, l.detail3Code])].filter((x) => !!x);
    const titles = await (0, detailValues_1.resolveDetailTitles)(codes);
    res.json({
        id: c.id,
        number: c.number,
        date: c.date,
        fiscalPeriodId: c.fiscalPeriodId,
        description: c.description,
        destinationAccountId: c.destinationAccountId,
        destinationAccount: { id: c.destinationAccount.id, code: (0, accountCode_1.computeFullAccountCode)(c.destinationAccount.id, byId), title: c.destinationAccount.title },
        detail1Code: c.detail1Code,
        detail1Title: c.detail1Code ? titles[c.detail1Code] : null,
        detail2Code: c.detail2Code,
        detail2Title: c.detail2Code ? titles[c.detail2Code] : null,
        detail3Code: c.detail3Code,
        detail3Title: c.detail3Code ? titles[c.detail3Code] : null,
        totalDebit: Number(c.totalDebit),
        totalCredit: Number(c.totalCredit),
        difference: Number(c.difference),
        issued: !!c.journalEntryId,
        journalEntryId: c.journalEntryId,
        lines: c.lines.map((l) => ({
            accountId: l.accountId,
            code: (0, accountCode_1.computeFullAccountCode)(l.accountId, byId),
            title: l.account.title,
            detail1Code: l.detail1Code,
            detail1Title: l.detail1Code ? titles[l.detail1Code] : null,
            detail2Code: l.detail2Code,
            detail2Title: l.detail2Code ? titles[l.detail2Code] : null,
            detail3Code: l.detail3Code,
            detail3Title: l.detail3Code ? titles[l.detail3Code] : null,
            currencyId: l.currencyId,
            currencyTitle: l.currency.title,
            debit: Number(l.debit),
            credit: Number(l.credit),
            fxRate: Number(l.fxRate),
            baseDebit: Number(l.baseDebit),
            baseCredit: Number(l.baseCredit),
        })),
    });
});
router.post("/", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const body = req.body;
    if (!body.date || !body.destinationAccountId)
        return res.status(400).json({ error: "تاریخ و حساب مقصد الزامی است" });
    if (!body.description || !body.description.trim())
        return res.status(400).json({ error: "شرح الزامی است" });
    if (!Array.isArray(body.lines) || body.lines.length === 0)
        return res.status(400).json({ error: "حداقل یک حساب باید انتخاب شود" });
    try {
        const destAccount = await prisma_1.prisma.account.findUnique({ where: { id: body.destinationAccountId } });
        if (!destAccount)
            return res.status(400).json({ error: "حساب مقصد یافت نشد" });
        if (destAccount.isCurrency)
            return res.status(400).json({ error: "حساب مقصد نباید ارزی باشد" });
        const date = new Date(body.date);
        const fiscalPeriod = await prisma_1.prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
        if (!fiscalPeriod)
            return res.status(400).json({ error: "این تاریخ در هیچ دوره مالی تعریف نشده است" });
        await (0, fiscalPeriodValidation_1.assertDateWithinCurrentFiscalPeriod)(date);
        const totalDebit = body.lines.reduce((s, l) => s + Number(l.baseDebit || 0), 0);
        const totalCredit = body.lines.reduce((s, l) => s + Number(l.baseCredit || 0), 0);
        const difference = totalCredit - totalDebit;
        const lastNumber = await prisma_1.prisma.accountClosing.findFirst({ where: { fiscalPeriodId: fiscalPeriod.id }, orderBy: { number: "desc" } });
        const number = lastNumber ? lastNumber.number + 1 : 1;
        const created = await prisma_1.prisma.accountClosing.create({
            data: {
                fiscalPeriodId: fiscalPeriod.id,
                number,
                date,
                destinationAccountId: body.destinationAccountId,
                detail1Code: body.detail1Code || null,
                detail2Code: body.detail2Code || null,
                detail3Code: body.detail3Code || null,
                description: body.description,
                totalDebit,
                totalCredit,
                difference,
                lines: {
                    create: body.lines.map((l) => ({
                        accountId: l.accountId,
                        detail1Code: l.detail1Code || null,
                        detail2Code: l.detail2Code || null,
                        detail3Code: l.detail3Code || null,
                        currencyId: l.currencyId,
                        debit: l.debit,
                        credit: l.credit,
                        fxRate: l.fxRate,
                        baseDebit: l.baseDebit,
                        baseCredit: l.baseCredit,
                    })),
                },
            },
        });
        res.status(201).json(created);
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ذخیره" });
    }
});
router.delete("/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const c = await prisma_1.prisma.accountClosing.findUnique({ where: { id } });
    if (!c)
        return res.status(404).json({ error: "یافت نشد" });
    if (c.journalEntryId)
        return res.status(400).json({ error: "سند صادرشده قابل حذف نیست" });
    await prisma_1.prisma.accountClosing.delete({ where: { id } });
    res.status(204).send();
});
// گردش جایگزین: صدور سند حسابداری معکوس‌کننده
router.post("/:id/issue", (0, guard_1.can)(`${FORM}.issue`), async (req, res) => {
    const id = Number(req.params.id);
    const c = await prisma_1.prisma.accountClosing.findUnique({
        where: { id },
        include: { lines: true },
    });
    if (!c)
        return res.status(404).json({ error: "سند بستن حسابها یافت نشد" });
    if (c.journalEntryId)
        return res.status(400).json({ error: "قبلاً برای این سند، حسابداری صادر شده است" });
    try {
        const docType = await prisma_1.prisma.documentType.findFirst({ where: { systemKey: "CLOSING_ACCOUNTS" } });
        if (!docType)
            return res.status(400).json({ error: "نوع سند «بستن حسابها» در سیستم تعریف نشده است" });
        const baseCurrency = await prisma_1.prisma.currency.findFirst({ where: { isBase: true } });
        if (!baseCurrency)
            return res.status(400).json({ error: "ارز پایه تعریف نشده است" });
        // ردیفهای معکوس: بدهکار<->بستانکار و بدهکار ارزی<->بستانکار ارزی، با همان کد حساب/تفصیل/ارز و شرح مرحله ۳
        const reversedLines = c.lines.map((l) => ({
            accountId: l.accountId,
            detail1Code: l.detail1Code,
            detail2Code: l.detail2Code,
            detail3Code: l.detail3Code,
            currencyId: l.currencyId,
            debit: Number(l.credit),
            credit: Number(l.debit),
            fxRate: Number(l.fxRate),
            description: c.description,
        }));
        const difference = Number(c.difference);
        if (Math.abs(difference) > 0.005) {
            reversedLines.push({
                accountId: c.destinationAccountId,
                detail1Code: c.detail1Code,
                detail2Code: c.detail2Code,
                detail3Code: c.detail3Code,
                currencyId: baseCurrency.id,
                debit: difference < 0 ? Math.abs(difference) : 0,
                credit: difference > 0 ? difference : 0,
                fxRate: 1,
                description: c.description,
            });
        }
        const entry = await (0, journalEntryService_1.issueJournalEntry)({
            date: c.date,
            documentTypeId: docType.id,
            description: c.description,
            issuingSystem: "ACCOUNT_CLOSING",
            isManual: false,
            lines: reversedLines,
            sources: [{ label: `بستن حسابها شماره ${c.number}`, path: `/account-closing/${c.id}` }],
        });
        await prisma_1.prisma.accountClosing.update({ where: { id }, data: { journalEntryId: entry.id } });
        res.json({ journalEntryId: entry.id });
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در صدور سند" });
    }
});
// حذف سند حسابداریِ صادرشده برای این عملیات بستن حسابها (امکان صدور مجدد بعد از حذف)
router.delete("/:id/journal-entry", (0, guard_1.can)(`${FORM}.revertIssue`), async (req, res) => {
    const id = Number(req.params.id);
    const c = await prisma_1.prisma.accountClosing.findUnique({ where: { id } });
    if (!c)
        return res.status(404).json({ error: "سند بستن حسابها یافت نشد" });
    if (!c.journalEntryId)
        return res.status(400).json({ error: "برای این عملیات سندی صادر نشده است" });
    try {
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.accountClosing.update({ where: { id }, data: { journalEntryId: null } }),
            prisma_1.prisma.journalEntry.delete({ where: { id: c.journalEntryId } }),
        ]);
        res.status(204).send();
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در حذف سند" });
    }
});
exports.default = router;
