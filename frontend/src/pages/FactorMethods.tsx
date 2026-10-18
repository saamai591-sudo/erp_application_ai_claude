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
import { WorkMonthPicker } from "../components/WorkMonthPicker";
import { FormulaBuilder } from "../components/FormulaBuilder";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { METHOD_FA, MONTHS_FA, VALUE_TYPE_FA, currentJalaliYearMonth } from "../lib/payrollLabels";
import { toFaDigits } from "../lib/formatAmount";

// حقوق و دستمزد › تنظیمات › روش محاسبه عامل: برای هر عامل (حکم یا حقوق) مشخص می‌شود چگونه به محاسبه‌ی ماه وارد می‌شود. رکوردها تاریخ‌دارند
// (ماه صدور / ماه اجرا)؛ روش مؤثر هر ماه، آخرین رکورد با ماه اجرا ≤ آن ماه است. فرمول (و شرط اختیاری) با پنجره‌ی فرمول‌نویس ساخته می‌شود.

interface Row {
  id: number;
  basis: "decree" | "payroll";
  factorId: number;
  factorTitle: string;
  method: string;
  valueType: string;
  issueYear: number;
  issueMonth: number;
  execYear: number;
  execMonth: number;
  branches: { conditionText: string; formulaText: string }[];
  /** مبناهایی که این روش (عامل) عضو آن‌هاست */
  basisIds?: number[];
  /** مبناهایی که آگاهانه «بدون تأثیر» تعیین شده‌اند (مبنایی که در هیچ‌یک از دو فهرست نیست = تعیین‌نشده) */
  noEffectBasisIds?: number[];
  isProvisional: boolean;
  isCurrent: boolean;
  locked?: boolean;
  lockMessage?: string | null;
}
interface Factor {
  id: number;
  title: string;
  /** طبقه‌ی عامل حقوق (برای عامل حکم همیشه پرداختی) */
  kind?: string;
}
interface BasisOpt {
  id: number;
  title: string;
  source: "DECREE" | "CALC";
  isActive: boolean;
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
            text="روش محاسبه هر عامل (حکم یا حقوق): محاسباتی با فرمول، مقدار ثابت، ورود دستی یا ورود از سیستم تردد/خزانه‌داری، همراه نوع پارامتر. هر رکورد از «ماه اجرا» به بعد معتبر است؛ مثلاً برای عاملی که تا امروز دستی وارد می‌شد، رکورد جدید با روش «ورود از سیستم تردد» و ماه اجرای بعدی ثبت کنید؛ نیازی به تعریف عامل تازه نیست."
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
          { header: "نوع پارامتر", ...s((r) => VALUE_TYPE_FA[r.valueType]), width: "110px" },
          { header: "ماه صدور", ...s((r) => ym(r.issueYear, r.issueMonth)), width: "130px" },
          { header: "ماه اجرا", ...s((r) => ym(r.execYear, r.execMonth)), width: "130px" },
          { header: "وضعیت", ...s((r) => (r.locked ? "قفل (مبنای محاسبه)" : r.isProvisional ? "موقت — نیاز به تایید" : r.isCurrent ? "جاری" : "")), width: "160px" },
        ]}
        rows={items}
        edit={{ path: (r: Row) => `/factor-methods/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function MonthYear({ year, month, onChange, disabled, autoFix }: { year: number; month: number; onChange: (y: number, m: number) => void; disabled?: boolean; autoFix?: boolean }) {
  // فقط ماه‌های تعریف‌شده در «تقویم کاری». روش جدید: اگر ماه پیش‌فرض در تقویم نبود خودکار به اولین ماه تقویم می‌رود؛ رکورد موجود دست نمی‌خورد
  return <WorkMonthPicker year={year} month={month} disabled={disabled} autoFix={!!autoFix} onChange={onChange} />;
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
    valueType: "AMOUNT",
    issueYear: cur.year,
    issueMonth: cur.month,
    execYear: cur.year,
    execMonth: cur.month,
    branches: [] as { conditionText: string; formulaText: string }[],
    basisIds: [] as number[],
    noEffectBasisIds: [] as number[],
  });
  const [bases, setBases] = useState<BasisOpt[]>([]);
  const [prefillNote, setPrefillNote] = useState<string | null>(null);
  const [factors, setFactors] = useState<{ decree: Factor[]; payroll: Factor[] }>({ decree: [], payroll: [] });
  const [builder, setBuilder] = useState(false);
  const [lockMessage, setLockMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    Promise.all([api.get("/decree-components"), api.get("/payroll-components")])
      .then(([d, p]) => setFactors({ decree: d.map((x: any) => ({ id: x.id, title: x.title, kind: "EARNING" })), payroll: p.filter((x: any) => x.isActive).map((x: any) => ({ id: x.id, title: x.title, kind: x.kind })) }))
      .catch(() => {});
    api
      .get("/payroll-parameters")
      .then((rows: any[]) => setBases(rows.filter((r) => r.kind === "BASIS").map((r) => ({ id: r.id, title: r.title, source: r.basisSource, isActive: r.isActive }))))
      .catch(() => {});
    if (editId) api.get(`/payroll-methods/${editId}`).then((r: Row) => setLockMessage(r.locked ? r.lockMessage ?? "این روش در محاسبه‌ی حقوق استفاده شده و قفل است" : null)).catch(() => {});
    if (editId && !hasPersistedState(cacheKey)) {
      api.get(`/payroll-methods/${editId}`).then((r: Row) => {
        setForm({
          basis: r.basis,
          factorId: String(r.factorId),
          method: r.method,
          valueType: r.valueType,
          issueYear: r.issueYear,
          issueMonth: r.issueMonth,
          execYear: r.execYear,
          execMonth: r.execMonth,
          branches: r.branches ?? [],
          basisIds: r.basisIds ?? [],
          noEffectBasisIds: r.noEffectBasisIds ?? [],
        });
        setLoaded(true);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const list = form.basis === "decree" ? factors.decree : factors.payroll;
  const picked = list.find((f) => String(f.id) === form.factorId);
  const formulaActive = form.basis === "decree" || form.method === "CALCULATED";
  // state ذخیره‌شده‌ی قدیمی (قبل از شاخه‌ها) شاخه ندارد
  const branches = form.branches ?? [];
  const basisIds = form.basisIds ?? [];
  const noEffectIds = form.noEffectBasisIds ?? [];
  // مبنا: عامل حکم هر مبنا؛ عامل حقوق فقط طبقه‌ی «پرداختی» و فقط مبنای منبع «محاسبات»
  const showBases = !!picked && (form.basis === "decree" || picked.kind === "EARNING");
  const applicableBases = bases.filter((b) => (form.basis === "decree" || b.source === "CALC") && (b.isActive || basisIds.includes(b.id) || noEffectIds.includes(b.id)));
  const stateOf = (id: number): "" | "YES" | "NO" => (basisIds.includes(id) ? "YES" : noEffectIds.includes(id) ? "NO" : "");
  const setState = (id: number, v: string) =>
    setForm({ ...form, basisIds: [...basisIds.filter((x) => x !== id), ...(v === "YES" ? [id] : [])], noEffectBasisIds: [...noEffectIds.filter((x) => x !== id), ...(v === "NO" ? [id] : [])] });

  // عامل انتخاب می‌شود: روش جدید از «آخرین رکورد روش همان عامل» پر می‌شود (فرمول، روش، نوع پارامتر، مبناها)؛ فقط ماه صدور/اجرا را کاربر تعیین می‌کند
  async function pickFactor(f: Factor) {
    const base = { ...form, factorId: String(f.id), basisIds: [] as number[], noEffectBasisIds: [] as number[] };
    setPrefillNote(null);
    if (editId) return setForm({ ...base, basisIds, noEffectBasisIds: noEffectIds });
    try {
      const rows: Row[] = await api.get("/payroll-methods");
      const prev = rows.filter((r) => r.basis === form.basis && r.factorId === f.id).sort((a, b) => b.execYear * 12 + b.execMonth - (a.execYear * 12 + a.execMonth))[0];
      const pristine = (form.branches ?? []).length === 0;
      if (prev && pristine) {
        setForm({ ...base, method: form.basis === "decree" ? "CALCULATED" : prev.method, valueType: prev.valueType, branches: prev.branches ?? [], basisIds: prev.basisIds ?? [], noEffectBasisIds: prev.noEffectBasisIds ?? [] });
        setPrefillNote(`روش و فرمول از آخرین رکورد این عامل (ماه اجرای ${ym(prev.execYear, prev.execMonth)}) پر شد؛ ماه صدور و ماه اجرای رکورد جدید را مشخص کنید و تغییرات را بدهید`);
      } else setForm(base);
    } catch {
      setForm(base);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.factorId) return setError("عامل را انتخاب کنید");
    if (formulaActive && !branches.some((b) => b.formulaText.trim())) return setError("فرمول تعریف نشده است؛ آیکن فرمول را بزنید");
    const undecided = showBases ? applicableBases.filter((b) => b.isActive && stateOf(b.id) === "") : [];
    if (undecided.length > 0) return setError(`برای مبناهای زیر باید «با تأثیر» یا «بدون تأثیر» را انتخاب کنید: ${undecided.map((b) => `«${b.title}»`).join("، ")}`);
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
      onDelete={editId && !lockMessage ? handleDelete : undefined}
      saveDisabled={!!lockMessage}
    >
      <form id="factor-method-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {lockMessage && <div className="alert error" style={{ marginBottom: 8 }}>{lockMessage}</div>}
        <fieldset disabled={!!lockMessage} style={{ border: "none", padding: 0, margin: 0 }}>
        <div className="form-grid">
          <div className="form-field">
            <label>مبنا<RequiredMark /></label>
            <select
              disabled={!!editId}
              value={form.basis}
              onChange={(e) => {
                setPrefillNote(null);
                setForm({ ...form, basis: e.target.value as "decree" | "payroll", factorId: "", method: "CALCULATED", branches: [], basisIds: [], noEffectBasisIds: [] });
              }}
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
              onSelect={(f) => void pickFactor(f)}
            />
          </div>
          {form.basis === "payroll" && (
            <div className="form-field">
              <label>روش<RequiredMark /></label>
              <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value, ...(e.target.value !== "CALCULATED" ? { branches: [] } : {}) })}>
                {Object.entries(METHOD_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          )}
          <div className="form-field">
            <label>نوع پارامتر<RequiredMark /> <FieldHint label="نوع پارامتر" text="نوع مقدار این عامل: عدد، ساعت دقیقه، روز یا مبلغ" /></label>
            <select value={form.valueType} onChange={(e) => setForm({ ...form, valueType: e.target.value })}>
              {Object.entries(VALUE_TYPE_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>ماه صدور<RequiredMark /></label>
            <MonthYear autoFix={!editId} year={form.issueYear} month={form.issueMonth} onChange={(y, m) => setForm({ ...form, issueYear: y, issueMonth: m })} />
          </div>
          <div className="form-field">
            <label>ماه اجرا<RequiredMark /> <FieldHint label="ماه اجرا" text="از این ماه به بعد این روش در محاسبه به کار می‌رود (تا رکورد بعدی همین عامل)" /></label>
            <MonthYear autoFix={!editId} year={form.execYear} month={form.execMonth} onChange={(y, m) => setForm({ ...form, execYear: y, execMonth: m })} />
          </div>
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
              {formulaActive && (branches.some((b) => b.formulaText.trim()) ? <span style={{ color: "#0a8f5a" }}>فرمول تعریف شده است{branches.length > 1 ? ` (${branches.length} شاخه)` : branches[0]?.conditionText.trim() ? " (با شرط)" : ""}</span> : <span style={{ opacity: 0.6 }}>تعریف نشده</span>)}
            </div>
          </div>
        </div>
        {prefillNote && <div className="alert" style={{ marginTop: 8 }}>{prefillNote}</div>}
        {showBases && (
          <>
            <h3 className="hr-section">
              مبناهای مؤثر <FieldHint label="مبناهای مؤثر" text="برای هر مبنا باید آگاهانه «با تأثیر» (این عامل در مبنا جمع شود) یا «بدون تأثیر» را انتخاب کنید؛ «—» یعنی هنوز تعیین نشده و ذخیره انجام نمی‌شود. تصمیم از ماه اجرای این رکورد به بعد است. تغییر آن در گذر زمان در گذر زمان = رکورد روش جدید با ماه اجرای جدید. برای افزودن یک مبنا به چند عامل یک‌جا از «پارامترهای مبنا» ← همان مبنا استفاده کنید" />
            </h3>
            {applicableBases.length === 0 ? (
              <p style={{ opacity: 0.7, fontSize: 13 }}>
                {bases.length === 0 ? "مبنایی تعریف نشده است؛ در «پارامترهای مبنا» با نوع «مبنا» تعریف کنید." : "مبنای مناسب این عامل وجود ندارد (عامل حقوق فقط در مبناهای منبع «محاسبات» عضو می‌شود)."}
              </p>
            ) : (
              <table className="hr-table" style={{ maxWidth: 560 }}>
                <thead>
                  <tr><th>مبنا</th><th style={{ width: 150 }}>تأثیر</th><th style={{ width: 90 }}>منبع</th></tr>
                </thead>
                <tbody>
                  {applicableBases.map((b) => {
                    const st = stateOf(b.id);
                    return (
                      <tr key={b.id}>
                        <td>{b.title}{!b.isActive ? <span style={{ opacity: 0.6, fontSize: 12 }}> — غیرفعال</span> : null}</td>
                        <td>
                          <select value={st} onChange={(e) => setState(b.id, e.target.value)} style={{ width: "100%", borderColor: st === "" ? "#d97706" : undefined }}>
                            <option value="">—</option>
                            <option value="YES">با تأثیر</option>
                            <option value="NO">بدون تأثیر</option>
                          </select>
                        </td>
                        <td>{b.source === "DECREE" ? "حکم" : "محاسبات"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
        </fieldset>
      </form>
      {builder && (
        <FormulaBuilder
          basis={form.basis}
          factorId={form.factorId}
          factorTitle={picked?.title ?? ""}
          method={form.method}
          branches={branches}
          basisIds={basisIds}
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
