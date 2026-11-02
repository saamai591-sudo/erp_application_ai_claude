import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { AmountInput } from "../components/AmountInput";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// باشگاه مشتریان › تنظیمات › «نوع شارژ کارت وفاداری»: کد (خودکار) + عنوان + نوع (مبلغی/درصدی) + مقدار + «تنها یک‌بار قابل استفاده باشد».
// قواعد در سرور (services/loyaltyService.ts).

interface TypeRow {
  id: number;
  code: number;
  title: string;
  kind: "AMOUNT" | "PERCENT";
  kindTitle: string;
  value: number;
  singleUse: boolean;
  isActive: boolean;
  chargeCount: number;
  updatedAt?: string;
}

export const formatChargeValue = (kind: "AMOUNT" | "PERCENT", value: number) => (kind === "PERCENT" ? `${toFaDigits(String(value))}٪` : formatAmountFa(value));

export default function LoyaltyChargeTypes() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <TypeForm />;
  if (location.pathname.endsWith("/edit")) return <TypeForm editId={Number(id)} />;
  return <TypeList />;
}

function TypeList() {
  const cacheKey = "/loyalty-charge-types";
  const [items, setItems] = usePersistedState<TypeRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/loyalty-charge-types").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: TypeRow) {
    try {
      await api.del(`/loyalty-charge-types/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: TypeRow) => string, extra: object = {}) => ({ render: (r: TypeRow) => f(r), filterType: "string" as const, filterValue: (r: TypeRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="نوع شارژ کارت وفاداری" text="هر نوع شارژ مبلغی (مقدار = مبلغ) یا درصدی (مقدار = درصد تخفیف از مبلغ فاکتور) است. کارت‌ها در «شارژ کارت وفاداری» با این نوع‌ها شارژ می‌شوند و در فروش فروشگاهی تا مانده/انقضا مصرف می‌شوند." />
          <NewRecordButton path="/loyalty-charge-types/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", ...s((r) => toFaDigits(String(r.code))), width: "70px" },
          { header: "عنوان", ...s((r) => r.title) },
          { header: "نوع", ...s((r) => r.kindTitle), width: "90px" },
          { header: "مقدار", ...s((r) => formatChargeValue(r.kind, r.value)), width: "130px" },
          { header: "تنها یک‌بار قابل استفاده", ...s((r) => (r.singleUse ? "بله" : "خیر")), width: "150px" },
          { header: "تعداد شارژ", ...s((r) => toFaDigits(String(r.chargeCount))), width: "100px" },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r: TypeRow) => `/loyalty-charge-types/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const EMPTY = { title: "", kind: "AMOUNT" as "AMOUNT" | "PERCENT", value: "", singleUse: false, isActive: true };

function TypeForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, EMPTY);
  const [code, setCode] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    if (!editId) return;
    api.get(`/loyalty-charge-types/${editId}`).then((r: TypeRow) => {
      setCode(r.code);
      setCount(r.chargeCount);
      setUpdatedAt(r.updatedAt);
      if (!hasPersistedState(cacheKey)) setForm({ title: r.title, kind: r.kind, value: String(r.value), singleUse: r.singleUse, isActive: r.isActive });
      setLoaded(true);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    if (!(Number(form.value) > 0)) return setError(form.kind === "AMOUNT" ? "مبلغ باید عددی بزرگ‌تر از صفر باشد" : "درصد باید عددی بزرگ‌تر از صفر باشد");
    if (form.kind === "PERCENT" && Number(form.value) > 100) return setError("درصد نمی‌تواند بیشتر از ۱۰۰ باشد");
    const body = { title: form.title, kind: form.kind, value: Number(form.value), singleUse: form.singleUse, isActive: form.isActive, updatedAt };
    try {
      if (editId) {
        await api.put(`/loyalty-charge-types/${editId}`, body);
        flash();
        const r: TypeRow = await api.get(`/loyalty-charge-types/${editId}`);
        setUpdatedAt(r.updatedAt);
      } else {
        const created = await api.post("/loyalty-charge-types", body);
        flash();
        navigate(`/loyalty-charge-types/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/loyalty-charge-types/${editId}`);
      navigate("/loyalty-charge-types");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  const locked = count > 0;
  return (
    <FormPage title={editId ? "ویرایش نوع شارژ" : "نوع شارژ جدید"} formId="loyalty-charge-type-form" closePath="/loyalty-charge-types" newPath="/loyalty-charge-types/new" onDelete={editId ? handleDelete : undefined}>
      <form id="loyalty-charge-type-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کد</label>
            <input dir="ltr" disabled value={code ? toFaDigits(String(code)) : "خودکار پس از ذخیره"} />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>نوع<RequiredMark /> <FieldHint label="نوع شارژ" text="مبلغی: مقدار یک مبلغ است و با هر مصرف از مانده‌ی شارژ کم می‌شود. درصدی: مقدار یک درصد است و هنگام تسویه فاکتور، همان درصد از مبلغ قابل پرداخت فاکتور تخفیف داده می‌شود." /></label>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "AMOUNT" | "PERCENT", value: "" })} disabled={locked}>
              <option value="AMOUNT">مبلغی</option>
              <option value="PERCENT">درصدی</option>
            </select>
          </div>
          <div className="form-field">
            <label>{form.kind === "AMOUNT" ? "مبلغ" : "درصد"}<RequiredMark /> {locked && <FieldHint label="مقدار" text="با این نوع شارژ، کارتی شارژ شده است؛ نوع و مقدار قابل تغییر نیست (نوع تازه تعریف کنید)." />}</label>
            {form.kind === "AMOUNT" ? (
              <AmountInput value={form.value} onChange={(v) => setForm({ ...form, value: v })} allowDecimal disabled={locked} />
            ) : (
              <input dir="ltr" inputMode="decimal" value={form.value} disabled={locked} onChange={(e) => setForm({ ...form, value: e.target.value.replace(/[^\d.]/g, "") })} />
            )}
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.singleUse} onChange={(e) => setForm({ ...form, singleUse: e.target.checked })} /> تنها یک‌بار قابل استفاده باشد
              <FieldHint label="تنها یک‌بار" text="اولین مصرف، کل شارژ را می‌بندد؛ برای شارژ مبلغی، مانده‌ی مصرف‌نشده‌ی آن می‌سوزد. بدون این گزینه، شارژ مبلغی تا تمام‌شدن مانده و شارژ درصدی تا انقضا (حداکثر یک‌بار در هر فاکتور) قابل مصرف است." />
            </label>
          </div>
          <div className="form-field">
            <label className="checkbox-row"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> فعال</label>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
