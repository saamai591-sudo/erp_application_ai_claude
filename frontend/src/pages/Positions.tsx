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
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { useTabs } from "../lib/TabsContext";

// پست‌های سازمانی. «پست پیش‌فرض» حذف‌نشدنی/غیرقابل‌غیرفعال‌شدن است؛ شرکتی که از پست استفاده نمی‌کند همه را به آن منتصب می‌کند.

interface PositionRow {
  id: number;
  code: number;
  title: string;
  orgUnitId: number | null;
  orgUnit: { id: number; code: number; title: string } | null;
  isDefault: boolean;
  isActive: boolean;
  hasTransactions: boolean;
}
interface PositionUse {
  kind: "ASSIGNMENT" | "DECREE";
  id: number;
  employeeId: number;
  personnelCode: string;
  employeeName: string;
  description: string;
  path: string;
}
interface OrgUnitRow {
  id: number;
  code: number;
  title: string;
}
interface JobOpt {
  id: number;
  code: number;
  title: string;
}
/** شغل مورد نیاز پست در فرم: تعداد نیاز (متن برای ویرایش) و تعداد فعلی (فقط‌خواندنی، از انتصاب‌های جاری) */
interface JobLine {
  jobId: number;
  title: string;
  requiredCount: string;
}

export default function Positions() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <PositionForm />;
  if (location.pathname.endsWith("/edit")) return <PositionForm editId={Number(id)} />;
  return <PositionList />;
}

function PositionList() {
  const cacheKey = "/positions";
  const [items, setItems] = usePersistedState<PositionRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    api.get("/positions").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: PositionRow) {
    try {
      await api.del(`/positions/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            text="پست‌های سازمانی؛ هر کارمند همیشه به یک پست منتصب است. اگر شرکت از پست استفاده نمی‌کند، «پست پیش‌فرض» را انتخاب کنید تا با شروع استفاده از پست‌ها اطلاعات یک‌دست بماند."
            title="پست‌های سازمانی"
          />
          <NewRecordButton path="/positions/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", render: (r) => toFaDigits(String(r.code)), width: "80px", filterType: "number", filterValue: (r) => r.code },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "واحد سازمانی", render: (r) => r.orgUnit?.title ?? "—", filterType: "string", filterValue: (r) => r.orgUnit?.title ?? "" },
          { header: "پیش‌فرض", render: (r) => (r.isDefault ? "بله" : ""), width: "90px", filterType: "string", filterValue: (r) => (r.isDefault ? "بله" : "") },
          { header: "فعال", render: (r) => (r.isActive ? "بله" : "خیر"), width: "80px", filterType: "string", filterValue: (r) => (r.isActive ? "بله" : "خیر") },
        ]}
        rows={items}
        edit={{ path: (r) => `/positions/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { code: "", title: "", orgUnitId: "", isActive: true, jobs: [] as JobLine[] };

function PositionForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [isDefault, setIsDefault] = useState(false);
  const [orgUnits, setOrgUnits] = useState<OrgUnitRow[]>([]);
  const [allJobs, setAllJobs] = useState<JobOpt[]>([]);
  const [headcount, setHeadcount] = useState<{ assigned: Record<number, number>; withoutJob: number }>({ assigned: {}, withoutJob: 0 });
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/org-units").then(setOrgUnits).catch(() => {});
    api.get("/jobs").then(setAllJobs).catch(() => {});
    if (editId) {
      api
        .get(`/positions/${editId}/jobs`)
        .then((r: { jobs: { jobId: number; assignedCount: number }[]; withoutJob: number }) => setHeadcount({ assigned: Object.fromEntries(r.jobs.map((j) => [j.jobId, j.assignedCount])), withoutJob: r.withoutJob }))
        .catch(() => {});
    }
    if (!editId) {
      if (!hasPersistedState(cacheKey)) setForm(DEFAULT_FORM);
      return;
    }
    api.get("/positions").then((items: PositionRow[]) => {
      const f = items.find((i) => i.id === editId);
      if (f) {
        setIsDefault(f.isDefault);
        if (!hasPersistedState(cacheKey)) {
          setForm({
            code: String(f.code),
            title: f.title,
            orgUnitId: f.orgUnitId ? String(f.orgUnitId) : "",
            isActive: f.isActive,
            jobs: ((f as any).jobs ?? []).map((j: { jobId: number; title: string; requiredCount: number }) => ({ jobId: j.jobId, title: j.title, requiredCount: String(j.requiredCount) })),
          });
        }
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان پست الزامی است");
    const jobsForm = form.jobs ?? [];
    for (const j of jobsForm) {
      if (!/^\d+$/.test(j.requiredCount) || Number(j.requiredCount) < 1) return setError(`تعداد مورد نیاز شغل «${j.title}» باید عدد صحیح و حداقل ۱ باشد`);
    }
    const body = {
      code: form.code ? Number(form.code) : undefined,
      title: form.title,
      orgUnitId: form.orgUnitId ? Number(form.orgUnitId) : null,
      isActive: form.isActive,
      jobs: jobsForm.map((j) => ({ jobId: j.jobId, requiredCount: Number(j.requiredCount) })),
    };
    try {
      if (editId) {
        await api.put(`/positions/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/positions", body);
        flash();
        navigate(`/positions/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/positions/${editId}`);
      navigate("/positions");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  const current = orgUnits.find((o) => String(o.id) === form.orgUnitId);

  return (
    <FormPage
      title={editId ? "ویرایش پست" : "پست جدید"}
      formId="position-form"
      closePath="/positions"
      newPath="/positions/new"
      onDelete={editId && !isDefault ? handleDelete : undefined}
    >
      <form id="position-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کد <FieldHint label="کد" text="اختیاری — در صورت خالی بودن، سیستم تعیین می‌کند" /></label>
            <input dir="ltr" disabled={!!editId} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>واحد سازمانی <FieldHint label="واحد سازمانی" text="اختیاری — واحدی که این پست معمولاً در آن قرار دارد؛ انتصاب هر کارمند واحد خودش را دارد" /></label>
            <RecordPickerField<OrgUnitRow>
              title="انتخاب واحد سازمانی"
              displayValue={current ? `${toFaDigits(String(current.code))} — ${current.title}` : ""}
              rows={orgUnits}
              columns={[
                { header: "کد", render: (o) => toFaDigits(String(o.code)), filterValue: (o) => String(o.code), width: "100px" },
                { header: "عنوان", render: (o) => o.title, filterValue: (o) => o.title },
              ]}
              onSelect={(o) => setForm({ ...form, orgUnitId: String(o.id) })}
              onClear={() => setForm({ ...form, orgUnitId: "" })}
            />
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.isActive}
                disabled={isDefault}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              فعال
              {isDefault && <FieldHint label="فعال" text="پست پیش‌فرض همیشه فعال است و حذف نمی‌شود" />}
            </label>
          </div>
        </div>
      </form>

      <h3 className="hr-section">مشاغل مورد نیاز</h3>
      <p style={{ opacity: 0.75, fontSize: 13, margin: "0 0 8px" }}>
        شغل‌هایی که این پست نیاز دارد و تعداد نفرات هر کدام (مثلاً «معاونت مالی» ← مدیر مالی ۱ نفر). کارمند هنگام انتصاب به این پست، شغلش را الزاماً از همین شغل‌ها انتخاب می‌کند؛ پستِ بدون شغل، شغل نمی‌خواهد.
      </p>
      <div style={{ maxWidth: 360, marginBottom: 8 }}>
        <RecordPickerField<JobOpt>
          title="انتخاب شغل‌ها برای پست"
          displayValue=""
          placeholder="افزودن شغل…"
          multiSelect
          resultInDisplayOrder
          rows={allJobs.filter((j) => !(form.jobs ?? []).some((x) => x.jobId === j.id))}
          columns={[
            { header: "کد", render: (j) => toFaDigits(String(j.code)), filterValue: (j) => String(j.code), width: "90px" },
            { header: "عنوان", render: (j) => j.title, filterValue: (j) => j.title },
          ]}
          onSelectMultiple={(rows) => setForm({ ...form, jobs: [...(form.jobs ?? []), ...rows.map((j) => ({ jobId: j.id, title: j.title, requiredCount: "1" }))] })}
        />
      </div>
      <table className="hr-table">
        <thead>
          <tr><th style={{ width: 40 }}>#</th><th>شغل</th><th style={{ width: 150 }}>تعداد مورد نیاز</th><th style={{ width: 130 }}>تعداد فعلی</th><th style={{ width: 60 }} /></tr>
        </thead>
        <tbody>
          {(form.jobs ?? []).length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", opacity: 0.7 }}>شغلی برای این پست تعریف نشده است</td></tr>}
          {(form.jobs ?? []).map((j, i) => (
            <tr key={j.jobId}>
              <td>{toFaDigits(String(i + 1))}</td>
              <td>{j.title}</td>
              <td>
                <input
                  dir="ltr"
                  inputMode="numeric"
                  style={{ width: 90 }}
                  value={j.requiredCount}
                  onChange={(e) => setForm({ ...form, jobs: (form.jobs ?? []).map((x) => (x.jobId === j.jobId ? { ...x, requiredCount: e.target.value.replace(/\D/g, "") } : x)) })}
                />
              </td>
              <td>{editId ? toFaDigits(String(headcount.assigned[j.jobId] ?? 0)) : "—"}</td>
              <td><button type="button" className="link-btn" onClick={() => setForm({ ...form, jobs: (form.jobs ?? []).filter((x) => x.jobId !== j.jobId) })}>حذف</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {editId && headcount.withoutJob > 0 && (form.jobs ?? []).length > 0 && (
        <p style={{ opacity: 0.8, fontSize: 13 }}>{toFaDigits(String(headcount.withoutJob))} کارمند فعلیِ این پست شغل ندارند (قبل از تخصیص شغل به پست منتصب شده‌اند)؛ شغلشان با اولین انتصاب جدید تعیین می‌شود.</p>
      )}

      {editId && <UsageSection positionId={editId} />}
    </FormPage>
  );
}

// «موارد استفاده»: کجاها از این پست استفاده شده (انتصاب‌های کارمندان و احکام کارگزینی) — برای دانستنِ علت «قابل حذف نیست» و رفتن به همان رکورد
function UsageSection({ positionId }: { positionId: number }) {
  const { openTab } = useTabs();
  const [uses, setUses] = useState<PositionUse[] | null>(null);
  useEffect(() => {
    api.get(`/positions/${positionId}/usage`).then(setUses).catch(() => setUses([]));
  }, [positionId]);
  if (uses === null) return null;
  return (
    <>
      <h3 className="hr-section">موارد استفاده</h3>
      <table className="hr-table">
        <thead>
          <tr><th style={{ width: 40 }}>#</th><th style={{ width: 110 }}>کد پرسنلی</th><th>کارمند</th><th>مورد</th><th style={{ width: 90 }} /></tr>
        </thead>
        <tbody>
          {uses.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", opacity: 0.7 }}>این پست در جایی استفاده نشده و قابل حذف است</td></tr>}
          {uses.map((u, i) => (
            <tr key={`${u.kind}:${u.id}`}>
              <td>{toFaDigits(String(i + 1))}</td>
              <td>{toFaDigits(u.personnelCode)}</td>
              <td>{u.employeeName}</td>
              <td>{u.description}</td>
              <td><button type="button" className="link-btn" onClick={() => openTab(u.path)}>باز کردن</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
