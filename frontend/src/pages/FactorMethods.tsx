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
import { RecordPickerField } from "../components/RecordPicker";
import { FormulaBuilder } from "../components/FormulaBuilder";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { KIND_FA, METHOD_FA, MONTHS_FA, VALUE_TYPE_FA, currentJalaliYearMonth } from "../lib/payrollLabels";
import { toFaDigits } from "../lib/formatAmount";

// حقوق و دستمزد › تنظیمات › روش محاسبه عامل: برای هر عامل (حکم یا حقوق) مشخص می‌شود چگونه به محاسبه‌ی ماه وارد می‌شود. رکوردها تاریخ‌دارند
// (ماه صدور / ماه اجرا)؛ روش مؤثر هر ماه، آخرین رکورد با ماه اجرا ≤ آن ماه است. فرمول (و شرط اختیاری) با پنجره‌ی فرمول‌نویس ساخته می‌شود.

interface Row {
  id: number;
  basis: "decree" | "payroll";
  factorId: number;
  factorTitle: string;
  method: string;
  kind: string;
  valueType: string;
  issueYear: number;
  issueMonth: number;
  execYear: number;
  execMonth: number;
  fixedValue: string | null;
  conditionText: string | null;
  formulaText: string | null;
  isProvisional: boolean;
  isCurrent: boolean;
}
interface Factor {
  id: number;
  title: string;
}

const ym = (y: number, m: number) => `${MONTHS_FA[m - 1]} ${toFaDigits(String(y))}`;

export default function FactorMethods() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <MethodForm />;
  if (location.pathname.endsWith("/edit")) return <MethodForm editId={Number(id)} />;
  return <MethodList />;
}

function MethodList() {
  const cacheKey = "/factor-methods";
  const [items, setItems] = usePersistedState<Row[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/payroll-methods").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: Row) {
    try {
      await api.del(`/payroll-methods/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: Row) => string, extra: object = {}) => ({ render: (r: Row) => f(r), filterType: "string" as const, filterValue: (r: Row) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            text="روش محاسبه هر عامل (حکم یا حقوق): محاسباتی با فرمول، مقدار ثابت، ورود دستی یا ورود از سیستم تردد/خزانه‌داری، همراه طبقه و نوع پارامتر. هر رکورد از «ماه اجرا» به بعد معتبر است؛ برای تغییر، رکورد جدید با ماه اجرای بعدی ثبت کنید."
            title="روش محاسبه عامل"
          />
          <NewRecordButton path="/factor-methods/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "مبنا", ...s((r) => (r.basis === "decree" ? "عامل حکم" : "عامل حقوق")), width: "100px" },
          { header: "عامل", ...s((r) => r.factorTitle) },
          { header: "روش", ...s((r) => (r.basis === "decree" ? "محاسباتی" : METHOD_FA[r.method])), width: "170px" },
          { header: "طبقه", ...s((r) => KIND_FA[r.kind]), width: "120px" },
          { header: "نوع پارامتر", ...s((r) => VALUE_TYPE_FA[r.valueType]), width: "110px" },
          { header: "ماه صدور", ...s((r) => ym(r.issueYear, r.issueMonth)), width: "130px" },
          { header: "ماه اجرا", ...s((r) => ym(r.execYear, r.execMonth)), width: "130px" },
          { header: "وضعیت", ...s((r) => (r.isProvisional ? "موقت — نیاز به تایید" : r.isCurrent ? "جاری" : "")), width: "160px" },
        ]}
        rows={items}
        edit={{ path: (r: Row) => `/factor-methods/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function MonthYear({ year, month, onChange, disabled }: { year: number; month: number; onChange: (y: number, m: number) => void; disabled?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <select disabled={disabled} value={month} onChange={(e) => onChange(year, Number(e.target.value))} style={{ flex: 1 }}>
        {MONTHS_FA.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <input disabled={disabled} dir="ltr" inputMode="numeric" value={year || ""} onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0, month)} style={{ width: 80 }} />
    </div>
  );
}

function MethodForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const cur = currentJalaliYearMonth();
  const [form, setForm] = usePersistedState(cacheKey, {
    basis: "payroll" as "decree" | "payroll",
    factorId: "",
    method: "CALCULATED",
    kind: "EARNING",
    valueType: "AMOUNT",
    issueYear: cur.year,
    issueMonth: cur.month,
    execYear: cur.year,
    execMonth: cur.month,
    fixedValue: "",
    conditionText: "",
    formulaText: "",
  });
  const [factors, setFactors] = useState<{ decree: Factor[]; payroll: Factor[] }>({ decree: [], payroll: [] });
  const [builder, setBuilder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    Promise.all([api.get("/decree-components"), api.get("/payroll-components")])
      .then(([d, p]) => setFactors({ decree: d.map((x: any) => ({ id: x.id, title: x.title })), payroll: p.filter((x: any) => x.isActive).map((x: any) => ({ id: x.id, title: x.title })) }))
      .catch(() => {});
    if (editId && !hasPersistedState(cacheKey)) {
      api.get(`/payroll-methods/${editId}`).then((r: Row) => {
        setForm({
          basis: r.basis,
          factorId: String(r.factorId),
          method: r.method,
          kind: r.kind,
          valueType: r.valueType,
          issueYear: r.issueYear,
          issueMonth: r.issueMonth,
          execYear: r.execYear,
          execMonth: r.execMonth,
          fixedValue: r.fixedValue ?? "",
          conditionText: r.conditionText ?? "",
          formulaText: r.formulaText ?? "",
        });
        setLoaded(true);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const list = form.basis === "decree" ? factors.decree : factors.payroll;
  const picked = list.find((f) => String(f.id) === form.factorId);
  const formulaActive = form.basis === "decree" || form.method === "CALCULATED";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.factorId) return setError("عامل را انتخاب کنید");
    if (formulaActive && !form.formulaText.trim()) return setError("فرمول تعریف نشده است؛ آیکن فرمول را بزنید");
    try {
      if (editId) {
        await api.put(`/payroll-methods/${editId}`, form);
        flash();
      } else {
        const created = await api.post("/payroll-methods", form);
        flash();
        navigate(`/factor-methods/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/payroll-methods/${editId}`);
      navigate("/factor-methods");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش روش محاسبه عامل" : "روش محاسبه عامل جدید"}
      formId="factor-method-form"
      closePath="/factor-methods"
      newPath="/factor-methods/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="factor-method-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>مبنا<RequiredMark /></label>
            <select
              disabled={!!editId}
              value={form.basis}
              onChange={(e) => setForm({ ...form, basis: e.target.value as "decree" | "payroll", factorId: "", method: "CALCULATED", formulaText: "", conditionText: "" })}
            >
              <option value="decree">عامل حکم</option>
              <option value="payroll">عامل حقوق</option>
            </select>
          </div>
          <div className="form-field">
            <label>عامل<RequiredMark /></label>
            <RecordPickerField<Factor>
              title={form.basis === "decree" ? "انتخاب عامل حکم" : "انتخاب عامل حقوق"}
              disabled={!!editId}
              displayValue={picked?.title ?? ""}
              rows={list}
              columns={[{ header: "عنوان", render: (f) => f.title, filterValue: (f) => f.title }]}
              onSelect={(f) => setForm({ ...form, factorId: String(f.id) })}
            />
          </div>
          {form.basis === "payroll" && (
            <div className="form-field">
              <label>روش<RequiredMark /></label>
              <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value, ...(e.target.value !== "CALCULATED" ? { formulaText: "", conditionText: "" } : {}) })}>
                {Object.entries(METHOD_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          )}
          <div className="form-field">
            <label>طبقه<RequiredMark /></label>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {Object.entries(KIND_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>نوع پارامتر<RequiredMark /> <FieldHint label="نوع پارامتر" text="نوع مقدار این عامل: عدد، ساعت دقیقه، روز یا مبلغ" /></label>
            <select value={form.valueType} onChange={(e) => setForm({ ...form, valueType: e.target.value })}>
              {Object.entries(VALUE_TYPE_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>ماه صدور<RequiredMark /></label>
            <MonthYear year={form.issueYear} month={form.issueMonth} onChange={(y, m) => setForm({ ...form, issueYear: y, issueMonth: m })} />
          </div>
          <div className="form-field">
            <label>ماه اجرا<RequiredMark /> <FieldHint label="ماه اجرا" text="از این ماه به بعد این روش در محاسبه به کار می‌رود (تا رکورد بعدی همین عامل)" /></label>
            <MonthYear year={form.execYear} month={form.execMonth} onChange={(y, m) => setForm({ ...form, execYear: y, execMonth: m })} />
          </div>
          {form.basis === "payroll" && form.method === "FIXED" && (
            <div className="form-field">
              <label>مقدار ثابت<RequiredMark /></label>
              <input dir="ltr" inputMode="decimal" value={form.fixedValue} onChange={(e) => setForm({ ...form, fixedValue: e.target.value.replace(/[^0-9.]/g, "") })} />
            </div>
          )}
          <div className="form-field">
            <label>فرمول</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                className="btn secondary"
                disabled={!formulaActive || !form.factorId}
                title={formulaActive ? (form.factorId ? "ویرایش فرمول" : "ابتدا عامل را انتخاب کنید") : "فقط برای عامل حکم یا روش محاسباتی"}
                onClick={() => setBuilder(true)}
                style={{ fontFamily: "serif", fontStyle: "italic", fontSize: 16 }}
              >
                fx
              </button>
              {formulaActive && (form.formulaText.trim() ? <span style={{ color: "#0a8f5a" }}>فرمول تعریف شده است{form.conditionText.trim() ? " (با شرط)" : ""}</span> : <span style={{ opacity: 0.6 }}>تعریف نشده</span>)}
            </div>
          </div>
        </div>
      </form>
      {builder && (
        <FormulaBuilder
          basis={form.basis}
          factorId={form.factorId}
          method={form.method}
          kind={form.kind}
          conditionText={form.conditionText}
          formulaText={form.formulaText}
          onClose={() => setBuilder(false)}
          onSave={(c, f) => {
            setForm({ ...form, conditionText: c, formulaText: f });
            setBuilder(false);
          }}
        />
      )}
    </FormPage>
  );
}
