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
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// مدیریت تردد › تنظیمات › «نوع ماموریت» = نوع «گزارش ماموریت» (دریا، هوایی، …): عنوان، «نوع درخواست» (ماهیت ماموریتِ روزانه) و فعال. نوع درخواستی که نوع ماموریتِ فعال دارد در محاسبه گزارشِ تاییدشده می‌خواهد.
// برای هر نوعِ فعال، در فرمول‌ساز عوامل تردد یک متغیر روز «طول گزارش ماموریت <عنوان>» ساخته می‌شود. قواعد در سرور (services/attendanceMissionTypeService.ts).

interface TypeRow {
  id: number;
  title: string;
  requestTypeId: number;
  requestTypeTitle: string;
  isActive: boolean;
  description: string;
  updatedAt?: string;
}

export default function AttendanceMissionTypes() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <TypeForm />;
  if (location.pathname.endsWith("/edit")) return <TypeForm editId={Number(id)} />;
  return <TypeList />;
}

function TypeList() {
  const cacheKey = "/attendance-mission-types";
  const [items, setItems] = usePersistedState<TypeRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/attendance-mission-types").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: TypeRow) {
    try {
      await api.del(`/attendance-mission-types/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: TypeRow) => string, extra: object = {}) => ({ render: (r: TypeRow) => f(r), filterType: "string" as const, filterValue: (r: TypeRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="نوع ماموریت" text="انواع گزارش ماموریت (دریا، هوایی، …). هر نوع به یک «نوع درخواست» ماموریتِ روزانه وصل است و همین اتصال تعیین می‌کند کدام نوع درخواست‌ها برای «محاسبه تردد» گزارشِ تاییدشده لازم دارند. برای هر نوع در فرمول‌سازِ عوامل تردد یک متغیر روز «طول گزارش ماموریت <عنوان>» ساخته می‌شود." />
          <NewRecordButton path="/attendance-mission-types/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "عنوان", ...s((r) => r.title) },
          { header: "نوع درخواست", ...s((r) => r.requestTypeTitle), width: "160px" },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "80px" },
          { header: "توضیحات", ...s((r) => r.description) },
        ]}
        rows={items}
        edit={{ path: (r: TypeRow) => `/attendance-mission-types/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function TypeForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { title: "", requestTypeId: "", isActive: true, description: "" });
  const [reqTypes, setReqTypes] = useState<{ id: number; title: string; isActive: boolean; unit: string }[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  async function load() {
    if (!editId) return;
    const r: TypeRow = await api.get(`/attendance-mission-types/${editId}`);
    setUpdatedAt(r.updatedAt);
    if (!hasPersistedState(cacheKey)) setForm({ title: r.title, requestTypeId: String(r.requestTypeId), isActive: r.isActive, description: r.description });
  }
  useEffect(() => {
    api.get("/attendance-request-types?nature=MISSION").then((r) => setReqTypes(r)).catch(() => {});
    load().then(() => setLoaded(true)).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان نوع ماموریت الزامی است");
    if (!form.requestTypeId) return setError("نوع درخواست را انتخاب کنید");
    try {
      if (editId) {
        await api.put(`/attendance-mission-types/${editId}`, { ...form, requestTypeId: Number(form.requestTypeId), updatedAt });
        flash();
        await load();
      } else {
        const created = await api.post("/attendance-mission-types", { ...form, requestTypeId: Number(form.requestTypeId) });
        flash();
        navigate(`/attendance-mission-types/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/attendance-mission-types/${editId}`);
      navigate("/attendance-mission-types");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  return (
    <FormPage title={editId ? "ویرایش نوع ماموریت" : "نوع ماموریت جدید"} formId="attendance-mission-type-form" closePath="/attendance-mission-types" newPath="/attendance-mission-types/new" onDelete={editId ? handleDelete : undefined}>
      <form id="attendance-mission-type-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>عنوان<RequiredMark /> <FieldHint label="عنوان" text="مثلاً «دریا». متغیر روز «طول گزارش ماموریت <عنوان>» در فرمول‌ساز ظاهر می‌شود." /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-field">
            <label>نوع درخواست<RequiredMark /> <FieldHint label="نوع درخواست" text="نوع درخواستِ ماموریتی که این نوع گزارش مربوط به آن است. نوع درخواستی که نوع ماموریتِ فعال دارد، در «محاسبه تردد» برای هر درخواستِ پایان‌یافته‌اش گزارشِ تاییدشده می‌خواهد. فقط نوع درخواست‌های روزانه قابل انتخاب‌اند (ماموریت ساعتی گزارش ندارد)." /></label>
            <select value={form.requestTypeId} onChange={(e) => setForm({ ...form, requestTypeId: e.target.value })}>
              <option value="">— انتخاب کنید —</option>
              {reqTypes.filter((t) => t.unit === "DAILY" && (t.isActive || String(t.id) === form.requestTypeId)).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
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
      </form>
    </FormPage>
  );
}
