import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { AmountInput } from "../components/AmountInput";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { useDefaultBaseCurrency } from "../lib/useDefaultBaseCurrency";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";

// «تعریف تنخواه» (مدیریت خزانه › تنظیمات). کد تفصیلی را سرور با سرویس عمومی «ایجاد کد تفصیلی» صادر می‌کند؛ کاربر آن را وارد نمی‌کند.

interface CurrencyOption { id: number; code: string; title: string; decimalPlaces: number; isBase?: boolean }
interface PettyCash {
  id: number;
  detailCode: string;
  title: string;
  currencyId: number;
  currency: CurrencyOption;
  limitAmount: string;
  isActive: boolean;
  hasTransactions: boolean;
}

export default function PettyCashes() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <PettyCashForm />;
  if (isEdit) return <PettyCashForm editId={Number(id)} />;
  return <PettyCashList />;
}

function PettyCashList() {
  const cacheKey = "/petty-cashes";
  const [items, setItems] = usePersistedState<PettyCash[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    api.get("/petty-cashes").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: PettyCash) {
    try {
      await api.del(`/petty-cashes/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="تعریف تنخواه‌ها — کد تفصیلی به‌صورت خودکار بر اساس «نوع تفصیل» صادر می‌شود" title="تنخواه" />
          <NewRecordButton path="/petty-cashes/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد تفصیلی", render: (r) => toFaDigits(r.detailCode), width: "110px", filterType: "string", filterValue: (r) => r.detailCode },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "ارز", render: (r) => r.currency?.title || "—", width: "120px", filterType: "string", filterValue: (r) => r.currency?.title || "" },
          {
            header: "سقف تنخواه",
            render: (r) => formatAmountFa(r.limitAmount),
            decimal: true,
            filterType: "number",
            filterValue: (r) => Number(r.limitAmount),
          },
          { header: "فعال", render: (r) => (r.isActive ? "بله" : "خیر"), width: "80px", filterType: "string", filterValue: (r) => (r.isActive ? "بله" : "خیر") },
        ]}
        rows={items}
        edit={{ path: (r) => `/petty-cashes/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { detailCode: "", title: "", currencyId: "", limitAmount: "", isActive: true };

function PettyCashForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [hasTransactions, setHasTransactions] = useState(false);
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/currencies").then(setCurrencies);
  }, []);

  // قاعده‌ی پایه: ارز تنخواه‌ی جدید به‌صورت پیش‌فرض «ارز پایه» است
  useDefaultBaseCurrency({ enabled: !editId && loaded, currencies, current: form.currencyId, apply: (cid) => setForm((f) => ({ ...f, currencyId: cid })) });

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) {
        setForm(DEFAULT_FORM);
        setHasTransactions(false);
      }
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get("/petty-cashes").then((items: PettyCash[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setHasTransactions(found.hasTransactions);
        setForm({
          detailCode: found.detailCode,
          title: found.title,
          currencyId: String(found.currencyId),
          limitAmount: String(Number(found.limitAmount)),
          isActive: found.isActive,
        });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const selectedCurrency = currencies.find((c) => String(c.id) === form.currencyId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    if (!form.currencyId) return setError("ارز الزامی است");
    if (form.limitAmount === "") return setError("سقف تنخواه الزامی است");
    // کد تفصیلی عمداً ارسال نمی‌شود: فقط سرور آن را (با سرویس عمومی) صادر می‌کند
    const body = {
      title: form.title.trim(),
      currencyId: Number(form.currencyId),
      limitAmount: Number(form.limitAmount),
      isActive: form.isActive,
    };
    try {
      if (editId) {
        await api.put(`/petty-cashes/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/petty-cashes", body);
        flash();
        navigate(`/petty-cashes/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/petty-cashes/${editId}`);
      navigate("/petty-cashes");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش تنخواه" : "تنخواه جدید"}
      formId="petty-cash-form"
      closePath="/petty-cashes"
      newPath="/petty-cashes/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="petty-cash-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کد تفصیلی <FieldHint label="کد تفصیلی" text="به‌صورت خودکار توسط سیستم صادر می‌شود و قابل ویرایش نیست" /></label>
            <input dir="ltr" disabled value={form.detailCode ? toFaDigits(form.detailCode) : ""} placeholder="پس از ذخیره صادر می‌شود" />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>
              ارز
              <RequiredMark />
              {hasTransactions && <FieldHint label="ارز" text="این تنخواه گردش دارد و ارز آن قابل تغییر نیست" />}
            </label>
            <select value={form.currencyId} disabled={hasTransactions} onChange={(e) => setForm({ ...form, currencyId: e.target.value })}>
              <option value="">انتخاب کنید</option>
              {currencies.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>سقف تنخواه<RequiredMark /></label>
            <AmountInput
              value={form.limitAmount}
              onChange={(v) => setForm({ ...form, limitAmount: v })}
              allowDecimal={(selectedCurrency?.decimalPlaces ?? 0) > 0}
            />
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              فعال
              <FieldHint label="فعال" text="تنخواه فعال در اسناد قابل استفاده است" />
            </label>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
