import { prisma } from "../lib/prisma";
import { getCurrentFiscalPeriod } from "../lib/prisma";
import { buildAccountByIdMap, computeFullAccountCode } from "../utils/accountCode";
import { resolveDetailTitles } from "../utils/detailValues";
import { getDetailLevels } from "./accountingSettingsService";
import { roundToCurrencyDecimals } from "../utils/currencyConversion";

// گزارش «تراز حسابها» (حسابداری › گزارش؛ مستند `Documents/گزارش تراز حسابها.docx`).
// دو نوع: «تراز» (یک سطح حساب: کل/معین/جزء…) و «تحلیلی» (حداکثر سه بُعد تودرتو؛ هر بُعد یک سطح حساب یا یک سطح تفصیل).
// ستون‌ها مثل قالب‌های چاپ (mrt): مانده اول دوره (خالص تا قبل از «از تاریخ» در همان دوره مالی) | گردش طی دوره (جمع بدهکار/بستانکار) |
// مانده پایان دوره (خالص اول دوره + گردش). همه‌ی مبالغ به ارز پایه (baseDebit/baseCredit) است. وضعیت سند فیلتر نمی‌شود (مثل مرور حسابها).

export type BalanceKind = "TRIAL" | "ANALYTIC";
export type DocMode = "ALL" | "INCLUDE" | "EXCLUDE";

/** بُعد: "L<order>" = سطح حساب با ترتیب order؛ "D<k>" = تفصیل k (۱..۳) */
export interface BalanceInput {
  fromDate: string;
  toDate: string;
  kind: BalanceKind;
  /** تراز: ترتیب سطح گزارشگری */
  levelOrder?: number;
  /** تحلیلی: ۱ تا ۳ بُعد */
  dims?: string[];
  documentTypeIds?: number[];
  docMode?: DocMode;
  entryIds?: number[];
  /** فیلتر حساب: همه / فقط حساب‌های انتخاب‌شده (و زیرمجموعه‌ی آنها) / بدون حساب‌های انتخاب‌شده */
  accountMode?: DocMode;
  accountIds?: number[];
  /** فقط ردیف‌هایی که مانده‌ی پایان دوره دارند */
  onlyWithBalance?: boolean;
}

export interface BalanceRow {
  /** مسیر یکتا برای کلید React */
  key: string;
  depth: number;
  code: string;
  title: string;
  /** عنوان نوع بُعد این سطر (مثلاً «کل»، «تفصیل ۱») */
  dimTitle: string;
  hasChildren: boolean;
  openDebit: number;
  openCredit: number;
  periodDebit: number;
  periodCredit: number;
  remainDebit: number;
  remainCredit: number;
}

export interface BalanceResult {
  rows: BalanceRow[];
  totals: Omit<BalanceRow, "key" | "depth" | "code" | "title" | "dimTitle" | "hasChildren">;
  dimTitles: string[];
}

const net = (d: number, c: number): [number, number] => {
  const diff = roundToCurrencyDecimals(d - c, 2);
  return diff >= 0 ? [diff, 0] : [0, -diff];
};

/** ترتیب نسبی بُعدها برای کنترل «هر بُعد باید بعد از قبلی باشد»: سطح حساب n → n، تفصیل k → 100+k */
function dimRank(dim: string): number {
  const m = /^([LD])(\d+)$/.exec(dim);
  if (!m) return -1;
  return m[1] === "L" ? Number(m[2]) : 100 + Number(m[2]);
}

export async function computeAccountBalance(input: BalanceInput): Promise<BalanceResult> {
  const from = new Date(input.fromDate);
  const to = new Date(input.toDate);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new Error("از تاریخ و تا تاریخ الزامی است");
  if (from > to) throw new Error("«از تاریخ» نباید بعد از «تا تاریخ» باشد");

  const period = await getCurrentFiscalPeriod();
  if (!period) throw new Error("دوره مالی تعریف نشده است");
  if (from < period.fromDate || to > period.toDate) throw new Error("بازه‌ی گزارش باید داخل دوره مالی جاری باشد");

  const levels = await prisma.reportingLevel.findMany({ orderBy: { order: "asc" } });
  const detailLevels = await getDetailLevels();

  let dims: string[];
  if (input.kind === "TRIAL") {
    if (!input.levelOrder) throw new Error("سطح گزارش مشخص نشده است");
    dims = [`L${input.levelOrder}`];
  } else {
    dims = (input.dims ?? []).filter(Boolean);
    if (dims.length < 1 || dims.length > 3) throw new Error("برای تراز تحلیلی یک تا سه انتخاب لازم است");
    for (let i = 1; i < dims.length; i++) {
      if (dimRank(dims[i]) <= dimRank(dims[i - 1])) throw new Error("هر انتخاب باید پایین‌تر از انتخاب قبلی در سلسله‌مراتب باشد");
    }
  }
  const levelByOrder = new Map(levels.map((l: any) => [l.order, l]));
  const dimTitles: string[] = [];
  for (const d of dims) {
    const m = /^([LD])(\d+)$/.exec(d);
    if (!m) throw new Error("سطح گزارش نامعتبر است");
    const n = Number(m[2]);
    if (m[1] === "L") {
      const lv = levelByOrder.get(n);
      if (!lv) throw new Error("سطح گزارشگری یافت نشد");
      dimTitles.push(lv.title);
    } else {
      if (n < 1 || n > 3 || n > detailLevels) throw new Error(`سطح تفصیل ${n} فعال نیست`);
      dimTitles.push(`تفصیل ${n}`);
    }
  }

  // فیلتر اسناد
  const entryWhere: any = { fiscalPeriodId: period.id };
  if (input.documentTypeIds?.length) entryWhere.documentTypeId = { in: input.documentTypeIds };
  const mode = input.docMode ?? "ALL";
  if (mode === "INCLUDE") {
    if (!input.entryIds?.length) throw new Error("هیچ سندی انتخاب نشده است");
    entryWhere.id = { in: input.entryIds };
  } else if (mode === "EXCLUDE" && input.entryIds?.length) {
    entryWhere.id = { notIn: input.entryIds };
  }

  const accounts = await prisma.account.findMany({ select: { id: true, parentId: true, code: true, title: true, levelId: true } });
  const byId = buildAccountByIdMap(accounts as any);
  const accById = new Map(accounts.map((a: any) => [a.id, a]));
  const levelById = new Map(levels.map((l: any) => [l.id, l]));
  const needDetail = dims.some((d) => d[0] === "D");

  // فیلتر حساب: حساب یا یکی از اجدادش در مجموعه‌ی انتخابی باشد
  const accMode = input.accountMode ?? "ALL";
  const pickedAccounts = new Set(input.accountIds ?? []);
  if (accMode === "INCLUDE" && !pickedAccounts.size) throw new Error("هیچ حسابی انتخاب نشده است");
  const accountAllowed = new Map<number, boolean>();
  const isAllowed = (accId: number): boolean => {
    if (accMode === "ALL" || (accMode === "EXCLUDE" && !pickedAccounts.size)) return true;
    const cached = accountAllowed.get(accId);
    if (cached !== undefined) return cached;
    let hit = false;
    let cur: any = accById.get(accId);
    while (cur) {
      if (pickedAccounts.has(cur.id)) { hit = true; break; }
      cur = cur.parentId ? accById.get(cur.parentId) : undefined;
    }
    const ok = accMode === "INCLUDE" ? hit : !hit;
    accountAllowed.set(accId, ok);
    return ok;
  };

  const by: any[] = needDetail ? ["accountId", "detail1Code", "detail2Code", "detail3Code"] : ["accountId"];
  const sum = async (extra: any) =>
    prisma.journalEntryLine.groupBy({
      by,
      where: { journalEntry: { AND: [entryWhere, extra] } },
      _sum: { baseDebit: true, baseCredit: true },
    } as any) as Promise<any[]>;
  // سند افتتاحیه (نوع سند OPENING) همیشه در «مانده اول دوره» می‌آید، حتی اگر تاریخ آن داخل بازه‌ی گزارش باشد
  const isOpeningDoc = { documentType: { systemKey: "OPENING" } };
  const [openG, perG] = await Promise.all([
    sum({ OR: [{ date: { gte: period.fromDate, lt: from } }, { date: { gte: from, lte: to }, ...isOpeningDoc }] }),
    sum({ date: { gte: from, lte: to }, NOT: isOpeningDoc }),
  ]);

  // اجداد هر حساب در هر سطح
  const ancestorAt = (accId: number, levelOrderWanted: number): any | null => {
    let cur: any = accById.get(accId);
    while (cur) {
      const lv: any = levelById.get(cur.levelId);
      if (lv && lv.order === levelOrderWanted) return cur;
      cur = cur.parentId ? accById.get(cur.parentId) : undefined;
    }
    return null;
  };

  interface Acc { openD: number; openC: number; perD: number; perC: number }
  interface Node extends Acc { key: string; depth: number; code: string; title: string; dimTitle: string; children: Map<string, Node> }
  const root = new Map<string, Node>();
  const detailCodes = new Set<string>();
  const detailTitleOf = new Map<string, string>();

  const feed = (g: any, kind: "open" | "per") => {
    const d = Number(g._sum.baseDebit ?? 0);
    const c = Number(g._sum.baseCredit ?? 0);
    if (!d && !c) return;
    if (!isAllowed(g.accountId)) return;
    let level = root;
    const path: string[] = [];
    for (let i = 0; i < dims.length; i++) {
      const dim = dims[i];
      const n = Number(dim.slice(1));
      let keyPart: string;
      let code: string;
      let title: string;
      if (dim[0] === "L") {
        const a = ancestorAt(g.accountId, n);
        if (!a) {
          if (input.kind === "TRIAL") return; // تراز: فقط حساب‌های همان سطح (مثل مرور حسابها)
          keyPart = "-";
          code = "";
          title = "(بدون این سطح)";
        } else {
          keyPart = `a${a.id}`;
          code = computeFullAccountCode(a.id, byId);
          title = a.title;
        }
      } else {
        const v: string | null = g[`detail${n}Code`] ?? null;
        if (!v) {
          keyPart = "-";
          code = "";
          title = "(بدون تفصیل)";
        } else {
          keyPart = `d${v}`;
          code = v;
          title = "";
          detailCodes.add(v);
        }
      }
      path.push(keyPart);
      const fullKey = path.join("/");
      let node = level.get(keyPart);
      if (!node) {
        node = { key: fullKey, depth: i, code, title, dimTitle: dimTitles[i], children: new Map(), openD: 0, openC: 0, perD: 0, perC: 0 };
        level.set(keyPart, node);
      }
      if (kind === "open") { node.openD += d; node.openC += c; } else { node.perD += d; node.perC += c; }
      level = node.children;
    }
  };
  openG.forEach((g) => feed(g, "open"));
  perG.forEach((g) => feed(g, "per"));

  if (detailCodes.size) {
    const titles = await resolveDetailTitles(Array.from(detailCodes));
    for (const [k, v] of Object.entries(titles)) detailTitleOf.set(k, v);
  }

  const rows: BalanceRow[] = [];
  const totals = { openDebit: 0, openCredit: 0, periodDebit: 0, periodCredit: 0, remainDebit: 0, remainCredit: 0 };
  const sortNodes = (m: Map<string, Node>) =>
    Array.from(m.values()).sort((a, b) => (a.code || "~").localeCompare(b.code || "~", "en", { numeric: true }));

  // «دارای مانده»: خود گره مانده داشته باشد یا یکی از زیرمجموعه‌هایش (تا ردیف والد بدون فرزند نماند)
  const keepMemo = new Map<Node, boolean>();
  const keep = (n: Node): boolean => {
    const hit = keepMemo.get(n);
    if (hit !== undefined) return hit;
    const [rd, rc] = net(n.openD + n.perD, n.openC + n.perC);
    let ok = rd !== 0 || rc !== 0;
    if (!ok) for (const ch of n.children.values()) if (keep(ch)) { ok = true; break; }
    keepMemo.set(n, ok);
    return ok;
  };

  const emit = (m: Map<string, Node>) => {
    for (const n of sortNodes(m)) {
      if (input.onlyWithBalance && !keep(n)) continue;
      const [od, oc] = net(n.openD, n.openC);
      const [rd, rc] = net(n.openD + n.perD, n.openC + n.perC);
      const title = n.title || detailTitleOf.get(n.code) || n.code;
      rows.push({
        key: n.key,
        depth: n.depth,
        code: n.code,
        title,
        dimTitle: n.dimTitle,
        hasChildren: n.children.size > 0,
        openDebit: od,
        openCredit: oc,
        periodDebit: roundToCurrencyDecimals(n.perD, 2),
        periodCredit: roundToCurrencyDecimals(n.perC, 2),
        remainDebit: rd,
        remainCredit: rc,
      });
      if (n.depth === 0) {
        totals.openDebit += od;
        totals.openCredit += oc;
        totals.periodDebit += n.perD;
        totals.periodCredit += n.perC;
        totals.remainDebit += rd;
        totals.remainCredit += rc;
      }
      emit(n.children);
    }
  };
  emit(root);
  for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] = roundToCurrencyDecimals(totals[k], 2);

  return { rows, totals, dimTitles };
}

/** فهرست حساب‌ها (با کد کامل) برای گرید «حساب‌های انتخاب‌شده» */
export async function listAccountsForPicker() {
  const accounts = await prisma.account.findMany({
    select: { id: true, parentId: true, code: true, title: true, level: { select: { title: true, order: true } } },
  });
  const byId = buildAccountByIdMap(accounts as any);
  return accounts
    .map((a: any) => ({ id: a.id, code: computeFullAccountCode(a.id, byId), title: a.title, level: a.level?.title ?? "", levelOrder: a.level?.order ?? 0 }))
    .sort((x, y) => x.code.localeCompare(y.code, "en", { numeric: true }));
}

/** فهرست اسناد دوره مالی جاری برای گرید «اسناد انتخاب‌شده» */
export async function listEntriesForPicker(q: { fromDate?: string; toDate?: string; documentTypeIds?: number[] }) {
  const period = await getCurrentFiscalPeriod();
  if (!period) return [];
  const where: any = { fiscalPeriodId: period.id };
  if (q.fromDate || q.toDate) {
    where.date = {};
    if (q.fromDate) where.date.gte = new Date(q.fromDate);
    if (q.toDate) where.date.lte = new Date(q.toDate);
  }
  if (q.documentTypeIds?.length) where.documentTypeId = { in: q.documentTypeIds };
  const list = await prisma.journalEntry.findMany({
    where,
    orderBy: [{ date: "asc" }, { number: "asc" }],
    take: 20000,
    select: { id: true, number: true, referenceNumber: true, date: true, status: true, description: true, documentType: { select: { title: true } } },
  });
  return list.map((e: any) => ({
    id: e.id,
    number: e.number,
    referenceNumber: e.referenceNumber,
    date: e.date,
    status: e.status,
    description: e.description,
    documentType: e.documentType?.title ?? "",
  }));
}
