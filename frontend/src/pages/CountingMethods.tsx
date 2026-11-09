import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { AmountInput } from "../components/AmountInput";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// انبارگردانی › «روش انبارگردانی»: تعداد دفعات شمارش (۱ تا ۳) و شرط هر شمارش. قواعد در سرور (routes/inventoryCounting.ts).

type Cond = "ALL_ITEMS" | "FIRST_STOCK_DIFF" | "SECOND_STOCK_DIFF" | "FIRST_SECOND_DIFF";
const COND_FA: Record<Cond, string> = {
  ALL_ITEMS: "همه کالاها",
  FIRST_STOCK_DIFF: "مغایرت شمارش اول و موجودی",
  SECOND_STOCK_DIFF: "مغایرت شمارش دوم و موجودی",
  FIRST_SECOND_DIFF: "مغایرت شمارش اول و دوم",
};
const SECOND_OPTIONS: Cond[] = ["ALL_ITEMS", "FIRST_STOCK_DIFF"];
const THIRD_OPTIONS: Cond[] = ["ALL_ITEMS", "FIRST_STOCK_DIFF", "SECOND_STOCK_DIFF", "FIRST_SECOND_DIFF"];
const TIMES_FA: Record<number, string> = { 1: "یک شمارشی", 2: "دو شمارشی", 3: "سه شمارشی" };

interface MethodRow {
  id: number;
  number: number;
  title: string;
  countTimes: number;
  minStock: number | null;
  secondCondition: Cond | null;
  thirdCondition: Cond | null;
  updatedAt?: string;
}

const conditionText = (m: MethodRow) =>
  m.countTimes === 1 ? `حداقل موجودی: ${formatAmountFa(m.minStock ?? 0)}` : m.countTimes === 2 ? `شرط شمارش دوم: ${COND_FA[m.secondCondition as Cond] ?? ""}` : `شرط شمارش سوم: ${COND_FA[m.thirdCondition as Cond] ?? ""}`;

export default function CountingMethods() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <MethodForm />;
  if (location.pathname.endsWith("/edit")) return <MethodForm editId={Number(id)} />;
  return <MethodList />;
}

function MethodList() {
  const cacheKey = "/warehousing/counting-methods";
  const [items, setItems] = usePersistedState<MethodRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/counting-methods").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: MethodRow) {
    try {
      await api.del(`/counting-methods/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: MethodRow) => string, extra: object = {}) => ({ render: (r: MethodRow) => f(r), filterType: "string" as const, filterValue: (r: MethodRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="روش انبارگردانی" text="تعداد دفعات شمارش (یک تا سه) و شرط هر شمارش را تعریف می‌کند: یک‌شمارشی با حداقل موجودی، دوشمارشی با شرط شمارش دوم و سه‌شمارشی با شرط شمارش سوم. هنگام صدور تگ انبارگردانی یکی از این روش‌ها انتخاب می‌شود." />
          <NewRecordButton path="/warehousing/counting-methods/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", ...s((r) => toFaDigits(String(r.number))), width: "80px", filterType: "number" as const, filterValue: (r: MethodRow) => r.number },
          { header: "عنوان", ...s((r) => r.title) },
          { header: "دفعات شمارش", ...s((r) => TIMES_FA[r.countTimes] ?? ""), width: "130px" },
          { header: "شرط", ...s((r) => conditionText(r)) },
        ]}
        rows={items}
        edit={{ path: (r: MethodRow) => `/warehousing/counting-methods/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const EMPTY = { title: "", countTimes: "1", minStock: "", secondCondition: "", thirdCondition: "" };

function MethodForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, EMPTY);
  const [number, setNumber] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const [nextNumber, setNextNumber] = useState<number | null>(null);
  const { flash } = useSavedFlash();

  useEffect(() => {
    // شماره‌ی بعدی (آخرین شماره + ۱) فقط برای نمایش؛ شماره‌ی نهایی را سرور هنگام ذخیره می‌دهد
    if (!editId) api.get("/counting-methods").then((r: MethodRow[]) => setNextNumber((r.reduce((m, x) => Math.max(m, x.number), 0) || 0) + 1)).catch(() => {});
    if (!editId) return;
    api.get(`/counting-methods/${editId}`).then((r: MethodRow) => {
      setNumber(r.number);
      setUpdatedAt(r.updatedAt);
      if (!hasPersistedState(cacheKey)) setForm({ title: r.title, countTimes: String(r.countTimes), minStock: r.minStock === null ? "" : String(r.minStock), secondCondition: r.secondCondition ?? "", thirdCondition: r.thirdCondition ?? "" });
      setLoaded(true);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const times = Number(form.countTimes);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    if (times === 1 && form.minStock === "") return setError("حداقل موجودی را وارد کنید");
    if (times === 2 && !form.secondCondition) return setError("شرط شمارش دوم را انتخاب کنید");
    if (times === 3 && !form.thirdCondition) return setError("شرط شمارش سوم را انتخاب کنید");
    const body = {
      title: form.title,
      countTimes: times,
      minStock: times === 1 ? Number(form.minStock) : null,
      secondCondition: times === 2 ? form.secondCondition : null,
      thirdCondition: times === 3 ? form.thirdCondition : null,
      updatedAt,
    };
    try {
      if (editId) {
        await api.put(`/counting-methods/${editId}`, body);
        flash();
        const r: MethodRow = await api.get(`/counting-methods/${editId}`);
        setUpdatedAt(r.updatedAt);
      } else {
        const created = await api.post("/counting-methods", body);
        flash();
        navigate(`/warehousing/counting-methods/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/counting-methods/${editId}`);
      navigate("/warehousing/counting-methods");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  const times = Number(form.countTimes);
  const condSelect = (value: string, options: Cond[], onChange: (v: string) => void) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— انتخاب —</option>
      {options.map((c) => (
        <option key={c} value={c}>{COND_FA[c]}</option>
      ))}
    </select>
  );
  return (
    <FormPage title={editId ? "ویرایش روش انبارگردانی" : "روش انبارگردانی جدید"} formId="counting-method-form" closePath="/warehousing/counting-methods" newPath="/warehousing/counting-methods/new" onDelete={editId ? handleDelete : undefined}>
      <form id="counting-method-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>شماره</label>
            <input dir="ltr" disabled value={number ? toFaDigits(String(number)) : nextNumber ? toFaDigits(String(nextNumber)) : "خودکار پس از ذخیره"} />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>دفعات شمارش<RequiredMark /></label>
            <select value={form.countTimes} onChange={(e) => setForm({ ...form, countTimes: e.target.value, minStock: "", secondCondition: "", thirdCondition: "" })}>
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>{TIMES_FA[n]}</option>
              ))}
            </select>
          </div>
          {times === 1 && (
            <div className="form-field">
              <label>شرایط شمارش اول — حداقل موجودی<RequiredMark /></label>
              <AmountInput value={form.minStock} onChange={(v) => setForm({ ...form, minStock: v })} allowDecimal />
            </div>
          )}
          {times === 2 && (
            <div className="form-field">
              <label>شرایط شمارش دوم<RequiredMark /></label>
              {condSelect(form.secondCondition, SECOND_OPTIONS, (v) => setForm({ ...form, secondCondition: v }))}
            </div>
          )}
          {times === 3 && (
            <div className="form-field">
              <label>شرایط شمارش سوم<RequiredMark /></label>
              {condSelect(form.thirdCondition, THIRD_OPTIONS, (v) => setForm({ ...form, thirdCondition: v }))}
            </div>
          )}
        </div>
      </form>
    </FormPage>
  );
}
