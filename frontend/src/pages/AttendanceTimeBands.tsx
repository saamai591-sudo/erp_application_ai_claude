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
import { TimeInput, maskToMinutes, minutesToMask } from "../components/TimeInput";
import { WorkMonthPicker } from "../components/WorkMonthPicker";
import { MONTHS_FA } from "../lib/payrollLabels";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// مدیریت تردد › تنظیمات › «بازه‌های زمانی»: بازه‌ی ساعتیِ مستقل از شیفت (مثلاً شبکاری ۲۱ تا ۰۴) با نسخه‌های تاریخ‌دار (ماه اجرا از تقویم کاری). برای هر بازه یک متغیر روزِ
// خودکار «حضور در <عنوان>» در فرمول‌سازِ عوامل تردد ساخته می‌شود = کل حضورِ جفت‌ترددها در آن بازه‌ی ساعتی. قواعد در سرور (services/attendanceTimeBandService.ts).

interface BandRow {
  id: number;
  title: string;
  isActive: boolean;
  description: string;
  versionCount?: number;
  updatedAt?: string;
  versions?: VersionRow[];
}
interface VersionRow {
  id: number;
  execYear: number;
  execMonth: number;
  startMinute: number;
  endMinute: number;
}

const ymText = (y: number, m: number) => `${MONTHS_FA[m - 1] ?? m} ${toFaDigits(String(y))}`;
const rangeText = (v: { startMinute: number; endMinute: number }) => `${toFaDigits(minutesToMask(v.startMinute))} تا ${toFaDigits(minutesToMask(v.endMinute))}${v.endMinute <= v.startMinute ? " (روز بعد)" : ""}`;

export default function AttendanceTimeBands() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <BandForm />;
  if (location.pathname.endsWith("/edit")) return <BandForm editId={Number(id)} />;
  return <BandList />;
}

function BandList() {
  const cacheKey = "/attendance-time-bands";
  const [items, setItems] = usePersistedState<BandRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/attendance-time-bands").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: BandRow) {
    try {
      await api.del(`/attendance-time-bands/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: BandRow) => string, extra: object = {}) => ({ render: (r: BandRow) => f(r), filterType: "string" as const, filterValue: (r: BandRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="بازه‌های زمانی" text="بازه‌ی ساعتی مستقل از شیفت، مثلاً شبکاری ۲۱ تا ۰۴. برای هر بازه، در فرمول‌ساز عوامل تردد یک متغیر روز «حضور در …» ساخته می‌شود که کل حضور کارمند (اعم از داخل شیفت و اضافه‌کار) در آن بازه‌ی ساعتی است. ساعت شروع و پایان در نسخه‌های تاریخ‌دار نگه‌داری می‌شود تا با تغییر قانون یا سیاست، فرمول‌ها دست نخورند." />
          <NewRecordButton path="/attendance-time-bands/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "عنوان", ...s((r) => r.title) },
          { header: "نسخه‌ها", ...s((r) => toFaDigits(String(r.versionCount ?? 0))), width: "90px" },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "80px" },
          { header: "توضیحات", ...s((r) => r.description) },
        ]}
        rows={items}
        edit={{ path: (r: BandRow) => `/attendance-time-bands/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

interface VersionDraft {
  id?: number;
  year: number;
  month: number;
  start: string;
  end: string;
}

function BandForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { title: "", isActive: true, description: "" });
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const [dlg, setDlg] = useState<VersionDraft | null>(null);
  const { flash } = useSavedFlash();

  async function load() {
    if (!editId) return;
    const r: BandRow = await api.get(`/attendance-time-bands/${editId}`);
    setUpdatedAt(r.updatedAt);
    setVersions(r.versions ?? []);
    if (!hasPersistedState(cacheKey)) setForm({ title: r.title, isActive: r.isActive, description: r.description });
  }
  useEffect(() => {
    load().then(() => setLoaded(true)).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان بازه الزامی است");
    try {
      if (editId) {
        await api.put(`/attendance-time-bands/${editId}`, { ...form, updatedAt });
        flash();
        await load();
      } else {
        const created = await api.post("/attendance-time-bands", form);
        flash();
        navigate(`/attendance-time-bands/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/attendance-time-bands/${editId}`);
      navigate("/attendance-time-bands");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function saveVersion() {
    if (!dlg || !editId) return;
    const s = maskToMinutes(dlg.start), t = maskToMinutes(dlg.end);
    if (s === null || t === null || s > 1439 || t > 1439) return showError("ساعت شروع و پایان را کامل و معتبر وارد کنید (مثلاً 21:00)");
    const body = { execYear: dlg.year, execMonth: dlg.month, startMinute: s, endMinute: t };
    try {
      if (dlg.id) await api.put(`/attendance-time-bands/${editId}/versions/${dlg.id}`, body);
      else await api.post(`/attendance-time-bands/${editId}/versions`, body);
      setDlg(null);
      await load();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  async function removeVersion(v: VersionRow) {
    if (!editId || !window.confirm(`نسخه‌ی ماه اجرای ${ymText(v.execYear, v.execMonth)} حذف شود؟`)) return;
    try {
      await api.del(`/attendance-time-bands/${editId}/versions/${v.id}`);
      await load();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  return (
    <FormPage title={editId ? "ویرایش بازه‌ی زمانی" : "بازه‌ی زمانی جدید"} formId="attendance-band-form" closePath="/attendance-time-bands" newPath="/attendance-time-bands/new" onDelete={editId ? handleDelete : undefined}>
      <form id="attendance-band-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>عنوان<RequiredMark /> <FieldHint label="عنوان بازه" text="مثلاً «شبکاری». متغیر روز با عنوان «حضور در <عنوان>» در فرمول‌ساز ظاهر می‌شود." /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
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
              ساعت بازه (نسخه‌ها) <FieldHint label="نسخه‌های بازه" text="هر نسخه از «ماه اجرا» به بعد معتبر است تا نسخه‌ی بعدی. اگر ساعت پایان از ساعت شروع کوچک‌تر یا مساوی باشد، بازه از نیمه‌شب می‌گذرد (مثلاً ۲۱:۰۰ تا ۰۴:۰۰). برای ماهی که قبل از اولین نسخه باشد، فرمولی که این بازه را به کار می‌برد خطای «تعریف نشده» می‌دهد." />
            </h3>
            <button type="button" className="btn secondary" onClick={() => setDlg({ year: 0, month: 0, start: "", end: "" })}>+ نسخه‌ی جدید</button>
            {versions.length === 0 ? (
              <p style={{ opacity: 0.7, fontSize: 13 }}>هنوز نسخه‌ای تعریف نشده است.</p>
            ) : (
              <table className="hr-table" style={{ maxWidth: 560, marginTop: 8 }}>
                <thead><tr><th>ماه اجرا</th><th>بازه‌ی ساعتی</th><th style={{ width: 150 }}></th></tr></thead>
                <tbody>
                  {versions.map((v) => (
                    <tr key={v.id}>
                      <td>{ymText(v.execYear, v.execMonth)}</td>
                      <td>{rangeText(v)}</td>
                      <td>
                        <button type="button" className="link-btn" onClick={() => setDlg({ id: v.id, year: v.execYear, month: v.execMonth, start: minutesToMask(v.startMinute), end: minutesToMask(v.endMinute) })}>ویرایش</button>{" "}
                        <button type="button" className="link-btn" onClick={() => removeVersion(v)}>حذف</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : (
          <p style={{ opacity: 0.7, fontSize: 13 }}>پس از ثبت بازه می‌توانید ساعت شروع و پایان آن را (نسخه‌ی تاریخ‌دار) تعریف کنید.</p>
        )}
      </form>

      {dlg && (
        <Modal title={dlg.id ? "ویرایش نسخه‌ی بازه" : "نسخه‌ی جدید بازه"} onClose={() => setDlg(null)}>
          <div className="form-grid">
            <div className="form-field">
              <label>ماه اجرا<RequiredMark /></label>
              <WorkMonthPicker year={dlg.year} month={dlg.month} autoFix={!dlg.id} onChange={(y, m) => setDlg((d) => (d ? { ...d, year: y, month: m } : d))} />
            </div>
            <div className="form-field">
              <label>از ساعت<RequiredMark /></label>
              <TimeInput value={dlg.start} width={90} placeholder="21:00" onChange={(t) => setDlg((d) => (d ? { ...d, start: t } : d))} />
            </div>
            <div className="form-field">
              <label>تا ساعت<RequiredMark /></label>
              <TimeInput value={dlg.end} width={90} placeholder="04:00" onChange={(t) => setDlg((d) => (d ? { ...d, end: t } : d))} />
            </div>
          </div>
          <div className="actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn" disabled={!dlg.year} onClick={saveVersion}>ثبت نسخه</button>
            <button type="button" className="btn secondary" onClick={() => setDlg(null)}>انصراف</button>
          </div>
        </Modal>
      )}
    </FormPage>
  );
}
