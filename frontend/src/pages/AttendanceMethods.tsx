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
import { FormulaBuilder, FormulaBranch } from "../components/FormulaBuilder";
import { WorkMonthPicker } from "../components/WorkMonthPicker";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { MONTHS_FA } from "../lib/payrollLabels";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// مدیریت تردد › تنظیمات › «روش محاسبه»: تنها جای تعریف فرمول. سه نوع:
//   تردد روزانه  — برای یک عامل روزانه از «تاریخ شروع اثر»؛ هر روز آخرین روشِ با تاریخ ≤ آن روز اجرا می‌شود (در میانه‌ی ماه هم می‌توان قاعده را عوض کرد)
//   تردد ماهانه  — برای یک عامل ماهانه از «ماه اجرا» (تقویم کاری)
//   حقوق        — برای عامل حقوقی که در آن ماه روش حقوقی‌اش «ورود از تردد» است؛ نتیجه با «محاسبه تردد» ذخیره و بعداً به حقوق ارسال می‌شود
// قواعد در سرور (services/attendanceMethodService.ts).

type Kind = "DAY" | "MONTH" | "PAYROLL";
const KIND_FA: Record<Kind, string> = { DAY: "تردد روزانه", MONTH: "تردد ماهانه", PAYROLL: "حقوق" };

interface MethodRow {
  id: number;
  kind: Kind;
  kindTitle: string;
  factorId: number | null;
  payrollComponentId: number | null;
  targetTitle: string;
  execYear: number | null;
  execMonth: number | null;
  effectiveDate: string | null;
  branches: FormulaBranch[];
  locked: boolean;
  lockedReason: string;
  updatedAt?: string;
}
interface TargetOpt {
  id: number;
  title: string;
  valueTypeTitle: string;
  extra: string;
}

const whenText = (r: { effectiveDate: string | null; execYear: number | null; execMonth: number | null }) =>
  r.effectiveDate ? `از ${formatJalaliDate(r.effectiveDate)}` : r.execMonth ? `${MONTHS_FA[r.execMonth - 1] ?? r.execMonth} ${toFaDigits(String(r.execYear))}` : "";
const formulaText = (bs: FormulaBranch[]) => (bs.length > 1 ? `${toFaDigits(String(bs.length))} شاخه` : bs[0]?.conditionText ? "با شرط" : "ساده");

export default function AttendanceMethods() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <MethodForm />;
  if (location.pathname.endsWith("/edit")) return <MethodForm editId={Number(id)} />;
  return <MethodList />;
}

function MethodList() {
  const cacheKey = "/attendance-methods";
  const [items, setItems] = usePersistedState<MethodRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/attendance-methods").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: MethodRow) {
    try {
      await api.del(`/attendance-methods/${row.id}`);
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
          <InfoHint title="روش محاسبه" text="تنها جای تعریف فرمول در مدیریت تردد: روش عامل‌های تردد روزانه (از یک تاریخ)، تردد ماهانه (از یک ماه اجرا) و عامل‌های حقوقی که روش حقوقی‌شان «ورود از تردد» است (از یک ماه اجرا). روشی که از زمان اثرش به بعد برای هر کارمندی «محاسبه تردد» شده باشد قابل تغییر نیست." />
          <NewRecordButton path="/attendance-methods/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "نوع", ...s((r) => r.kindTitle), width: "120px" },
          { header: "عامل", ...s((r) => r.targetTitle) },
          { header: "زمان اثر", ...s((r) => whenText(r)), width: "170px" },
          { header: "فرمول", ...s((r) => formulaText(r.branches)), width: "110px" },
          { header: "وضعیت", ...s((r) => (r.locked ? "قفل (محاسبه شده)" : "")), width: "140px" },
        ]}
        rows={items}
        edit={{ path: (r: MethodRow) => `/attendance-methods/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

interface FormState {
  kind: Kind;
  factorId: string;
  payrollComponentId: string;
  year: number;
  month: number;
  effectiveDate: string;
  branches: FormulaBranch[];
}
const EMPTY_BRANCHES: FormulaBranch[] = [{ conditionText: "", formulaText: "" }];

function MethodForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const cacheKey = `form:${location.pathname}:form`;
  const qKind = params.get("kind");
  const [form, setForm] = usePersistedState<FormState>(cacheKey, {
    kind: qKind === "MONTH" || qKind === "PAYROLL" || qKind === "DAY" ? qKind : "DAY",
    factorId: params.get("factorId") ?? "",
    payrollComponentId: params.get("payrollComponentId") ?? "",
    year: 0,
    month: 0,
    effectiveDate: "",
    branches: EMPTY_BRANCHES,
  });
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [meta, setMeta] = useState<{ targetTitle: string; locked: boolean; lockedReason: string } | null>(null);
  const [targets, setTargets] = useState<TargetOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const [builder, setBuilder] = useState(false);
  const { flash } = useSavedFlash();

  async function load() {
    if (!editId) return;
    const r: MethodRow = await api.get(`/attendance-methods/${editId}`);
    setUpdatedAt(r.updatedAt);
    setMeta({ targetTitle: r.targetTitle, locked: r.locked, lockedReason: r.lockedReason });
    if (!hasPersistedState(cacheKey)) {
      setForm({ kind: r.kind, factorId: r.factorId ? String(r.factorId) : "", payrollComponentId: r.payrollComponentId ? String(r.payrollComponentId) : "", year: r.execYear ?? 0, month: r.execMonth ?? 0, effectiveDate: r.effectiveDate ?? "", branches: r.branches });
    }
  }
  useEffect(() => {
    load().then(() => setLoaded(true)).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // گزینه‌های «عامل»: حقوق به ماه وابسته است
  useEffect(() => {
    if (editId) return;
    const q = new URLSearchParams({ kind: form.kind });
    if (form.kind === "PAYROLL") {
      if (!form.year || !form.month) { setTargets([]); return; }
      q.set("year", String(form.year));
      q.set("month", String(form.month));
    }
    api.get(`/attendance-methods/targets?${q.toString()}`).then((r: TargetOpt[]) => setTargets(r)).catch((e) => setError(e.message));
  }, [editId, form.kind, form.kind === "PAYROLL" ? form.year : 0, form.kind === "PAYROLL" ? form.month : 0]);

  const targetId = form.kind === "PAYROLL" ? form.payrollComponentId : form.factorId;
  const targetTitle = meta?.targetTitle ?? targets.find((t) => String(t.id) === targetId)?.title ?? "";
  const locked = !!meta?.locked;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!targetId) return setError("عامل را انتخاب کنید");
    if (form.kind === "DAY" && !form.effectiveDate) return setError("تاریخ شروع اثر را وارد کنید");
    if (form.kind !== "DAY" && !form.month) return setError("ماه اجرا را انتخاب کنید");
    if (!form.branches.some((b) => b.formulaText.trim())) return setError("فرمول تعریف نشده است");
    const body = {
      kind: form.kind,
      factorId: form.kind === "PAYROLL" ? undefined : Number(form.factorId),
      payrollComponentId: form.kind === "PAYROLL" ? Number(form.payrollComponentId) : undefined,
      execYear: form.kind === "DAY" ? undefined : form.year,
      execMonth: form.kind === "DAY" ? undefined : form.month,
      effectiveDate: form.kind === "DAY" ? form.effectiveDate : undefined,
      branches: form.branches,
      updatedAt,
    };
    try {
      if (editId) {
        await api.put(`/attendance-methods/${editId}`, body);
        flash();
        await load();
      } else {
        const created = await api.post("/attendance-methods", body);
        flash();
        navigate(`/attendance-methods/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/attendance-methods/${editId}`);
      navigate("/attendance-methods");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  const setTarget = (v: string) => setForm({ ...form, ...(form.kind === "PAYROLL" ? { payrollComponentId: v } : { factorId: v }) });
  return (
    <FormPage title={editId ? "ویرایش روش محاسبه" : "روش محاسبه‌ی جدید"} formId="attendance-method-form" closePath="/attendance-methods" newPath="/attendance-methods/new" onDelete={editId && !locked ? handleDelete : undefined} saveDisabled={locked}>
      <form id="attendance-method-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {locked && <div className="banner warn" style={{ marginBottom: 8 }}>{meta?.lockedReason}</div>}
        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid">
            <div className="form-field">
              <label>نوع<RequiredMark /> <FieldHint label="نوع روش" text="حقوق: فرمولِ عامل حقوقی که روش حقوقی‌اش «ورود از تردد» است (مقدار آن بعد از «محاسبه تردد» ذخیره و به حقوق ارسال می‌شود). تردد روزانه: فرمول یک عامل روزانه که برای هر روز اجرا می‌شود. تردد ماهانه: فرمول یک عامل ماهانه." /></label>
              <select value={form.kind} disabled={!!editId} onChange={(e) => setForm({ ...form, kind: e.target.value as Kind, factorId: "", payrollComponentId: "" })}>
                {(["PAYROLL", "DAY", "MONTH"] as Kind[]).map((k) => <option key={k} value={k}>{KIND_FA[k]}</option>)}
              </select>
            </div>
            {form.kind === "DAY" ? (
              <div className="form-field">
                <label>تاریخ شروع اثر<RequiredMark /> <FieldHint label="تاریخ شروع اثر" text="هر روز، آخرین روشِ این عامل که تاریخ شروعش ≤ همان روز باشد اجرا می‌شود؛ پس برای عوض‌کردن قاعده از میانه‌ی ماه یک روش با تاریخ جدید بسازید." /></label>
                <JalaliDatePicker value={form.effectiveDate} onChange={(v) => setForm({ ...form, effectiveDate: v })} />
              </div>
            ) : (
              <div className="form-field">
                <label>ماه اجرا<RequiredMark /></label>
                <WorkMonthPicker year={form.year} month={form.month} autoFix={!editId} onChange={(y, m) => setForm({ ...form, year: y, month: m, ...(form.kind === "PAYROLL" && !editId ? { payrollComponentId: "" } : {}) })} />
              </div>
            )}
            <div className="form-field">
              <label>عامل<RequiredMark /> {form.kind === "PAYROLL" && <FieldHint label="عامل حقوق" text="فقط عامل‌های حقوقی نمایش داده می‌شوند که روش حقوقیِ مؤثرشان در ماه اجرای انتخاب‌شده «ورود از تردد» است (و از نوع مبلغی نیستند)." />}</label>
              {editId ? (
                <input value={targetTitle} disabled />
              ) : (
                <select value={targetId} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">{form.kind === "PAYROLL" && !form.month ? "ابتدا ماه اجرا را انتخاب کنید" : "انتخاب کنید"}</option>
                  {targets.map((t) => <option key={t.id} value={t.id}>{t.title}{t.extra ? ` — ${t.extra}` : ""} ({t.valueTypeTitle})</option>)}
                </select>
              )}
            </div>
            <div className="form-field">
              <label>فرمول<RequiredMark /></label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button type="button" className="btn secondary" disabled={!targetId} onClick={() => setBuilder(true)} style={{ fontFamily: "serif", fontStyle: "italic", fontSize: 16 }}>fx</button>
                {form.branches.some((b) => b.formulaText.trim()) ? <span style={{ color: "#0a8f5a" }}>فرمول تعریف شده است{form.branches.length > 1 ? ` (${toFaDigits(String(form.branches.length))} شاخه)` : ""}</span> : <span style={{ opacity: 0.6 }}>تعریف نشده</span>}
              </div>
            </div>
          </div>
        </fieldset>
      </form>
      {builder && (
        <FormulaBuilder
          factorId={form.kind === "PAYROLL" ? "" : form.factorId}
          factorTitle={targetTitle}
          attendanceLevel={form.kind === "DAY" ? "DAY" : "MONTH"}
          branches={form.branches}
          onClose={() => setBuilder(false)}
          onSave={(bs) => {
            setForm({ ...form, branches: bs });
            setBuilder(false);
          }}
        />
      )}
    </FormPage>
  );
}
