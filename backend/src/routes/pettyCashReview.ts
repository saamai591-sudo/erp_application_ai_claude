import { Router } from "express";
import { getPettyCashMovements, loadPettyCashes, loadCustodians, PettyCashMovement, PettyCashMeta, CustodianMeta } from "../services/pettyCashReviewService";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { applyServerFilterSort, ServerColumnDef } from "../utils/tableFilters";

// =========================================================================
// ماژول «خزانه‌داری» > گزارش > مرور تنخواه — هم‌الگوی «مرور صندوق» (routes/cashReview.ts) با سه تب:
// «تنخواه» (به‌ازای هر تنخواه: مانده ابتدا / شارژ / پرداخت / مانده)، «تنخواه‌دار» (همان ستون‌ها به‌ازای هر تنخواه‌دار) و «گردش»
// (فهرست تخت گردش‌ها با مانده‌ی جاری، فیلتر/مرتب‌سازی/صفحه‌بندی سمت سرور). انتخاب ردیف‌های تب «تنخواه» تب‌های بعدی را (تنخواه‌دارهای
// همان تنخواه‌ها) و انتخاب ردیف‌های تب «تنخواه‌دار» تب «گردش» را فیلتر می‌کند. منبع داده و تعریف «گردش»: services/pettyCashReviewService.ts.
// مبالغ به ارز خودِ تنخواه است (نه ارز پایه).
// =========================================================================

const FORM = findFormPrefix("petty-cash-review");

const router = Router();

interface CommonQuery {
  fromDate?: string;
  toDate?: string;
  pettyCashIds?: string;
  custodianIds?: string;
}

function idSet(raw?: string) {
  return new Set((raw || "").split(",").map(Number).filter((n) => !Number.isNaN(n) && n !== 0));
}

function parseFilters(q: CommonQuery) {
  if (!q.fromDate || !q.toDate) throw new Error("بازه تاریخ الزامی است");
  return { fromDate: new Date(q.fromDate), toDate: new Date(q.toDate), pettyCashIds: idSet(q.pettyCashIds), custodianIds: idSet(q.custodianIds) };
}

function applyFilters(movements: PettyCashMovement[], pettyCashes: Map<number, PettyCashMeta>, custodians: Map<number, CustodianMeta>, f: { pettyCashIds: Set<number>; custodianIds: Set<number> }) {
  return movements.filter(
    (m) =>
      pettyCashes.has(m.pettyCashId) &&
      // گردش «افتتاحیه» (custodianId = 0) مال خودِ تنخواه است: فقط وقتی فیلتر تنخواه‌دار نیست دیده می‌شود
      (m.custodianId === 0 ? !f.custodianIds.size : custodians.has(m.custodianId)) &&
      (!f.pettyCashIds.size || f.pettyCashIds.has(m.pettyCashId)) &&
      (!f.custodianIds.size || f.custodianIds.has(m.custodianId))
  );
}

/** مانده‌ی ابتدا / شارژ / پرداخت / مانده‌ی هر گروه (تنخواه یا تنخواه‌دار) */
function bucketize(movements: PettyCashMovement[], keyOf: (m: PettyCashMovement) => number, fromDate: Date, toDate: Date) {
  const buckets = new Map<number, { opening: number; inflow: number; outflow: number }>();
  for (const m of movements) {
    const k = keyOf(m);
    if (!buckets.has(k)) buckets.set(k, { opening: 0, inflow: 0, outflow: 0 });
    const b = buckets.get(k)!;
    if (m.date < fromDate) b.opening += m.inflow - m.outflow;
    else if (m.date <= toDate) {
      b.inflow += m.inflow;
      b.outflow += m.outflow;
    }
  }
  return buckets;
}

router.get("/petty-cash-review/petty-cashes", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const [movements, pettyCashes, custodians] = await Promise.all([getPettyCashMovements(f.toDate), loadPettyCashes(), loadCustodians()]);
    const buckets = bucketize(applyFilters(movements, pettyCashes, custodians, { pettyCashIds: f.pettyCashIds, custodianIds: new Set() }), (m) => m.pettyCashId, f.fromDate, f.toDate);
    const rows = Array.from(buckets.entries())
      .map(([id, b]) => {
        const p = pettyCashes.get(id)!;
        return { id: String(id), pettyCashId: id, code: p.code, title: p.title, currencyTitle: p.currencyTitle, openingBalance: b.opening, inflow: b.inflow, outflow: b.outflow, closingBalance: b.opening + b.inflow - b.outflow };
      })
      .filter((r) => r.openingBalance !== 0 || r.inflow !== 0 || r.outflow !== 0);
    res.json(rows);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

router.get("/petty-cash-review/custodians", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const [movements, pettyCashes, custodians] = await Promise.all([getPettyCashMovements(f.toDate), loadPettyCashes(), loadCustodians()]);
    const buckets = bucketize(applyFilters(movements, pettyCashes, custodians, { pettyCashIds: f.pettyCashIds, custodianIds: new Set() }), (m) => m.custodianId, f.fromDate, f.toDate);
    buckets.delete(0); // تب «تنخواه‌دار»: افتتاحیه‌ی تنخواه به هیچ تنخواه‌داری تعلق ندارد
    const rows = Array.from(buckets.entries())
      .map(([id, b]) => {
        const c = custodians.get(id)!;
        const p = pettyCashes.get(c.pettyCashId)!;
        return {
          id: String(id),
          custodianId: id,
          code: c.code,
          title: c.title,
          pettyCashTitle: p.title,
          currencyTitle: p.currencyTitle,
          openingBalance: b.opening,
          inflow: b.inflow,
          outflow: b.outflow,
          closingBalance: b.opening + b.inflow - b.outflow,
        };
      })
      .filter((r) => r.openingBalance !== 0 || r.inflow !== 0 || r.outflow !== 0);
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
  pettyCashCode: string;
  pettyCashTitle: string;
  custodianCode: string;
  custodianTitle: string;
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
  pettyCashCode: { type: "string", get: (r) => r.pettyCashCode },
  pettyCashTitle: { type: "string", get: (r) => r.pettyCashTitle },
  custodianCode: { type: "string", get: (r) => r.custodianCode },
  custodianTitle: { type: "string", get: (r) => r.custodianTitle },
  partyDisplay: { type: "string", get: (r) => r.partyDisplay },
  description: { type: "string", get: (r) => r.description },
  inflow: { type: "number", get: (r) => r.inflow },
  outflow: { type: "number", get: (r) => r.outflow },
  balance: { type: "number", get: (r) => r.balance },
};

// «مانده‌ی جاری» از مانده‌ی ابتدای (فیلترشده‌ی) بازه شروع می‌شود و به ترتیب تاریخ (در تاریخ برابر: شارژ قبل از پرداخت، مثل
// کنترل مانده‌ی منفی — services/pettyCashBalanceService.ts) روی همه‌ی ردیف‌های فیلترشده‌ی زنجیره جمع می‌شود — قبل از
// فیلتر/مرتب‌سازی ستونی، تا مقدار هر ردیف با مرتب‌سازی عوض نشود.
router.get("/petty-cash-review/ledger", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const pageSize = Math.min(1000, Math.max(1, parseInt((req.query.pageSize as string) || "100", 10)));

    const [movements, pettyCashes, custodians] = await Promise.all([getPettyCashMovements(f.toDate), loadPettyCashes(), loadCustodians()]);
    const filtered = applyFilters(movements, pettyCashes, custodians, f);
    const opening = filtered.filter((m) => m.date < f.fromDate).reduce((s, m) => s + m.inflow - m.outflow, 0);
    const inRange = filtered
      .filter((m) => m.date >= f.fromDate && m.date <= f.toDate)
      .sort((a, b) => a.date.getTime() - b.date.getTime() || b.inflow - a.inflow || a.docNumber - b.docNumber || a.key.localeCompare(b.key));

    let running = opening;
    const rows: LedgerRow[] = inRange.map((m, i) => {
      running += m.inflow - m.outflow;
      const p = pettyCashes.get(m.pettyCashId)!;
      const c = custodians.get(m.custodianId);
      return {
        id: i + 1,
        type: m.docType,
        docTypeCode: m.docTypeCode,
        documentId: m.docId,
        number: m.docNumber,
        date: m.date,
        pettyCashCode: p.code,
        pettyCashTitle: p.title,
        custodianCode: c?.code || "",
        custodianTitle: c?.title || "",
        partyDisplay: m.partyDisplay,
        description: m.description || "",
        inflow: m.inflow,
        outflow: m.outflow,
        balance: running,
      };
    });

    const filteredSorted = applyServerFilterSort(rows, LEDGER_COLUMN_DEFS, req.query.filters, req.query.sortField as string | undefined, req.query.sortDir as string | undefined, req.query.sorts);
    const total = filteredSorted.length;
    const start = (page - 1) * pageSize;
    res.json({ rows: filteredSorted.slice(start, start + pageSize), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), openingBalance: opening });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
  }
});

export default router;
