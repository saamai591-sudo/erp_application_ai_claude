import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { FormPage } from "../components/FormPage";
import { DataTable } from "../components/DataTable";
import { api } from "../lib/api";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { useTabs } from "../lib/TabsContext";

// نمای فقط‌خواندنیِ «حواله / برگشت حواله فروش فروشگاهی» (مدیریت موجودی و انبار): این اسناد سیستمی‌اند و فقط با «تایید» / «لغو تایید» تحویل فروش ساخته و حذف می‌شوند؛
// ذخیره و حذف ندارند. قیمت‌گذاری، تایید انبار و سند حسابداری انبار از فرم‌های مشترک انبار انجام می‌شود.

interface Detail {
  id: number;
  number: number;
  date: string;
  warehouseTitle: string;
  fiscalPeriodTitle: string;
  status: string;
  description: string;
  counterpartCode: string;
  counterpartTitle: string;
  deliveryId: number | null;
  deliveryNumber: number | null;
  stationTitle: string;
  lines: { id: number; goodsItemCode: string; goodsItemTitle: string; unitTitle: string; quantity: number }[];
}
const STATUS_FA: Record<string, string> = { REGISTERED: "ثبت", FINALIZED: "تایید انبار" };

export default function StoreSaleIssueView({ kind }: { kind: "ISSUE" | "RETURN" }) {
  const { id } = useParams();
  const { openTab } = useTabs();
  const base = kind === "ISSUE" ? "/store-sale-issues" : "/store-sale-returns";
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get(`${base}/${id}`).then(setD).catch((e) => setError(e.message));
  }, [base, id]);

  return (
    <FormPage title={`${kind === "ISSUE" ? "حواله" : "برگشت حواله"} فروش فروشگاهی${d ? ` شماره ${toFaDigits(String(d.number))}` : ""}`} closePath={base} saveDisabled wide>
      <ErrorToast message={error} />
      {d && (
        <>
          <div className="alert" style={{ marginBottom: 10 }}>این سند سیستمی است و با «تایید» تحویل فروش ساخته شده؛ ویرایش و حذف ندارد (برای حذف، تحویل فروش را «لغو تایید» کنید).</div>
          <fieldset disabled style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="je-header-grid" style={{ marginBottom: 16, maxWidth: 900 }}>
              <div className="form-field"><label>شماره</label><input dir="ltr" value={toFaDigits(String(d.number))} disabled /></div>
              <div className="form-field"><label>تاریخ</label><input value={formatJalaliDate(d.date)} disabled /></div>
              <div className="form-field"><label>انبار</label><input value={d.warehouseTitle} disabled /></div>
              <div className="form-field"><label>طرف مقابل (مرکز هزینه)</label><input value={d.counterpartTitle ? `${toFaDigits(d.counterpartCode)} — ${d.counterpartTitle}` : "—"} disabled /></div>
              <div className="form-field"><label>ایستگاه فروش</label><input value={d.stationTitle} disabled /></div>
              <div className="form-field">
                <label>تحویل فروش</label>
                <div>
                  {d.deliveryId ? (
                    <button type="button" className="btn-link" onClick={() => openTab(`/store-deliveries/${d.deliveryId}/edit`)}>
                      تحویل فروش شماره {toFaDigits(String(d.deliveryNumber))}
                    </button>
                  ) : "—"}
                </div>
              </div>
              <div className="form-field"><label>وضعیت</label><div><span className="badge">{STATUS_FA[d.status] ?? d.status}</span></div></div>
              <div className="form-field full"><label>شرح</label><input value={d.description} disabled /></div>
            </div>
          </fieldset>
          <DataTable
            columns={[
              { header: "کد کالا", render: (r: Detail["lines"][number]) => toFaDigits(r.goodsItemCode), filterType: "string", filterValue: (r: Detail["lines"][number]) => r.goodsItemCode, width: "130px" },
              { header: "کالا", render: (r: Detail["lines"][number]) => r.goodsItemTitle, filterType: "string", filterValue: (r: Detail["lines"][number]) => r.goodsItemTitle },
              { header: "واحد", render: (r: Detail["lines"][number]) => r.unitTitle, filterType: "string", filterValue: (r: Detail["lines"][number]) => r.unitTitle, width: "100px" },
              { header: "مقدار", render: (r: Detail["lines"][number]) => formatAmountFa(r.quantity), filterType: "number", filterValue: (r: Detail["lines"][number]) => r.quantity, decimal: true, width: "120px" },
            ] as any}
            rows={d.lines}
          />
        </>
      )}
    </FormPage>
  );
}
