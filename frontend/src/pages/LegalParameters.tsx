import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { AmountInput } from "../components/AmountInput";
import { Modal } from "../components/Modal";
import { RecordPickerDialog } from "../components/RecordPicker";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePermissions } from "../lib/usePermissions";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { MONTHS_FA, currentJalaliYearMonth } from "../lib/payrollLabels";
import { WorkMonthPicker } from "../components/WorkMonthPicker";

// حقوق و دستمزد › تنظیمات › پارامترهای مبنا: هر پارامتر یک تعریف (کلید ثابت، نوع) + مقدارهای تاریخ‌دار است. مقدار معتبر هر تاریخ، آخرین مقدار با
// ماه اجرا ≤ آن تاریخ است؛ تغییر سالانه‌ی قانون = یک مقدار جدید با ماه اجرای جدید (بدون تغییر کد). مقداری که در محاسبه استفاده شده قفل است
// و مقدار جدید فقط برای ماهی بعد از آخرین ماهِ محاسبه‌شده ثبت می‌شود.

const DECREE_MODE_FA: Record<string, string> = { LAST: "آخرین مقدار حکم", AVG: "میانگین حکم" };
const TYPE_FA: Record<string, string> = { NUMBER: "عدد", AMOUNT: "مبلغ", BRACKETS: "جدول پلکانی" };
// «نوع» = مقدار ثابت (مقدارهای تاریخ‌دار؛ «نوع داده» عدد/مبلغ/جدول پلکانی) یا مبنا (بدون مقدار؛ جمع مبلغ عامل‌های عضو، با «منبع داده» حکم یا محاسبات)
const KIND_FA: Record<string, string> = {
  CONSTANT: "مقدار ثابت",
  BASIS: "مبنا",
  PERSONNEL_HR: "مقدار ثابت پرسنلی - منابع انسانی",
  PERSONNEL_PAYROLL: "مقدار ثابت پرسنلی - حقوقی",
};
/** مقدار ثابت پرسنلی: مقدار هر کارمند جداگانه ثبت می‌شود (نه در همین فرم)؛ ثبت‌نشده = صفر */
const isPersonnel = (k: string) => k === "PERSONNEL_HR" || k === "PERSONNEL_PAYROLL";
const SOURCE_FA: Record<string, string> = { DECREE: "حکم", CALC: "محاسبات" };

interface BracketRow {
  from: string;
  to: string | null;
  rate: string;
}
interface ValueRow {
  id: number;
  effectiveDate: string;
  execYear: number;
  execMonth: number;
  /** در محاسبه‌ی حقوق استفاده شده؛ ویرایش و حذف ممنوع */
  locked: boolean;
  lockedReason: string | null;
  value: string | null;
  note: string | null;
  brackets: BracketRow[];
}
interface ParamRow {
  id: number;
  key: string;
  title: string;
  type: string;
  kind: string;
  basisSource: string | null;
  decreeValueMode?: string | null;
  memberCount: number;
  employeeValueCount?: number;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  valueCount: number;
  current: ValueRow | null;
}
interface ParamDetail {
  id: number;
  key: string;
  title: string;
  type: string;
  kind: string;
  basisSource: string | null;
  decreeValueMode?: string | null;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  lastCalculated: { year: number; month: number } | null;
  values: ValueRow[];
}

const monthText = (y: number, m: number) => `${MONTHS_FA[m - 1]} ${toFaDigits(String(y))}`;
const fmtNum = (v: string | null) => (v === null ? "" : toFaDigits(Number(v).toLocaleString("en-US", { maximumFractionDigits: 4 })));
function valueText(type: string, v: ValueRow | null): string {
  if (!v) return "تعریف نشده";
  if (type === "BRACKETS") return `${toFaDigits(String(v.brackets.length))} پله`;
  return fmtNum(v.value);
}

export default function LegalParameters() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <ParamForm />;
  if (location.pathname.endsWith("/edit")) return <ParamForm editId={Number(id)} />;
  return <ParamList />;
}

function ParamList() {
  const cacheKey = "/legal-parameters";
  const [items, setItems] = usePersistedState<ParamRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    api.get("/payroll-parameters").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: ParamRow) {
    try {
      await api.del(`/payroll-parameters/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  const s = (f: (r: ParamRow) => string, extra: object = {}) => ({ render: (r: ParamRow) => f(r), filterType: "string" as const, filterValue: (r: ParamRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            text="پارامترهای مبنا حقوق، دو نوع: «مقدار ثابت» (نرخ بیمه، سقف بیمه، حداقل دستمزد، جدول مالیات) و «مبنا» (درآمد مشمول بیمه/مالیات، مبنای اضافه‌کار، مبنای سنوات؛ بدون مقدار؛ مقدارش جمع مبلغ عامل‌های عضو است و اعضا در «روش محاسبه عامل» یا با عمل گروهی از همین فرم مشخص می‌شوند). هر مقدار ثابت مقدارهای تاریخ‌دار دارد؛ برای تغییر سالانه، مقدار جدید با ماه اجرای جدید ثبت کنید (ماه اجرا باید بعد از آخرین ماهِ محاسبه‌شده باشد). مقداری که در محاسبه‌ی حقوق استفاده شده قابل ویرایش و حذف نیست. با ثبت هر ردیف، مقدار معتبر است و نیازی به تایید ندارد."
            title="پارامترهای مبنا"
          />
          <NewRecordButton path="/legal-parameters/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "عنوان", ...s((r) => r.title) },
          { header: "نوع", ...s((r) => KIND_FA[r.kind] ?? r.kind), width: "190px" },
          { header: "نوع داده", ...s((r) => (r.kind === "BASIS" ? "—" : TYPE_FA[r.type])), width: "110px" },
          { header: "منبع داده", ...s((r) => (r.kind === "BASIS" ? (SOURCE_FA[r.basisSource ?? ""] ?? "") + (r.basisSource === "DECREE" && r.decreeValueMode ? ` (${DECREE_MODE_FA[r.decreeValueMode] ?? ""})` : "") : "—")), width: "170px" },
          { header: "مقدار فعلی", ...s((r) => (r.kind === "BASIS" ? "بدون مقدار (جمع اعضا)" : isPersonnel(r.kind) ? "مقدار هر کارمند" : valueText(r.type, r.current))), width: "170px" },
          { header: "ماه اجرا", ...s((r) => (r.kind !== "BASIS" && !isPersonnel(r.kind) && r.current ? monthText(r.current.execYear, r.current.execMonth) : "—")), width: "130px" },
          { header: "سیستمی", ...s((r) => (r.isSystem ? "بله" : "")), width: "80px" },
        ]}
        rows={items}
        edit={{ path: (r: ParamRow) => `/legal-parameters/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function ParamForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { title: "", kind: "CONSTANT", type: "NUMBER", basisSource: "CALC", decreeValueMode: "", description: "", isActive: true });
  const [detail, setDetail] = useState<ParamDetail | null>(null);
  const [valueDlg, setValueDlg] = useState<{ value: ValueRow | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  async function reload(fillForm = true) {
    if (!editId) return;
    const d: ParamDetail = await api.get(`/payroll-parameters/${editId}`);
    setDetail(d);
    if (fillForm) setForm({ title: d.title, kind: d.kind, type: d.type, basisSource: d.basisSource ?? "CALC", decreeValueMode: d.decreeValueMode ?? "", description: d.description ?? "", isActive: d.isActive });
  }

  useEffect(() => {
    if (editId) reload(!hasPersistedState(cacheKey)).then(() => setLoaded(true)).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    if (!editId && form.kind === "BASIS" && form.basisSource === "DECREE" && !form.decreeValueMode) return setError("مقدار حکم را مشخص کنید: آخرین مقدار حکم یا میانگین حکم");
    try {
      if (editId) {
        await api.put(`/payroll-parameters/${editId}`, { title: form.title, description: form.description, isActive: form.isActive });
        flash();
        await reload(false);
      } else {
        const created = await api.post("/payroll-parameters", { title: form.title, kind: form.kind, type: form.type, basisSource: form.basisSource, decreeValueMode: form.basisSource === "DECREE" ? form.decreeValueMode : undefined, description: form.description });
        flash();
        navigate(`/legal-parameters/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/payroll-parameters/${editId}`);
      navigate("/legal-parameters");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function removeValue(v: ValueRow) {
    if (!window.confirm(`مقدار با ماه اجرای ${monthText(v.execYear, v.execMonth)} حذف شود؟`)) return;
    try {
      await api.del(`/payroll-parameters/values/${v.id}`);
      await reload(false);
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  const canEdit = hasPermission("payroll.settings.legal-parameters.edit");
  const isSystem = !!detail?.isSystem;
  const type = detail?.type ?? form.type;
  const kind = detail?.kind ?? form.kind;
  const basisSource = detail?.basisSource ?? form.basisSource;

  return (
    <FormPage
      title={editId ? `پارامتر مبنا${detail ? ` — ${detail.title}` : ""}` : "پارامتر مبنا جدید"}
      formId="legal-param-form"
      closePath="/legal-parameters"
      newPath="/legal-parameters/new"
      onDelete={editId && !isSystem ? handleDelete : undefined}
      wide
    >
      <form id="legal-param-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>نوع<RequiredMark /> <FieldHint label="نوع" text="مقدار ثابت: مقدارهای تاریخ‌دار دارد (نرخ، سقف، جدول). مبنا: مقدار ندارد و در فرمول جمع مبلغ عامل‌های عضو را می‌دهد؛ اعضا را در «روش محاسبه عامل» هر عامل (یا با عمل گروهی همین فرم) مشخص کنید. مقدار ثابت پرسنلی: مقدار هر کارمند جداگانه و تاریخ‌دار ثبت می‌شود و ثبت‌نشده صفر است؛ «منابع انسانی» در تب مقادیر ثابت فرم کارمند و «حقوقی» در فرم «مقادیر ثابت پرسنل» وارد می‌شود" /></label>
            <select disabled={!!editId} value={kind} onChange={(e) => setForm({ ...form, kind: e.target.value, type: isPersonnel(e.target.value) && form.type === "BRACKETS" ? "NUMBER" : form.type })}>
              {Object.entries(KIND_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {kind === "BASIS" ? (
            <div className="form-field">
              <label>منبع داده<RequiredMark /> <FieldHint label="منبع داده" text="حکم: جمع مقدارِ خامِ عامل‌های حکمِ عضو (مثلاً پایه‌ی سنوات روزانه‌ی حکم). محاسبات: جمع مبلغ محاسبه‌شده‌ی عضوها در فیش همان ماه (عامل حکم یا عامل حقوق از طبقه‌ی پرداختی)؛ عامل حقوق فقط در مبنای منبع محاسبات عضو می‌شود" /></label>
              <select disabled={!!editId} value={basisSource ?? "CALC"} onChange={(e) => setForm({ ...form, basisSource: e.target.value })}>
                {Object.entries(SOURCE_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          ) : null}
          {kind === "BASIS" && basisSource === "DECREE" ? (
            <div className="form-field">
              <label>مقدار حکم<RequiredMark /> <FieldHint label="مقدار حکم" text="آخرین مقدار حکم: مقدار عامل در آخرین حکم تأییدشده تا پایان ماه. میانگین حکم: میانگین وزنی بر روزِ مقدارهای حکم از ابتدای سال (یا اولین حکم) تا پایان ماه. این انتخاب بعد از ثبت قابل تغییر نیست." /></label>
              <select disabled={!!editId} value={editId ? detail?.decreeValueMode ?? "" : form.decreeValueMode} onChange={(e) => setForm({ ...form, decreeValueMode: e.target.value })} style={!editId && !form.decreeValueMode ? { borderColor: "#d97706" } : undefined}>
                <option value="">—</option>
                {Object.entries(DECREE_MODE_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          ) : (
            <div className="form-field">
              <label>نوع داده<RequiredMark /></label>
              <select disabled={!!editId} value={type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {Object.entries(TYPE_FA).filter(([k]) => !(isPersonnel(kind) && k === "BRACKETS")).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          )}
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
        </div>
      </form>

      {editId && detail && detail.kind === "BASIS" && <MembersSection param={detail} canEdit={canEdit} />}

      {editId && detail && isPersonnel(detail.kind) && (
        <p className="hr-note" style={{ opacity: 0.85 }}>
          مقدار این پارامتر برای هر کارمند جداگانه و از یک ماه اجرا به بعد ثبت می‌شود
          {detail.kind === "PERSONNEL_HR" ? " (تب «مقادیر ثابت» فرم کارمند، توسط منابع انسانی)" : " (فرم «مقادیر ثابت پرسنل»، توسط واحد حقوق)"}؛ برای کارمندی که مقداری ندارد، مقدار صفر در نظر گرفته می‌شود. در فرمول می‌توانید با یک شرط (مثلاً «اگر مقدار صفر بود، نرخ ثابت») پیش‌فرض بگذارید.
        </p>
      )}

      {editId && detail && detail.kind !== "BASIS" && !isPersonnel(detail.kind) && (
        <>
          <h3 className="hr-section" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            مقدارهای تاریخ‌دار
            {canEdit && (
              <button type="button" className="btn secondary" onClick={() => setValueDlg({ value: null })}>افزودن مقدار جدید</button>
            )}
          </h3>
          <table className="hr-table">
            <thead>
              <tr><th style={{ width: 150 }}>ماه اجرا</th><th>مقدار</th><th>توضیح</th><th style={{ width: 170 }} /></tr>
            </thead>
            <tbody>
              {detail.values.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: "center", opacity: 0.7 }}>هنوز مقداری ثبت نشده است</td></tr>
              )}
              {detail.values.map((v, i) => (
                <tr key={v.id}>
                  <td>
                    {monthText(v.execYear, v.execMonth)}{i === 0 ? " (آخرین)" : ""}
                    {v.locked && <span title={v.lockedReason ?? ""} style={{ marginInlineStart: 6, opacity: 0.75, fontSize: 12 }}>🔒 استفاده‌شده</span>}
                  </td>
                  <td>
                    {detail.type === "BRACKETS" ? (
                      <BracketsView rows={v.brackets} />
                    ) : (
                      valueText(detail.type, v)
                    )}
                  </td>
                  <td>{v.note ?? ""}</td>
                  <td>
                    {canEdit && (
                      <>
                        <button type="button" className="link-btn" disabled={v.locked} title={v.locked ? v.lockedReason ?? "" : undefined} onClick={() => setValueDlg({ value: v })}>ویرایش</button>{" "}
                        <button type="button" className="link-btn" disabled={v.locked} title={v.locked ? v.lockedReason ?? "" : undefined} onClick={() => removeValue(v)}>حذف</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {valueDlg && detail && (
        <ValueDialog
          param={detail}
          value={valueDlg.value}
          onClose={() => setValueDlg(null)}
          onDone={async () => {
            setValueDlg(null);
            await reload(false);
          }}
        />
      )}
    </FormPage>
  );
}

function BracketsView({ rows }: { rows: BracketRow[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {rows.map((b, i) => (
        <span key={i}>
          از {fmtNum(b.from)} {b.to === null ? "به بالا" : `تا ${fmtNum(b.to)}`} — {toFaDigits(String(Number(b.rate)))}٪
        </span>
      ))}
    </div>
  );
}

function ValueDialog({ param, value, onClose, onDone }: { param: ParamDetail; value: ValueRow | null; onClose: () => void; onDone: () => void }) {
  const isBr = param.type === "BRACKETS";
  // پیش‌فرض ماه اجرای مقدار جدید: ماهِ بعد از آخرین مقدار و بعد از آخرین ماهِ محاسبه‌شده (و نه قبل از ماه جاری)
  const [exec, setExec] = useState<{ year: number; month: number }>(() => {
    if (value) return { year: value.execYear, month: value.execMonth };
    const cur = currentJalaliYearMonth();
    let k = cur.year * 12 + cur.month - 1;
    const after = (y: number, m: number) => { k = Math.max(k, y * 12 + m); };
    const latest = param.values[0];
    if (latest) after(latest.execYear, latest.execMonth);
    if (param.lastCalculated) after(param.lastCalculated.year, param.lastCalculated.month);
    return { year: Math.floor(k / 12), month: (k % 12) + 1 };
  });
  const [val, setVal] = useState(value?.value !== null && value?.value !== undefined ? String(Number(value.value)) : "");
  const [note, setNote] = useState(value?.note ?? "");
  const [rows, setRows] = useState<{ from: string; to: string; rate: string }[]>(
    value && value.brackets.length
      ? value.brackets.map((b) => ({ from: String(Number(b.from)), to: b.to === null ? "" : String(Number(b.to)), rate: String(Number(b.rate)) }))
      : [{ from: "0", to: "", rate: "" }]
  );
  const [err, setErr] = useState<string | null>(null);
  const num = (s: string) => s.replace(/[^0-9.]/g, "");

  // «از» هر پله همیشه برابر «تا»ی پله‌ی قبل است
  function setRow(i: number, p: Partial<{ to: string; rate: string }>) {
    const next = rows.map((r, k) => (k === i ? { ...r, ...p } : r));
    for (let k = 1; k < next.length; k++) next[k] = { ...next[k], from: next[k - 1].to };
    setRows(next);
  }
  function addRow() {
    const last = rows[rows.length - 1];
    setRows([...rows, { from: last.to, to: "", rate: "" }]);
  }

  async function save() {
    setErr(null);
    const body: any = { execYear: exec.year, execMonth: exec.month, note };
    if (isBr) body.brackets = rows.map((r) => ({ from: r.from, to: r.to === "" ? null : r.to, rate: r.rate }));
    else body.value = val;
    try {
      if (value) await api.put(`/payroll-parameters/values/${value.id}`, body);
      else await api.post(`/payroll-parameters/${param.id}/values`, body);
      onDone();
    } catch (e) {
      setErr((e as ApiError).message);
    }
  }

  return (
    <Modal title={`${value ? "ویرایش" : "مقدار جدید"} — ${param.title}`} onClose={onClose} wide={isBr}>
      <ErrorToast message={err} />
      <div className="form-grid">
        <div className="form-field">
          <label>ماه اجرا<RequiredMark /> <FieldHint label="ماه اجرا" text="از ابتدای این ماه به بعد این مقدار در محاسبه به کار می‌رود (تا مقدار بعدی)؛ باید بعد از ماه اجرای آخرین مقدار و بعد از آخرین ماهِ محاسبه‌شده‌ی حقوق باشد" /></label>
          <WorkMonthPicker year={exec.year} month={exec.month} autoFix={false} onChange={(y, m) => setExec({ year: y, month: m })} />
          {param.lastCalculated && (
            <div style={{ opacity: 0.7, fontSize: 12, marginTop: 2 }}>آخرین ماهِ محاسبه‌شده: {monthText(param.lastCalculated.year, param.lastCalculated.month)}</div>
          )}
        </div>
        {!isBr && (
          <div className="form-field">
            <label>مقدار<RequiredMark /></label>
            <AmountInput value={val} onChange={setVal} allowDecimal />
          </div>
        )}
        <div className="form-field" style={{ gridColumn: "1 / -1" }}>
          <label>توضیح (مثلاً مرجع مصوبه)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      {isBr && (
        <>
          <table className="hr-table">
            <thead>
              <tr><th style={{ width: 40 }}>#</th><th>از (ریال)</th><th>تا (ریال؛ خالی = بی‌نهایت)</th><th style={{ width: 130 }}>نرخ (٪)</th><th style={{ width: 60 }} /></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{toFaDigits(String(i + 1))}</td>
                  <td><AmountInput value={r.from} onChange={() => {}} allowDecimal disabled /></td>
                  <td><AmountInput value={r.to} onChange={(v) => setRow(i, { to: v })} allowDecimal /></td>
                  <td><AmountInput value={r.rate} onChange={(v) => setRow(i, { rate: v })} allowDecimal /></td>
                  <td>
                    {rows.length > 1 && i === rows.length - 1 && (
                      <button type="button" className="link-btn" onClick={() => setRows(rows.slice(0, -1))}>حذف</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="btn secondary" onClick={addRow} disabled={rows[rows.length - 1].to === ""}>
            افزودن پله
          </button>
        </>
      )}
      <div className="actions">
        <button type="button" className="btn" onClick={save}>ثبت</button>
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
      </div>
    </Modal>
  );
}

interface MemberRow {
  basis: "decree" | "payroll";
  factorId: number;
  title: string;
  methodId: number;
  execYear: number;
  execMonth: number;
}
interface CandidateRow {
  basis: "decree" | "payroll";
  id: number;
  title: string;
  key: string;
}
interface BulkResult {
  basis: string;
  factorId: number;
  title: string;
  status: "DONE" | "SKIPPED" | "ERROR";
  message: string;
}

// اعضای مبنا در یک ماه + عمل گروهی «افزودن/حذف از مبنا از این ماه». هر عضو همان عاملی است که روش مؤثرِ آن ماهش عضو این مبناست؛ تغییر یعنی رکورد روش
// جدید (کپی روش قبلی) با ماه اجرای همین ماه، یا اصلاح خودِ رکورد همین ماه. ماه جدید باید بعد از آخرین ماه محاسبه‌شده بماند تا قفل نشود.
function MembersSection({ param, canEdit }: { param: ParamDetail; canEdit: boolean }) {
  const cur = currentJalaliYearMonth();
  const [ym, setYm] = usePersistedState(`form:basis-members:${param.id}`, { year: cur.year, month: cur.month });
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [pickOpen, setPickOpen] = useState(false);
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const q = `year=${ym.year}&month=${ym.month}`;
      const [m, c] = await Promise.all([api.get(`/payroll-parameters/${param.id}/members?${q}`), api.get(`/payroll-parameters/${param.id}/candidates?${q}`)]);
      setMembers(m);
      setCandidates(c);
      setTicked(new Set());
    } catch (e) {
      setMembers([]);
      setCandidates([]);
      setError((e as ApiError).message);
    }
  }
  useEffect(() => {
    if (ym.year && ym.month) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ym.year, ym.month, param.id]);

  async function run(action: "add" | "remove", factors: { basis: string; id: number }[]) {
    try {
      const r = await api.post(`/payroll-parameters/${param.id}/members/bulk`, { action, year: ym.year, month: ym.month, factors });
      setResults(r.results);
      await load();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const keyOf = (m: MemberRow) => `${m.basis}:${m.factorId}`;

  return (
    <>
      <h3 className="hr-section">اعضای مبنا</h3>
      <p style={{ opacity: 0.75, fontSize: 13, margin: "0 0 8px" }}>
        {param.basisSource === "DECREE" ? `منبع «حکم»: جمع ${param.decreeValueMode === "AVG" ? "میانگین حکمِ" : "آخرین مقدار حکمِ"} عامل‌های حکمِ عضو.` : "منبع «محاسبات»: جمع مبلغ محاسبه‌شده‌ی عضوها (عامل حکم یا عامل حقوق از طبقه‌ی پرداختی) در فیش همان ماه."} عضویت یک عامل در «روش محاسبه عامل»ِ همان عامل هم قابل تنظیم است.
      </p>
      <ErrorToast message={error} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <span>اعضا در ماه:</span>
        <div style={{ minWidth: 220 }}>
          <WorkMonthPicker year={ym.year} month={ym.month} onChange={(y, m) => setYm({ year: y, month: m })} />
        </div>
        {canEdit && (
          <>
            <button type="button" className="btn secondary" disabled={candidates.length === 0} onClick={() => setPickOpen(true)} title="اضافه‌کردن عامل‌ها به این مبنا از ماهِ انتخاب‌شده">افزودن عامل‌ها از این ماه…</button>
            <button
              type="button"
              className="btn secondary"
              disabled={ticked.size === 0}
              onClick={() => {
                if (!window.confirm(`${toFaDigits(String(ticked.size))} عامل از این مبنا (از ماه ${monthText(ym.year, ym.month)}) حذف شود؟`)) return;
                run("remove", members.filter((m) => ticked.has(keyOf(m))).map((m) => ({ basis: m.basis, id: m.factorId })));
              }}
            >
              حذف انتخاب‌شده‌ها از این ماه
            </button>
          </>
        )}
      </div>
      <table className="hr-table">
        <thead>
          <tr>{canEdit && <th style={{ width: 36 }} />}<th>عامل</th><th style={{ width: 110 }}>نوع عامل</th><th style={{ width: 170 }}>رکورد روشِ مؤثر (ماه اجرا)</th></tr>
        </thead>
        <tbody>
          {members.length === 0 && <tr><td colSpan={canEdit ? 4 : 3} style={{ textAlign: "center", opacity: 0.7 }}>در این ماه عضوی ندارد</td></tr>}
          {members.map((m) => (
            <tr key={keyOf(m)}>
              {canEdit && (
                <td>
                  <input
                    type="checkbox"
                    checked={ticked.has(keyOf(m))}
                    onChange={() => setTicked((t) => { const n = new Set(t); n.has(keyOf(m)) ? n.delete(keyOf(m)) : n.add(keyOf(m)); return n; })}
                  />
                </td>
              )}
              <td>{m.title}</td>
              <td>{m.basis === "decree" ? "عامل حکم" : "عامل حقوق"}</td>
              <td>{monthText(m.execYear, m.execMonth)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {pickOpen && (
        <RecordPickerDialog<{ id: string; basis: "decree" | "payroll"; factorId: number; title: string }>
          title="انتخاب عامل‌ها برای افزودن به مبنا"
          multiSelect
          resultInDisplayOrder
          rows={candidates.map((c) => ({ id: c.key, basis: c.basis, factorId: c.id, title: c.title }))}
          columns={[
            { header: "عامل", render: (r) => r.title, filterValue: (r) => r.title },
            { header: "نوع عامل", render: (r) => (r.basis === "decree" ? "عامل حکم" : "عامل حقوق"), filterValue: (r) => (r.basis === "decree" ? "عامل حکم" : "عامل حقوق"), width: "120px" },
          ]}
          onSelect={() => setPickOpen(false)}
          onSelectMultiple={(rows) => {
            setPickOpen(false);
            run("add", rows.map((r) => ({ basis: r.basis, id: r.factorId })));
          }}
          onClose={() => setPickOpen(false)}
        />
      )}

      {results && (
        <Modal title="نتیجه‌ی اعمال گروهی" onClose={() => setResults(null)}>
          <table className="hr-table">
            <thead><tr><th>عامل</th><th style={{ width: 90 }}>وضعیت</th><th>توضیح</th></tr></thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i}>
                  <td>{r.title}</td>
                  <td style={{ color: r.status === "ERROR" ? "#c0392b" : r.status === "DONE" ? "#0a8f5a" : undefined }}>{r.status === "DONE" ? "انجام شد" : r.status === "SKIPPED" ? "نیازی نبود" : "خطا"}</td>
                  <td>{r.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={() => setResults(null)}>بستن</button>
          </div>
        </Modal>
      )}
    </>
  );
}
