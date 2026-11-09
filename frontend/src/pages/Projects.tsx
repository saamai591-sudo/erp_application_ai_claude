import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";

interface Project { id: number; detailCode: string; title: string; description: string | null; isActive: boolean }

export default function Projects() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <ProjectForm />;
  if (location.pathname.endsWith("/edit")) return <ProjectForm editId={Number(id)} />;
  return <ProjectList />;
}

function ProjectList() {
  const cacheKey = "/projects";
  const [items, setItems] = usePersistedState<Project[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    api.get("/projects").then(setItems).catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: Project) {
    try {
      await api.del(`/projects/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="پروژه یک «تفصیل» حسابداری است (نوع تفصیل ۸) — کد به صورت خودکار صادر می‌شود" title="پروژه" />
          <NewRecordButton path="/projects/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", render: (r) => toFaDigits(r.detailCode), width: "100px", filterType: "string", filterValue: (r) => r.detailCode },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "شرح", render: (r) => r.description ?? "", filterType: "string", filterValue: (r) => r.description ?? "" },
          { header: "وضعیت", render: (r) => (r.isActive ? "فعال" : "غیرفعال"), width: "100px", filterType: "string", filterValue: (r) => (r.isActive ? "فعال" : "غیرفعال") },
        ]}
        rows={items}
        edit={{ path: (r) => `/projects/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function ProjectForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { detailCode: "", title: "", description: "", isActive: true });
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    if (!editId || hasPersistedState(cacheKey)) return;
    api.get("/projects").then((items: Project[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) setForm({ detailCode: found.detailCode, title: found.title, description: found.description ?? "", isActive: found.isActive });
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = { title: form.title, description: form.description, isActive: form.isActive };
    try {
      if (editId) {
        await api.put(`/projects/${editId}`, payload);
        flash();
      } else {
        const created = await api.post("/projects", payload);
        flash();
        navigate(`/projects/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/projects/${editId}`);
      navigate("/projects");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش پروژه" : "پروژه جدید"}
      formId="project-form"
      closePath="/projects"
      newPath="/projects/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="project-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کد تفصیل</label>
            <input value={form.detailCode ? toFaDigits(form.detailCode) : "پس از ذخیره صادر می‌شود"} disabled />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field full">
            <label>شرح</label>
            <textarea rows={3} maxLength={1000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-field">
            <label>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> فعال
            </label>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
