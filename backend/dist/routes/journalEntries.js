"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const journalEntryRenumberService_1 = require("../services/journalEntryRenumberService");
const detailValues_1 = require("../utils/detailValues");
const journalEntryValidation_1 = require("../utils/journalEntryValidation");
const journalEntryService_1 = require("../services/journalEntryService");
const concurrency_1 = require("../utils/concurrency");
const fiscalPeriodValidation_1 = require("../utils/fiscalPeriodValidation");
const guard_1 = require("../authz/guard");
const tableFilters_1 = require("../utils/tableFilters");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("journal-entries");
const router = (0, express_1.Router)();
async function computeLineData(line, baseCurrencyId) {
    const currency = await prisma_1.prisma.currency.findUnique({ where: { id: line.currencyId } });
    if (!currency)
        throw new Error("ارز ردیف سند نامعتبر است");
    const debit = Number(line.debit) || 0;
    const credit = Number(line.credit) || 0;
    (0, journalEntryValidation_1.assertLineHasAmount)(debit, credit);
    const isBaseLine = line.currencyId === baseCurrencyId;
    const fxRate = isBaseLine ? 1 : Number(line.fxRate) || 0;
    if (!isBaseLine && fxRate <= 0)
        throw new Error("نرخ تبدیل ارز برای ردیف‌های ارزی الزامی است");
    const baseDebit = (debit * fxRate) / currency.baseVolume;
    const baseCredit = (credit * fxRate) / currency.baseVolume;
    return { debit, credit, fxRate, baseDebit, baseCredit };
}
/** ردیف بدون شرح، هنگام ذخیره شرح سند (هدر) را می‌گیرد؛ اگر شرح سند هم خالی باشد دست‌نخورده می‌ماند تا کنترل «شرح ردیف الزامی است» عمل کند */
function applyHeaderDescriptionToLines(body) {
    const header = body.description?.trim();
    if (!header)
        return;
    for (const line of body.lines) {
        if (!line.description || !line.description.trim())
            line.description = body.description;
    }
}
async function validateAccountForLine(accountId, description, currencyId, baseCurrencyId, detail1Code, detail2Code, detail3Code) {
    const account = await prisma_1.prisma.account.findUnique({ where: { id: accountId }, include: { level: true } });
    if (!account)
        throw new Error("حساب انتخاب‌شده یافت نشد");
    if (!description || !description.trim())
        throw new Error(`شرح ردیف برای حساب «${account.title}» الزامی است`);
    if (account.level.order < 3) {
        throw new Error(`حساب «${account.title}» در سطح گروه/کل است و قابل ثبت سند مستقیم نیست`);
    }
    const hasChildren = await prisma_1.prisma.account.findFirst({ where: { parentId: accountId } });
    if (hasChildren)
        throw new Error(`حساب «${account.title}» دارای زیرحساب است و قابل ثبت سند مستقیم نیست`);
    if (!account.isCurrency && currencyId !== baseCurrencyId) {
        throw new Error(`حساب «${account.title}» ارزی نیست و فقط ارز پایه برای آن مجاز است`);
    }
    if (account.detailType1Id && !detail1Code)
        throw new Error(`تفصیل سطح ۱ برای حساب «${account.title}» الزامی است`);
    if (account.detailType2Id && !detail2Code)
        throw new Error(`تفصیل سطح ۲ برای حساب «${account.title}» الزامی است`);
    if (account.detailType3Id && !detail3Code)
        throw new Error(`تفصیل سطح ۳ برای حساب «${account.title}» الزامی است`);
    return account;
}
// معادل فارسی وضعیت سند — برای ترجمه‌ی عبارت جستجوی فیلتر «وضعیت» (که روی برچسب فارسی اعمال می‌شود) به مقدار enum
const STATUS_FA = { DRAFT: "ثبت", REVIEW: "بررسی", APPROVED: "تایید" };
function parseFilters(raw) {
    if (!raw || typeof raw !== "string")
        return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    }
    catch {
        return {};
    }
}
function stringWhere(f) {
    if (f.operator === "empty")
        return { OR: [{ equals: null }, { equals: "" }] };
    if (f.operator === "notEmpty")
        return { AND: [{ not: null }, { not: "" }] };
    const needle = (f.value ?? "").trim();
    if (!needle)
        return undefined;
    if (f.operator === "contains")
        return { contains: needle, mode: "insensitive" };
    if (f.operator === "notContains")
        return { not: { contains: needle, mode: "insensitive" } };
    return undefined;
}
function numberWhere(f) {
    if (f.value === undefined || f.value === "" || Number.isNaN(Number(f.value)))
        return undefined;
    const n = Number(f.value);
    if (f.operator === "eq")
        return { equals: n };
    if (f.operator === "gt")
        return { gt: n };
    if (f.operator === "lt")
        return { lt: n };
    return undefined;
}
/** بازه‌ی روز/ماه/سال از یک رشته‌ی جزئی YYYY یا YYYY-MM یا YYYY-MM-DD؛ برای عملگر «شامل باشد» روی تاریخ */
function dateContainsRange(value) {
    const v = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        const start = new Date(`${v}T00:00:00.000Z`);
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 1);
        return { gte: start, lt: end };
    }
    if (/^\d{4}-\d{2}$/.test(v)) {
        const start = new Date(`${v}-01T00:00:00.000Z`);
        const end = new Date(start);
        end.setUTCMonth(end.getUTCMonth() + 1);
        return { gte: start, lt: end };
    }
    if (/^\d{4}$/.test(v)) {
        const start = new Date(`${v}-01-01T00:00:00.000Z`);
        const end = new Date(start);
        end.setUTCFullYear(end.getUTCFullYear() + 1);
        return { gte: start, lt: end };
    }
    return null;
}
function dateWhere(f) {
    if (f.operator === "empty" || f.operator === "notEmpty")
        return undefined; // تاریخ سند همیشه الزامی است
    if (f.operator === "gt" && f.value)
        return { gt: new Date(`${f.value}T00:00:00.000Z`) };
    if (f.operator === "lt" && f.value)
        return { lt: new Date(`${f.value}T00:00:00.000Z`) };
    if (f.operator === "between" && f.value && f.value2) {
        return { gte: new Date(`${f.value}T00:00:00.000Z`), lte: new Date(`${f.value2}T23:59:59.999Z`) };
    }
    if ((f.operator === "contains" || f.operator === "notContains") && f.value) {
        const range = dateContainsRange(f.value);
        if (!range)
            return undefined;
        return f.operator === "contains" ? { gte: range.gte, lt: range.lt } : { OR: [{ lt: range.gte }, { gte: range.lt }] };
    }
    return undefined;
}
router.get("/", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const { fiscalPeriodId, page: pageRaw, pageSize: pageSizeRaw, sortField, sortDir, sorts: sortsRaw, filters: filtersRaw } = req.query;
    const filters = parseFilters(filtersRaw);
    const page = Math.max(1, parseInt(pageRaw, 10) || 1);
    // برای سازگاری با کدهای قدیمی که هنوز page ارسال نمی‌کنند (و کل لیست را می‌خواهند)، وقتی page ارسال نشود
    // pageSize نامحدود در نظر گرفته می‌شود؛ فرانت‌اند فعلی همیشه page/pageSize می‌فرستد.
    const serverPaging = pageRaw !== undefined;
    const pageSize = Math.min(200, Math.max(1, parseInt(pageSizeRaw, 10) || 25));
    const andConditions = [];
    if (fiscalPeriodId)
        andConditions.push({ fiscalPeriodId: Number(fiscalPeriodId) });
    if (filters.number) {
        const w = numberWhere(filters.number);
        if (w)
            andConditions.push({ number: w });
    }
    if (filters.referenceNumber) {
        const w = numberWhere(filters.referenceNumber);
        if (w)
            andConditions.push({ referenceNumber: w });
    }
    if (filters.date) {
        const w = dateWhere(filters.date);
        if (w)
            andConditions.push({ date: w });
    }
    if (filters.documentTypeTitle) {
        const w = stringWhere(filters.documentTypeTitle);
        if (w)
            andConditions.push({ documentType: { title: w } });
    }
    if (filters.description) {
        const w = stringWhere(filters.description);
        if (w)
            andConditions.push({ description: w });
    }
    if (filters.status) {
        const f = filters.status;
        if (f.operator === "empty") {
            andConditions.push({ id: -1 }); // وضعیت سند همیشه مقدار دارد؛ یعنی هیچ سندی با این فیلتر مطابقت ندارد
        }
        else if (f.operator === "contains" || f.operator === "notContains") {
            const needle = (f.value ?? "").trim();
            if (needle) {
                const matched = Object.entries(STATUS_FA)
                    .filter(([, label]) => label.includes(needle))
                    .map(([key]) => key);
                if (f.operator === "contains") {
                    andConditions.push(matched.length ? { status: { in: matched } } : { id: -1 });
                }
                else if (matched.length) {
                    andConditions.push({ status: { notIn: matched } });
                }
            }
        }
    }
    const where = andConditions.length ? { AND: andConditions } : undefined;
    // مرتب‌سازی چندستونه (پارامتر sorts، به ترتیب اولویت) یا تک‌ستونه‌ی قبلی (sortField/sortDir)
    const orderFor = (field, dir) => ({
        number: { number: dir },
        date: { date: dir },
        referenceNumber: { referenceNumber: dir },
        documentTypeTitle: { documentType: { title: dir } },
        description: { description: dir },
        status: { status: dir },
    }[field]);
    const sortOrder = (0, tableFilters_1.parseSorts)(sortsRaw, sortField, sortDir).map((k) => orderFor(k.field, k.dir)).filter(Boolean);
    const orderBy = sortOrder.length ? sortOrder : [{ date: "desc" }, { number: "desc" }];
    const [total, entries] = await Promise.all([
        prisma_1.prisma.journalEntry.count({ where }),
        prisma_1.prisma.journalEntry.findMany({
            where,
            include: { documentType: true, fiscalPeriod: true, lines: true },
            orderBy,
            ...(serverPaging ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
        }),
    ]);
    const rows = entries.map((e) => ({
        ...e,
        totalDebit: e.lines.reduce((s, l) => s + Number(l.baseDebit), 0),
        totalCredit: e.lines.reduce((s, l) => s + Number(l.baseCredit), 0),
    }));
    if (!serverPaging) {
        // سازگاری با نسخه‌ی قبلی: بدون پارامتر page، آرایه‌ی خام (بدون صفحه‌بندی) برگردانده می‌شود
        res.json(rows);
        return;
    }
    res.json({ rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
});
router.get("/:id", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const id = Number(req.params.id);
    const entry = await prisma_1.prisma.journalEntry.findUnique({
        where: { id },
        include: {
            documentType: true,
            fiscalPeriod: true,
            lines: { include: { account: true, currency: true }, orderBy: { rowOrder: "asc" } },
            sources: true,
        },
    });
    if (!entry)
        return res.status(404).json({ error: "سند یافت نشد" });
    const codes = entry.lines.flatMap((l) => [l.detail1Code, l.detail2Code, l.detail3Code]);
    const titles = await (0, detailValues_1.resolveDetailTitles)(codes);
    res.json({
        ...entry,
        lines: entry.lines.map((l) => ({
            ...l,
            detail1Title: l.detail1Code ? titles[l.detail1Code] : null,
            detail2Title: l.detail2Code ? titles[l.detail2Code] : null,
            detail3Title: l.detail3Code ? titles[l.detail3Code] : null,
        })),
    });
});
router.post("/", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const body = req.body;
    if (!body.date || !body.documentTypeId)
        return res.status(400).json({ error: "تاریخ و نوع سند الزامی است" });
    if (!Array.isArray(body.lines) || body.lines.length === 0)
        return res.status(400).json({ error: "سند باید حداقل یک ردیف داشته باشد" });
    try {
        const docType = await prisma_1.prisma.documentType.findUnique({ where: { id: body.documentTypeId } });
        if (!docType)
            return res.status(400).json({ error: "نوع سند نامعتبر است" });
        if (docType.isSystem && docType.systemKey !== "OPERATIONAL") {
            return res.status(400).json({ error: "این نوع سند فقط توسط عملیات مربوطه (افتتاحیه/اختتامیه/بستن حسابها) صادر می‌شود" });
        }
        const baseCurrency = await prisma_1.prisma.currency.findFirst({ where: { isBase: true } });
        if (!baseCurrency)
            return res.status(400).json({ error: "ارز پایه تعریف نشده است" });
        applyHeaderDescriptionToLines(body);
        // اعتبارسنجی‌های خاصِ حساب (سطح حساب، تفصیل اجباری و ...) که مخصوص ورودی مستقیم کاربر است
        for (const line of body.lines) {
            await validateAccountForLine(line.accountId, line.description, line.currencyId, baseCurrency.id, line.detail1Code, line.detail2Code, line.detail3Code);
        }
        const entryDate = new Date(body.date);
        const entryPeriod = await prisma_1.prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: entryDate }, toDate: { gte: entryDate } } });
        if (entryPeriod)
            await (0, fiscalPeriodValidation_1.assertWithinCurrentFiscalPeriod)(entryPeriod.id);
        const created = await (0, journalEntryService_1.issueJournalEntry)({
            date: new Date(body.date),
            documentTypeId: body.documentTypeId,
            description: body.description,
            issuingSystem: "ACCOUNTING",
            isManual: true,
            lines: body.lines,
        });
        res.status(201).json(created);
    }
    catch (err) {
        res.status(400).json({ error: err.message || "خطا در ثبت سند" });
    }
});
router.put("/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.journalEntry.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "سند یافت نشد" });
    if (!existing.isManual)
        return res.status(400).json({ error: "این سند به‌صورت خودکار از یک فرم دیگر صادر شده و از طریق فرم سند حسابداری قابل ویرایش نیست" });
    if (existing.status !== "DRAFT")
        return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل ویرایش هستند" });
    if (!Array.isArray(body.lines) || body.lines.length === 0)
        return res.status(400).json({ error: "سند باید حداقل یک ردیف داشته باشد" });
    try {
        (0, concurrency_1.assertRecordNotStale)(existing.updatedAt, req.body.updatedAt, "این سند");
        const docType = await prisma_1.prisma.documentType.findUnique({ where: { id: body.documentTypeId } });
        if (!docType)
            return res.status(400).json({ error: "نوع سند نامعتبر است" });
        if (docType.isSystem && docType.systemKey !== "OPERATIONAL") {
            return res.status(400).json({ error: "این نوع سند فقط توسط عملیات مربوطه (افتتاحیه/اختتامیه/بستن حسابها) صادر می‌شود" });
        }
        const baseCurrency = await prisma_1.prisma.currency.findFirst({ where: { isBase: true } });
        if (!baseCurrency)
            return res.status(400).json({ error: "ارز پایه تعریف نشده است" });
        const date = new Date(body.date);
        const fiscalPeriod = await prisma_1.prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
        if (!fiscalPeriod)
            return res.status(400).json({ error: "این تاریخ در هیچ دوره مالی تعریف نشده است" });
        await (0, fiscalPeriodValidation_1.assertWithinCurrentFiscalPeriod)(fiscalPeriod.id);
        applyHeaderDescriptionToLines(body);
        const computedLines = [];
        let totalDebit = 0;
        let totalCredit = 0;
        for (const line of body.lines) {
            await validateAccountForLine(line.accountId, line.description, line.currencyId, baseCurrency.id, line.detail1Code, line.detail2Code, line.detail3Code);
            const computed = await computeLineData(line, baseCurrency.id);
            totalDebit += computed.baseDebit;
            totalCredit += computed.baseCredit;
            computedLines.push({ ...line, ...computed });
        }
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            return res.status(400).json({ error: "سند بالانس نیست" });
        }
        let number = existing.number;
        if (fiscalPeriod.id !== existing.fiscalPeriodId) {
            const lastNumber = await prisma_1.prisma.journalEntry.findFirst({ where: { fiscalPeriodId: fiscalPeriod.id }, orderBy: { number: "desc" } });
            number = lastNumber ? lastNumber.number + 1 : 1;
        }
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.journalEntryLine.deleteMany({ where: { journalEntryId: id } }),
            prisma_1.prisma.journalEntry.update({
                where: { id },
                data: {
                    fiscalPeriodId: fiscalPeriod.id,
                    number,
                    date,
                    documentTypeId: body.documentTypeId,
                    description: body.description,
                    lines: {
                        create: computedLines.map((l, idx) => ({
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
                            description: l.description,
                            rowOrder: idx,
                        })),
                    },
                },
            }),
        ]);
        res.json({ ok: true });
    }
    catch (err) {
        res.status(400).json({ error: err.message || "خطا در ویرایش سند" });
    }
});
router.delete("/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const entry = await prisma_1.prisma.journalEntry.findUnique({ where: { id } });
    if (!entry)
        return res.status(404).json({ error: "سند یافت نشد" });
    if (!entry.isManual)
        return res.status(400).json({ error: "این سند به‌صورت خودکار از یک فرم دیگر صادر شده و از طریق فرم سند حسابداری قابل حذف نیست" });
    if (entry.status !== "DRAFT")
        return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل حذف هستند" });
    await prisma_1.prisma.journalEntry.delete({ where: { id } });
    res.status(204).send();
});
// عملیات «شماره‌گذاری مجدد» فهرست: اسناد ثبت/بررسی دوره‌ی مالی جاری کاربر بر اساس تاریخ سند و شماره‌ی روزانه؛
// منطق فقط در سرویس مشترک است (همان که تایید اسناد هم صدا می‌زند)
router.post("/renumber", (0, guard_1.can)(`${FORM}.renumber`), async (_req, res) => {
    try {
        const fiscalPeriod = await (0, prisma_1.getCurrentFiscalPeriod)();
        if (!fiscalPeriod)
            return res.status(400).json({ error: "دوره مالی جاری مشخص نیست" });
        await (0, fiscalPeriodValidation_1.assertWithinCurrentFiscalPeriod)(fiscalPeriod.id);
        const result = await (0, journalEntryRenumberService_1.renumberJournalEntries)(fiscalPeriod.id);
        res.json(result);
    }
    catch (err) {
        res.status(400).json({ error: err.message || "خطا در شماره‌گذاری مجدد اسناد" });
    }
});
router.put("/:id/review", (0, guard_1.can)(`${FORM}.review`), async (req, res) => {
    const id = Number(req.params.id);
    const entry = await prisma_1.prisma.journalEntry.findUnique({ where: { id } });
    if (!entry)
        return res.status(404).json({ error: "سند یافت نشد" });
    if (entry.status !== "DRAFT")
        return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل ارسال به بررسی هستند" });
    const updated = await prisma_1.prisma.journalEntry.update({ where: { id }, data: { status: "REVIEW" } });
    res.json(updated);
});
router.put("/:id/unreview", (0, guard_1.can)(`${FORM}.unreview`), async (req, res) => {
    const id = Number(req.params.id);
    const entry = await prisma_1.prisma.journalEntry.findUnique({ where: { id } });
    if (!entry)
        return res.status(404).json({ error: "سند یافت نشد" });
    if (entry.status !== "REVIEW")
        return res.status(400).json({ error: "فقط اسناد در وضعیت «بررسی» قابل بازگشت هستند" });
    const updated = await prisma_1.prisma.journalEntry.update({ where: { id }, data: { status: "DRAFT" } });
    res.json(updated);
});
exports.default = router;
