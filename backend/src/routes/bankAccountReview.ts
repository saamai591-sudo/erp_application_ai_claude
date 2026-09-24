import { Router } from "express";
import { getBankMovements, loadBankAccounts, BankMovement, BankAccountMeta } from "../services/bankAccountReviewService";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { applyServerFilterSort, ServerColumnDef } from "../utils/tableFilters";

// =========================================================================
// ماژول «خزانه‌داری» > گزارش > مرور حساب بانکی.
//
// هم‌فرمت سایر گزارش‌های «مرور» (مرور فروش/مرور مبلغی انبار: ChainedTabsBar + انتخاب چندگانه‌ی زنجیره‌ای، هدر
// «از تاریخ / تا تاریخ»): هر تب یک بُعد را جمع می‌زند — حساب بانکی، شعبه‌ی بانک، نوع حساب بانکی — با ستون‌های
// «مانده ابتدا / دریافت / پرداخت / مانده»؛ تب «اسناد» به‌ازای هر سند یک ردیف، و تب «گردش» فهرست تخت گردش‌های
// بانکی با «مانده‌ی جاری» (سمت سرور: فیلتر/مرتب‌سازی/صفحه‌بندی). منبع داده و تعریف «گردش بانکی»:
// services/bankAccountReviewService.ts. همه‌ی مبالغ به ارز پایه است.
// =========================================================================

const FORM = findFormPrefix("bank-account-review");

const router = Router();

interface CommonQuery {
  fromDate?: string;
  toDate?: string;
  bankAccountIds?: string;
  bankBranchIds?: string;
  accountTypeIds?: string;
  documentKeys?: string;
}

function parseIdList(s?: string): number[] {
  if (!s) return [];
  return s.split(",").map(Number).filter((n) => !Number.isNaN(n));
}

function parseFilters(q: CommonQuery) {
  if (!q.fromDate || !q.toDate) throw new Error("بازه تاریخ الزامی است");
  return {
    fromDate: new Date(q.fromDate),
    toDate: new Date(q.toDate),
    bankAccountIds: new Set(parseIdList(q.bankAccountIds)),
    bankBranchIds: new Set(parseIdList(q.bankBranchIds)),
    accountTypeIds: new Set(parseIdList(q.accountTypeIds)),
    documentKeys: new Set((q.documentKeys || "").split(",").filter(Boolean)),
  };
}

type Filters = ReturnType<typeof parseFilters>;

/** گردش‌ها را بر اساس فیلترهای زنجیره‌ای (حساب/شعبه/نوع حساب/سند) کم می‌کند؛ بازه‌ی تاریخ اینجا اعمال نمی‌شود. */
function applyDimFilters(movements: BankMovement[], accounts: Map<number, BankAccountMeta>, f: Filters, ignoreDocs = false) {
  return movements.filter((m) => {
    const a = accounts.get(m.bankAccountId);
    if (!a) return false;
    if (f.bankAccountIds.size && !f.bankAccountIds.has(a.id)) return false;
    if (f.bankBranchIds.size && !f.bankBranchIds.has(a.bankBranchId)) return false;
    if (f.accountTypeIds.size && !f.accountTypeIds.has(a.accountTypeId)) return false;
    if (!ignoreDocs && f.documentKeys.size && !f.documentKeys.has(m.docKey)) return false;
    return true;
  });
}

interface Bucket {
  opening: number;
  inflow: number;
  outflow: number;
  sample: BankAccountMeta;
}

function aggregate(
  movements: BankMovement[],
  accounts: Map<number, BankAccountMeta>,
  f: Filters,
  keyOf: (a: BankAccountMeta) => string,
  rowMeta: (a: BankAccountMeta) => Record<string, any>
) {
  const buckets = new Map<string, Bucket>();
  for (const m of movements) {
    const a = accounts.get(m.bankAccountId)!;
    const key = keyOf(a);
    if (!buckets.has(key)) buckets.set(key, { opening: 0, inflow: 0, outflow: 0, sample: a });
    const b = buckets.get(key)!;
    if (m.date < f.fromDate) b.opening += m.inflow - m.outflow;
    else if (m.date <= f.toDate) {
      b.inflow += m.inflow;
      b.outflow += m.outflow;
    }
  }
  return Array.from(buckets.entries())
    .map(([key, b]) => ({
      id: key,
      ...rowMeta(b.sample),
      openingBalance: b.opening,
      inflow: b.inflow,
      outflow: b.outflow,
      closingBalance: b.opening + b.inflow - b.outflow,
    }))
    .filter((r) => r.openingBalance !== 0 || r.inflow !== 0 || r.outflow !== 0);
}

async function dimensionRows(q: CommonQuery, keyOf: (a: BankAccountMeta) => string, rowMeta: (a: BankAccountMeta) => Record<string, any>) {
  const f = parseFilters(q);
  const [movements, accounts] = await Promise.all([getBankMovements(f.toDate, f.fromDate), loadBankAccounts()]);
  return aggregate(applyDimFilters(movements, accounts, f), accounts, f, keyOf, rowMeta);
}

router.get("/bank-account-review/bank-accounts", can(`${FORM}.view`), async (req, res) => {
  try {
    res.json(
      await dimensionRows(
        req.query as CommonQuery,
        (a) => String(a.id),
        (a) => ({ bankAccountId: a.id, code: a.code, title: `${a.accountNumber} — ${a.bankBranchTitle}` })
      )
    );
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

router.get("/bank-account-review/bank-branches", can(`${FORM}.view`), async (req, res) => {
  try {
    res.json(
      await dimensionRows(
        req.query as CommonQuery,
        (a) => String(a.bankBranchId),
        (a) => ({ bankBranchId: a.bankBranchId, code: a.bankBranchCode, title: a.bankBranchTitle })
      )
    );
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

router.get("/bank-account-review/account-types", can(`${FORM}.view`), async (req, res) => {
  try {
    res.json(
      await dimensionRows(
        req.query as CommonQuery,
        (a) => String(a.accountTypeId),
        (a) => ({ accountTypeId: a.accountTypeId, code: a.accountTypeCode, title: a.accountTypeTitle })
      )
    );
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

// تب «اسناد»: یک ردیف به‌ازای هر سند (دریافت/پرداخت/نتیجه‌ی وصول) که در بازه گردش بانکی دارد — مانده ندارد.
router.get("/bank-account-review/documents", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const [movements, accounts] = await Promise.all([getBankMovements(f.toDate, f.fromDate), loadBankAccounts()]);
    const docs = new Map<string, any>();
    for (const m of applyDimFilters(movements, accounts, f, true)) {
      if (m.date < f.fromDate || m.date > f.toDate) continue;
      if (!docs.has(m.docKey)) {
        docs.set(m.docKey, { id: m.docKey, docKey: m.docKey, docType: m.docType, docTypeCode: m.docTypeCode, documentId: m.docId, number: m.docNumber, date: m.date, partyDisplay: m.partyDisplay, inflow: 0, outflow: 0 });
      }
      const d = docs.get(m.docKey);
      d.inflow += m.inflow;
      d.outflow += m.outflow;
    }
    const rows = Array.from(docs.values()).map((d) => ({ ...d, net: d.inflow - d.outflow }));
    rows.sort((a, b) => a.date.getTime() - b.date.getTime() || a.number - b.number);
    res.json(rows);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

interface LedgerRow {
  id: number;
  type: string;
  docTypeCode: string;
  documentId: number;
  number: number;
  date: Date;
  bankAccountCode: string;
  bankAccountTitle: string;
  partyDisplay: string;
  description: string;
  inflow: number;
  outflow: number;
  balance: number;
}

const LEDGER_COLUMN_DEFS: Record<string, ServerColumnDef<LedgerRow>> = {
  type: { type: "string", get: (r) => r.type },
  number: { type: "number", get: (r) => r.number },
  date: { type: "date", get: (r) => r.date },
  bankAccountCode: { type: "string", get: (r) => r.bankAccountCode },
  bankAccountTitle: { type: "string", get: (r) => r.bankAccountTitle },
  partyDisplay: { type: "string", get: (r) => r.partyDisplay },
  description: { type: "string", get: (r) => r.description },
  inflow: { type: "number", get: (r) => r.inflow },
  outflow: { type: "number", get: (r) => r.outflow },
  balance: { type: "number", get: (r) => r.balance },
};

// «مانده‌ی جاری» از مانده‌ی ابتدای (فیلترشده‌ی) بازه شروع می‌شود و به ترتیب تاریخ/شماره روی همه‌ی ردیف‌های
// فیلترشده‌ی زنجیره جمع می‌شود — قبل از فیلتر/مرتب‌سازی ستونی، تا مقدار هر ردیف با مرتب‌سازی عوض نشود.
router.get("/bank-account-review/ledger", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const pageSize = Math.min(1000, Math.max(1, parseInt((req.query.pageSize as string) || "100", 10)));

    const [movements, accounts] = await Promise.all([getBankMovements(f.toDate, f.fromDate), loadBankAccounts()]);
    const filtered = applyDimFilters(movements, accounts, f);
    const opening = filtered.filter((m) => m.date < f.fromDate).reduce((s, m) => s + m.inflow - m.outflow, 0);
    const inRange = filtered.filter((m) => m.date >= f.fromDate && m.date <= f.toDate).sort((a, b) => a.date.getTime() - b.date.getTime() || a.docNumber - b.docNumber || a.key.localeCompare(b.key));

    let running = opening;
    const rows: LedgerRow[] = inRange.map((m, i) => {
      running += m.inflow - m.outflow;
      const a = accounts.get(m.bankAccountId)!;
      return {
        id: i + 1,
        type: m.docType,
        docTypeCode: m.docTypeCode,
        documentId: m.docId,
        number: m.docNumber,
        date: m.date,
        bankAccountCode: a.code,
        bankAccountTitle: `${a.accountNumber} — ${a.bankBranchTitle}`,
        partyDisplay: m.partyDisplay,
        description: m.description || "",
        inflow: m.inflow,
        outflow: m.outflow,
        balance: running,
      };
    });

    const filteredSorted = applyServerFilterSort(rows, LEDGER_COLUMN_DEFS, req.query.filters, req.query.sortField as string | undefined, req.query.sortDir as string | undefined);
    const total = filteredSorted.length;
    const start = (page - 1) * pageSize;
    res.json({ rows: filteredSorted.slice(start, start + pageSize), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), openingBalance: opening });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

export default router;
