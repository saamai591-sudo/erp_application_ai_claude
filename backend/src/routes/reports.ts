import { Router } from "express";
import { prisma } from "../lib/prisma";
import { resolveDetailTitles } from "../utils/detailValues";
import { computeFullAccountCode, buildAccountByIdMap } from "../utils/accountCode";
import { parseFilters, stringWhere, numberWhere, dateWhere } from "../utils/tableFilters";
import { toJalaliYearMonth } from "../utils/jalaliDate";

const router = Router();

// معادل فارسی وضعیت سند و سیستم صادرکننده — برای ترجمه‌ی عبارت جستجوی فیلتر ستونی «وضعیت»/«سیستم»
// تب گردش (که روی برچسب فارسی نمایش‌داده‌شده اعمال می‌شود) به مقدار enum؛ دقیقاً همان برچسب‌هایی که
// AccountsReview.tsx برای رندر این دو ستون استفاده می‌کند.
const LEDGER_STATUS_FA: Record<string, string> = { DRAFT: "ثبت", REVIEW: "بررسی", APPROVED: "تایید" };
const LEDGER_ISSUING_SYSTEM_FA: Record<string, string> = {
  ACCOUNTING: "حسابداری",
  ACCOUNTING_EXCEL_IMPORT: "حسابداری (ورود از اکسل)",
  ACCOUNT_CLOSING: "بستن حسابها",
  OPENING_CLOSING: "افتتاحیه و اختتامیه",
};

interface CommonFilters {
  fromDate?: string;
  toDate?: string;
  documentTypeIds?: string;
  numberFrom?: string;
  numberTo?: string;
  referenceFrom?: string;
  referenceTo?: string;
  issuingSystem?: string;
}

function buildEntryWhere(f: CommonFilters) {
  const where: any = {};
  if (f.fromDate || f.toDate) {
    where.date = {};
    if (f.fromDate) where.date.gte = new Date(f.fromDate);
    if (f.toDate) where.date.lte = new Date(f.toDate);
  }
  if (f.documentTypeIds) {
    const ids = f.documentTypeIds.split(",").map(Number).filter((n) => !Number.isNaN(n));
    if (ids.length) where.documentTypeId = { in: ids };
  }
  if (f.numberFrom || f.numberTo) {
    where.number = {};
    if (f.numberFrom) where.number.gte = Number(f.numberFrom);
    if (f.numberTo) where.number.lte = Number(f.numberTo);
  }
  if (f.referenceFrom || f.referenceTo) {
    where.referenceNumber = {};
    if (f.referenceFrom) where.referenceNumber.gte = Number(f.referenceFrom);
    if (f.referenceTo) where.referenceNumber.lte = Number(f.referenceTo);
  }
  if (f.issuingSystem) where.issuingSystem = f.issuingSystem;
  return where;
}

function parseIdList(param?: string): number[] {
  if (!param) return [];
  return param.split(",").map(Number).filter((n) => !Number.isNaN(n));
}
function parseCodeList(param?: string): string[] {
  if (!param) return [];
  return param.split(",").filter(Boolean);
}

function collectLeafDescendants(accountId: number, allAccounts: { id: number; parentId: number | null }[]): number[] {
  const childrenMap = new Map<number, number[]>();
  for (const a of allAccounts) {
    if (a.parentId) {
      if (!childrenMap.has(a.parentId)) childrenMap.set(a.parentId, []);
      childrenMap.get(a.parentId)!.push(a.id);
    }
  }
  const leaves: number[] = [];
  function walk(id: number) {
    const children = childrenMap.get(id);
    if (!children || children.length === 0) leaves.push(id);
    else children.forEach(walk);
  }
  walk(accountId);
  return leaves;
}

/** همه‌ی فرزندان یک حساب در هر عمقی (نه فقط برگ‌ها) — برای فیلتر «این حساب زیرمجموعه‌ی کدام گروه/کل/معین انتخاب‌شده است؟» */
function collectAllDescendants(accountId: number, allAccounts: { id: number; parentId: number | null }[]): Set<number> {
  const childrenMap = new Map<number, number[]>();
  for (const a of allAccounts) {
    if (a.parentId) {
      if (!childrenMap.has(a.parentId)) childrenMap.set(a.parentId, []);
      childrenMap.get(a.parentId)!.push(a.id);
    }
  }
  const result = new Set<number>();
  function walk(id: number) {
    result.add(id);
    const children = childrenMap.get(id);
    if (children) children.forEach(walk);
  }
  walk(accountId);
  return result;
}

function collectAllDescendantsMulti(accountIds: number[], allAccounts: { id: number; parentId: number | null }[]): Set<number> {
  const result = new Set<number>();
  for (const id of accountIds) for (const d of collectAllDescendants(id, allAccounts)) result.add(d);
  return result;
}

/** برای هر حساب زیرمجموعه (مثلاً معین‌های انتخاب‌شده)، اجداد آن را در سطح گزارشگری مشخص‌شده پیدا می‌کند (برای فیلتر پایین‌به‌بالا در خود سلسله‌مراتب حساب) */
function ancestorIdsAtLevel(
  descendantIds: number[],
  targetLevelId: number,
  allAccounts: { id: number; parentId: number | null; levelId: number }[]
): Set<number> {
  const byId = new Map(allAccounts.map((a) => [a.id, a]));
  const result = new Set<number>();
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

function collectLeafDescendantsMulti(accountIds: number[], allAccounts: { id: number; parentId: number | null }[]): number[] {
  const set = new Set<number>();
  for (const id of accountIds) for (const leaf of collectLeafDescendants(id, allAccounts)) set.add(leaf);
  return Array.from(set);
}

/** فیلتر خطوط سند بر اساس کدهای تفصیلی انتخاب‌شده؛ اسلات خودِ تب فعلی از فیلتر مستثنی می‌شود */
function buildLineWhere(detail1Codes: string[], detail2Codes: string[], detail3Codes: string[], excludeSlot?: number) {
  const where: any = {};
  if (detail1Codes.length && excludeSlot !== 1) where.detail1Code = { in: detail1Codes };
  if (detail2Codes.length && excludeSlot !== 2) where.detail2Code = { in: detail2Codes };
  if (detail3Codes.length && excludeSlot !== 3) where.detail3Code = { in: detail3Codes };
  return where;
}

router.get("/trial-balance", async (req, res) => {
  const q = req.query as any as { levelOrder: string; parentIds?: string; descendantIds?: string; detail1Codes?: string; detail2Codes?: string; detail3Codes?: string } & CommonFilters;
  if (!q.levelOrder) return res.status(400).json({ error: "سطح گزارشگری مشخص نشده است" });

  const level = await prisma.reportingLevel.findFirst({ where: { order: Number(q.levelOrder) } });
  if (!level) return res.status(404).json({ error: "سطح گزارشگری یافت نشد" });

  const allAccounts = await prisma.account.findMany({ select: { id: true, parentId: true, code: true, title: true, levelId: true } });
  const parentIds = parseIdList(q.parentIds);
  const descendantScope = parentIds.length ? collectAllDescendantsMulti(parentIds, allAccounts) : null;

  const descendantIds = parseIdList(q.descendantIds);
  const ancestorScope = descendantIds.length ? ancestorIdsAtLevel(descendantIds, level.id, allAccounts) : null;

  const rowsAtLevel = allAccounts.filter((a: any) => {
    if (a.levelId !== level.id) return false;
    if (descendantScope && !descendantScope.has(a.id)) return false;
    if (ancestorScope && !ancestorScope.has(a.id)) return false;
    return true;
  });

  const entryWhere = buildEntryWhere(q);
  const detail1Codes = parseCodeList(q.detail1Codes);
  const detail2Codes = parseCodeList(q.detail2Codes);
  const detail3Codes = parseCodeList(q.detail3Codes);
  const lineWhere = buildLineWhere(detail1Codes, detail2Codes, detail3Codes);

  const results: any[] = [];
  const byId = buildAccountByIdMap(allAccounts as any);
  for (const acc of rowsAtLevel) {
    const leafIds = collectLeafDescendants(acc.id, allAccounts);
    const hasChildren = allAccounts.some((a: any) => a.parentId === acc.id);
    const agg = await prisma.journalEntryLine.aggregate({
      where: { accountId: { in: leafIds }, ...lineWhere, journalEntry: entryWhere },
      _sum: { baseDebit: true, baseCredit: true },
    });
    const totalDebit = Number(agg._sum.baseDebit || 0);
    const totalCredit = Number(agg._sum.baseCredit || 0);
    if (totalDebit === 0 && totalCredit === 0) continue;
    const diff = totalDebit - totalCredit;
    results.push({
      id: acc.id,
      code: computeFullAccountCode(acc.id, byId),
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

router.get("/detail-summary", async (req, res) => {
  const q = req.query as any as {
    slot: string;
    parentIds?: string;
    detail1Codes?: string;
    detail2Codes?: string;
    detail3Codes?: string;
    page?: string;
    pageSize?: string;
    sortField?: string;
    sortDir?: string;
  } & CommonFilters;
  const slot = Number(q.slot);
  if (![1, 2, 3].includes(slot)) return res.status(400).json({ error: "اسلات تفصیل نامعتبر است" });

  const allAccounts = await prisma.account.findMany({ select: { id: true, parentId: true } });
  const parentIds = parseIdList(q.parentIds);
  const accountScope = parentIds.length ? collectLeafDescendantsMulti(parentIds, allAccounts) : null;

  const detail1Codes = parseCodeList(q.detail1Codes);
  const detail2Codes = parseCodeList(q.detail2Codes);
  const detail3Codes = parseCodeList(q.detail3Codes);
  const lineWhere: any = buildLineWhere(detail1Codes, detail2Codes, detail3Codes, slot);
  if (accountScope) lineWhere.accountId = { in: accountScope };

  const slotField = `detail${slot}Code`;
  lineWhere[slotField] = { not: null };

  const entryWhere = buildEntryWhere(q);

  const grouped: any[] = await (prisma.journalEntryLine as any).groupBy({
    by: [slotField],
    where: { ...lineWhere, journalEntry: entryWhere },
    _sum: { baseDebit: true, baseCredit: true },
  });

  const codes = grouped.map((g) => g[slotField]).filter(Boolean);
  const titles = await resolveDetailTitles(codes);

  const results = grouped
    .map((g) => {
      const code = g[slotField] as string;
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

  // سازگاری با نسخه‌ی قبلی: بدون پارامتر page، آرایه‌ی خام (بدون صفحه‌بندی) برگردانده می‌شود
  if (q.page === undefined) {
    res.json(results);
    return;
  }

  // مرتب‌سازی روی کل نتیجه (که همین‌جا در حافظه محاسبه شده) انجام می‌شود؛ سپس فقط همان صفحه برگردانده می‌شود
  let sorted = results;
  if (q.sortField && DETAIL_SUMMARY_SORT_FIELDS.has(q.sortField)) {
    const field = q.sortField as "code" | "title" | "totalDebit" | "totalCredit";
    sorted = [...results].sort((a, b) => {
      const av = a[field];
      const bv = b[field];
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "fa");
      return q.sortDir === "asc" ? cmp : -cmp;
    });
  }

  const page = Math.max(1, parseInt(q.page as any, 10) || 1);
  const pageSize = Math.min(500, Math.max(1, parseInt(q.pageSize as any, 10) || 25));
  const total = sorted.length;
  const start = (page - 1) * pageSize;
  const rows = sorted.slice(start, start + pageSize);

  res.json({ rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
});

router.get("/ledger", async (req, res) => {
  const q = req.query as any as {
    parentIds?: string;
    detail1Codes?: string;
    detail2Codes?: string;
    detail3Codes?: string;
    page?: string;
    pageSize?: string;
    sortField?: string;
    sortDir?: string;
    filters?: string;
  } & CommonFilters;

  const allAccounts = await prisma.account.findMany({ select: { id: true, parentId: true, code: true } });
  const parentIds = parseIdList(q.parentIds);
  const accountScope = parentIds.length ? collectLeafDescendantsMulti(parentIds, allAccounts) : null;
  const accountById = buildAccountByIdMap(allAccounts as any);

  const detail1Codes = parseCodeList(q.detail1Codes);
  const detail2Codes = parseCodeList(q.detail2Codes);
  const detail3Codes = parseCodeList(q.detail3Codes);
  const lineWhere: any = buildLineWhere(detail1Codes, detail2Codes, detail3Codes);
  if (accountScope) lineWhere.accountId = { in: accountScope };

  const entryWhere = buildEntryWhere(q);

  // فیلتر ستونی تب گردش (کلیک روی آیکن فیلتر هر ستون در جدول) — مستقل و علاوه‌بر «فیلترهای بیشتر»ی
  // که از بالای صفحه (buildEntryWhere) می‌آید؛ هر دو با AND با هم ترکیب می‌شوند نه جایگزین یکدیگر.
  const colFilters = parseFilters(q.filters);
  const entryAnd: any[] = [entryWhere];
  if (colFilters.number) {
    const w = numberWhere(colFilters.number);
    if (w) entryAnd.push({ number: w });
  }
  if (colFilters.referenceNumber) {
    const w = numberWhere(colFilters.referenceNumber);
    if (w) entryAnd.push({ referenceNumber: w });
  }
  if (colFilters.date) {
    const w = dateWhere(colFilters.date);
    if (w) entryAnd.push({ date: w });
  }
  if (colFilters.documentType) {
    const w = stringWhere(colFilters.documentType);
    if (w) entryAnd.push({ documentType: { title: w } });
  }
  if (colFilters.status) {
    const f = colFilters.status;
    if (f.operator === "empty") {
      entryAnd.push({ id: -1 }); // وضعیت سند همیشه مقدار دارد؛ یعنی هیچ سندی مطابقت ندارد
    } else if (f.operator === "contains" || f.operator === "notContains") {
      const needle = (f.value ?? "").trim();
      if (needle) {
        const matched = Object.entries(LEDGER_STATUS_FA).filter(([, label]) => label.includes(needle)).map(([key]) => key);
        if (f.operator === "contains") entryAnd.push(matched.length ? { status: { in: matched } } : { id: -1 });
        else if (matched.length) entryAnd.push({ status: { notIn: matched } });
      }
    }
  }
  if (colFilters.issuingSystem) {
    const f = colFilters.issuingSystem;
    if (f.operator === "empty") {
      entryAnd.push({ id: -1 });
    } else if (f.operator === "contains" || f.operator === "notContains") {
      const needle = (f.value ?? "").trim();
      if (needle) {
        const matched = Object.entries(LEDGER_ISSUING_SYSTEM_FA).filter(([, label]) => label.includes(needle)).map(([key]) => key);
        if (f.operator === "contains") entryAnd.push(matched.length ? { issuingSystem: { in: matched } } : { id: -1 });
        else if (matched.length) entryAnd.push({ issuingSystem: { notIn: matched } });
      }
    }
  }

  const lineAnd: any[] = [lineWhere];
  if (colFilters.description) {
    const w = stringWhere(colFilters.description);
    if (w) lineAnd.push({ description: w });
  }
  if (colFilters.debit) {
    const w = numberWhere(colFilters.debit);
    if (w) lineAnd.push({ baseDebit: w });
  }
  if (colFilters.credit) {
    const w = numberWhere(colFilters.credit);
    if (w) lineAnd.push({ baseCredit: w });
  }

  const where = { AND: [...lineAnd, { journalEntry: { AND: entryAnd } }] };

  // مرتب‌سازی: پیش‌فرض همیشه زمانی (تاریخ → شماره سند → ترتیب ردیف) است چون «مانده تجمعی» فقط در
  // همین ترتیب معنای واقعیِ «مانده‌ی حساب تا این لحظه» را دارد؛ اگر کاربر ستون دیگری را برای
  // مرتب‌سازی انتخاب کند، مانده‌ی هر ردیف همچنان صحیح محاسبه می‌شود (جمع تجمعی روی همان ترتیب
  // نمایش‌داده‌شده) ولی دیگر یک «مانده‌ی زمانی» متعارف نیست.
  const sortDir = q.sortDir === "asc" ? "asc" : "desc";
  const sortMap: Record<string, any> = {
    number: { journalEntry: { number: sortDir } },
    referenceNumber: { journalEntry: { referenceNumber: sortDir } },
    date: { journalEntry: { date: sortDir } },
    documentType: { journalEntry: { documentType: { title: sortDir } } },
    issuingSystem: { journalEntry: { issuingSystem: sortDir } },
    status: { journalEntry: { status: sortDir } },
    description: { description: sortDir },
    debit: { baseDebit: sortDir },
    credit: { baseCredit: sortDir },
  };
  const orderBy =
    q.sortField && sortMap[q.sortField]
      ? [sortMap[q.sortField], { rowOrder: "asc" as const }]
      : [{ journalEntry: { date: "asc" as const } }, { journalEntry: { number: "asc" as const } }, { rowOrder: "asc" as const }];

  const page = Math.max(1, parseInt(q.page as any) || 1);
  const pageSize = Math.min(1000, Math.max(1, parseInt(q.pageSize as any) || 100));
  const skip = (page - 1) * pageSize;

  // پاس سبک (فقط دو ستون عددی) روی همه‌ی ردیف‌های منطبق، برای محاسبه‌ی مانده‌ی تراکمی درست تا قبل از این صفحه
  const allAmounts = await prisma.journalEntryLine.findMany({ where, select: { baseDebit: true, baseCredit: true }, orderBy });
  const total = allAmounts.length;
  let cum = 0;
  const cumulative: number[] = allAmounts.map((l: any) => {
    cum += Number(l.baseDebit) - Number(l.baseCredit);
    return cum;
  });
  const startingBalance = skip > 0 ? cumulative[skip - 1] ?? 0 : 0;

  const lines = await prisma.journalEntryLine.findMany({
    where,
    include: {
      journalEntry: { include: { documentType: true } },
      account: true,
    },
    orderBy,
    skip,
    take: pageSize,
  });

  const codes = lines.flatMap((l: any) => [l.detail1Code, l.detail2Code, l.detail3Code]);
  const titles = await resolveDetailTitles(codes);

  let running = startingBalance;
  const rows = lines.map((l: any) => {
    const debit = Number(l.baseDebit);
    const credit = Number(l.baseCredit);
    running += debit - credit;
    return {
      journalEntryId: l.journalEntryId,
      number: l.journalEntry.number,
      referenceNumber: l.journalEntry.referenceNumber,
      date: l.journalEntry.date,
      documentType: l.journalEntry.documentType.title,
      issuingSystem: l.journalEntry.issuingSystem,
      status: l.journalEntry.status,
      accountCode: computeFullAccountCode(l.accountId, accountById),
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

type OlapDimension =
  | { type: "account"; levelOrder: number }
  | { type: "detail"; slot: 1 | 2 | 3 }
  | { type: "period"; granularity: "year" | "month" };

type OlapMeasure = "debit" | "credit" | "balance" | "turnover" | "count";
const OLAP_MEASURES: OlapMeasure[] = ["debit", "credit", "balance", "turnover", "count"];

interface OlapFilters {
  fromDate?: string;
  toDate?: string;
  accountIds?: number[];
  detail1Codes?: string[];
  detail2Codes?: string[];
  detail3Codes?: string[];
  documentTypeIds?: number[];
  status?: string[];
  issuingSystem?: string[];
}

const NO_DETAIL_KEY = "__none__";
const NO_DETAIL_LABEL = "(بدون تفصیل)";

router.post("/olap-pivot", async (req, res) => {
  const body = req.body as { rowDimension?: OlapDimension; colDimension?: OlapDimension | null; measure?: OlapMeasure; filters?: OlapFilters };
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

  const entryWhere: any = {};
  if (f.fromDate || f.toDate) {
    entryWhere.date = {};
    if (f.fromDate) entryWhere.date.gte = new Date(f.fromDate);
    if (f.toDate) entryWhere.date.lte = new Date(f.toDate);
  }
  if (f.documentTypeIds?.length) entryWhere.documentTypeId = { in: f.documentTypeIds };
  if (f.status?.length) entryWhere.status = { in: f.status };
  if (f.issuingSystem?.length) entryWhere.issuingSystem = { in: f.issuingSystem };

  const allAccounts = await prisma.account.findMany({ select: { id: true, parentId: true, code: true, title: true, levelId: true } });
  const accountById = buildAccountByIdMap(allAccounts);

  const lineWhere: any = {};
  if (f.accountIds?.length) {
    const leafIds = collectLeafDescendantsMulti(f.accountIds, allAccounts);
    lineWhere.accountId = { in: leafIds };
  }
  if (f.detail1Codes?.length) lineWhere.detail1Code = { in: f.detail1Codes };
  if (f.detail2Codes?.length) lineWhere.detail2Code = { in: f.detail2Codes };
  if (f.detail3Codes?.length) lineWhere.detail3Code = { in: f.detail3Codes };

  const where = { ...lineWhere, journalEntry: entryWhere };

  const matchCount = await prisma.journalEntryLine.count({ where });
  if (matchCount > OLAP_MAX_LINES) {
    return res.status(400).json({ error: "تعداد ردیف‌های منطبق با فیلتر بسیار زیاد است؛ لطفاً بازه زمانی یا فیلترها را محدودتر کنید" });
  }

  const lines = await prisma.journalEntryLine.findMany({
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

  // نگاشت هر حساب به اجدادش در هر سطح گزارشگری (کش‌شده)، برای پیمایش «این ردیف سند در بعد حساب زیرمجموعه‌ی کدام گروه/کل/معین است؟»
  const levels = await prisma.reportingLevel.findMany();
  const levelOrderById = new Map(levels.map((l: any) => [l.id, l.order]));
  const ancestorCache = new Map<number, Map<number, number | null>>();
  function ancestorAtLevel(accountId: number, levelOrder: number): number | null {
    let byLevel = ancestorCache.get(accountId);
    if (!byLevel) {
      byLevel = new Map();
      ancestorCache.set(accountId, byLevel);
    }
    if (byLevel.has(levelOrder)) return byLevel.get(levelOrder)!;
    let cur = accountById.get(accountId);
    let found: number | null = null;
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

  function keyLabel(dim: OlapDimension, line: (typeof lines)[number]): { key: string; label: string } | null {
    if (dim.type === "account") {
      const id = ancestorAtLevel(line.accountId, dim.levelOrder);
      if (id == null) return null;
      const acc = accountById.get(id)!;
      return { key: `a${id}`, label: `${computeFullAccountCode(id, accountById)} - ${acc.title}` };
    }
    if (dim.type === "detail") {
      const code = (line as any)[`detail${dim.slot}Code`] as string | null;
      if (!code) return { key: NO_DETAIL_KEY, label: NO_DETAIL_LABEL };
      return { key: code, label: code };
    }
    const { year, month } = toJalaliYearMonth(line.journalEntry.date);
    const key = dim.granularity === "year" ? String(year) : `${year}/${String(month).padStart(2, "0")}`;
    return { key, label: key };
  }

  interface Cell {
    debit: number;
    credit: number;
    count: number;
  }
  const cells = new Map<string, Map<string, Cell>>();
  const rowLabels = new Map<string, string>();
  const colLabels = new Map<string, string>();
  const detailCodesToResolve = new Set<string>();

  for (const line of lines) {
    const rowKL = keyLabel(rowDimension, line);
    if (!rowKL) continue;
    let colKL: { key: string; label: string };
    if (colDimension) {
      const c = keyLabel(colDimension, line);
      if (!c) continue;
      colKL = c;
    } else {
      colKL = { key: "_", label: "" };
    }

    rowLabels.set(rowKL.key, rowKL.label);
    colLabels.set(colKL.key, colKL.label);
    if (rowDimension.type === "detail" && rowKL.key !== NO_DETAIL_KEY) detailCodesToResolve.add(rowKL.key);
    if (colDimension?.type === "detail" && colKL.key !== NO_DETAIL_KEY) detailCodesToResolve.add(colKL.key);

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
    const titles = await resolveDetailTitles(Array.from(detailCodesToResolve));
    for (const code of detailCodesToResolve) {
      if (titles[code]) {
        if (rowLabels.has(code)) rowLabels.set(code, `${code} - ${titles[code]}`);
        if (colLabels.has(code)) colLabels.set(code, `${code} - ${titles[code]}`);
      }
    }
  }

  function measureValue(cell: Cell): number {
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
  function sortDimKeys(dim: OlapDimension | null, keys: string[], labels: Map<string, string>): string[] {
    if (!dim) return keys;
    if (dim.type === "period") return [...keys].sort((a, b) => a.localeCompare(b));
    return [...keys].sort((a, b) => {
      if (a === NO_DETAIL_KEY) return 1;
      if (b === NO_DETAIL_KEY) return -1;
      return (labels.get(a) || "").localeCompare(labels.get(b) || "", "fa");
    });
  }

  const rowKeys = sortDimKeys(rowDimension, Array.from(rowLabels.keys()), rowLabels);
  const colKeys = colDimension ? sortDimKeys(colDimension, Array.from(colLabels.keys()), colLabels) : ["_"];

  const resultCells: Record<string, Record<string, number>> = {};
  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
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

export default router;
