import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { formatJalaliDate } from "../lib/formatDate";
import { AmountInput } from "../components/AmountInput";
import { formatAmountFa } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { Currency } from "./Currencies";
import { InfoHint } from "../components/InfoHint";

interface Rate { id: number; date: string; rate: string; currency: Currency }

export default function ExchangeRates() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <RateForm />;
  if (isEdit) return <RateForm editId={Number(id)} />;
  return <RateList />;
}

function RateList() {
  const cacheKey = "/exchange-rates";
  const [rates, setRates] = usePersistedState<Rate[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const [bulkSlot, setBulkSlot] = useState<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/currencies/rates").then(setRates).catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: Rate) {
    try {
      await api.del(`/currencies/rates/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>نرخ ارز</h2>
        </div>
        <div className="header-toolbar" style={{ gap: 4 }}><InfoHint text={`ثبت روزانه نرخ تسعیر برای ارزهای غیر پایه`} title="نرخ ارز" /><NewRecordButton path="/exchange-rates/new" /><RefreshButton onClick={reload} /><div ref={setBulkSlot} className="bulk-slot" style={{ display: "flex" }} /></div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        bulkActionsContainer={bulkSlot}
        columns={[
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "ارز", render: (r) => r.currency.title, filterType: "string", filterValue: (r) => r.currency.title },
          { header: "نرخ", render: (r) => formatAmountFa(r.rate), filterType: "number", filterValue: (r) => r.rate },
        ]}
        rows={rates}
        onEdit={(r) => navigate(`/exchange-rates/${r.id}/edit`)}
        onDelete={onDelete}
      />
    </div>
  );
}

function RateForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [form, setForm] = usePersistedState(cacheKey, { date: new Date().toISOString().slice(0, 10), currencyId: "", rate: "" });
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { saved, flash } = useSavedFlash();
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));

  useEffect(() => {
    api.get("/currencies").then(setCurrencies).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editId || hasPersistedState(cacheKey)) return;
    api.get("/currencies/rates").then((items: Rate[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setForm({ date: found.date.slice(0, 10), currencyId: String(found.currency.id), rate: String(found.rate) });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await api.post("/currencies/rates", {
        date: form.date,
        currencyId: Number(form.currencyId),
        rate: Number(form.rate),
      });
      setHint(created.hint);
      if (editId) {
        flash();
      } else {
        flash();
        navigate(`/exchange-rates/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/currencies/rates/${editId}`);
      navigate("/exchange-rates");
    } catch (err) {
      alert((err as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش نرخ ارز" : "ثبت نرخ ارز"}
      formId="rate-form"
      closePath="/exchange-rates"
      newPath="/exchange-rates/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="rate-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {hint && <div className="alert warn">{hint}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>تاریخ</label>
            <JalaliDatePicker value={form.date} onChange={(v) => setForm({ ...form, date: v })} placeholder="انتخاب تاریخ" />
          </div>
          <div className="form-field">
            <label>ارز (بدون ارز پایه)</label>
            <select disabled={!!editId} value={form.currencyId} onChange={(e) => setForm({ ...form, currencyId: e.target.value })}>
              <option value="">انتخاب کنید</option>
              {currencies.filter((c) => !c.isBase).map((c) => (
                <option key={c.id} value={c.id}>{c.code} - {c.title}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>نرخ ارز</label>
            <AmountInput value={form.rate} onChange={(v) => setForm({ ...form, rate: v })} allowDecimal placeholder="۰" />
          </div>
        </div>
      </form>
    </FormPage>
  );
}
