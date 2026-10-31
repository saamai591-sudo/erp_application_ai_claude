import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { RecordPickerField } from "../components/RecordPicker";
import { DescriptionField } from "../components/DescriptionField";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate, localTodayIso } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// باشگاه مشتریان › عملیات › «صدور بن‌کارت»: ساخت دسته‌ای سریال‌های یکتا و غیرقابل‌حدس (۱۰ رقم تصادفی + رقم کنترل) برای یک نوع بن.
// بن‌های تازه «ایجادشده»اند و بدهی نیستند؛ با «فروش بن‌کارت به سازمان» فروخته می‌شوند. فهرست و خروجی Excel سریال‌ها: «بن‌کارت‌ها».

interface BatchRow {
  id: number;
  number: number;
  date: string;
  typeId: number;
  typeTitle: string;
  faceValue: number;
  count: number;
  soldCount: number;
  usedCount: number;
  validUntil: string | null;
  description: string;
}
interface TypeOpt {
  id: number;
  code: number;
  title: string;
  faceValue: number;
  validityDays: number | null;
  isActive: boolean;
}

export default function VoucherBatches() {
  const location = useLocation();
  if (location.pathname.endsWith("/new")) return <BatchForm />;
  return <BatchList />;
}

function BatchList() {
  const cacheKey = "/voucher-batches";
  const [items, setItems] = usePersistedState<BatchRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/voucher-batches").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const s = (f: (r: BatchRow) => string, extra: object = {}) => ({ render: (r: BatchRow) => f(r), filterType: "string" as const, filterValue: (r: BatchRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="صدور بن‌کارت" text="هر دسته چند بن با سریال‌های یکتا می‌سازد. سریال‌ها را از «بن‌کارت‌ها» (فهرست + خروجی Excel) برای چاپ بارکد بردارید." />
          <NewRecordButton path="/voucher-batches/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره دسته", ...s((r) => toFaDigits(String(r.number))), width: "100px", filterType: "number", filterValue: (r: BatchRow) => r.number },
          { header: "تاریخ صدور", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10), width: "110px" },
          { header: "نوع بن", ...s((r) => r.typeTitle) },
          { header: "ارزش اسمی", render: (r) => formatAmountFa(r.faceValue), filterType: "number", filterValue: (r) => r.faceValue, decimal: true, width: "120px" },
          { header: "تعداد", ...s((r) => toFaDigits(String(r.count))), width: "80px" },
          { header: "فروخته‌شده", ...s((r) => toFaDigits(String(r.soldCount))), width: "100px" },
          { header: "مصرف‌شده", ...s((r) => toFaDigits(String(r.usedCount))), width: "100px" },
          { header: "انقضا", render: (r) => (r.validUntil ? formatJalaliDate(r.validUntil) : "—"), filterType: "date", filterValue: (r) => r.validUntil ?? "", width: "110px" },
          { header: "شرح", ...s((r) => r.description) },
        ]}
        rows={items}
      />
    </div>
  );
}

function BatchForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { typeId: "", count: "", date: localTodayIso(), validUntil: "", description: "" });
  const [types, setTypes] = useState<TypeOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/voucher-types").then((r: TypeOpt[]) => setTypes(r.filter((t) => t.isActive))).catch(() => {});
  }, []);
  void hasPersistedState;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.typeId) return setError("نوع بن را انتخاب کنید");
    if (!(Number(form.count) >= 1)) return setError("تعداد باید عدد صحیحِ مثبت باشد");
    if (busy) return;
    setBusy(true);
    try {
      await api.post("/voucher-batches", { typeId: Number(form.typeId), count: Number(form.count), date: form.date, validUntil: form.validUntil || null, description: form.description });
      flash();
      navigate("/vouchers");
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const type = types.find((t) => String(t.id) === form.typeId);
  return (
    <FormPage title="صدور بن‌کارت" formId="voucher-batch-form" closePath="/voucher-batches" newPath="/voucher-batches/new" saveDisabled={busy}>
      <form id="voucher-batch-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>نوع بن<RequiredMark /></label>
            <RecordPickerField<TypeOpt>
              title="انتخاب نوع بن"
              displayValue={type ? `${type.title} — ${formatAmountFa(type.faceValue)}` : ""}
              rows={types}
              columns={[
                { header: "کد", render: (x) => toFaDigits(String(x.code)), filterValue: (x) => String(x.code), width: "70px" },
                { header: "عنوان", render: (x) => x.title, filterValue: (x) => x.title },
                { header: "ارزش اسمی", render: (x) => formatAmountFa(x.faceValue), filterValue: (x) => String(x.faceValue), width: "130px" },
              ]}
              onSelect={(x) => setForm({ ...form, typeId: String(x.id) })}
            />
          </div>
          <div className="form-field">
            <label>تعداد<RequiredMark /> <FieldHint label="تعداد" text="حداکثر ۲۰٬۰۰۰ بن در هر دسته. سریال‌ها تصادفی و یکتایند." /></label>
            <input dir="ltr" inputMode="numeric" value={form.count} onChange={(e) => setForm({ ...form, count: e.target.value.replace(/[^\d]/g, "") })} autoFocus />
          </div>
          <div className="form-field">
            <label>تاریخ صدور<RequiredMark /></label>
            <JalaliDatePicker fiscalYear value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          </div>
          <div className="form-field">
            <label>تاریخ انقضا <FieldHint label="تاریخ انقضا" text="اختیاری؛ خالی = از مدت اعتبار نوع بن (از تاریخ صدور) محاسبه می‌شود." /></label>
            <JalaliDatePicker value={form.validUntil} onChange={(v) => setForm({ ...form, validUntil: v })} />
          </div>
          <DescriptionField value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        </div>
        {type && <p style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>ارزش کل این دسته: {formatAmountFa(type.faceValue * (Number(form.count) || 0))}</p>}
      </form>
    </FormPage>
  );
}
