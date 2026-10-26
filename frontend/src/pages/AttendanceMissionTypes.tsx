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

// مدیریت تردد › تنظیمات › «نوع ماموریت» (خشکی، دریا، …): عنوان، «نوع پایه» (دقیقاً یکی؛ روزهای ماموریتِ بدون «گزارش ماموریت» به آن تعلق می‌گیرد) و فعال.
// برای هر نوعِ فعال، در فرمول‌ساز عوامل تردد یک متغیر روز «روزهای ماموریت <عنوان>» ساخته می‌شود. قواعد در سرور (services/attendanceMissionTypeService.ts).

interface TypeRow {
  id: number;
  title: string;
  isBase: boolean;
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
          <InfoHint title="نوع ماموریت" text="انواع ماموریت (خشکی، دریا، …). دقیقاً یک نوع «پایه» است: روزهای ماموریتی که برایشان «گزارش ماموریت» ثبت نشده به آن تعلق می‌گیرد. برای هر نوع در فرمول‌سازِ عوامل تردد یک متغیر روز «روزهای ماموریت <عنوان>» ساخته می‌شود." />
          <NewRecordButton path="/attendance-mission-types/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "عنوان", ...s((r) => r.title) },
          { header: "نوع پایه", ...s((r) => (r.isBase ? "بله" : "")), width: "100px" },
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
  const [form, setForm] = usePersistedState(cacheKey, { title: "", isBase: false, isActive: true, description: "" });
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [wasBase, setWasBase] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  async function load() {
    if (!editId) return;
    const r: TypeRow = await api.get(`/attendance-mission-types/${editId}`);
    setUpdatedAt(r.updatedAt);
    setWasBase(r.isBase);
    if (!hasPersistedState(cacheKey)) setForm({ title: r.title, isBase: r.isBase, isActive: r.isActive, description: r.description });
  }
  useEffect(() => {
    load().then(() => setLoaded(true)).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان نوع ماموریت الزامی است");
    try {
      if (editId) {
        await api.put(`/attendance-mission-types/${editId}`, { ...form, updatedAt });
        flash();
        await load();
      } else {
        const created = await api.post("/attendance-mission-types", form);
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
    <FormPage title={editId ? "ویرایش نوع ماموریت" : "نوع ماموریت جدید"} formId="attendance-mission-type-form" closePath="/attendance-mission-types" newPath="/attendance-mission-types/new" onDelete={editId && !wasBase ? handleDelete : undefined}>
      <form id="attendance-mission-type-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>عنوان<RequiredMark /> <FieldHint label="عنوان" text="مثلاً «خشکی» یا «دریا». متغیر روز «روزهای ماموریت <عنوان>» در فرمول‌ساز ظاهر می‌شود." /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="checkbox-row"><input type="checkbox" checked={form.isBase} disabled={wasBase} onChange={(e) => setForm({ ...form, isBase: e.target.checked })} /> نوع پایه <FieldHint label="نوع پایه" text="دقیقاً یک نوع پایه وجود دارد. روزهای ماموریتی که با «گزارش ماموریت» به نوع دیگری برده نشده باشند (و پیش‌فرضِ نوعِ درخواست) به نوع پایه تعلق می‌گیرند. با پایه‌کردن یک نوع دیگر، پایه‌ی قبلی خودکار برداشته می‌شود." /></label>
          </div>
          <div className="form-field">
            <label className="checkbox-row"><input type="checkbox" checked={form.isActive} disabled={form.isBase} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> فعال</label>
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
