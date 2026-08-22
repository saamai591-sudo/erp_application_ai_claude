import { useEffect, useState } from "react";
import { DataTable } from "../components/DataTable";
import { InfoHint } from "../components/InfoHint";
import { RefreshButton } from "../components/RefreshButton";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";

// طبق مستند «موتور قیمت‌گذاری در حالت برگشت»: وقتی ردیفی که یک اجرای قیمت‌گذاری باید مقدارش را عوض
// کند، در دوره‌ای زودتر و قبلاً قیمت‌گذاری‌شده باشد، آن اصلاحیه مستقیم روی مبلغ سند نوشته نمی‌شود —
// این گزارش تنها جایی است که چنین اصلاحیه‌هایی («وضعیت: فقط گزارش») قابل مشاهده‌اند؛ اصلاحیه‌هایی که
// مستقیم روی سند نوشته شده‌اند («وضعیت: منعکس در سند») هم برای شفافیت کامل در همین لیست نمایش داده
// می‌شوند.

interface Correction {
  id: number;
  amount: number;
  appliedToLine: boolean;
  createdAt: string;
  goodsItemId: number;
  goodsItemTitle: string;
  reportingPeriodId: number;
  reportingPeriodTitle: string;
  documentType: string;
  documentTypeTitle: string;
  documentNumber: number;
  documentDate: string;
}

const INFO_TEXT =
  "اصلاحیه‌های ایجادشده توسط موتور قیمت‌گذاری برای سندهایی که مبلغشان به‌خاطر یک برگشت یا قیمت‌گذاری بعدی تغییر کرده است. اگر دوره‌ی سند از قبل قیمت‌گذاری/قفل شده باشد، مبلغ خود سند تغییر نمی‌کند و اصلاحیه فقط در همین گزارش دیده می‌شود (\"فقط گزارش\")؛ در غیر این صورت مبلغ سند هم مستقیماً به‌روزرسانی شده است (\"منعکس در سند\").";

export default function GoodsPricingCorrections() {
  const [items, setItems] = useState<Correction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    try {
      setItems(await api.get("/goods-pricing/corrections"));
      setError(null);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="اصلاحیه‌های قیمت‌گذاری" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      {!loading && (
        <DataTable
          columns={[
            { header: "کالا", render: (r) => r.goodsItemTitle, filterType: "string", filterValue: (r) => r.goodsItemTitle },
            { header: "دوره گزارشگری", render: (r) => r.reportingPeriodTitle, filterType: "string", filterValue: (r) => r.reportingPeriodTitle },
            { header: "نوع سند", render: (r) => r.documentTypeTitle, filterType: "string", filterValue: (r) => r.documentTypeTitle },
            { header: "شماره سند", render: (r) => toFaDigits(String(r.documentNumber)), width: "90px" },
            { header: "تاریخ سند", render: (r) => formatJalaliDate(r.documentDate), filterType: "date", filterValue: (r) => r.documentDate.slice(0, 10) },
            { header: "مبلغ اصلاحیه", render: (r) => formatAmountFa(r.amount) },
            {
              header: "وضعیت",
              render: (r) => <span className="badge">{r.appliedToLine ? "منعکس در سند" : "فقط گزارش"}</span>,
              filterType: "string",
              filterValue: (r) => (r.appliedToLine ? "منعکس در سند" : "فقط گزارش"),
            },
            { header: "تاریخ ثبت", render: (r) => formatJalaliDate(r.createdAt), filterType: "date", filterValue: (r) => r.createdAt.slice(0, 10) },
          ]}
          rows={items}
        />
      )}
    </div>
  );
}
