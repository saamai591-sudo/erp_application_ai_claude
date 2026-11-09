import { useCallback, useEffect, useState } from "react";
import { DataTable } from "../components/DataTable";
import { ErrorToast } from "../components/ErrorToast";
import { Modal } from "../components/Modal";
import { api } from "../lib/api";
import { formatAmountFa } from "../lib/formatAmount";
import { formatDisplayDate } from "../lib/formatDate";
import { useTabs } from "../lib/TabsContext";

// «آنالیز موجودی» (وضعیت فعلی، سطح کالا): موجودی واقعی، در راه (مانده‌ی سفارش خرید تاییدشده)، تعهدشده (مانده‌ی حواله‌نشده‌ی سفارش فروش
// تاییدشده) و در دسترس = موجودی + در راه − تعهدشده. قواعد در backend/src/services/stockAnalysisService.ts؛ فقط نمایش، بدون کنترل سخت.
// سلول‌های «در راه» و «تعهدشده» لینک‌اند: کلیک، ریز سفارش‌های مبنا را در مودال نشان می‌دهد (با امکان بازکردن سفارش).

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

type Kind = "committed" | "in-transit";

interface OrdersDetail {
  item: { code: string; title: string; unit: string };
  kind: Kind;
  canOpen: boolean;
  rows: { orderId: number; number: number; date: string; partyTitle: string; quantity: number; remaining: number }[];
}

const num = (n: number) => (n < 0 ? `(${formatAmountFa(Math.abs(n))})` : formatAmountFa(n));

const KIND_TEXT: Record<Kind, { title: string; party: string; path: string; orderLabel: string }> = {
  committed: { title: "سفارش‌های فروش مبنای مقدار تعهدشده", party: "مشتری", path: "/sales-orders", orderLabel: "سفارش فروش" },
  "in-transit": { title: "سفارش‌های خرید مبنای موجودی در راه", party: "تامین‌کننده", path: "/purchase-orders", orderLabel: "سفارش خرید" },
};

export default function StockAnalysis() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrdersDetail | null>(null);
  const { openTab } = useTabs();

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

  async function showOrders(itemId: number, kind: Kind) {
    setError(null);
    try {
      setDetail(await api.get(`/stock-analysis/${itemId}/${kind}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const numCol = (header: string, f: (r: Row) => number, extra: object = {}) => ({
    header,
    render: (r: Row) => <span style={f(r) < 0 ? { color: "#c0392b" } : undefined}>{num(f(r))}</span>,
    filterType: "number" as const,
    filterValue: f,
    exportValue: f,
    width: "130px",
    ...extra,
  });

  // سلول لینک‌شده: فقط وقتی مقدار صفر نیست قابل کلیک است
  const linkCol = (header: string, f: (r: Row) => number, kind: Kind) =>
    numCol(header, f, {
      render: (r: Row) =>
        f(r) === 0 ? (
          <span>{num(0)}</span>
        ) : (
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              showOrders(r.id, kind);
            }}
            style={{ textDecoration: "underline", cursor: "pointer" }}
            title="نمایش سفارش‌های مبنا"
          >
            {num(f(r))}
          </a>
        ),
    });

  const text = detail ? KIND_TEXT[detail.kind] : null;
  const totalRemaining = detail ? detail.rows.reduce((s, r) => s + r.remaining, 0) : 0;

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
            linkCol("موجودی در راه", (r) => r.inTransit, "in-transit"),
            linkCol("مقدار تعهدشده", (r) => r.committed, "committed"),
            numCol("موجودی در دسترس", (r) => r.available),
          ] as any
        }
        rows={rows}
      />
      {detail && text && (
        <Modal title={text.title} onClose={() => setDetail(null)}>
          <div style={{ marginBottom: 8, fontSize: 13 }}>
            کالا: {detail.item.code} — {detail.item.title} (واحد: {detail.item.unit})
          </div>
          <div style={{ maxHeight: "60vh", overflow: "auto" }}>
            <table className="data-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>شماره</th>
                  <th>تاریخ</th>
                  <th>{text.party}</th>
                  <th>مقدار</th>
                  <th>مانده</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {detail.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", opacity: 0.7 }}>
                      سفارشی یافت نشد
                    </td>
                  </tr>
                ) : (
                  detail.rows.map((o) => (
                    <tr key={o.orderId}>
                      <td>{formatAmountFa(o.number)}</td>
                      <td>{formatDisplayDate(o.date)}</td>
                      <td>{o.partyTitle}</td>
                      <td>{formatAmountFa(o.quantity)}</td>
                      <td>{formatAmountFa(o.remaining)}</td>
                      <td>
                        {detail.canOpen && (
                          <button type="button" className="btn secondary" style={{ padding: "3px 10px", fontSize: 12 }} onClick={() => openTab(`${text.path}/${o.orderId}/edit`)}>
                            باز کردن {text.orderLabel}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {detail.rows.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ textAlign: "end" }}>
                      جمع مانده
                    </td>
                    <td>{formatAmountFa(totalRemaining)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}
