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

// فروش فروشگاهی › عملیات › «دریافت فروشگاهی»: فقط نقد، به صندوقِ ایستگاهِ فروش؛ هر دریافت به یک فروش وصل است، یک فروش چند دریافت می‌تواند داشته باشد و جمعشان از
// مبلغ قابل پرداخت (مبلغ + ارزش افزوده) بیشتر نمی‌شود. سند حسابداری ندارد. قواعد در سرور (services/storeReceiptService.ts).

interface RecRow {
  id: number;
  number: number;
  date: string;
  saleId: number;
  saleNumber: number | null;
  stationTitle: string;
  cashBoxTitle: string;
  customerTitle: string;
  amount: number;
  description: string;
  updatedAt?: string;
}
interface SaleOpt {
  id: number;
  number: number;
  date: string;
  stationTitle: string;
  customerTitle: string;
  payable: number;
  paid: number;
  remaining: number;
}

export default function StoreReceipts() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <ReceiptForm />;
  if (location.pathname.endsWith("/edit")) return <ReceiptForm editId={Number(id)} />;
  return <ReceiptList />;
}

function ReceiptList() {
  const cacheKey = "/store-receipts";
  const [items, setItems] = usePersistedState<RecRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/store-receipts").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: RecRow) {
    try {
      await api.del(`/store-receipts/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: RecRow) => string, extra: object = {}) => ({ render: (r: RecRow) => f(r), filterType: "string" as const, filterValue: (r: RecRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="دریافت فروشگاهی" text="دریافت نقدِ یک فروش فروشگاهی به صندوقِ ایستگاه. یک فروش می‌تواند چند دریافت داشته باشد؛ جمع دریافت‌ها از مبلغ قابل پرداخت فروش بیشتر نمی‌شود. سند حسابداری ندارد." />
          <NewRecordButton path="/store-receipts/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", ...s((r) => toFaDigits(String(r.number))), width: "80px", filterType: "number", filterValue: (r: RecRow) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10), width: "110px" },
          { header: "شماره فروش", ...s((r) => toFaDigits(String(r.saleNumber ?? ""))), width: "100px" },
          { header: "ایستگاه", ...s((r) => r.stationTitle) },
          { header: "مشتری", ...s((r) => r.customerTitle) },
          { header: "صندوق", ...s((r) => r.cashBoxTitle) },
          { header: "مبلغ", render: (r) => formatAmountFa(r.amount), filterType: "number", filterValue: (r) => r.amount, decimal: true, width: "130px" },
          { header: "شرح", ...s((r) => r.description) },
        ]}
        rows={items}
        edit={{ path: (r: RecRow) => `/store-receipts/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function ReceiptForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [qs] = useSearchParams();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { saleId: qs.get("saleId") ?? "", date: localTodayIso(), amount: "", description: "" });
  const [meta, setMeta] = useState<{ number: number | null; updatedAt?: string; cashBoxTitle: string }>({ number: null, cashBoxTitle: "" });
  const [sales, setSales] = useState<SaleOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    const sid = form.saleId || "";
    api.get(`/store-receipts/payable-sales${editId && sid ? `?saleId=${sid}` : ""}`)
      .then((rows: SaleOpt[]) => {
        setSales(rows);
        // بازشدن از لینکِ کارتِ دریافتِ فرم فروش (?saleId=): فروش انتخاب و مبلغ/تاریخ از همان پیش‌فرض می‌شود
        const pre = !editId && qs.get("saleId") ? rows.find((x) => String(x.id) === qs.get("saleId")) : undefined;
        if (pre && !hasPersistedState(cacheKey)) setForm((f) => ({ ...f, saleId: String(pre.id), amount: String(pre.remaining), date: f.date < pre.date ? pre.date : f.date }));
      })
      .catch(() => {});
    if (!editId) return;
    api.get(`/store-receipts/${editId}`).then((r: RecRow) => {
      setMeta({ number: r.number, updatedAt: r.updatedAt, cashBoxTitle: r.cashBoxTitle });
      if (!hasPersistedState(cacheKey)) setForm({ saleId: String(r.saleId), date: r.date, amount: String(r.amount), description: r.description });
      setLoaded(true);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const sale = sales.find((x) => String(x.id) === form.saleId);
  // مبلغ پیش‌فرض دریافتِ جدید = باقی‌مانده‌ی فروش انتخاب‌شده
  function pickSale(x: SaleOpt) {
    setForm({ ...form, saleId: String(x.id), amount: editId ? form.amount : String(x.remaining), date: form.date < x.date ? x.date : form.date });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.saleId) return setError("فروش را انتخاب کنید");
    if (!form.date) return setError("تاریخ الزامی است");
    if (!(Number(form.amount) > 0)) return setError("مبلغ باید عددی بزرگ‌تر از صفر باشد");
    const body = { saleId: Number(form.saleId), date: form.date, amount: Number(form.amount), description: form.description, updatedAt: meta.updatedAt };
    try {
      if (editId) {
        await api.put(`/store-receipts/${editId}`, body);
        flash();
        const r: RecRow = await api.get(`/store-receipts/${editId}`);
        setMeta({ number: r.number, updatedAt: r.updatedAt, cashBoxTitle: r.cashBoxTitle });
      } else {
        const created = await api.post("/store-receipts", body);
        flash();
        navigate(`/store-receipts/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/store-receipts/${editId}`);
      navigate("/store-receipts");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  return (
    <FormPage title={editId ? `دریافت فروشگاهی شماره ${toFaDigits(String(meta.number ?? ""))}` : "دریافت فروشگاهی جدید"} formId="store-receipt-form" closePath="/store-receipts" newPath="/store-receipts/new" onDelete={editId ? handleDelete : undefined}>
      <form id="store-receipt-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>فروش<RequiredMark /> <FieldHint label="فروش" text="فقط فروش‌هایی که هنوز باقی‌مانده‌ی دریافت دارند. بعد از ثبت، فروشِ یک دریافت قابل تغییر نیست." /></label>
            <RecordPickerField<SaleOpt>
              title="انتخاب فروش"
              disabled={!!editId}
              displayValue={sale ? `${toFaDigits(String(sale.number))} — ${sale.stationTitle}` : ""}
              rows={sales}
              columns={[
                { header: "شماره", render: (x) => toFaDigits(String(x.number)), filterValue: (x) => String(x.number), width: "80px" },
                { header: "تاریخ", render: (x) => formatJalaliDate(x.date), filterValue: (x) => x.date, width: "100px" },
                { header: "ایستگاه", render: (x) => x.stationTitle, filterValue: (x) => x.stationTitle },
                { header: "مشتری", render: (x) => x.customerTitle, filterValue: (x) => x.customerTitle },
                { header: "قابل پرداخت", render: (x) => formatAmountFa(x.payable), filterValue: (x) => String(x.payable), width: "110px" },
                { header: "باقی‌مانده", render: (x) => formatAmountFa(x.remaining), filterValue: (x) => String(x.remaining), width: "110px" },
              ]}
              onSelect={pickSale}
            />
          </div>
          <div className="form-field">
            <label>تاریخ<RequiredMark /></label>
            <JalaliDatePicker fiscalYear value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          </div>
          <div className="form-field">
            <label>مبلغ<RequiredMark /></label>
            <AmountInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} allowDecimal />
          </div>
          {sale && !editId && (
            <div className="form-field">
              <label>باقی‌مانده‌ی فروش</label>
              <input disabled value={formatAmountFa(sale.remaining)} />
            </div>
          )}
          <div className="form-field">
            <label>صندوق</label>
            <input disabled value={meta.cashBoxTitle || "صندوق ایستگاه فروش (خودکار)"} />
          </div>
          <DescriptionField value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        </div>
      </form>
    </FormPage>
  );
}
