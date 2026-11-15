import { ReactNode, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { InfoHint } from "../components/InfoHint";
import { toFaDigits, formatAmountFa } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { usePersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";
import { ORDER_STATUS_FA } from "./ProductionOrders";

// تولید › گزارش: بهای تمام‌شده (مرکز هزینه و دستور)، مصرف در برابر فرمول، برنامه در برابر انجام. فقط خواندنی؛ منبع: backend/src/routes/productionReports.ts

const fmt = (n: number) => formatAmountFa(String(Math.round(n * 100) / 100));
const KIND_FA: Record<string, string> = { CUSTOM: "سفارشی", STOCK: "انباری" };

function ReportShell<T>({ path, info, title, extra, columns, cacheKey }: { path: string; info: string; title: string; extra?: ReactNode; columns: any[]; cacheKey: string }) {
  const [range, setRange] = usePersistedState(`${cacheKey}:range`, { from: "", to: "" });
  const [rows, setRows] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (range.from) q.set("from", range.from);
      if (range.to) q.set("to", range.to);
      setRows(await api.get(`${path}?${q.toString()}`));
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="card ar-filters" style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap", padding: 10, marginBottom: 8 }}>
        <InfoHint text={info} title={title} />
        <div className="form-field">
          <label>از تاریخ</label>
          <JalaliDatePicker value={range.from} onChange={(v) => setRange({ ...range, from: v })} />
        </div>
        <div className="form-field">
          <label>تا تاریخ</label>
          <JalaliDatePicker value={range.to} onChange={(v) => setRange({ ...range, to: v })} />
        </div>
        <button type="button" className="btn" disabled={loading} onClick={load}>نمایش</button>
        {extra}
      </div>
      <ErrorToast message={error} />
      <DataTable columns={columns} rows={rows as any[]} />
    </div>
  );
}

export function ProductionOrderCostReport() {
  return (
    <ReportShell<any>
      cacheKey="/production-order-cost-report"
      path="/production-reports/cost-orders"
      title="گزارش بهای تمام‌شده به تفکیک دستور"
      info="بهای تمام‌شده منتسب به هر دستور تولید: آمار تولیدِ ثبت‌شده برای آن دستور ضرب در فی مرکز هزینه و کالای همان آمار. فقط آمارهایی که به دستور وصل شده‌اند در این گزارش می‌آیند."
      columns={[
        { header: "دوره", render: (r: any) => r.period, width: "110px", filterType: "string", filterValue: (r: any) => r.period },
        { header: "دستور", render: (r: any) => toFaDigits(String(r.orderNumber)), width: "80px", filterType: "number", filterValue: (r: any) => r.orderNumber },
        { header: "نوع", render: (r: any) => KIND_FA[r.kind] ?? r.kind, width: "80px", filterType: "string", filterValue: (r: any) => KIND_FA[r.kind] ?? r.kind },
        { header: "مشتری", render: (r: any) => r.customer, filterType: "string", filterValue: (r: any) => r.customer },
        { header: "کالا", render: (r: any) => r.itemTitle, filterType: "string", filterValue: (r: any) => r.itemTitle },
        { header: "تولید (آمار)", render: (r: any) => toFaDigits(String(r.finishedQty)), width: "100px", filterType: "number", filterValue: (r: any) => r.finishedQty },
        { header: "مواد", render: (r: any) => fmt(r.materialCost), filterType: "number", filterValue: (r: any) => r.materialCost },
        { header: "دستمزد و سربار", render: (r: any) => fmt(r.conversionCost), filterType: "number", filterValue: (r: any) => r.conversionCost },
        { header: "بهای کل", render: (r: any) => fmt(r.totalCost), filterType: "number", filterValue: (r: any) => r.totalCost },
        { header: "فی واحد", render: (r: any) => fmt(r.unitCost), filterType: "number", filterValue: (r: any) => r.unitCost },
      ]}
    />
  );
}

export function ProductionVarianceReport() {
  return (
    <ReportShell<any>
      cacheKey="/production-variance-report"
      path="/production-reports/variance"
      title="گزارش مصرف در برابر فرمول"
      info="به ازای هر مرکز هزینه و جزء: مقدار لازم (آمار تولید مرکز × فرمول ساخت فعال در تاریخ آمار) در برابر مصرف خالص (مصرف منهای برگشت مصرف) اسناد همان مرکز و مبلغ مصرف. مصرف کالایی که در فرمول کالاهای تولیدشده‌ی مرکز نبوده «خارج از فرمول» است."
      columns={[
        { header: "مرکز هزینه", render: (r: any) => r.costCenter, filterType: "string", filterValue: (r: any) => r.costCenter },
        { header: "کد جزء", render: (r: any) => toFaDigits(r.itemCode), width: "110px", filterType: "string", filterValue: (r: any) => r.itemCode },
        { header: "جزء", render: (r: any) => r.itemTitle, filterType: "string", filterValue: (r: any) => r.itemTitle },
        { header: "لازم", render: (r: any) => toFaDigits(String(r.plannedQty)), width: "100px", filterType: "number", filterValue: (r: any) => r.plannedQty },
        { header: "مصرف خالص", render: (r: any) => toFaDigits(String(r.usedQty)), width: "110px", filterType: "number", filterValue: (r: any) => r.usedQty },
        { header: "اختلاف", render: (r: any) => <span style={{ color: r.diffQty > 0 ? "var(--danger, #c0392b)" : undefined }}>{toFaDigits(String(Math.round(r.diffQty * 1e6) / 1e6))}</span>, width: "100px", filterType: "number", filterValue: (r: any) => r.diffQty },
        { header: "مبلغ مصرف", render: (r: any) => fmt(r.usedAmount), filterType: "number", filterValue: (r: any) => r.usedAmount },
        { header: "خارج از فرمول", render: (r: any) => (r.unplanned ? "بله" : ""), width: "100px", filterType: "string", filterValue: (r: any) => (r.unplanned ? "بله" : "") },
      ]}
    />
  );
}

export function ProductionPlanReport() {
  return (
    <ReportShell<any>
      cacheKey="/production-plan-report"
      path="/production-reports/plan"
      title="گزارش برنامه در برابر انجام"
      info="هر دستور تولید با مقدار برنامه‌ای، مقدار تولیدشده (رسیدهای تولید)، مانده و درصد پیشرفت. دستورِ باز که تاریخ پایان برنامه‌ایِ آن گذشته و هنوز کامل نشده «دارای تاخیر» است."
      columns={[
        { header: "شماره", render: (r: any) => toFaDigits(String(r.number)), width: "80px", filterType: "number", filterValue: (r: any) => r.number },
        { header: "تاریخ", render: (r: any) => formatJalaliDate(r.date), width: "110px", filterType: "string", filterValue: (r: any) => formatJalaliDate(r.date) },
        { header: "نوع", render: (r: any) => KIND_FA[r.kind] ?? r.kind, width: "80px", filterType: "string", filterValue: (r: any) => KIND_FA[r.kind] ?? r.kind },
        { header: "وضعیت", render: (r: any) => ORDER_STATUS_FA[r.status] ?? r.status, width: "100px", filterType: "string", filterValue: (r: any) => ORDER_STATUS_FA[r.status] ?? r.status },
        { header: "کالا", render: (r: any) => r.itemTitle, filterType: "string", filterValue: (r: any) => r.itemTitle },
        { header: "برنامه", render: (r: any) => toFaDigits(String(r.plannedQty)), width: "100px", filterType: "number", filterValue: (r: any) => r.plannedQty },
        { header: "تولیدشده", render: (r: any) => toFaDigits(String(r.producedQty)), width: "100px", filterType: "number", filterValue: (r: any) => r.producedQty },
        { header: "مانده", render: (r: any) => toFaDigits(String(r.remainingQty)), width: "100px", filterType: "number", filterValue: (r: any) => r.remainingQty },
        { header: "پیشرفت (٪)", render: (r: any) => toFaDigits(String(r.percent)), width: "100px", filterType: "number", filterValue: (r: any) => r.percent },
        { header: "شروع برنامه‌ای", render: (r: any) => (r.plannedStart ? formatJalaliDate(r.plannedStart) : ""), width: "120px", filterType: "string", filterValue: (r: any) => r.plannedStart ?? "" },
        { header: "پایان برنامه‌ای", render: (r: any) => (r.plannedEnd ? formatJalaliDate(r.plannedEnd) : ""), width: "120px", filterType: "string", filterValue: (r: any) => r.plannedEnd ?? "" },
        { header: "تاخیر", render: (r: any) => (r.late ? "دارد" : ""), width: "80px", filterType: "string", filterValue: (r: any) => (r.late ? "دارد" : "") },
      ]}
    />
  );
}
