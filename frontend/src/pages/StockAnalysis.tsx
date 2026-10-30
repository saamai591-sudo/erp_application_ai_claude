import { useCallback, useEffect, useState } from "react";
import { DataTable } from "../components/DataTable";
import { ErrorToast } from "../components/ErrorToast";
import { api } from "../lib/api";
import { formatAmountFa } from "../lib/formatAmount";

// «آنالیز موجودی» (وضعیت فعلی، سطح کالا): موجودی واقعی، در راه (مانده‌ی سفارش خرید تاییدشده)، تعهدشده (مانده‌ی حواله‌نشده‌ی سفارش فروش
// تاییدشده) و در دسترس = موجودی + در راه − تعهدشده. قواعد در backend/src/services/stockAnalysisService.ts؛ فقط نمایش، بدون کنترل سخت.

interface Row {
  id: number;
  code: string;
  title: string;
  unit: string;
  stock: number;
  inTransit: number;
  committed: number;
  available: number;
}

const num = (n: number) => (n < 0 ? `(${formatAmountFa(Math.abs(n))})` : formatAmountFa(n));

export default function StockAnalysis() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get("/stock-analysis");
      setRows(r.rows);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const numCol = (header: string, f: (r: Row) => number, extra: object = {}) => ({
    header,
    render: (r: Row) => <span style={f(r) < 0 ? { color: "#c0392b" } : undefined}>{num(f(r))}</span>,
    filterType: "number" as const,
    filterValue: f,
    exportValue: f,
    width: "130px",
    ...extra,
  });

  return (
    <div>
      <div className="page-head" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>آنالیز موجودی</h2>
        <button type="button" className="btn secondary" onClick={load} disabled={loading}>
          {loading ? "در حال بارگذاری…" : "به‌روزرسانی"}
        </button>
        <span style={{ fontSize: 12, opacity: 0.7 }}>وضعیت فعلی همه‌ی انبارها — در دسترس = موجودی + در راه − تعهدشده</span>
      </div>
      <ErrorToast message={error} />
      <DataTable<Row>
        columns={
          [
            { header: "کد کالا", render: (r: Row) => r.code, filterType: "string", filterValue: (r: Row) => r.code, width: "120px" },
            { header: "عنوان کالا", render: (r: Row) => r.title, filterType: "string", filterValue: (r: Row) => r.title },
            { header: "واحد سنجش", render: (r: Row) => r.unit, filterType: "string", filterValue: (r: Row) => r.unit, width: "100px" },
            numCol("موجودی", (r) => r.stock),
            numCol("موجودی در راه", (r) => r.inTransit),
            numCol("مقدار تعهدشده", (r) => r.committed),
            numCol("موجودی در دسترس", (r) => r.available),
          ] as any
        }
        rows={rows}
      />
    </div>
  );
}
