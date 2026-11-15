import { FormEvent, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// تولید › تنظیمات › «الگوی شماره‌گذاری بچ»: قالب شماره‌ی بچ‌هایی که هنگام «تایید آمار تولید» ساخته می‌شوند. الگو در فرم کالا (تب «ردیابی») تعیین می‌شود.
// قواعد و ساخت شماره: backend/src/services/batchNumberPatternService.ts

const INFO_TEXT =
  "قالب شماره‌ی بچ را با نشانه‌ها بسازید؛ مثلاً «B-{YEAR}-{SEQ}» یا «[P{ORDER}-]S{STAT}-{DATE}». گروه داخل [ ] فقط وقتی چاپ می‌شود که همه‌ی نشانه‌هایش مقدار داشته باشند (مثلاً دستور تولید). کالایی که الگو ندارد، قالب پیش‌فرض «[P{ORDER}-]S{STAT}-{DATE}» را می‌گیرد.";

const TOKENS: { token: string; title: string }[] = [
  { token: "{ORDER}", title: "شماره‌ی دستور تولید (خالی اگر آمار دستور ندارد)" },
  { token: "{STAT}", title: "شماره‌ی آمار تولید" },
  { token: "{DATE}", title: "تاریخ آمار، شمسی ۸ رقمی (مثلاً 14050820)" },
  { token: "{YEAR}", title: "سال شمسی ۴ رقمی" },
  { token: "{YY}", title: "دو رقم آخر سال شمسی" },
  { token: "{MONTH}", title: "ماه شمسی ۲ رقمی" },
  { token: "{DAY}", title: "روز شمسی ۲ رقمی" },
  { token: "{ITEM}", title: "کد کالا" },
  { token: "{SEQ}", title: "شمارنده (محدوده و تعداد ارقام را پایین انتخاب کنید)" },
];
const SCOPES: { value: string; label: string }[] = [
  { value: "ALL", label: "یک شمارنده برای همه" },
  { value: "ITEM", label: "جدا برای هر کالا" },
  { value: "FISCAL_YEAR", label: "جدا برای هر سال مالی" },
  { value: "ITEM_FISCAL_YEAR", label: "جدا برای هر کالا در هر سال مالی" },
];

interface Pattern { id: number; code: number; title: string; template: string; seqScope: string; seqScopeTitle: string; seqWidth: number; itemCount: number; used: boolean }
interface FormState { title: string; template: string; seqScope: string; seqWidth: string }
const EMPTY: FormState = { title: "", template: "", seqScope: "ALL", seqWidth: "1" };

export default function BatchNumberPatterns() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <PatternForm />;
  if (location.pathname.endsWith("/edit")) return <PatternForm editId={Number(id)} />;
  return <PatternList />;
}

function PatternList() {
  const cacheKey = "/batch-number-patterns";
  const [items, setItems] = usePersistedState<Pattern[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const reload = () => api.get("/batch-number-patterns").then(setItems).catch((e) => setError(e.message));
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: Pattern) {
    try {
      await api.del(`/batch-number-patterns/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="الگوی شماره‌گذاری بچ" />
          <NewRecordButton path="/batch-number-patterns/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", render: (r: Pattern) => toFaDigits(String(r.code)), width: "90px", filterType: "number", filterValue: (r: Pattern) => r.code },
          { header: "عنوان", render: (r: Pattern) => r.title, filterType: "string", filterValue: (r: Pattern) => r.title },
          { header: "قالب", render: (r: Pattern) => <span dir="ltr">{r.template}</span>, filterType: "string", filterValue: (r: Pattern) => r.template },
          { header: "شمارنده", render: (r: Pattern) => (r.template.includes("{SEQ}") ? r.seqScopeTitle : "—"), filterType: "string", filterValue: (r: Pattern) => (r.template.includes("{SEQ}") ? r.seqScopeTitle : "—") },
          { header: "تعداد کالا", render: (r: Pattern) => toFaDigits(String(r.itemCount)), width: "100px", filterType: "number", filterValue: (r: Pattern) => r.itemCount },
        ]}
        rows={items}
        edit={{ path: (r: Pattern) => `/batch-number-patterns/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function PatternForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState<FormState>(cacheKey, EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const [preview, setPreview] = useState<{ example: string; exampleWithoutOrder: string } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [itemCount, setItemCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { flash } = useSavedFlash();
  const hasSeq = form.template.includes("{SEQ}");

  useEffect(() => {
    if (!editId) return;
    api.get(`/batch-number-patterns/${editId}`).then((p: Pattern) => {
      setItemCount(p.itemCount);
      if (!hasPersistedState(cacheKey)) setForm({ title: p.title, template: p.template, seqScope: p.seqScope, seqWidth: String(p.seqWidth) });
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // پیش‌نمایش را سرور می‌سازد (فرانت قالب را خودش پر نمی‌کند)
  useEffect(() => {
    if (!form.template.trim()) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    const t = setTimeout(() => {
      api
        .post("/batch-number-patterns/preview", { template: form.template.trim(), seqScope: form.seqScope, seqWidth: form.seqWidth }, { silent: true })
        .then((r) => {
          setPreview(r);
          setPreviewError(null);
        })
        .catch((e) => {
          setPreview(null);
          setPreviewError((e as ApiError).message);
        });
    }, 350);
    return () => clearTimeout(t);
  }, [form.template, form.seqScope, form.seqWidth]);

  function insert(token: string) {
    const el = inputRef.current;
    const start = el?.selectionStart ?? form.template.length;
    const end = el?.selectionEnd ?? form.template.length;
    const next = form.template.slice(0, start) + token + form.template.slice(end);
    setForm({ ...form, template: next });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const body = { title: form.title, template: form.template.trim(), seqScope: form.seqScope, seqWidth: Number(form.seqWidth) || 1 };
    try {
      if (editId) {
        await api.put(`/batch-number-patterns/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/batch-number-patterns", body);
        flash();
        navigate(`/batch-number-patterns/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/batch-number-patterns/${editId}`);
      navigate("/batch-number-patterns");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  return (
    <FormPage title={editId ? "ویرایش الگوی شماره‌گذاری بچ" : "الگوی شماره‌گذاری بچ جدید"} formId="batch-number-pattern-form" closePath="/batch-number-patterns" newPath="/batch-number-patterns/new" onDelete={editId ? handleDelete : undefined}>
      <form id="batch-number-pattern-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً بچ سالانه" />
          </div>
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label>قالب شماره‌ی بچ<RequiredMark /> <InfoHint text={INFO_TEXT} title="قالب شماره‌ی بچ" /></label>
            <input ref={inputRef} dir="ltr" value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value.replace(/\s/g, "") })} placeholder="[P{ORDER}-]S{STAT}-{DATE}" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {TOKENS.map((t) => (
                <button key={t.token} type="button" className="btn" title={t.title} onClick={() => insert(t.token)} style={{ direction: "ltr" }}>
                  {t.token}
                </button>
              ))}
              <button type="button" className="btn" title="گروه اختیاری: فقط وقتی چاپ می‌شود که همه‌ی نشانه‌هایش مقدار داشته باشند" onClick={() => insert("[]")}>
                [ گروه اختیاری ]
              </button>
            </div>
            {previewError && <small style={{ color: "var(--danger, #c0392b)" }}>{previewError}</small>}
            {preview && !previewError && (
              <small>
                نمونه: <b dir="ltr">{preview.example}</b>
                {preview.exampleWithoutOrder !== preview.example && (
                  <>
                    {" "}
                    — بدون دستور تولید: <b dir="ltr">{preview.exampleWithoutOrder}</b>
                  </>
                )}
              </small>
            )}
          </div>
          {hasSeq && (
            <>
              <div className="form-field">
                <label>محدوده‌ی شمارنده</label>
                <select value={form.seqScope} onChange={(e) => setForm({ ...form, seqScope: e.target.value })}>
                  {SCOPES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>تعداد ارقام شمارنده</label>
                <input type="number" min={1} max={8} value={form.seqWidth} onChange={(e) => setForm({ ...form, seqWidth: e.target.value })} />
                <small>با صفر پر می‌شود؛ مثلاً ۳ رقم: 007</small>
              </div>
            </>
          )}
        </div>
        {!!editId && itemCount > 0 && (
          <p>
            <small>این الگو روی {toFaDigits(String(itemCount))} کالا تعیین شده است؛ تغییر قالب فقط روی بچ‌های بعدی اثر می‌گذارد و شمارنده ادامه می‌یابد.</small>
          </p>
        )}
      </form>
    </FormPage>
  );
}
