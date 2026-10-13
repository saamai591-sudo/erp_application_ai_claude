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
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate, localTodayIso } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePermissions } from "../lib/usePermissions";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// حقوق و دستمزد › تنظیمات › پارامترهای قانونی: هر پارامتر یک تعریف (کلید ثابت، نوع) + مقدارهای تاریخ‌دار است. مقدار معتبر هر تاریخ، آخرین مقدار با
// تاریخ شروع ≤ آن تاریخ است؛ تغییر سالانه‌ی قانون = یک مقدار جدید با تاریخ شروع جدید (بدون تغییر کد).

const TYPE_FA: Record<string, string> = { NUMBER: "عدد", PERCENT: "درصد", AMOUNT: "مبلغ", BRACKETS: "جدول پلکانی" };

interface BracketRow {
  from: string;
  to: string | null;
  rate: string;
}
interface ValueRow {
  id: number;
  effectiveDate: string;
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
  values: ValueRow[];
}

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
            text="پارامترهای قانونی حقوق (نرخ بیمه، سقف بیمه، حداقل دستمزد، ضریب اضافه‌کار، جدول مالیات). هر پارامتر مقدارهای تاریخ‌دار دارد؛ برای تغییر سالانه، مقدار جدید با تاریخ شروع جدید ثبت کنید. مقدارهای «موقت» پیش‌فرض نصب‌اند و باید با قانون جاری تطبیق و تایید شوند."
            title="پارامترهای قانونی"
          />
          <NewRecordButton path="/legal-parameters/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "عنوان", ...s((r) => r.title) },
          { header: "کلید", ...s((r) => r.key), width: "260px" },
          { header: "نوع", ...s((r) => TYPE_FA[r.type]), width: "110px" },
          { header: "مقدار فعلی", ...s((r) => valueText(r.type, r.current)), width: "150px" },
          { header: "از تاریخ", ...s((r) => (r.current ? formatJalaliDate(r.current.effectiveDate) : "—")), width: "120px" },
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
  const [form, setForm] = usePersistedState(cacheKey, { key: "", title: "", type: "NUMBER", description: "", isActive: true });
  const [detail, setDetail] = useState<ParamDetail | null>(null);
  const [valueDlg, setValueDlg] = useState<{ value: ValueRow | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  async function reload(fillForm = true) {
    if (!editId) return;
    const d: ParamDetail = await api.get(`/payroll-parameters/${editId}`);
    setDetail(d);
    if (fillForm) setForm({ key: d.key, title: d.title, type: d.type, description: d.description ?? "", isActive: d.isActive });
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
        if (!form.key.trim()) return setError("کلید الزامی است");
        const created = await api.post("/payroll-parameters", { key: form.key, title: form.title, type: form.type, description: form.description });
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
    if (!window.confirm(`مقدار با تاریخ شروع ${formatJalaliDate(v.effectiveDate)} حذف شود؟`)) return;
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
      title={editId ? `پارامتر قانونی${detail ? ` — ${detail.title}` : ""}` : "پارامتر قانونی جدید"}
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
            <label>کلید<RequiredMark /> <FieldHint label="کلید" text="شناسه‌ی ثابت پارامتر برای ارجاع در فرمول‌ها؛ حروف بزرگ انگلیسی، عدد و _ . بعد از ثبت قابل تغییر نیست." /></label>
            <input dir="ltr" disabled={!!editId} value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase() })} />
          </div>
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
              <tr><th style={{ width: 130 }}>تاریخ شروع</th><th>مقدار</th><th style={{ width: 170 }}>وضعیت</th><th>توضیح</th><th style={{ width: 170 }} /></tr>
            </thead>
            <tbody>
              {detail.values.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", opacity: 0.7 }}>هنوز مقداری ثبت نشده است</td></tr>
              )}
              {detail.values.map((v, i) => (
                <tr key={v.id}>
                  <td>{formatJalaliDate(v.effectiveDate)}{i === 0 ? " (آخرین)" : ""}</td>
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
                        <button type="button" className="link-btn" onClick={() => setValueDlg({ value: v })}>ویرایش</button>{" "}
                        {v.isProvisional && <button type="button" className="link-btn" onClick={() => confirmValue(v)}>تایید مقدار</button>}{" "}
                        <button type="button" className="link-btn" onClick={() => removeValue(v)}>حذف</button>
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
  const [date, setDate] = useState(value?.effectiveDate ?? localTodayIso());
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
    const body: any = { effectiveDate: date, note };
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
          <label>تاریخ شروع<RequiredMark /> <FieldHint label="تاریخ شروع" text="از این تاریخ به بعد این مقدار معتبر است؛ باید بعد از تاریخ شروع آخرین مقدار باشد" /></label>
          <JalaliDatePicker value={date} onChange={setDate} />
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
