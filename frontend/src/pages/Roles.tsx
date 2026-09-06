import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useCrud } from "../lib/useCrud";
import { DataTable } from "../components/DataTable";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { FormPage } from "../components/FormPage";
import { PermissionTree, TreeModule } from "../components/PermissionTree";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";

interface Action { action: { id: number } }
interface Role {
  id: number;
  code: number;
  title: string;
  actions: Action[];
}

export default function Roles() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <RoleForm />;
  if (isEdit) return <RoleForm editId={Number(id)} />;
  return <RoleList />;
}

function RoleList() {
  const { items, loading, error, remove, reload } = useCrud<Role>("/roles");
  const navigate = useNavigate();
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}><InfoHint text={`تعریف نقش‌ها و تعیین دسترسی به تفکیک ماژول، ساب‌ماژول، فرم و عملیات`} title="نقش کاربری" /><NewRecordButton path="/roles/new" /><RefreshButton onClick={reload} /></div>
      </div>
      {error && <div className="alert error">{error}</div>}
      {!loading && (
        <DataTable
          columns={[
            { header: "کد", render: (r) => toFaDigits(String(r.code)), width: "80px", filterType: "number", filterValue: (r) => r.code },
            { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
            { header: "تعداد دسترسی", render: (r) => r.actions.length, width: "120px", filterType: "number", filterValue: (r) => r.actions.length },
          ]}
          rows={items}
          edit={{ path: (r) => `/roles/${r.id}/edit` }}
          onDelete={async (r) => {
            const res = await remove(r.id);
            if (!res.ok) alert(res.error);
          }}
        />
      )}
    </div>
  );
}

function RoleForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const { create } = useCrud<Role>("/roles");
  const [tree, setTree] = useState<TreeModule[]>([]);
  const [title, setTitle] = usePersistedState(`${cacheKey}:title`, "");
  const [checked, setChecked] = usePersistedState<Set<number>>(`${cacheKey}:checked`, new Set());
  const [formError, setFormError] = useState<string | null>(null);
  const { saved, flash } = useSavedFlash();
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(`${cacheKey}:title`));

  useEffect(() => {
    api.get("/authz/tree").then(setTree).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editId || hasPersistedState(`${cacheKey}:title`)) return;
    api.get(`/roles/${editId}`).then((role: Role) => {
      setTitle(role.title);
      setChecked(new Set(role.actions.map((a) => a.action.id)));
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  function toggleIds(ids: number[]) {
    const count = ids.filter((id) => checked.has(id)).length;
    const allChecked = ids.length > 0 && count === ids.length;
    setChecked((prev) => {
      const next = new Set(prev);
      if (allChecked) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (editId) {
      try {
        await api.put(`/roles/${editId}`, { title, actionIds: Array.from(checked) });
        flash();
      } catch (err) {
        setFormError((err as ApiError).message);
      }
    } else {
      const res = await create({ title, actionIds: Array.from(checked) });
      if (res.ok && res.data) {
        flash();
        navigate(`/roles/${res.data.id}/edit`);
      } else setFormError(res.error || "خطا");
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/roles/${editId}`);
      navigate("/roles");
    } catch (err) {
      alert((err as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش نقش کاربری" : "نقش کاربری جدید"}
      description="عنوان و دسترسی‌های نقش را مشخص کنید"
      formId="role-form"
      closePath="/roles"
      newPath="/roles/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="role-form" onSubmit={onSubmit}>
        {formError && <div className="alert error">{formError}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}
        <div className="form-field full" style={{ marginBottom: 14 }}>
          <label>عنوان<RequiredMark /></label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </div>

        <div className="form-field full">
          <label>دسترسی‌ها</label>
          <PermissionTree tree={tree} checked={checked} onToggle={toggleIds} persistKey={`${cacheKey}:permTree`} />
        </div>
      </form>
    </FormPage>
  );
}
