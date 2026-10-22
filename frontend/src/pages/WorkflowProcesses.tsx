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
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError, showToast } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePermissions } from "../lib/usePermissions";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// کارتابل › تنظیمات › «تعریف فرایند» (مدیر مشتری): فرایند = رویداد شروع + شرط شروع + مراحل. هر مرحله: مسئول‌ها (کاربر / نقش / ثبت‌کننده‌ی سند)،
// نحوه‌ی تکمیل (دستی با توضیح و مدرک، یا خودکار با رویداد سند)، مهلت و یادآوری (ساعت تقویمی)، تشدید (کاربر/نقش) و شرط ورود. ویرایشِ فرایندی که
// نمونه‌ی اجراشده دارد، نسخه‌ی تازه می‌سازد و کارهای در جریان با نسخه‌ی قبلی ادامه می‌دهند. قواعد در سرور (workflowProcessService).

interface Meta {
  startEvents: { key: string; title: string }[];
  completionEvents: { key: string; title: string; canBranch: boolean }[];
  conditionFields: { key: string; title: string }[];
  users: { id: number; title: string; isLight: boolean }[];
  roles: { id: number; title: string }[];
  values: Record<string, { id: number; title: string }[]>;
}
interface Cond { field: string; op: "EQ" | "NEQ"; value: string }
interface Assignee { kind: "USER" | "ROLE" | "CREATOR"; userId: string; roleId: string }
interface StepUI {
  title: string;
  description: string;
  completion: "MANUAL" | "EVENT";
  completionEvent: string;
  requireNote: boolean;
  requireAttachment: boolean;
  branchPerEvent: boolean;
  deadlineHours: string;
  reminderHours: string;
  escalateUserId: string;
  escalateRoleId: string;
  entryCondition: Cond[];
  assignees: Assignee[];
}
interface FormUI { title: string; description: string; isActive: boolean; startEvent: string; startCondition: Cond[]; steps: StepUI[] }
interface ListRow { id: number; code: number; title: string; rootTypeTitle: string; startEventTitle: string; isActive: boolean; version: number; stepCount: number; instanceCount: number }

const emptyStep = (): StepUI => ({ title: "", description: "", completion: "MANUAL", completionEvent: "", requireNote: true, requireAttachment: true, branchPerEvent: false, deadlineHours: "", reminderHours: "", escalateUserId: "", escalateRoleId: "", entryCondition: [], assignees: [] });
const EMPTY: FormUI = { title: "", description: "", isActive: true, startEvent: "SALES_QUOTE_APPROVED", startCondition: [], steps: [emptyStep()] };
const KIND_FA = { USER: "کاربر", ROLE: "نقش", CREATOR: "ثبت‌کننده‌ی سند" } as const;

const fromServer = (d: any): FormUI => ({
  title: d.title,
  description: d.description ?? "",
  isActive: d.isActive,
  startEvent: d.startEvent,
  startCondition: (d.startCondition ?? []).map((c: any) => ({ field: c.field, op: c.op, value: String(c.value) })),
  steps: d.steps.map((s: any) => ({
    title: s.title,
    description: s.description ?? "",
    completion: s.completion,
    completionEvent: s.completionEvent ?? "",
    requireNote: s.requireNote !== false,
    requireAttachment: s.requireAttachment !== false,
    branchPerEvent: !!s.branchPerEvent,
    deadlineHours: s.deadlineHours ? String(s.deadlineHours) : "",
    reminderHours: s.reminderHours ? String(s.reminderHours) : "",
    escalateUserId: s.escalateUserId ? String(s.escalateUserId) : "",
    escalateRoleId: s.escalateRoleId ? String(s.escalateRoleId) : "",
    entryCondition: (s.entryCondition ?? []).map((c: any) => ({ field: c.field, op: c.op, value: String(c.value) })),
    assignees: s.assignees.map((a: any) => ({ kind: a.kind, userId: a.userId ? String(a.userId) : "", roleId: a.roleId ? String(a.roleId) : "" })),
  })),
});

const condBody = (cs: Cond[]) => cs.filter((c) => c.field && c.value).map((c) => ({ field: c.field, op: c.op, value: Number(c.value) }));
const toBody = (f: FormUI) => ({
  title: f.title,
  description: f.description,
  isActive: f.isActive,
  startEvent: f.startEvent,
  startCondition: condBody(f.startCondition),
  steps: f.steps.map((s) => ({
    title: s.title,
    description: s.description,
    completion: s.completion,
    completionEvent: s.completion === "EVENT" ? s.completionEvent : null,
    requireNote: s.requireNote,
    requireAttachment: s.requireAttachment,
    branchPerEvent: s.completion === "EVENT" && s.branchPerEvent,
    deadlineHours: s.deadlineHours ? Number(s.deadlineHours) : null,
    reminderHours: s.reminderHours ? Number(s.reminderHours) : null,
    escalateUserId: s.escalateUserId ? Number(s.escalateUserId) : null,
    escalateRoleId: s.escalateRoleId ? Number(s.escalateRoleId) : null,
    entryCondition: condBody(s.entryCondition),
    assignees: s.assignees.map((a) => ({ kind: a.kind, userId: a.userId ? Number(a.userId) : null, roleId: a.roleId ? Number(a.roleId) : null })),
  })),
});

export default function WorkflowProcesses() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <ProcessForm />;
  if (location.pathname.endsWith("/edit")) return <ProcessForm editId={Number(id)} />;
  return <ProcessList />;
}

function ProcessList() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const cacheKey = "/workflow-processes";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/workflow-processes").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(r: ListRow) {
    try {
      await api.del(`/workflow-processes/${r.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  async function fromTemplate() {
    try {
      const r = await api.post("/workflow-processes/from-template", {});
      showToast("الگوی زنجیره‌ی فروش ساخته شد؛ مسئول و مهلت مرحله‌ها را تنظیم و فعال کنید");
      navigate(`/workflow-processes/${r.id}/edit`);
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: ListRow) => string, extra: object = {}) => ({ render: (r: ListRow) => f(r), filterType: "string" as const, filterValue: (r: ListRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="تعریف فرایند" text="فرایند کارتابل: با رویداد شروع (مثلاً تایید پیش‌فاکتور) برای هر سند یک نمونه ساخته می‌شود و مرحله‌ها به‌ترتیب به مسئول‌ها محول می‌شوند. مرحله‌ی خودکار با ثبت سند مربوط (حواله، فاکتور، …) و مرحله‌ی دستی با توضیح و مدرک بسته می‌شود." />
          <NewRecordButton path="/workflow-processes/new" />
          {hasPermission("workflow.settings.workflow-processes.create") && <button type="button" className="toolbar-icon-btn" onClick={fromTemplate} title="ساخت فرایند از الگوی پیشنهادیِ زنجیره‌ی فروش">الگوی زنجیره‌ی فروش</button>}
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", render: (r: ListRow) => toFaDigits(String(r.code)), filterType: "number" as const, filterValue: (r: ListRow) => r.code, width: "70px" },
          { header: "عنوان", ...s((r) => r.title) },
          { header: "سند ریشه", ...s((r) => r.rootTypeTitle), width: "110px" },
          { header: "رویداد شروع", ...s((r) => r.startEventTitle) },
          { header: "مراحل", render: (r: ListRow) => toFaDigits(String(r.stepCount)), filterType: "number" as const, filterValue: (r: ListRow) => r.stepCount, width: "80px" },
          { header: "نسخه", render: (r: ListRow) => toFaDigits(String(r.version)), filterType: "number" as const, filterValue: (r: ListRow) => r.version, width: "70px" },
          { header: "اجراها", render: (r: ListRow) => toFaDigits(String(r.instanceCount)), filterType: "number" as const, filterValue: (r: ListRow) => r.instanceCount, width: "80px" },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r: ListRow) => `/workflow-processes/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function CondEditor({ value, onChange, meta }: { value: Cond[]; onChange: (v: Cond[]) => void; meta: Meta }) {
  const set = (i: number, p: Partial<Cond>) => onChange(value.map((c, j) => (j === i ? { ...c, ...p } : c)));
  return (
    <div>
      {value.map((c, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
          <select value={c.field} onChange={(e) => set(i, { field: e.target.value, value: "" })}>
            <option value="">فیلد…</option>
            {meta.conditionFields.map((f) => <option key={f.key} value={f.key}>{f.title}</option>)}
          </select>
          <select value={c.op} onChange={(e) => set(i, { op: e.target.value as Cond["op"] })} style={{ width: 90 }}>
            <option value="EQ">برابر</option>
            <option value="NEQ">نابرابر</option>
          </select>
          <select value={c.value} onChange={(e) => set(i, { value: e.target.value })} style={{ minWidth: 160 }}>
            <option value="">مقدار…</option>
            {(meta.values[c.field] ?? []).map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
          </select>
          <button type="button" className="btn-link" onClick={() => onChange(value.filter((_, j) => j !== i))}>حذف</button>
        </div>
      ))}
      <button type="button" className="btn secondary" onClick={() => onChange([...value, { field: "", op: "EQ", value: "" }])}>+ شرط</button>
    </div>
  );
}

function ProcessForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState<FormUI>(cacheKey, EMPTY);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [info, setInfo] = useState<{ version: number; instanceCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/workflow-processes/meta").then(setMeta).catch(() => {});
    if (!editId) return;
    api.get(`/workflow-processes/${editId}`).then((d: any) => {
      setUpdatedAt(d.updatedAt);
      setInfo({ version: d.version, instanceCount: d.instanceCount });
      if (!hasPersistedState(cacheKey)) setForm(fromServer(d));
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const setStep = (i: number, p: Partial<StepUI>) => setForm({ ...form, steps: form.steps.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const move = (i: number, d: -1 | 1) => {
    const a = [...form.steps];
    [a[i], a[i + d]] = [a[i + d], a[i]];
    setForm({ ...form, steps: a });
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    try {
      if (editId) {
        await api.put(`/workflow-processes/${editId}`, { ...toBody(form), updatedAt });
        const d = await api.get(`/workflow-processes/${editId}`);
        setUpdatedAt(d.updatedAt);
        setInfo({ version: d.version, instanceCount: d.instanceCount });
        flash();
      } else {
        const r = await api.post("/workflow-processes", toBody(form));
        flash();
        navigate(`/workflow-processes/${r.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/workflow-processes/${editId}`);
      navigate("/workflow-processes");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded || !meta) return null;
  const userOpts = meta.users.map((u) => <option key={u.id} value={u.id}>{u.title}{u.isLight ? " (سبک)" : ""}</option>);
  const roleOpts = meta.roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>);

  return (
    <FormPage
      title={editId ? "ویرایش فرایند" : "فرایند جدید"}
      formId="workflow-process-form"
      closePath="/workflow-processes"
      newPath="/workflow-processes/new"
      onDelete={editId ? handleDelete : undefined}
      wide
    >
      <form id="workflow-process-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {info && info.instanceCount > 0 && (
          <div className="alert" style={{ marginBottom: 8 }}>نسخه‌ی {toFaDigits(String(info.version))} — {toFaDigits(String(info.instanceCount))} نمونه‌ی اجراشده دارد؛ ذخیره‌ی تغییر، نسخه‌ی تازه می‌سازد و کارهای در جریان با نسخه‌ی قبلی ادامه می‌دهند.</div>
        )}
        <div className="form-grid">
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-field">
            <label>رویداد شروع<RequiredMark /> <FieldHint label="رویداد شروع" text="با این رویداد برای هر سندِ ریشه یک نمونه‌ی فرایند ساخته می‌شود" /></label>
            <select value={form.startEvent} onChange={(e) => setForm({ ...form, startEvent: e.target.value })}>
              {meta.startEvents.map((e) => <option key={e.key} value={e.key}>{e.title}</option>)}
            </select>
          </div>
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label>شرط شروع <FieldHint label="شرط شروع" text="اختیاری؛ فرایند فقط برای سندهایی شروع می‌شود که همه‌ی شرط‌ها (AND) برقرار باشد؛ مثلاً مرکز فروش = تهران" /></label>
            <CondEditor value={form.startCondition} onChange={(v) => setForm({ ...form, startCondition: v })} meta={meta} />
          </div>
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label>شرح</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="checkbox-row"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> فعال</label>
          </div>
        </div>

        <h3 className="hr-section" style={{ marginTop: 14 }}>مراحل</h3>
        {form.steps.map((s, i) => (
          <div key={i} className="card" style={{ padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
              <b>مرحله {toFaDigits(String(i + 1))}</b>
              <span style={{ flex: 1 }} />
              <button type="button" className="btn-link" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="btn-link" disabled={i === form.steps.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button type="button" className="btn-link" disabled={form.steps.length === 1} onClick={() => setForm({ ...form, steps: form.steps.filter((_, j) => j !== i) })}>حذف</button>
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label>عنوان مرحله<RequiredMark /></label>
                <input value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} />
              </div>
              <div className="form-field">
                <label>نحوه‌ی تکمیل</label>
                <select value={s.completion} onChange={(e) => setStep(i, { completion: e.target.value as StepUI["completion"] })}>
                  <option value="MANUAL">دستی (با توضیح و مدرک)</option>
                  <option value="EVENT">خودکار (با ثبت سند)</option>
                </select>
              </div>
              {s.completion === "EVENT" && (
                <div className="form-field">
                  <label>رویداد بسته‌شدن<RequiredMark /></label>
                  <select value={s.completionEvent} onChange={(e) => setStep(i, { completionEvent: e.target.value, branchPerEvent: false })}>
                    <option value="">—</option>
                    {meta.completionEvents.map((e) => <option key={e.key} value={e.key}>{e.title}</option>)}
                  </select>
                </div>
              )}
              {s.completion === "EVENT" && meta.completionEvents.find((e) => e.key === s.completionEvent)?.canBranch && (
                <div className="form-field">
                  <label>مسیر هر سند <FieldHint label="هر حواله یک مسیر جدا" text="اگر روشن باشد، این مرحله با اولین حواله بسته نمی‌شود و تا حواله‌شدن کامل پیش‌فاکتور (یا بستن پیگیری آن) برای مسئولش باز می‌ماند. با ثبت هر حواله، مرحله‌های بعدی (مثلاً صدور فاکتور) برای همان حواله جداگانه برای نفر بعدی ساخته می‌شود. برگشت از فروش در این مسیر اثری ندارد." /></label>
                  <label className="checkbox-row"><input type="checkbox" checked={s.branchPerEvent} onChange={(e) => setStep(i, { branchPerEvent: e.target.checked })} /> هر حواله یک مسیر جدا برای مرحله‌های بعدی</label>
                </div>
              )}
              {s.completion === "MANUAL" && (
                <div className="form-field">
                  <label>هنگام «انجام شد» <FieldHint label="الزام توضیح و مدرک" text="تعیین کنید کاربر برای بستن این مرحله حتماً توضیح بنویسد و/یا مدرک پیوست کند؛ اگر اختیاری باشد، همچنان می‌تواند ثبت کند" /></label>
                  <label className="checkbox-row"><input type="checkbox" checked={s.requireNote} onChange={(e) => setStep(i, { requireNote: e.target.checked })} /> توضیح اجباری</label>
                  <label className="checkbox-row"><input type="checkbox" checked={s.requireAttachment} onChange={(e) => setStep(i, { requireAttachment: e.target.checked })} /> مدرک (پیوست) اجباری</label>
                </div>
              )}
              <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                <label>راهنمای مرحله</label>
                <input value={s.description} onChange={(e) => setStep(i, { description: e.target.value })} />
              </div>
              <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                <label>مسئول‌ها {s.completion === "MANUAL" && <RequiredMark />} <FieldHint label="مسئول‌ها" text="هر ترکیب از کاربر، نقش و «ثبت‌کننده‌ی سند»؛ کار برای همه دیده می‌شود و یک نفر آن را برمی‌دارد" /></label>
                {s.assignees.map((a, k) => (
                  <div key={k} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                    <select value={a.kind} onChange={(e) => setStep(i, { assignees: s.assignees.map((x, j) => (j === k ? { kind: e.target.value as Assignee["kind"], userId: "", roleId: "" } : x)) })} style={{ width: 150 }}>
                      {(Object.keys(KIND_FA) as (keyof typeof KIND_FA)[]).map((kk) => <option key={kk} value={kk}>{KIND_FA[kk]}</option>)}
                    </select>
                    {a.kind === "USER" && <select value={a.userId} onChange={(e) => setStep(i, { assignees: s.assignees.map((x, j) => (j === k ? { ...x, userId: e.target.value } : x)) })} style={{ minWidth: 200 }}><option value="">—</option>{userOpts}</select>}
                    {a.kind === "ROLE" && <select value={a.roleId} onChange={(e) => setStep(i, { assignees: s.assignees.map((x, j) => (j === k ? { ...x, roleId: e.target.value } : x)) })} style={{ minWidth: 200 }}><option value="">—</option>{roleOpts}</select>}
                    <button type="button" className="btn-link" onClick={() => setStep(i, { assignees: s.assignees.filter((_, j) => j !== k) })}>حذف</button>
                  </div>
                ))}
                <button type="button" className="btn secondary" onClick={() => setStep(i, { assignees: [...s.assignees, { kind: "ROLE", userId: "", roleId: "" }] })}>+ مسئول</button>
              </div>
              <div className="form-field">
                <label>مهلت (ساعت) <FieldHint label="مهلت" text="ساعت تقویمی از لحظه‌ی ساخت کار" /></label>
                <input dir="ltr" inputMode="numeric" value={s.deadlineHours} onChange={(e) => setStep(i, { deadlineHours: e.target.value.replace(/\D/g, "") })} />
              </div>
              <div className="form-field">
                <label>یادآوری (ساعت بعد از ساخت)</label>
                <input dir="ltr" inputMode="numeric" value={s.reminderHours} onChange={(e) => setStep(i, { reminderHours: e.target.value.replace(/\D/g, "") })} />
              </div>
              <div className="form-field">
                <label>تشدید به کاربر <FieldHint label="تشدید" text="بعد از گذشتن مهلت، کار «عقب‌افتاده» می‌شود و به کاربر/نقش تشدید اطلاعیه می‌رسد" /></label>
                <select value={s.escalateUserId} onChange={(e) => setStep(i, { escalateUserId: e.target.value })}><option value="">—</option>{userOpts}</select>
              </div>
              <div className="form-field">
                <label>تشدید به نقش</label>
                <select value={s.escalateRoleId} onChange={(e) => setStep(i, { escalateRoleId: e.target.value })}><option value="">—</option>{roleOpts}</select>
              </div>
              <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                <label>شرط ورود به مرحله <FieldHint label="شرط ورود" text="اختیاری؛ اگر برقرار نباشد این مرحله رد می‌شود" /></label>
                <CondEditor value={s.entryCondition} onChange={(v) => setStep(i, { entryCondition: v })} meta={meta} />
              </div>
            </div>
          </div>
        ))}
        <button type="button" className="btn secondary" onClick={() => setForm({ ...form, steps: [...form.steps, emptyStep()] })}>+ مرحله</button>
      </form>
    </FormPage>
  );
}
