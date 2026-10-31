import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { AmountInput } from "../components/AmountInput";
import { RecordPickerField } from "../components/RecordPicker";
import { DescriptionField } from "../components/DescriptionField";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate, localTodayIso } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// فروش فروشگاهی › عملیات › «پرداخت فروشگاهی»: بازپرداخت پول به مشتری بابت یک «برگشت فروش» — نقد از صندوق ایستگاه یا حواله از حساب‌های بانکیِ تعریف‌شده برای ایستگاه.
// جمع پرداخت‌های هر برگشت از «قابل پرداخت» آن بیشتر نمی‌شود؛ اثر حسابداری با «تحویل فروش» بعدی می‌آید. قواعد در سرور (services/storeReturnService.ts).

interface PayRow {
  id: number;
  number: number;
  date: string;
  returnId: number;
  returnNumber: number | null;
  saleNumber: number | null;
  customerTitle: string;
  stationTitle: string;
  method: "CASH" | "TRANSFER";
  cashBoxTitle: string;
  bankAccountId: number | null;
  bankAccountTitle: string;
  referenceNumber: string;
  amount: number;
  description: string;
  deliveryId: number | null;
  updatedAt?: string;
}
interface RetOpt {
  id: number;
  number: number;
  date: string;
  saleNumber: number | null;
  customerTitle: string;
  payable: number;
  paid: number;
  remaining: number;
}

export default function StorePayments() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <PaymentForm />;
  if (location.pathname.endsWith("/edit")) return <PaymentForm editId={Number(id)} />;
  return <PaymentList />;
}

function PaymentList() {
  const cacheKey = "/store-payments";
  const [items, setItems] = usePersistedState<PayRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/store-payments").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: PayRow) {
    try {
      await api.del(`/store-payments/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: PayRow) => string, extra: object = {}) => ({ render: (r: PayRow) => f(r), filterType: "string" as const, filterValue: (r: PayRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="پرداخت فروشگاهی" text="بازپرداخت پول به مشتری بابت برگشت فروش (نقد از صندوق ایستگاه یا حواله از حساب بانکیِ ایستگاه). جمع پرداخت‌های هر برگشت از مبلغ قابل پرداخت آن بیشتر نمی‌شود؛ اثر حسابداری با تحویل فروش بعدی می‌آید." />
          <NewRecordButton path="/store-payments/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", ...s((r) => toFaDigits(String(r.number))), width: "80px", filterType: "number", filterValue: (r: PayRow) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10), width: "110px" },
          { header: "شماره برگشت", ...s((r) => toFaDigits(String(r.returnNumber ?? ""))), width: "100px" },
          { header: "از فروش شماره", ...s((r) => toFaDigits(String(r.saleNumber ?? ""))), width: "100px" },
          { header: "مشتری", ...s((r) => r.customerTitle) },
          { header: "روش", ...s((r) => (r.method === "TRANSFER" ? "حواله" : "نقد")), width: "80px" },
          { header: "صندوق / حساب بانکی", ...s((r) => (r.method === "TRANSFER" ? r.bankAccountTitle : r.cashBoxTitle)) },
          { header: "مبلغ", render: (r) => formatAmountFa(r.amount), filterType: "number", filterValue: (r) => r.amount, decimal: true, width: "130px" },
          { header: "تحویل فروش", ...s((r) => (r.deliveryId ? "تحویل‌شده" : "")), width: "100px" },
          { header: "شرح", ...s((r) => r.description) },
        ]}
        rows={items}
        edit={{ path: (r: PayRow) => `/store-payments/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function PaymentForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [qs] = useSearchParams();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { returnId: qs.get("returnId") ?? "", date: localTodayIso(), method: "CASH", bankAccountId: "", amount: "", referenceNumber: "", description: "" });
  const [meta, setMeta] = useState<{ number: number | null; updatedAt?: string; deliveryId: number | null }>({ number: null, deliveryId: null });
  const [returns, setReturns] = useState<RetOpt[]>([]);
  const [options, setOptions] = useState<{ cashBoxTitle: string; bankAccounts: { id: number; title: string }[] }>({ cashBoxTitle: "", bankAccounts: [] });
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();
  const locked = !!meta.deliveryId;

  function loadExisting() {
    api.get(`/store-payments/${editId}`).then((r: PayRow) => {
      setMeta({ number: r.number, updatedAt: r.updatedAt, deliveryId: r.deliveryId });
      if (!hasPersistedState(cacheKey)) setForm({ returnId: String(r.returnId), date: r.date, method: r.method, bankAccountId: r.bankAccountId ? String(r.bankAccountId) : "", amount: String(r.amount), referenceNumber: r.referenceNumber, description: r.description });
      setLoaded(true);
    }).catch((e) => setError(e.message));
  }

  useEffect(() => {
    api.get(`/store-payments/payable-returns${editId && form.returnId ? `?returnId=${form.returnId}` : ""}`)
      .then((rows: RetOpt[]) => {
        setReturns(rows);
        const pre = !editId && qs.get("returnId") ? rows.find((x) => String(x.id) === qs.get("returnId")) : undefined;
        if (pre && !hasPersistedState(cacheKey)) setForm((f) => ({ ...f, returnId: String(pre.id), amount: String(pre.remaining), date: f.date < pre.date ? pre.date : f.date }));
      })
      .catch(() => {});
    if (editId) loadExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  useEffect(() => {
    if (!form.returnId) return;
    api.get(`/store-payments/options?returnId=${form.returnId}`).then(setOptions).catch(() => {});
  }, [form.returnId]);

  const ret = returns.find((x) => String(x.id) === form.returnId);
  function pickReturn(x: RetOpt) {
    setForm({ ...form, returnId: String(x.id), amount: editId ? form.amount : String(x.remaining), date: form.date < x.date ? x.date : form.date });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.returnId) return setError("برگشت فروش را انتخاب کنید");
    if (!form.date) return setError("تاریخ الزامی است");
    if (!(Number(form.amount) > 0)) return setError("مبلغ باید عددی بزرگ‌تر از صفر باشد");
    if (form.method === "TRANSFER" && !form.bankAccountId) return setError("حساب بانکی را انتخاب کنید");
    const body = {
      returnId: Number(form.returnId),
      date: form.date,
      amount: Number(form.amount),
      description: form.description,
      bankAccountId: form.method === "TRANSFER" ? Number(form.bankAccountId) : null,
      referenceNumber: form.referenceNumber,
      updatedAt: meta.updatedAt,
    };
    try {
      if (editId) {
        await api.put(`/store-payments/${editId}`, body);
        flash();
        loadExisting();
      } else {
        const created = await api.post("/store-payments", body);
        flash();
        navigate(`/store-payments/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/store-payments/${editId}`);
      navigate("/store-payments");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  return (
    <FormPage title={editId ? `پرداخت فروشگاهی شماره ${toFaDigits(String(meta.number ?? ""))}` : "پرداخت فروشگاهی جدید"} formId="store-payment-form" closePath="/store-payments" newPath="/store-payments/new" onDelete={editId && !locked ? handleDelete : undefined} saveDisabled={locked}>
      <form id="store-payment-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {locked && <div className="alert warn" style={{ marginBottom: 8 }}>این پرداخت در «تحویل فروش» بسته شده و قابل ویرایش یا حذف نیست.</div>}
        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid">
            <div className="form-field">
              <label>برگشت فروش<RequiredMark /> <FieldHint label="برگشت فروش" text="فقط برگشت‌هایی که هنوز باقی‌مانده‌ی پرداخت دارند. بعد از ثبت، برگشتِ یک پرداخت قابل تغییر نیست." /></label>
              <RecordPickerField<RetOpt>
                title="انتخاب برگشت فروش"
                disabled={!!editId}
                displayValue={ret ? `${toFaDigits(String(ret.number))} — ${ret.customerTitle}` : form.returnId ? `برگشت ${toFaDigits(form.returnId)}` : ""}
                rows={returns}
                columns={[
                  { header: "شماره", render: (x) => toFaDigits(String(x.number)), filterValue: (x) => String(x.number), width: "80px" },
                  { header: "تاریخ", render: (x) => formatJalaliDate(x.date), filterValue: (x) => x.date, width: "100px" },
                  { header: "از فروش", render: (x) => toFaDigits(String(x.saleNumber ?? "")), filterValue: (x) => String(x.saleNumber ?? ""), width: "80px" },
                  { header: "مشتری", render: (x) => x.customerTitle, filterValue: (x) => x.customerTitle },
                  { header: "قابل پرداخت", render: (x) => formatAmountFa(x.payable), filterValue: (x) => String(x.payable), width: "110px" },
                  { header: "باقی‌مانده", render: (x) => formatAmountFa(x.remaining), filterValue: (x) => String(x.remaining), width: "110px" },
                ]}
                onSelect={pickReturn}
              />
            </div>
            <div className="form-field">
              <label>تاریخ<RequiredMark /></label>
              <JalaliDatePicker fiscalYear value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            </div>
            <div className="form-field">
              <label>روش پرداخت</label>
              <select value={form.method} disabled={!!editId} onChange={(e) => setForm({ ...form, method: e.target.value, bankAccountId: "" })}>
                <option value="CASH">نقد — {options.cashBoxTitle || "صندوق ایستگاه فروش"}</option>
                <option value="TRANSFER" disabled={options.bankAccounts.length === 0}>حواله{options.bankAccounts.length === 0 ? " (حسابی برای ایستگاه تعریف نشده)" : ""}</option>
              </select>
            </div>
            {form.method === "TRANSFER" && (
              <>
                <div className="form-field">
                  <label>حساب بانکی<RequiredMark /></label>
                  <select value={form.bankAccountId} disabled={!!editId} onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}>
                    <option value="">انتخاب کنید</option>
                    {options.bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>شماره پیگیری</label>
                  <input dir="ltr" value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} />
                </div>
              </>
            )}
            <div className="form-field">
              <label>مبلغ<RequiredMark /></label>
              <AmountInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} allowDecimal />
            </div>
            {ret && !editId && (
              <div className="form-field">
                <label>باقی‌مانده‌ی برگشت</label>
                <input disabled value={formatAmountFa(ret.remaining)} />
              </div>
            )}
            <DescriptionField value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          </div>
        </fieldset>
      </form>
    </FormPage>
  );
}
