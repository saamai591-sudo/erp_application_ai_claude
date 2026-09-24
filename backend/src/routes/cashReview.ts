import { Router } from "express";
import { getCashMovements, loadCashBoxes, CashMovement, CashBoxMeta } from "../services/cashReviewService";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { applyServerFilterSort, ServerColumnDef } from "../utils/tableFilters";

// =========================================================================
// ماژول «خزانه‌داری» > گزارش > مرور صندوق — هم‌الگوی «مرور حساب بانکی» (routes/bankAccountReview.ts) با دو تب:
// «صندوق» (به‌ازای هر صندوق: مانده ابتدا / دریافت / پرداخت / مانده) و «گردش» (فهرست تخت گردش‌ها با مانده‌ی جاری،
// فیلتر/مرتب‌سازی/صفحه‌بندی سمت سرور). انتخاب ردیف‌های تب «صندوق» تب «گردش» را فیلتر می‌کند.
// منبع داده و تعریف «گردش صندوق»: services/cashReviewService.ts. همه‌ی مبالغ به ارز پایه است.
// =========================================================================

const FORM = findFormPrefix("cash-review");

const router = Router();

interface CommonQuery {
  fromDate?: string;
  toDate?: string;
  cashBoxIds?: string;
}

function parseFilters(q: CommonQuery) {
  if (!q.fromDate || !q.toDate) throw new Error("بازه تاریخ الزامی است");
  return {
    fromDate: new Date(q.fromDate),
    toDate: new Date(q.toDate),
    cashBoxIds: new Set((q.cashBoxIds || "").split(",").map(Number).filter((n) => !Number.isNaN(n) && n !== 0)),
  };
}

function applyFilters(movements: CashMovement[], boxes: Map<number, CashBoxMeta>, cashBoxIds: Set<number>) {
  return movements.filter((m) => boxes.has(m.cashBoxId) && (!cashBoxIds.size || cashBoxIds.has(m.cashBoxId)));
}

router.get("/cash-review/cash-boxes", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const [movements, boxes] = await Promise.all([getCashMovements(f.toDate), loadCashBoxes()]);
    const buckets = new Map<number, { opening: number; inflow: number; outflow: number }>();
    for (const m of applyFilters(movements, boxes, f.cashBoxIds)) {
      if (!buckets.has(m.cashBoxId)) buckets.set(m.cashBoxId, { opening: 0, inflow: 0, outflow: 0 });
      const b = buckets.get(m.cashBoxId)!;
      if (m.date < f.fromDate) b.opening += m.inflow - m.outflow;
      else if (m.date <= f.toDate) {
        b.inflow += m.inflow;
        b.outflow += m.outflow;
      }
    }
    const rows = Array.from(buckets.entries())
      .map(([id, b]) => {
        const box = boxes.get(id)!;
        return { id: String(id), cashBoxId: id, code: box.code, title: box.title, openingBalance: b.opening, inflow: b.inflow, outflow: b.outflow, closingBalance: b.opening + b.inflow - b.outflow };
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
  cashBoxCode: string;
  cashBoxTitle: string;
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
  cashBoxCode: { type: "string", get: (r) => r.cashBoxCode },
  cashBoxTitle: { type: "string", get: (r) => r.cashBoxTitle },
  partyDisplay: { type: "string", get: (r) => r.partyDisplay },
  description: { type: "string", get: (r) => r.description },
  inflow: { type: "number", get: (r) => r.inflow },
  outflow: { type: "number", get: (r) => r.outflow },
  balance: { type: "number", get: (r) => r.balance },
};

// «مانده‌ی جاری» از مانده‌ی ابتدای (فیلترشده‌ی) بازه شروع می‌شود و به ترتیب تاریخ/شماره روی همه‌ی ردیف‌های فیلترشده‌ی
// زنجیره جمع می‌شود — قبل از فیلتر/مرتب‌سازی ستونی، تا مقدار هر ردیف با مرتب‌سازی عوض نشود.
router.get("/cash-review/ledger", can(`${FORM}.view`), async (req, res) => {
  try {
    const f = parseFilters(req.query as CommonQuery);
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const pageSize = Math.min(1000, Math.max(1, parseInt((req.query.pageSize as string) || "100", 10)));

    const [movements, boxes] = await Promise.all([getCashMovements(f.toDate), loadCashBoxes()]);
    const filtered = applyFilters(movements, boxes, f.cashBoxIds);
    const opening = filtered.filter((m) => m.date < f.fromDate).reduce((s, m) => s + m.inflow - m.outflow, 0);
    const inRange = filtered
      .filter((m) => m.date >= f.fromDate && m.date <= f.toDate)
      .sort((a, b) => a.date.getTime() - b.date.getTime() || a.docNumber - b.docNumber || a.key.localeCompare(b.key));

    let running = opening;
    const rows: LedgerRow[] = inRange.map((m, i) => {
      running += m.inflow - m.outflow;
      const box = boxes.get(m.cashBoxId)!;
      return {
        id: i + 1,
        type: m.docType,
        docTypeCode: m.docTypeCode,
        documentId: m.docId,
        number: m.docNumber,
        date: m.date,
        cashBoxCode: box.code,
        cashBoxTitle: box.title,
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
