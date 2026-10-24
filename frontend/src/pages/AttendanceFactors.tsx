import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { Modal } from "../components/Modal";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { FormulaBuilder, FormulaBranch } from "../components/FormulaBuilder";
import { WorkMonthPicker } from "../components/WorkMonthPicker";
import { MONTHS_FA } from "../lib/payrollLabels";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// مدیریت تردد › تنظیمات › «عوامل تردد»: عامل روزانه (برای هر روزِ هر کارمند از متغیرهای کارکرد همان روز) و عامل ماهانه (از تجمیع عوامل روزانه و عوامل ماهانه‌ی دیگر).
// هر عامل «روش»‌های تاریخ‌دار دارد (ماه اجرا از تقویم کاری) و هر روش شاخه‌های شرط ← فرمول؛ فرمول را همان فرمول‌ساز حقوق می‌سازد. قواعد در سرور (services/attendanceFactorService.ts).

type Level = "DAY" | "MONTH";
interface FactorRow {
  id: number;
  title: string;
  level: Level;
  levelTitle: string;
  valueType: "NUMBER" | "TIME" | "DAYS";
  valueTypeTitle: string;
  isActive: boolean;
  description: string;
  methodCount?: number;
  updatedAt?: string;
  methods?: MethodRow[];
}
interface MethodRow {
  id: number;
  execYear: number;
  execMonth: number;
  branches: FormulaBranch[];
}

const ymText = (y: number, m: number) => `${MONTHS_FA[m - 1] ?? m} ${toFaDigits(String(y))}`;

export default function AttendanceFactors() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <FactorForm />;
  if (location.pathname.endsWith("/edit")) return <FactorForm editId={Number(id)} />;
  return <FactorList />;
}

function FactorList() {
  const cacheKey = "/attendance-factors";
  const [items, setItems] = usePersistedState<FactorRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/attendance-factors").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: FactorRow) {
    try {
      await api.del(`/attendance-factors/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: FactorRow) => string, extra: object = {}) => ({ render: (r: FactorRow) => f(r), filterType: "string" as const, filterValue: (r: FactorRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="عوامل تردد" text="عامل روزانه برای هر روزِ هر کارمند از متغیرهای «کارکرد روزانه» (حضور، تاخیر، تعجیل، اضافه‌کار، …) محاسبه می‌شود؛ عامل ماهانه از تجمیع عوامل روزانه (جمع، بیشترین، تعداد روز) و عوامل ماهانه‌ی دیگر. فرمول هر عامل در «روش»‌های تاریخ‌دار آن (از ماه اجرا به بعد) تعریف می‌شود." />
          <NewRecordButton path="/attendance-factors/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "عنوان", ...s((r) => r.title) },
          { header: "سطح", ...s((r) => r.levelTitle), width: "110px" },
          { header: "نوع مقدار", ...s((r) => r.valueTypeTitle), width: "170px" },
          { header: "روش‌ها", ...s((r) => toFaDigits(String(r.methodCount ?? 0))), width: "90px" },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "80px" },
          { header: "توضیحات", ...s((r) => r.description) },
        ]}
        rows={items}
        edit={{ path: (r: FactorRow) => `/attendance-factors/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

interface MethodDraft {
  id?: number;
  year: number;
  month: number;
  branches: FormulaBranch[];
}

function FactorForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { title: "", level: "DAY" as Level, valueType: "TIME", isActive: true, description: "" });
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [methods, setMethods] = useState<MethodRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const [dlg, setDlg] = useState<MethodDraft | null>(null);
  const [builder, setBuilder] = useState(false);
  const { flash } = useSavedFlash();

  async function load() {
    if (!editId) return;
    const r: FactorRow = await api.get(`/attendance-factors/${editId}`);
    setUpdatedAt(r.updatedAt);
    setMethods(r.methods ?? []);
    if (!hasPersistedState(cacheKey)) setForm({ title: r.title, level: r.level, valueType: r.valueType, isActive: r.isActive, description: r.description });
  }
  useEffect(() => {
    load().then(() => setLoaded(true)).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان عامل الزامی است");
    const body = { ...form, updatedAt };
    try {
      if (editId) {
        await api.put(`/attendance-factors/${editId}`, body);
        flash();
        await load();
      } else {
        const created = await api.post("/attendance-factors", body);
        flash();
        navigate(`/attendance-factors/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/attendance-factors/${editId}`);
      navigate("/attendance-factors");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function saveMethod() {
    if (!dlg || !editId) return;
    const body = { execYear: dlg.year, execMonth: dlg.month, branches: dlg.branches };
    try {
      if (dlg.id) await api.put(`/attendance-factors/${editId}/methods/${dlg.id}`, body);
      else await api.post(`/attendance-factors/${editId}/methods`, body);
      setDlg(null);
      await load();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  async function removeMethod(m: MethodRow) {
    if (!editId || !window.confirm(`روش ماه اجرای ${ymText(m.execYear, m.execMonth)} حذف شود؟`)) return;
    try {
      await api.del(`/attendance-factors/${editId}/methods/${m.id}`);
      await load();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  const levelLocked = !!editId && methods.length > 0;
  if (!loaded) return null;
  return (
    <FormPage title={editId ? "ویرایش عامل تردد" : "عامل تردد جدید"} formId="attendance-factor-form" closePath="/attendance-factors" newPath="/attendance-factors/new" onDelete={editId ? handleDelete : undefined}>
      <form id="attendance-factor-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-field">
            <label>سطح<RequiredMark /> <FieldHint label="سطح عامل" text="روزانه: برای هر روز از متغیرهای همان روز محاسبه می‌شود. ماهانه: از تجمیع ماه (جمع/بیشترین/تعداد روز) عوامل روزانه و متغیرهای روز و عوامل ماهانه‌ی دیگر. تا وقتی عامل روش دارد قابل تغییر نیست." /></label>
            <select value={form.level} disabled={levelLocked} onChange={(e) => setForm({ ...form, level: e.target.value as Level })}>
              <option value="DAY">روزانه</option>
              <option value="MONTH">ماهانه</option>
            </select>
          </div>
          <div className="form-field">
            <label>نوع مقدار <FieldHint label="نوع مقدار" text="زمان: مقدار به دقیقه محاسبه و به‌صورت ساعت:دقیقه نمایش داده می‌شود. عدد و روز: عدد ساده." /></label>
            <select value={form.valueType} onChange={(e) => setForm({ ...form, valueType: e.target.value })}>
              <option value="TIME">زمان (ساعت و دقیقه)</option>
              <option value="NUMBER">عدد</option>
              <option value="DAYS">روز</option>
            </select>
          </div>
          <div className="form-field">
            <label className="checkbox-row"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> فعال</label>
          </div>
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label>توضیحات</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>

        {editId ? (
          <>
            <h3 className="hr-section">
              روش‌های محاسبه <FieldHint label="روش محاسبه" text="هر روش از «ماه اجرا» (ماه تقویم کاری) به بعد معتبر است تا روش بعدی همین عامل؛ برای ماهی که قبل از اولین روش باشد، نتیجه خطای «روش تعریف نشده» می‌دهد." />
            </h3>
            <button type="button" className="btn secondary" onClick={() => setDlg({ year: 0, month: 0, branches: [{ conditionText: "", formulaText: "" }] })}>+ روش جدید</button>
            {methods.length === 0 ? (
              <p style={{ opacity: 0.7, fontSize: 13 }}>هنوز روشی تعریف نشده است.</p>
            ) : (
              <table className="hr-table" style={{ maxWidth: 640, marginTop: 8 }}>
                <thead><tr><th>ماه اجرا</th><th>فرمول</th><th style={{ width: 150 }}></th></tr></thead>
                <tbody>
                  {methods.map((m) => (
                    <tr key={m.id}>
                      <td>{ymText(m.execYear, m.execMonth)}</td>
                      <td>{m.branches.length > 1 ? `${toFaDigits(String(m.branches.length))} شاخه` : m.branches[0]?.conditionText ? "با شرط" : "ساده"}</td>
                      <td>
                        <button type="button" className="link-btn" onClick={() => setDlg({ id: m.id, year: m.execYear, month: m.execMonth, branches: m.branches })}>ویرایش</button>{" "}
                        <button type="button" className="link-btn" onClick={() => removeMethod(m)}>حذف</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : (
          <p style={{ opacity: 0.7, fontSize: 13 }}>پس از ثبت عامل می‌توانید روش‌های محاسبه (فرمول) آن را تعریف کنید.</p>
        )}
      </form>

      {dlg && !builder && (
        <Modal title={dlg.id ? "ویرایش روش محاسبه" : "روش محاسبه‌ی جدید"} onClose={() => setDlg(null)}>
          <div className="form-grid">
            <div className="form-field">
              <label>ماه اجرا<RequiredMark /></label>
              <WorkMonthPicker year={dlg.year} month={dlg.month} autoFix={!dlg.id} onChange={(y, m) => setDlg((d) => (d ? { ...d, year: y, month: m } : d))} />
            </div>
            <div className="form-field">
              <label>فرمول</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button type="button" className="btn secondary" onClick={() => setBuilder(true)} style={{ fontFamily: "serif", fontStyle: "italic", fontSize: 16 }}>fx</button>
                {dlg.branches.some((b) => b.formulaText.trim()) ? <span style={{ color: "#0a8f5a" }}>فرمول تعریف شده است{dlg.branches.length > 1 ? ` (${dlg.branches.length} شاخه)` : ""}</span> : <span style={{ opacity: 0.6 }}>تعریف نشده</span>}
              </div>
            </div>
          </div>
          <div className="actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn" disabled={!dlg.year || !dlg.branches.some((b) => b.formulaText.trim())} onClick={saveMethod}>ثبت روش</button>
            <button type="button" className="btn secondary" onClick={() => setDlg(null)}>انصراف</button>
          </div>
        </Modal>
      )}
      {dlg && builder && editId && (
        <FormulaBuilder
          factorId={String(editId)}
          factorTitle={form.title}
          attendanceLevel={form.level}
          branches={dlg.branches}
          onClose={() => setBuilder(false)}
          onSave={(bs) => {
            setDlg({ ...dlg, branches: bs });
            setBuilder(false);
          }}
        />
      )}
    </FormPage>
  );
}
