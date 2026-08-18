import { Router } from "express";
import { prisma } from "../lib/prisma";
import { resolveDetailTitles } from "../utils/detailValues";
import { computeFullAccountCode, buildAccountByIdMap } from "../utils/accountCode";

const router = Router();

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
  const q = req.query as any as { parentIds?: string; detail1Codes?: string; detail2Codes?: string; detail3Codes?: string; page?: string; pageSize?: string } & CommonFilters;

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
  const where = { ...lineWhere, journalEntry: entryWhere };
  const orderBy = [{ journalEntry: { date: "asc" as const } }, { journalEntry: { number: "asc" as const } }, { rowOrder: "asc" as const }];

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

export default router;
