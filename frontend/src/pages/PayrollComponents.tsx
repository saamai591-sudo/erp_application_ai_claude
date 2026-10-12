import { FormEvent, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// حقوق و دستمزد › تنظیمات › اجزای حقوق: اجزایی که هر ماه با فرمول محاسبه می‌شوند (اضافه‌کار، بیمه، مالیات، …). مقدار «اجزای حکم» در منابع انسانی
// ثابت است و اینجا فقط به‌عنوان عملوند فرمول به آن‌ها ارجاع داده می‌شود. فرمول متن است و عملوندها از پالت درج می‌شوند.

export const PAYROLL_KIND_FA: Record<string, string> = {
  EARNING: "مزیت",
  DEDUCTION: "کسر",
  EMPLOYER_COST: "سهم کارفرما",
  INFO: "اطلاعاتی",
};

interface Comp {
  id: number;
  key: string;
  title: string;
  kind: string;
  formula: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
}
interface Palette {
  decree: { ref: string; title: string }[];
  components: { ref: string; title: string; kind: string }[];
  params: { ref: string; title: string; type: string }[];
  variables: { ref: string; title: string }[];
  functions: string[];
}

export default function PayrollComponents() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <CompForm />;
  if (location.pathname.endsWith("/edit")) return <CompForm editId={Number(id)} />;
  return <CompList />;
}

function CompList() {
  const cacheKey = "/payroll-components";
  const [items, setItems] = usePersistedState<Comp[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/payroll-components").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: Comp) {
    try {
      await api.del(`/payroll-components/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: Comp) => string, extra: object = {}) => ({ render: (r: Comp) => f(r), filterType: "string" as const, filterValue: (r: Comp) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            text="اجزای حقوق هر ماه با فرمول محاسبه می‌شوند (اضافه‌کار، بیمه، مالیات و …). عملوند فرمول می‌تواند مبلغ جزء حکم، جزء حقوق دیگر، پارامتر قانونی یا متغیر ماه (روز کارکرد، ساعت اضافه‌کار، جمع مشمول بیمه/مالیات) باشد؛ ترتیب محاسبه از وابستگی‌ها تعیین می‌شود."
            title="اجزای حقوق"
          />
          <NewRecordButton path="/payroll-components/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "عنوان", ...s((r) => r.title) },
          { header: "کلید", ...s((r) => r.key), width: "180px" },
          { header: "نوع", ...s((r) => PAYROLL_KIND_FA[r.kind]), width: "120px" },
          { header: "فرمول", ...s((r) => r.formula) },
          { header: "سیستمی", ...s((r) => (r.isSystem ? "بله" : "")), width: "80px" },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r: Comp) => `/payroll-components/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { key: "", title: "", kind: "EARNING", formula: "", description: "", isActive: true };

function CompForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [isSystem, setIsSystem] = useState(false);
  const [palette, setPalette] = useState<Palette | null>(null);
  const [check, setCheck] = useState<{ ok: boolean; error?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const ta = useRef<HTMLTextAreaElement>(null);
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/payroll-components/palette").then(setPalette).catch(() => {});
    if (editId) {
      api.get("/payroll-components").then((rows: Comp[]) => {
        const c = rows.find((r) => r.id === editId);
        if (c) {
          setIsSystem(c.isSystem);
          if (!hasPersistedState(cacheKey)) setForm({ key: c.key, title: c.title, kind: c.kind, formula: c.formula, description: c.description ?? "", isActive: c.isActive });
        }
        setLoaded(true);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  function insert(text: string) {
    const el = ta.current;
    const v = form.formula;
    const a = el?.selectionStart ?? v.length;
    const b = el?.selectionEnd ?? v.length;
    const next = v.slice(0, a) + text + v.slice(b);
    setForm({ ...form, formula: next });
    setCheck(null);
    setTimeout(() => {
      el?.focus();
      el?.setSelectionRange(a + text.length, a + text.length);
    }, 0);
  }

  async function validate() {
    try {
      const r = await api.post("/payroll-components/validate", { key: form.key, kind: form.kind, formula: form.formula }, { silent: true } as any);
      setCheck(r);
    } catch (e) {
      setCheck({ ok: false, error: (e as ApiError).message });
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    if (!form.formula.trim()) return setError("فرمول الزامی است");
    try {
      if (editId) {
        await api.put(`/payroll-components/${editId}`, form);
        flash();
      } else {
        if (!form.key.trim()) return setError("کلید الزامی است");
        const created = await api.post("/payroll-components", form);
        flash();
        navigate(`/payroll-components/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/payroll-components/${editId}`);
      navigate("/payroll-components");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  const chips = (title: string, rows: { ref: string; title: string }[]) =>
    rows.length === 0 ? null : (
      <div style={{ marginBottom: 6 }}>
        <b style={{ marginInlineEnd: 6 }}>{title}:</b>
        {rows.map((r) => (
          <button key={r.ref} type="button" className="link-btn" style={{ marginInlineEnd: 10 }} title={r.ref} onClick={() => insert(r.ref)}>
            {r.title}
          </button>
        ))}
      </div>
    );

  return (
    <FormPage
      title={editId ? "ویرایش جزء حقوق" : "جزء حقوق جدید"}
      formId="payroll-comp-form"
      closePath="/payroll-components"
      newPath="/payroll-components/new"
      onDelete={editId && !isSystem ? handleDelete : undefined}
      wide
    >
      <form id="payroll-comp-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کلید<RequiredMark /> <FieldHint label="کلید" text="شناسه‌ی ثابت برای ارجاع از فرمول جزء‌های دیگر به‌صورت [C:کلید]؛ بعد از ثبت قابل تغییر نیست" /></label>
            <input dir="ltr" disabled={!!editId} value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase() })} />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>نوع<RequiredMark /> <FieldHint label="نوع" text="مزیت: به جمع مزایا می‌رود و می‌تواند مشمول بیمه/مالیات باشد. کسر: از خالص پرداختی کم می‌شود. سهم کارفرما: هزینه‌ی کارفرما و بدون اثر بر خالص" /></label>
            <select disabled={isSystem} value={form.kind} onChange={(e) => { setForm({ ...form, kind: e.target.value }); setCheck(null); }}>
              {Object.entries(PAYROLL_KIND_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {editId && !isSystem && (
            <div className="form-field">
              <label className="checkbox-row">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                فعال
              </label>
            </div>
          )}
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label>شرح</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label>فرمول<RequiredMark /></label>
            <textarea
              ref={ta}
              dir="ltr"
              rows={3}
              style={{ fontFamily: "monospace" }}
              value={form.formula}
              onChange={(e) => { setForm({ ...form, formula: e.target.value }); setCheck(null); }}
            />
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10 }}>
              <button type="button" className="btn secondary" onClick={validate}>بررسی فرمول</button>
              {check && (check.ok ? <span style={{ color: "#0a8f5a" }}>فرمول معتبر است</span> : <span style={{ color: "#c0392b" }}>{check.error}</span>)}
            </div>
          </div>
        </div>
        {palette && (
          <div className="hr-section" style={{ borderBottom: "none", fontWeight: 400 }}>
            <p style={{ margin: "0 0 6px", opacity: 0.8 }}>
              روی هر عملوند کلیک کنید تا در محل مکان‌نما به فرمول اضافه شود. عملگرها: + - * / و پرانتز؛ توابع: {palette.functions.join("، ")}
            </p>
            {chips("متغیرهای ماه", palette.variables)}
            {chips("پارامترهای قانونی", palette.params)}
            {chips("اجزای حکم", palette.decree)}
            {chips("اجزای حقوق", palette.components.filter((c) => c.ref !== `[C:${form.key}]`))}
          </div>
        )}
      </form>
    </FormPage>
  );
}
