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
import { MONTHS_FA } from "../lib/payrollLabels";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { useTabs } from "../lib/TabsContext";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// مدیریت تردد › تنظیمات › «عوامل تردد»: عامل روزانه (برای هر روزِ هر کارمند از متغیرهای کارکرد همان روز) و عامل ماهانه (از تجمیع عوامل روزانه و عوامل ماهانه‌ی دیگر).
// «منبع» عامل: محاسباتی (روش‌های تاریخ‌دار با شاخه‌های شرط ← فرمول) یا مجوز (روش ندارد؛ مقدارش را کاربر برای هر کارمند در «مجوزها» وارد می‌کند و در فرمول‌ها با [F:…] / [M:…] خوانده می‌شود).
// روش‌های محاسبه‌ی عامل (فرمول) در فرم «روش محاسبه» تعریف می‌شود؛ این فرم فقط فهرست روش‌های عامل را می‌خواند و پیوند می‌دهد. قواعد در سرور (services/attendanceFactorService.ts).

type Level = "DAY" | "MONTH";
interface FactorRow {
  id: number;
  title: string;
  level: Level;
  levelTitle: string;
  valueType: "NUMBER" | "TIME" | "DAYS";
  valueTypeTitle: string;
  source: "COMPUTED" | "PERMIT";
  sourceTitle: string;
  isActive: boolean;
  showInWorksheet?: boolean;
  description: string;
  methodCount?: number;
  updatedAt?: string;
  methods?: MethodRow[];
}
interface MethodRow {
  id: number;
  execYear: number | null;
  execMonth: number | null;
  effectiveDate: string | null;
  branches: { conditionText: string; formulaText: string }[];
  locked: boolean;
}

const whenText = (m: MethodRow) => (m.effectiveDate ? `از ${formatJalaliDate(m.effectiveDate)}` : m.execMonth ? `${MONTHS_FA[m.execMonth - 1] ?? m.execMonth} ${toFaDigits(String(m.execYear))}` : "");

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
          { header: "منبع", ...s((r) => r.sourceTitle), width: "100px" },
          { header: "سطح", ...s((r) => r.levelTitle), width: "110px" },
          { header: "نوع مقدار", ...s((r) => r.valueTypeTitle), width: "170px" },
          { header: "روش‌ها", ...s((r) => toFaDigits(String(r.methodCount ?? 0))), width: "90px" },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "80px" },
          { header: "نمایش در گزارش کارکرد", ...s((r) => (r.showInWorksheet ? "بله" : "")), width: "150px" },
          { header: "توضیحات", ...s((r) => r.description) },
        ]}
        rows={items}
        edit={{ path: (r: FactorRow) => `/attendance-factors/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function FactorForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { title: "", source: "COMPUTED" as "COMPUTED" | "PERMIT", level: "DAY" as Level, valueType: "TIME", isActive: true, showInWorksheet: false, description: "" });
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [methods, setMethods] = useState<MethodRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { openTab } = useTabs();
  const { flash } = useSavedFlash();

  async function load() {
    if (!editId) return;
    const r: FactorRow = await api.get(`/attendance-factors/${editId}`);
    setUpdatedAt(r.updatedAt);
    setMethods(r.methods ?? []);
    if (!hasPersistedState(cacheKey)) setForm({ title: r.title, source: r.source, level: r.level, valueType: r.valueType, isActive: r.isActive, showInWorksheet: !!r.showInWorksheet, description: r.description });
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

  const levelLocked = !!editId && methods.length > 0;
  const permit = form.source === "PERMIT";
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
            <label>منبع<RequiredMark /> <FieldHint label="منبع عامل" text="محاسباتی: مقدار از روش و فرمول محاسبه می‌شود. مجوز: روش و فرمول ندارد و مقدارش را برای هر کارمند در فرم «مجوزها» وارد می‌کنید (روزانه برای یک تاریخ، ماهانه از یک ماه به بعد)؛ در فرمول‌ها مثل هر عامل دیگر خوانده می‌شود و ثبت‌نشده = ۰ (مثلاً سقفِ اضافه‌کار ماهانه یا مجوز اضافه‌کار یک روز). منبع بعد از ثبت قابل تغییر نیست." /></label>
            <select value={form.source} disabled={!!editId} onChange={(e) => setForm({ ...form, source: e.target.value as "COMPUTED" | "PERMIT" })}>
              <option value="COMPUTED">محاسباتی</option>
              <option value="PERMIT">مجوز</option>
            </select>
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
          {form.level === "DAY" && (
            <div className="form-field">
              <label className="checkbox-row"><input type="checkbox" checked={form.showInWorksheet} onChange={(e) => setForm({ ...form, showInWorksheet: e.target.checked })} /> نمایش در گزارش کارکرد <FieldHint label="نمایش در گزارش کارکرد" text="اگر تیک بخورد، مقدار این عامل برای هر روز به‌صورت یک ستون در گزارش‌های «کارکرد روزانه» و «مرور کارکرد» نمایش داده می‌شود. فقط عامل روزانه." /></label>
            </div>
          )}
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label>توضیحات</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>

        {permit ? (
          <p style={{ opacity: 0.75, fontSize: 13, maxWidth: 640 }}>عامل مجوز روش و فرمول ندارد؛ مقدارش را برای هر کارمند در فرم «مجوزها» وارد کنید{form.level === "MONTH" ? " (مقدار ماهانه از ماه ثبت‌شده تا مقدار بعدی ادامه دارد)" : " (مقدار روزانه برای یک تاریخ)"}. ثبت‌نشده = ۰.</p>
        ) : editId ? (
          <>
            <h3 className="hr-section">
              روش‌های محاسبه <FieldHint label="روش محاسبه" text="روش‌ها در فرم «روش محاسبه» تعریف می‌شوند. عامل روزانه: هر روش از «تاریخ شروع اثر» به بعد معتبر است؛ عامل ماهانه: از «ماه اجرا» (ماه تقویم کاری). برای روزی/ماهی که قبل از اولین روش باشد نتیجه خطای «روش تعریف نشده» است." />
            </h3>
            <button type="button" className="btn secondary" onClick={() => openTab(`/attendance-methods/new?kind=${form.level}&factorId=${editId}`)}>+ تعریف روش</button>
            {methods.length === 0 ? (
              <p style={{ opacity: 0.7, fontSize: 13 }}>هنوز روشی تعریف نشده است.</p>
            ) : (
              <table className="hr-table" style={{ maxWidth: 640, marginTop: 8 }}>
                <thead><tr><th>{form.level === "DAY" ? "تاریخ شروع اثر" : "ماه اجرا"}</th><th>فرمول</th><th style={{ width: 150 }}></th></tr></thead>
                <tbody>
                  {methods.map((m) => (
                    <tr key={m.id}>
                      <td>{whenText(m)}</td>
                      <td>{m.branches.length > 1 ? `${toFaDigits(String(m.branches.length))} شاخه` : m.branches[0]?.conditionText ? "با شرط" : "ساده"}{m.locked ? " — قفل" : ""}</td>
                      <td><button type="button" className="link-btn" onClick={() => openTab(`/attendance-methods/${m.id}/edit`)}>مشاهده / ویرایش ←</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : (
          <p style={{ opacity: 0.7, fontSize: 13 }}>پس از ثبت عامل می‌توانید روش‌های محاسبه (فرمول) آن را در فرم «روش محاسبه» تعریف کنید.</p>
        )}
      </form>

    </FormPage>
  );
}
