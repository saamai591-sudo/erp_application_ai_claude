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
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { useTabs } from "../lib/TabsContext";

// منابع انسانی › سازمان › شغل: کد (خودکار)، عنوان، کد تامین اجتماعی و سه زبانه‌ی متنی (شرح شغل، مهارت‌های تخصصی، ویژگی‌های فردی).
// هر پست شغل‌های مورد نیازش را (با تعداد نفرات) در فرم «پست‌های سازمانی» دارد و کارمند شغلش را همراه پست از همان‌ها انتخاب می‌کند.

interface JobRow {
  id: number;
  code: number;
  title: string;
  socialSecurityCode: string;
  description: string;
  specializedSkills: string;
  personalTraits: string;
  positionCount: number;
  updatedAt?: string;
}
interface JobUse {
  kind: "POSITION" | "ASSIGNMENT" | "DECREE";
  id: number;
  description: string;
  path: string;
}

export default function Jobs() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <JobForm />;
  if (location.pathname.endsWith("/edit")) return <JobForm editId={Number(id)} />;
  return <JobList />;
}

function JobList() {
  const cacheKey = "/jobs";
  const [items, setItems] = usePersistedState<JobRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/jobs").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: JobRow) {
    try {
      await api.del(`/jobs/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: JobRow) => string, extra: object = {}) => ({ render: (r: JobRow) => f(r), filterType: "string" as const, filterValue: (r: JobRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="تعریف شغل (مثل مدیر مالی، حسابدار). در فرم «پست‌های سازمانی» برای هر پست مشخص می‌شود چه شغل‌هایی و با چه تعدادی لازم است؛ کارمند هنگام انتصاب به پست، شغلش را از همان شغل‌ها انتخاب می‌کند." title="شغل" />
          <NewRecordButton path="/jobs/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", render: (r: JobRow) => toFaDigits(String(r.code)), width: "80px", filterType: "number", filterValue: (r: JobRow) => r.code },
          { header: "عنوان", ...s((r) => r.title) },
          { header: "کد تامین اجتماعی", ...s((r) => (r.socialSecurityCode ? toFaDigits(r.socialSecurityCode) : "")), width: "150px" },
          { header: "تعداد پست‌های دارای این شغل", ...s((r) => toFaDigits(String(r.positionCount))), width: "190px" },
        ]}
        rows={items}
        edit={{ path: (r: JobRow) => `/jobs/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { title: "", socialSecurityCode: "", description: "", specializedSkills: "", personalTraits: "" };
type Tab = "description" | "skills" | "traits";
const TABS: { key: Tab; title: string }[] = [
  { key: "description", title: "شرح شغل" },
  { key: "skills", title: "مهارت‌های تخصصی" },
  { key: "traits", title: "ویژگی‌های فردی" },
];

function JobForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [code, setCode] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("description");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    if (!editId) return;
    api.get(`/jobs/${editId}`).then((j: JobRow) => {
      setCode(j.code);
      if (!hasPersistedState(cacheKey)) {
        setForm({ title: j.title, socialSecurityCode: j.socialSecurityCode, description: j.description, specializedSkills: j.specializedSkills, personalTraits: j.personalTraits });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان شغل الزامی است");
    try {
      if (editId) {
        await api.put(`/jobs/${editId}`, form);
        flash();
      } else {
        const created = await api.post("/jobs", form);
        flash();
        navigate(`/jobs/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/jobs/${editId}`);
      navigate("/jobs");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  const field = tab === "description" ? "description" : tab === "skills" ? "specializedSkills" : "personalTraits";

  return (
    <FormPage title={editId ? "ویرایش شغل" : "شغل جدید"} formId="job-form" closePath="/jobs" newPath="/jobs/new" onDelete={editId ? handleDelete : undefined}>
      <form id="job-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کد <FieldHint label="کد" text="خودکار: آخرین کد + ۱" /></label>
            <input disabled readOnly value={editId ? (code != null ? toFaDigits(String(code)) : "") : "خودکار"} />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>کد تامین اجتماعی</label>
            <input dir="ltr" value={form.socialSecurityCode} onChange={(e) => setForm({ ...form, socialSecurityCode: e.target.value })} />
          </div>
        </div>
        <div className="party-tabs" style={{ marginTop: 12 }}>
          {TABS.map((t) => (
            <button key={t.key} type="button" className={`party-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
              {t.title}
            </button>
          ))}
        </div>
        <textarea
          rows={12}
          style={{ width: "100%", minHeight: 220, resize: "vertical" }}
          value={form[field]}
          onChange={(e) => setForm({ ...form, [field]: e.target.value })}
          placeholder={tab === "description" ? "شرح شغل را بنویسید…" : tab === "skills" ? "مهارت‌های تخصصی مورد نیاز را بنویسید…" : "ویژگی‌های فردی مورد نیاز را بنویسید…"}
        />
      </form>
      {editId && <JobUsageSection jobId={editId} />}
    </FormPage>
  );
}

// «موارد استفاده»: پست‌هایی که این شغل را نیاز دارند و انتصاب/حکم‌هایی که از آن استفاده کرده‌اند
function JobUsageSection({ jobId }: { jobId: number }) {
  const { openTab } = useTabs();
  const [uses, setUses] = useState<JobUse[] | null>(null);
  useEffect(() => {
    api.get(`/jobs/${jobId}/usage`).then(setUses).catch(() => setUses([]));
  }, [jobId]);
  if (uses === null) return null;
  return (
    <>
      <h3 className="hr-section">موارد استفاده</h3>
      <table className="hr-table">
        <thead>
          <tr><th style={{ width: 40 }}>#</th><th>مورد</th><th style={{ width: 90 }} /></tr>
        </thead>
        <tbody>
          {uses.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", opacity: 0.7 }}>این شغل در جایی استفاده نشده و قابل حذف است</td></tr>}
          {uses.map((u, i) => (
            <tr key={`${u.kind}:${u.id}`}>
              <td>{toFaDigits(String(i + 1))}</td>
              <td>{u.description}</td>
              <td><button type="button" className="link-btn" onClick={() => openTab(u.path)}>باز کردن</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
