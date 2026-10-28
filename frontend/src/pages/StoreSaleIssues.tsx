import { useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { api } from "../lib/api";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// فروش فروشگاهی › «حواله / برگشت حواله فروش فروشگاهی»: فهرست فقط‌خواندنیِ اسناد انبارِ ساخته‌شده با «تایید» تحویل فروش (با «لغو تایید» حذف می‌شوند).
// قیمت‌گذاری، تایید انبار و سند حسابداری انبار مثل هر حواله‌ی دیگر از فرم‌های مشترک انبار انجام می‌شود.

interface Row {
  id: number;
  number: number;
  date: string;
  warehouseTitle: string;
  status: string;
  lineCount: number;
  quantity: number;
  deliveryNumber: number | null;
  stationTitle: string;
  description: string;
}
const STATUS_FA: Record<string, string> = { REGISTERED: "ثبت", FINALIZED: "تایید انبار" };

export default function StoreSaleIssues({ kind }: { kind: "ISSUE" | "RETURN" }) {
  const path = kind === "ISSUE" ? "/store-sale-issues" : "/store-sale-returns";
  const [items, setItems] = usePersistedState<Row[]>(path, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get(path).then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(path)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const s = (f: (r: Row) => string, extra: object = {}) => ({ render: (r: Row) => f(r), filterType: "string" as const, filterValue: (r: Row) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title={kind === "ISSUE" ? "حواله فروش فروشگاهی" : "برگشت حواله فروش فروشگاهی"} text="این اسناد انبار خودکار با «تایید» تحویل فروش ساخته می‌شوند و با «لغو تایید» حذف می‌شوند؛ در این فهرست فقط دیده می‌شوند." />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", ...s((r) => toFaDigits(String(r.number))), width: "80px", filterType: "number", filterValue: (r: Row) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10), width: "110px" },
          { header: "انبار", ...s((r) => r.warehouseTitle) },
          { header: "ایستگاه فروش", ...s((r) => r.stationTitle) },
          { header: "تحویل فروش", ...s((r) => (r.deliveryNumber != null ? toFaDigits(String(r.deliveryNumber)) : "")), width: "100px" },
          { header: "وضعیت", ...s((r) => STATUS_FA[r.status] ?? r.status), width: "110px" },
          { header: "تعداد ردیف", render: (r) => formatAmountFa(r.lineCount), filterType: "number" as const, filterValue: (r: Row) => r.lineCount, width: "100px" },
          { header: "جمع مقدار", render: (r) => formatAmountFa(r.quantity), filterType: "number" as const, filterValue: (r: Row) => r.quantity, decimal: true, width: "110px" },
          { header: "شرح", ...s((r) => r.description) },
        ]}
        rows={items}
      />
    </div>
  );
}
