import { Router } from "express";
import { getChequeReviewRows, ChequeKind, ChequeRow, CHEQUE_STATUS_TITLES } from "../services/chequeReviewService";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

// =========================================================================
// ماژول «مدیریت نقدینگی و چک» > گزارش > «مرور اسناد دریافتنی» و «مرور اسناد پرداختنی»
// (Documents/تغییرات نقدینگی و چک راه اندازی مرور اسناد دریافتی و پرداختی.md). هر گزارش سه تب دارد که زنجیره‌ای فیلتر می‌شوند:
//   وضعیت  → هر وضعیت چک (تعداد/مبلغ) — انتخاب وضعیت‌ها، تب «اسناد» را فیلتر می‌کند
//   اسناد  → فهرست چک‌ها (سند دریافتنی/پرداختنی) — انتخاب چک‌ها، تب «جزئیات» را فیلتر می‌کند
//   جزئیات → رویدادهای اسنادِ تاییدشده‌ی چرخه‌ی عمر چک‌های انتخاب‌شده
// منبع داده و تعریف بازه‌ی تاریخ: services/chequeReviewService.ts (بازه باید در یک دوره‌ی مالی باشد). همه‌ی مبالغ به ارز پایه است.
// =========================================================================

const FORMS: Record<ChequeKind, string> = {
  receivable: findFormPrefix("receivable-documents-review"),
  payable: findFormPrefix("payable-documents-review"),
};

const router = Router();

function parseQuery(q: any) {
  if (!q.fromDate || !q.toDate) throw new Error("بازه تاریخ الزامی است");
  const statuses = new Set<string>(String(q.statuses || "").split(",").filter(Boolean));
  const chequeIds = new Set<number>(String(q.chequeIds || "").split(",").map(Number).filter((n) => n > 0));
  return { fromDate: new Date(q.fromDate), toDate: new Date(q.toDate), statuses, chequeIds };
}

function stripEvents(r: ChequeRow) {
  const { events, ...rest } = r;
  return rest;
}

for (const kind of ["receivable", "payable"] as ChequeKind[]) {
  const FORM = FORMS[kind];

  router.get(`/cheque-review/${kind}/statuses`, can(`${FORM}.view`), async (req, res) => {
    try {
      const f = parseQuery(req.query);
      const rows = await getChequeReviewRows(kind, f.fromDate, f.toDate);
      const byStatus = new Map<string, { count: number; amount: number }>();
      for (const r of rows) {
        const b = byStatus.get(r.status) || { count: 0, amount: 0 };
        b.count += 1;
        b.amount += r.amount;
        byStatus.set(r.status, b);
      }
      res.json(
        Array.from(byStatus.entries()).map(([status, b]) => ({ id: status, status, title: CHEQUE_STATUS_TITLES[status] || status, count: b.count, amount: b.amount }))
      );
    } catch (e: any) {
      res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
    }
  });

  router.get(`/cheque-review/${kind}/cheques`, can(`${FORM}.view`), async (req, res) => {
    try {
      const f = parseQuery(req.query);
      const rows = (await getChequeReviewRows(kind, f.fromDate, f.toDate)).filter((r) => !f.statuses.size || f.statuses.has(r.status));
      res.json(rows.map(stripEvents));
    } catch (e: any) {
      res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
    }
  });

  router.get(`/cheque-review/${kind}/details`, can(`${FORM}.view`), async (req, res) => {
    try {
      const f = parseQuery(req.query);
      const rows = (await getChequeReviewRows(kind, f.fromDate, f.toDate)).filter(
        (r) => (!f.statuses.size || f.statuses.has(r.status)) && (!f.chequeIds.size || f.chequeIds.has(r.id))
      );
      const events = rows
        .flatMap((r) => r.events.map((e) => ({ ...e, chequeStatusTitle: r.statusTitle })))
        .sort((a, b) => a.date.getTime() - b.date.getTime() || a.chequeNumber.localeCompare(b.chequeNumber) || a.key.localeCompare(b.key))
        .map((e, i) => ({ ...e, id: i + 1 }));
      res.json(events);
    } catch (e: any) {
      res.status(400).json({ error: e.message || "خطا در دریافت گزارش" });
    }
  });
}

export default router;
