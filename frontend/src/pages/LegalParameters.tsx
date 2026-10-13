import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { AmountInput } from "../components/AmountInput";
import { Modal } from "../components/Modal";
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

// حقوق و دستمزد › تنظیمات › پارامترهای مبنا: هر پارامتر یک تعریف (کلید ثابت، نوع) + مقدارهای تاریخ‌دار است. مقدار معتبر هر تاریخ، آخرین مقدار با
// ماه اجرا ≤ آن تاریخ است؛ تغییر سالانه‌ی قانون = یک مقدار جدید با ماه اجرای جدید (بدون تغییر کد). مقداری که در محاسبه استفاده شده قفل است
// و مقدار جدید فقط برای ماهی بعد از آخرین ماهِ محاسبه‌شده ثبت می‌شود.

const TYPE_FA: Record<string, string> = { NUMBER: "عدد", PERCENT: "درصد", AMOUNT: "مبلغ", BRACKETS: "جدول پلکانی" };

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
  isProvisional: boolean;
  note: string | null;
  brackets: BracketRow[];
}
interface ParamRow {
  id: number;
  key: string;
  title: string;
  type: string;
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
  return type === "PERCENT" ? `${fmtNum(v.value)}٪` : fmtNum(v.value);
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
            text="پارامترهای مبنا حقوق (نرخ بیمه، سقف بیمه، حداقل دستمزد، ضریب اضافه‌کار، جدول مالیات). هر پارامتر مقدارهای تاریخ‌دار دارد؛ برای تغییر سالانه، مقدار جدید با ماه اجرای جدید ثبت کنید (ماه اجرا باید بعد از آخرین ماهِ محاسبه‌شده باشد). مقداری که در محاسبه‌ی حقوق استفاده شده قابل ویرایش و حذف نیست. مقدارهای «موقت» پیش‌فرض نصب‌اند و باید با قانون جاری تطبیق و تایید شوند."
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
          { header: "نوع", ...s((r) => TYPE_FA[r.type]), width: "110px" },
          { header: "مقدار فعلی", ...s((r) => valueText(r.type, r.current)), width: "150px" },
          { header: "ماه اجرا", ...s((r) => (r.current ? monthText(r.current.execYear, r.current.execMonth) : "—")), width: "130px" },
          { header: "وضعیت", ...s((r) => (!r.current ? "نیازمند تعریف" : r.current.isProvisional ? "موقت — نیاز به تایید" : "تاییدشده")), width: "170px" },
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
  const [form, setForm] = usePersistedState(cacheKey, { title: "", type: "NUMBER", description: "", isActive: true });
  const [detail, setDetail] = useState<ParamDetail | null>(null);
  const [valueDlg, setValueDlg] = useState<{ value: ValueRow | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  async function reload(fillForm = true) {
    if (!editId) return;
    const d: ParamDetail = await api.get(`/payroll-parameters/${editId}`);
    setDetail(d);
    if (fillForm) setForm({ title: d.title, type: d.type, description: d.description ?? "", isActive: d.isActive });
  }

  useEffect(() => {
    if (editId) reload(!hasPersistedState(cacheKey)).then(() => setLoaded(true)).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    try {
      if (editId) {
        await api.put(`/payroll-parameters/${editId}`, { title: form.title, description: form.description, isActive: form.isActive });
        flash();
        await reload(false);
      } else {
        const created = await api.post("/payroll-parameters", { title: form.title, type: form.type, description: form.description });
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
  async function confirmValue(v: ValueRow) {
    try {
      await api.post(`/payroll-parameters/values/${v.id}/confirm`, {});
      await reload(false);
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  const canEdit = hasPermission("payroll.settings.legal-parameters.edit");
  const isSystem = !!detail?.isSystem;
  const type = detail?.type ?? form.type;

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
            <label>نوع<RequiredMark /></label>
            <select disabled={!!editId} value={type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(TYPE_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
        </div>
      </form>

      {editId && detail && (
        <>
          <h3 className="hr-section" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            مقدارهای تاریخ‌دار
            {canEdit && (
              <button type="button" className="btn secondary" onClick={() => setValueDlg({ value: null })}>افزودن مقدار جدید</button>
            )}
          </h3>
          <table className="hr-table">
            <thead>
              <tr><th style={{ width: 150 }}>ماه اجرا</th><th>مقدار</th><th style={{ width: 170 }}>وضعیت</th><th>توضیح</th><th style={{ width: 170 }} /></tr>
            </thead>
            <tbody>
              {detail.values.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", opacity: 0.7 }}>هنوز مقداری ثبت نشده است</td></tr>
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
                  <td>{v.isProvisional ? "موقت — نیاز به تایید" : "تاییدشده"}</td>
                  <td>{v.note ?? ""}</td>
                  <td>
                    {canEdit && (
                      <>
                        <button type="button" className="link-btn" disabled={v.locked} title={v.locked ? v.lockedReason ?? "" : undefined} onClick={() => setValueDlg({ value: v })}>ویرایش</button>{" "}
                        {v.isProvisional && <button type="button" className="link-btn" onClick={() => confirmValue(v)}>تایید مقدار</button>}{" "}
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
          <div style={{ display: "flex", gap: 6 }}>
            <select value={exec.month} onChange={(e) => setExec({ ...exec, month: Number(e.target.value) })} style={{ flex: 1 }}>
              {MONTHS_FA.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <input dir="ltr" inputMode="numeric" value={exec.year || ""} onChange={(e) => setExec({ ...exec, year: Number(e.target.value.replace(/D/g, "")) || 0 })} style={{ width: 80 }} />
          </div>
          {param.lastCalculated && (
            <div style={{ opacity: 0.7, fontSize: 12, marginTop: 2 }}>آخرین ماهِ محاسبه‌شده: {monthText(param.lastCalculated.year, param.lastCalculated.month)}</div>
          )}
        </div>
        {!isBr && (
          <div className="form-field">
            <label>مقدار{param.type === "PERCENT" ? " (درصد)" : ""}<RequiredMark /></label>
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
