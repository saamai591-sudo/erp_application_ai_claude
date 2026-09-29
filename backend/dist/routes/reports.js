"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const detailValues_1 = require("../utils/detailValues");
const accountCode_1 = require("../utils/accountCode");
const tableFilters_1 = require("../utils/tableFilters");
const jalaliDate_1 = require("../utils/jalaliDate");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const ACCOUNT_REVIEW = (0, registry_1.findFormPrefix)("account-review");
const OLAP_REPORTS = (0, registry_1.findFormPrefix)("olap-reports");
const router = (0, express_1.Router)();
// معادل فارسی وضعیت سند و سیستم صادرکننده — برای ترجمه‌ی عبارت جستجوی فیلتر ستونی «وضعیت»/«سیستم»
// تب گردش (که روی برچسب فارسی نمایش‌داده‌شده اعمال می‌شود) به مقدار enum؛ دقیقاً همان برچسب‌هایی که
// AccountsReview.tsx برای رندر این دو ستون استفاده می‌کند.
const LEDGER_STATUS_FA = { DRAFT: "ثبت", REVIEW: "بررسی", APPROVED: "تایید" };
const LEDGER_ISSUING_SYSTEM_FA = {
    ACCOUNTING: "حسابداری",
    ACCOUNTING_EXCEL_IMPORT: "حسابداری (ورود از اکسل)",
    ACCOUNT_CLOSING: "بستن حسابها",
    OPENING_CLOSING: "افتتاحیه و اختتامیه",
    TREASURY: "خزانه‌داری",
};
function buildEntryWhere(f) {
    const where = {};
    if (f.fromDate || f.toDate) {
        where.date = {};
        if (f.fromDate)
            where.date.gte = new Date(f.fromDate);
        if (f.toDate)
            where.date.lte = new Date(f.toDate);
    }
    if (f.documentTypeIds) {
        const ids = f.documentTypeIds.split(",").map(Number).filter((n) => !Number.isNaN(n));
        if (ids.length)
            where.documentTypeId = { in: ids };
    }
    if (f.numberFrom || f.numberTo) {
        where.number = {};
        if (f.numberFrom)
            where.number.gte = Number(f.numberFrom);
        if (f.numberTo)
            where.number.lte = Number(f.numberTo);
    }
    if (f.referenceFrom || f.referenceTo) {
        where.referenceNumber = {};
        if (f.referenceFrom)
            where.referenceNumber.gte = Number(f.referenceFrom);
        if (f.referenceTo)
            where.referenceNumber.lte = Number(f.referenceTo);
    }
    if (f.issuingSystem)
        where.issuingSystem = f.issuingSystem;
    return where;
}
function parseIdList(param) {
    if (!param)
        return [];
    return param.split(",").map(Number).filter((n) => !Number.isNaN(n));
}
function parseCodeList(param) {
    if (!param)
        return [];
    return param.split(",").filter(Boolean);
}
function collectLeafDescendants(accountId, allAccounts) {
    const childrenMap = new Map();
    for (const a of allAccounts) {
        if (a.parentId) {
            if (!childrenMap.has(a.parentId))
                childrenMap.set(a.parentId, []);
            childrenMap.get(a.parentId).push(a.id);
        }
    }
    const leaves = [];
    function walk(id) {
        const children = childrenMap.get(id);
        if (!children || children.length === 0)
            leaves.push(id);
        else
            children.forEach(walk);
    }
    walk(accountId);
    return leaves;
}
/** همه‌ی فرزندان یک حساب در هر عمقی (نه فقط برگ‌ها) — برای فیلتر «این حساب زیرمجموعه‌ی کدام گروه/کل/معین انتخاب‌شده است؟» */
function collectAllDescendants(accountId, allAccounts) {
    const childrenMap = new Map();
    for (const a of allAccounts) {
        if (a.parentId) {
            if (!childrenMap.has(a.parentId))
                childrenMap.set(a.parentId, []);
            childrenMap.get(a.parentId).push(a.id);
        }
    }
    const result = new Set();
    function walk(id) {
        result.add(id);
        const children = childrenMap.get(id);
        if (children)
            children.forEach(walk);
    }
    walk(accountId);
    return result;
}
function collectAllDescendantsMulti(accountIds, allAccounts) {
    const result = new Set();
    for (const id of accountIds)
        for (const d of collectAllDescendants(id, allAccounts))
            result.add(d);
    return result;
}
/** برای هر حساب زیرمجموعه (مثلاً معین‌های انتخاب‌شده)، اجداد آن را در سطح گزارشگری مشخص‌شده پیدا می‌کند (برای فیلتر پایین‌به‌بالا در خود سلسله‌مراتب حساب) */
function ancestorIdsAtLevel(descendantIds, targetLevelId, allAccounts) {
    const byId = new Map(allAccounts.map((a) => [a.id, a]));
    const result = new Set();
    for (const startId of descendantIds) {
        let cur = byId.get(startId);
        while (cur) {
            if (cur.levelId === targetLevelId) {
                result.add(cur.id);
                break;
            }
            cur = cur.parentId ? byId.get(cur.parentId) : undefined;
        }
    }
    return result;
}
function collectLeafDescendantsMulti(accountIds, allAccounts) {
    const set = new Set();
    for (const id of accountIds)
        for (const leaf of collectLeafDescendants(id, allAccounts))
            set.add(leaf);
    return Array.from(set);
}
/** فیلتر خطوط سند بر اساس کدهای تفصیلی انتخاب‌شده؛ اسلات خودِ تب فعلی از فیلتر مستثنی می‌شود */
function buildLineWhere(detail1Codes, detail2Codes, detail3Codes, excludeSlot) {
    const where = {};
    if (detail1Codes.length && excludeSlot !== 1)
        where.detail1Code = { in: detail1Codes };
    if (detail2Codes.length && excludeSlot !== 2)
        where.detail2Code = { in: detail2Codes };
    if (detail3Codes.length && excludeSlot !== 3)
        where.detail3Code = { in: detail3Codes };
    return where;
}
router.get("/trial-balance", (0, guard_1.can)(`${ACCOUNT_REVIEW}.view`), async (req, res) => {
    const q = req.query;
    if (!q.levelOrder)
        return res.status(400).json({ error: "سطح گزارشگری مشخص نشده است" });
    const level = await prisma_1.prisma.reportingLevel.findFirst({ where: { order: Number(q.levelOrder) } });
    if (!level)
        return res.status(404).json({ error: "سطح گزارشگری یافت نشد" });
    const allAccounts = await prisma_1.prisma.account.findMany({ select: { id: true, parentId: true, code: true, title: true, levelId: true } });
    const parentIds = parseIdList(q.parentIds);
    const descendantScope = parentIds.length ? collectAllDescendantsMulti(parentIds, allAccounts) : null;
    const descendantIds = parseIdList(q.descendantIds);
    const ancestorScope = descendantIds.length ? ancestorIdsAtLevel(descendantIds, level.id, allAccounts) : null;
    const rowsAtLevel = allAccounts.filter((a) => {
        if (a.levelId !== level.id)
            return false;
        if (descendantScope && !descendantScope.has(a.id))
            return false;
        if (ancestorScope && !ancestorScope.has(a.id))
            return false;
        return true;
    });
    const entryWhere = buildEntryWhere(q);
    const detail1Codes = parseCodeList(q.detail1Codes);
    const detail2Codes = parseCodeList(q.detail2Codes);
    const detail3Codes = parseCodeList(q.detail3Codes);
    const lineWhere = buildLineWhere(detail1Codes, detail2Codes, detail3Codes);
    const results = [];
    const byId = (0, accountCode_1.buildAccountByIdMap)(allAccounts);
    for (const acc of rowsAtLevel) {
        const leafIds = collectLeafDescendants(acc.id, allAccounts);
        const hasChildren = allAccounts.some((a) => a.parentId === acc.id);
        const agg = await prisma_1.prisma.journalEntryLine.aggregate({
            where: { accountId: { in: leafIds }, ...lineWhere, journalEntry: entryWhere },
            _sum: { baseDebit: true, baseCredit: true },
        });
        const totalDebit = Number(agg._sum.baseDebit || 0);
        const totalCredit = Number(agg._sum.baseCredit || 0);
        if (totalDebit === 0 && totalCredit === 0)
            continue;
        const diff = totalDebit - totalCredit;
        results.push({
            id: acc.id,
            code: (0, accountCode_1.computeFullAccountCode)(acc.id, byId),
            title: acc.title,
            hasChildren,
            totalDebit,
            totalCredit,
            balance: Math.abs(diff),
            balanceNature: diff >= 0 ? "DEBIT" : "CREDIT",
        });
    }
    res.json(results);
});
const DETAIL_SUMMARY_SORT_FIELDS = new Set(["code", "title", "totalDebit", "totalCredit"]);
// این endpoint هم مرور حسابها (AccountsReview.tsx) و هم گزارش تحلیلی OLAP (OlapReports.tsx، برای
// انتخابگر slot) را تغذیه می‌کند؛ چون یک route نمی‌تواند دو کلید متفاوت را هم‌زمان به can() بدهد،
// بررسی مجاز بودن این‌جا به‌صورت دستی (اجتماع دو دسترسی) انجام می‌شود.
router.get("/detail-summary", async (req, res) => {
    const [canAccountReview, canOlapReports] = await Promise.all([
        (0, guard_1.userHasAction)(req.user.id, `${ACCOUNT_REVIEW}.view`),
        (0, guard_1.userHasAction)(req.user.id, `${OLAP_REPORTS}.view`),
    ]);
    if (!canAccountReview && !canOlapReports) {
        return res.status(403).json({ error: "دسترسی لازم برای این عملیات را ندارید" });
    }
    const q = req.query;
    const slot = Number(q.slot);
    if (![1, 2, 3].includes(slot))
        return res.status(400).json({ error: "اسلات تفصیل نامعتبر است" });
    const allAccounts = await prisma_1.prisma.account.findMany({ select: { id: true, parentId: true } });
    const parentIds = parseIdList(q.parentIds);
    const accountScope = parentIds.length ? collectLeafDescendantsMulti(parentIds, allAccounts) : null;
    const detail1Codes = parseCodeList(q.detail1Codes);
    const detail2Codes = parseCodeList(q.detail2Codes);
    const detail3Codes = parseCodeList(q.detail3Codes);
    const lineWhere = buildLineWhere(detail1Codes, detail2Codes, detail3Codes, slot);
    if (accountScope)
        lineWhere.accountId = { in: accountScope };
    const slotField = `detail${slot}Code`;
    lineWhere[slotField] = { not: null };
    const entryWhere = buildEntryWhere(q);
    const grouped = await prisma_1.prisma.journalEntryLine.groupBy({
        by: [slotField],
        where: { ...lineWhere, journalEntry: entryWhere },
        _sum: { baseDebit: true, baseCredit: true },
    });
    const codes = grouped.map((g) => g[slotField]).filter(Boolean);
    const titles = await (0, detailValues_1.resolveDetailTitles)(codes);
    const results = grouped
        .map((g) => {
        const code = g[slotField];
        const totalDebit = Number(g._sum.baseDebit || 0);
        const totalCredit = Number(g._sum.baseCredit || 0);
        const diff = totalDebit - totalCredit;
        return {
            id: code,
            code,
            title: titles[code] || code,
            hasChildren: false,
            totalDebit,
            totalCredit,
            balance: Math.abs(diff),
            balanceNature: diff >= 0 ? "DEBIT" : "CREDIT",
        };
    })
        .filter((r) => r.totalDebit > 0 || r.totalCredit > 0);
    // فیلتر ستونی (آیکن فیلتر هدر جدول تفصیل در فرانت‌اند) — چون این endpoint خودش نتیجه را در حافظه
    // تجمیع می‌کند (نه یک کوئری مستقیم دیتابیس)، فیلتر هم روی همین آرایه‌ی نهایی با matchesFilterValue اعمال می‌شود
    const DETAIL_FILTER_TYPES = { code: "string", title: "string", totalDebit: "number", totalCredit: "number" };
    const colFilters = (0, tableFilters_1.parseFilters)(q.filters);
    const filtered = Object.keys(colFilters).length
        ? results.filter((r) => Object.entries(colFilters).every(([field, f]) => {
            const type = DETAIL_FILTER_TYPES[field];
            if (!type)
                return true;
            return (0, tableFilters_1.matchesFilterValue)(r[field], type, f);
        }))
        : results;
    // سازگاری با نسخه‌ی قبلی: بدون پارامتر page، آرایه‌ی خام (بدون صفحه‌بندی) برگردانده می‌شود
    if (q.page === undefined) {
        res.json(filtered);
        return;
    }
    // مرتب‌سازی روی کل نتیجه (که همین‌جا در حافظه محاسبه شده) انجام می‌شود؛ سپس فقط همان صفحه برگردانده می‌شود
    let sorted = filtered;
    const summarySortKeys = (0, tableFilters_1.parseSorts)(q.sorts, q.sortField, q.sortDir).filter((k) => DETAIL_SUMMARY_SORT_FIELDS.has(k.field));
    if (summarySortKeys.length) {
        sorted = [...results].sort((a, b) => {
            for (const k of summarySortKeys) {
                const field = k.field;
                const av = a[field];
                const bv = b[field];
                const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "fa");
                if (cmp !== 0)
                    return k.dir === "asc" ? cmp : -cmp;
            }
            return 0;
        });
    }
    const page = Math.max(1, parseInt(q.page, 10) || 1);
    const pageSize = Math.min(500, Math.max(1, parseInt(q.pageSize, 10) || 25));
    const total = sorted.length;
    const start = (page - 1) * pageSize;
    const rows = sorted.slice(start, start + pageSize);
    res.json({ rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
});
router.get("/ledger", (0, guard_1.can)(`${ACCOUNT_REVIEW}.view`), async (req, res) => {
    const q = req.query;
    const allAccounts = await prisma_1.prisma.account.findMany({ select: { id: true, parentId: true, code: true } });
    const parentIds = parseIdList(q.parentIds);
    const accountScope = parentIds.length ? collectLeafDescendantsMulti(parentIds, allAccounts) : null;
    const accountById = (0, accountCode_1.buildAccountByIdMap)(allAccounts);
    const detail1Codes = parseCodeList(q.detail1Codes);
    const detail2Codes = parseCodeList(q.detail2Codes);
    const detail3Codes = parseCodeList(q.detail3Codes);
    const lineWhere = buildLineWhere(detail1Codes, detail2Codes, detail3Codes);
    if (accountScope)
        lineWhere.accountId = { in: accountScope };
    const entryWhere = buildEntryWhere(q);
    // فیلتر ستونی تب گردش (کلیک روی آیکن فیلتر هر ستون در جدول) — مستقل و علاوه‌بر «فیلترهای بیشتر»ی
    // که از بالای صفحه (buildEntryWhere) می‌آید؛ هر دو با AND با هم ترکیب می‌شوند نه جایگزین یکدیگر.
    const colFilters = (0, tableFilters_1.parseFilters)(q.filters);
    const entryAnd = [entryWhere];
    if (colFilters.number) {
        const w = (0, tableFilters_1.numberWhere)(colFilters.number);
        if (w)
            entryAnd.push({ number: w });
    }
    if (colFilters.referenceNumber) {
        const w = (0, tableFilters_1.numberWhere)(colFilters.referenceNumber);
        if (w)
            entryAnd.push({ referenceNumber: w });
    }
    if (colFilters.date) {
        const w = (0, tableFilters_1.dateWhere)(colFilters.date);
        if (w)
            entryAnd.push({ date: w });
    }
    if (colFilters.documentType) {
        const w = (0, tableFilters_1.stringWhere)(colFilters.documentType);
        if (w)
            entryAnd.push({ documentType: { title: w } });
    }
    if (colFilters.status) {
        const f = colFilters.status;
        if (f.operator === "empty") {
            entryAnd.push({ id: -1 }); // وضعیت سند همیشه مقدار دارد؛ یعنی هیچ سندی مطابقت ندارد
        }
        else if (f.operator === "contains" || f.operator === "notContains") {
            const needle = (f.value ?? "").trim();
            if (needle) {
                const matched = Object.entries(LEDGER_STATUS_FA).filter(([, label]) => label.includes(needle)).map(([key]) => key);
                if (f.operator === "contains")
                    entryAnd.push(matched.length ? { status: { in: matched } } : { id: -1 });
                else if (matched.length)
                    entryAnd.push({ status: { notIn: matched } });
            }
        }
    }
    if (colFilters.issuingSystem) {
        const f = colFilters.issuingSystem;
        if (f.operator === "empty") {
            entryAnd.push({ id: -1 });
        }
        else if (f.operator === "contains" || f.operator === "notContains") {
            const needle = (f.value ?? "").trim();
            if (needle) {
                const matched = Object.entries(LEDGER_ISSUING_SYSTEM_FA).filter(([, label]) => label.includes(needle)).map(([key]) => key);
                if (f.operator === "contains")
                    entryAnd.push(matched.length ? { issuingSystem: { in: matched } } : { id: -1 });
                else if (matched.length)
                    entryAnd.push({ issuingSystem: { notIn: matched } });
            }
        }
    }
    const lineAnd = [lineWhere];
    if (colFilters.description) {
        const w = (0, tableFilters_1.stringWhere)(colFilters.description);
        if (w)
            lineAnd.push({ description: w });
    }
    if (colFilters.debit) {
        const w = (0, tableFilters_1.numberWhere)(colFilters.debit);
        if (w)
            lineAnd.push({ baseDebit: w });
    }
    if (colFilters.credit) {
        const w = (0, tableFilters_1.numberWhere)(colFilters.credit);
        if (w)
            lineAnd.push({ baseCredit: w });
    }
    const where = { AND: [...lineAnd, { journalEntry: { AND: entryAnd } }] };
    // مرتب‌سازی: پیش‌فرض همیشه زمانی (تاریخ → شماره سند → ترتیب ردیف) است چون «مانده تجمعی» فقط در
    // همین ترتیب معنای واقعیِ «مانده‌ی حساب تا این لحظه» را دارد؛ اگر کاربر ستون دیگری را برای
    // مرتب‌سازی انتخاب کند، مانده‌ی هر ردیف همچنان صحیح محاسبه می‌شود (جمع تجمعی روی همان ترتیب
    // نمایش‌داده‌شده) ولی دیگر یک «مانده‌ی زمانی» متعارف نیست.
    const orderFor = (field, dir) => ({
        number: { journalEntry: { number: dir } },
        referenceNumber: { journalEntry: { referenceNumber: dir } },
        date: { journalEntry: { date: dir } },
        documentType: { journalEntry: { documentType: { title: dir } } },
        issuingSystem: { journalEntry: { issuingSystem: dir } },
        status: { journalEntry: { status: dir } },
        description: { description: dir },
        debit: { baseDebit: dir },
        credit: { baseCredit: dir },
    }[field]);
    // مرتب‌سازی چندستونه (پارامتر sorts) یا تک‌ستونه‌ی قبلی؛ rowOrder همیشه آخرین کلید است تا ترتیب ردیف‌های یک سند پایدار بماند
    const ledgerSortOrder = (0, tableFilters_1.parseSorts)(q.sorts, q.sortField, q.sortDir).map((k) => orderFor(k.field, k.dir)).filter(Boolean);
    const orderBy = ledgerSortOrder.length
        ? [...ledgerSortOrder, { rowOrder: "asc" }]
        : [{ journalEntry: { date: "asc" } }, { journalEntry: { number: "asc" } }, { rowOrder: "asc" }];
    const page = Math.max(1, parseInt(q.page) || 1);
    const pageSize = Math.min(1000, Math.max(1, parseInt(q.pageSize) || 100));
    const skip = (page - 1) * pageSize;
    // پاس سبک (فقط دو ستون عددی) روی همه‌ی ردیف‌های منطبق، برای محاسبه‌ی مانده‌ی تراکمی درست تا قبل از این صفحه
    const allAmounts = await prisma_1.prisma.journalEntryLine.findMany({ where, select: { baseDebit: true, baseCredit: true }, orderBy });
    const total = allAmounts.length;
    let cum = 0;
    const cumulative = allAmounts.map((l) => {
        cum += Number(l.baseDebit) - Number(l.baseCredit);
        return cum;
    });
    const startingBalance = skip > 0 ? cumulative[skip - 1] ?? 0 : 0;
    const lines = await prisma_1.prisma.journalEntryLine.findMany({
        where,
        include: {
            journalEntry: { include: { documentType: true } },
            account: true,
        },
        orderBy,
        skip,
        take: pageSize,
    });
    const codes = lines.flatMap((l) => [l.detail1Code, l.detail2Code, l.detail3Code]);
    const titles = await (0, detailValues_1.resolveDetailTitles)(codes);
    let running = startingBalance;
    const rows = lines.map((l) => {
        const debit = Number(l.baseDebit);
        const credit = Number(l.baseCredit);
        running += debit - credit;
        return {
            id: l.id,
            journalEntryId: l.journalEntryId,
            number: l.journalEntry.number,
            referenceNumber: l.journalEntry.referenceNumber,
            date: l.journalEntry.date,
            documentType: l.journalEntry.documentType.title,
            issuingSystem: l.journalEntry.issuingSystem,
            status: l.journalEntry.status,
            accountCode: (0, accountCode_1.computeFullAccountCode)(l.accountId, accountById),
            accountTitle: l.account.title,
            detail1Title: l.detail1Code ? titles[l.detail1Code] : null,
            detail2Title: l.detail2Code ? titles[l.detail2Code] : null,
            detail3Title: l.detail3Code ? titles[l.detail3Code] : null,
            description: l.description,
            debit,
            credit,
            runningBalance: Math.abs(running),
            runningBalanceNature: running >= 0 ? "DEBIT" : "CREDIT",
        };
    });
    res.json({ rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
});
/** حداکثر تعداد ردیف سند مطابق فیلتر که یک‌جا در حافظه تجمیع می‌شود؛ فراتر از این، کاربر باید فیلتر را محدودتر کند */
const OLAP_MAX_LINES = 200000;
const OLAP_MEASURES = ["debit", "credit", "balance", "turnover", "count"];
const NO_DETAIL_KEY = "__none__";
const NO_DETAIL_LABEL = "(بدون تفصیل)";
router.post("/olap-pivot", (0, guard_1.can)(`${OLAP_REPORTS}.view`), async (req, res) => {
    const body = req.body;
    const rowDimension = body.rowDimension;
    const colDimension = body.colDimension || null;
    const measure = body.measure;
    if (!rowDimension || !["account", "detail", "period"].includes(rowDimension.type)) {
        return res.status(400).json({ error: "بعد ردیف گزارش مشخص نشده است" });
    }
    if (!measure || !OLAP_MEASURES.includes(measure)) {
        return res.status(400).json({ error: "شاخص گزارش نامعتبر است" });
    }
    const f = body.filters || {};
    const entryWhere = {};
    if (f.fromDate || f.toDate) {
        entryWhere.date = {};
        if (f.fromDate)
            entryWhere.date.gte = new Date(f.fromDate);
        if (f.toDate)
            entryWhere.date.lte = new Date(f.toDate);
    }
    if (f.documentTypeIds?.length)
        entryWhere.documentTypeId = { in: f.documentTypeIds };
    if (f.status?.length)
        entryWhere.status = { in: f.status };
    if (f.issuingSystem?.length)
        entryWhere.issuingSystem = { in: f.issuingSystem };
    const allAccounts = await prisma_1.prisma.account.findMany({ select: { id: true, parentId: true, code: true, title: true, levelId: true } });
    const accountById = (0, accountCode_1.buildAccountByIdMap)(allAccounts);
    const lineWhere = {};
    if (f.accountIds?.length) {
        const leafIds = collectLeafDescendantsMulti(f.accountIds, allAccounts);
        lineWhere.accountId = { in: leafIds };
    }
    if (f.detail1Codes?.length)
        lineWhere.detail1Code = { in: f.detail1Codes };
    if (f.detail2Codes?.length)
        lineWhere.detail2Code = { in: f.detail2Codes };
    if (f.detail3Codes?.length)
        lineWhere.detail3Code = { in: f.detail3Codes };
    const where = { ...lineWhere, journalEntry: entryWhere };
    const matchCount = await prisma_1.prisma.journalEntryLine.count({ where });
    if (matchCount > OLAP_MAX_LINES) {
        return res.status(400).json({ error: "تعداد ردیف‌های منطبق با فیلتر بسیار زیاد است؛ لطفاً بازه زمانی یا فیلترها را محدودتر کنید" });
    }
    const lineWithMonthFilterCandidates = await prisma_1.prisma.journalEntryLine.findMany({
        where,
        select: {
            accountId: true,
            detail1Code: true,
            detail2Code: true,
            detail3Code: true,
            baseDebit: true,
            baseCredit: true,
            journalEntry: { select: { date: true } },
        },
    });
    // فیلتر «بازه زمانی» (ماه شمسی، مستقل از سال) — چون نمی‌شود ماه شمسی را در where پریزما محاسبه کرد،
    // این فیلتر روی همان ردیف‌های واکشی‌شده در حافظه اعمال می‌شود (مثلاً فقط فروردین، برای مقایسه‌ی چند سال)
    const monthFrom = f.monthFrom && f.monthFrom >= 1 && f.monthFrom <= 12 ? f.monthFrom : null;
    const monthTo = f.monthTo && f.monthTo >= 1 && f.monthTo <= 12 ? f.monthTo : null;
    const lines = monthFrom || monthTo
        ? lineWithMonthFilterCandidates.filter((l) => {
            const { month } = (0, jalaliDate_1.toJalaliYearMonth)(l.journalEntry.date);
            const from = monthFrom || 1;
            const to = monthTo || 12;
            return from <= to ? month >= from && month <= to : month >= from || month <= to;
        })
        : lineWithMonthFilterCandidates;
    // نگاشت هر حساب به اجدادش در هر سطح گزارشگری (کش‌شده)، برای پیمایش «این ردیف سند در بعد حساب زیرمجموعه‌ی کدام گروه/کل/معین است؟»
    const levels = await prisma_1.prisma.reportingLevel.findMany();
    const levelOrderById = new Map(levels.map((l) => [l.id, l.order]));
    const ancestorCache = new Map();
    function ancestorAtLevel(accountId, levelOrder) {
        let byLevel = ancestorCache.get(accountId);
        if (!byLevel) {
            byLevel = new Map();
            ancestorCache.set(accountId, byLevel);
        }
        if (byLevel.has(levelOrder))
            return byLevel.get(levelOrder);
        let cur = accountById.get(accountId);
        let found = null;
        while (cur) {
            if (levelOrderById.get(cur.levelId) === levelOrder) {
                found = cur.id;
                break;
            }
            cur = cur.parentId ? accountById.get(cur.parentId) : undefined;
        }
        byLevel.set(levelOrder, found);
        return found;
    }
    function keyLabel(dim, line) {
        if (dim.type === "account") {
            const id = ancestorAtLevel(line.accountId, dim.levelOrder);
            if (id == null)
                return null;
            const acc = accountById.get(id);
            return { key: `a${id}`, label: `${(0, accountCode_1.computeFullAccountCode)(id, accountById)} - ${acc.title}` };
        }
        if (dim.type === "detail") {
            const code = line[`detail${dim.slot}Code`];
            if (!code)
                return { key: NO_DETAIL_KEY, label: NO_DETAIL_LABEL };
            return { key: code, label: code };
        }
        const { year, month } = (0, jalaliDate_1.toJalaliYearMonth)(line.journalEntry.date);
        const key = dim.granularity === "year" ? String(year) : `${year}/${String(month).padStart(2, "0")}`;
        return { key, label: key };
    }
    const cells = new Map();
    const rowLabels = new Map();
    const colLabels = new Map();
    const detailCodesToResolve = new Set();
    for (const line of lines) {
        const rowKL = keyLabel(rowDimension, line);
        if (!rowKL)
            continue;
        let colKL;
        if (colDimension) {
            const c = keyLabel(colDimension, line);
            if (!c)
                continue;
            colKL = c;
        }
        else {
            colKL = { key: "_", label: "" };
        }
        rowLabels.set(rowKL.key, rowKL.label);
        colLabels.set(colKL.key, colKL.label);
        if (rowDimension.type === "detail" && rowKL.key !== NO_DETAIL_KEY)
            detailCodesToResolve.add(rowKL.key);
        if (colDimension?.type === "detail" && colKL.key !== NO_DETAIL_KEY)
            detailCodesToResolve.add(colKL.key);
        let rowMap = cells.get(rowKL.key);
        if (!rowMap) {
            rowMap = new Map();
            cells.set(rowKL.key, rowMap);
        }
        let cell = rowMap.get(colKL.key);
        if (!cell) {
            cell = { debit: 0, credit: 0, count: 0 };
            rowMap.set(colKL.key, cell);
        }
        cell.debit += Number(line.baseDebit);
        cell.credit += Number(line.baseCredit);
        cell.count += 1;
    }
    if (detailCodesToResolve.size) {
        const titles = await (0, detailValues_1.resolveDetailTitles)(Array.from(detailCodesToResolve));
        for (const code of detailCodesToResolve) {
            if (titles[code]) {
                if (rowLabels.has(code))
                    rowLabels.set(code, `${code} - ${titles[code]}`);
                if (colLabels.has(code))
                    colLabels.set(code, `${code} - ${titles[code]}`);
            }
        }
    }
    function measureValue(cell) {
        switch (measure) {
            case "debit":
                return cell.debit;
            case "credit":
                return cell.credit;
            case "balance":
                return cell.debit - cell.credit;
            case "turnover":
                return cell.debit + cell.credit;
            case "count":
                return cell.count;
            default:
                return 0;
        }
    }
    // مرتب‌سازی: دوره زمانی بر اساس خودِ کلید (کلید سال/ماه zero-padded است پس مرتب‌سازی رشته‌ای همان
    // ترتیب زمانی را می‌دهد)؛ حساب و تفصیل بر اساس برچسب (که با کد حساب یا عنوان تفصیل شروع می‌شود)،
    // با این تفاوت که ردیف/ستون «بدون تفصیل» همیشه در انتها قرار می‌گیرد.
    function sortDimKeys(dim, keys, labels) {
        if (!dim)
            return keys;
        if (dim.type === "period")
            return [...keys].sort((a, b) => a.localeCompare(b));
        return [...keys].sort((a, b) => {
            if (a === NO_DETAIL_KEY)
                return 1;
            if (b === NO_DETAIL_KEY)
                return -1;
            return (labels.get(a) || "").localeCompare(labels.get(b) || "", "fa");
        });
    }
    const rowKeys = sortDimKeys(rowDimension, Array.from(rowLabels.keys()), rowLabels);
    const colKeys = colDimension ? sortDimKeys(colDimension, Array.from(colLabels.keys()), colLabels) : ["_"];
    const resultCells = {};
    const rowTotals = {};
    const colTotals = {};
    let grandTotal = 0;
    for (const rowKey of rowKeys) {
        const rowMap = cells.get(rowKey);
        resultCells[rowKey] = {};
        for (const colKey of colKeys) {
            const cell = rowMap?.get(colKey);
            const value = cell ? measureValue(cell) : 0;
            resultCells[rowKey][colKey] = value;
            rowTotals[rowKey] = (rowTotals[rowKey] || 0) + value;
            colTotals[colKey] = (colTotals[colKey] || 0) + value;
            grandTotal += value;
        }
    }
    res.json({
        rows: rowKeys.map((key) => ({ key, label: rowLabels.get(key) || key })),
        cols: colDimension ? colKeys.map((key) => ({ key, label: colLabels.get(key) || key })) : null,
        cells: resultCells,
        rowTotals,
        colTotals,
        grandTotal,
    });
});
exports.default = router;
