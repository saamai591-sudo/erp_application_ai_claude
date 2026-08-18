import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useCrud } from "../lib/useCrud";
import { DataTable } from "../components/DataTable";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { FormPage } from "../components/FormPage";
import { TriStateCheckbox } from "../components/TriStateCheckbox";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { MODULES } from "../navConfig";
import { InfoHint } from "../components/InfoHint";
import { toFaDigits } from "../lib/formatAmount";

interface Permission { id: number; module: string; form: string; operation: string }
interface Role {
  id: number;
  code: number;
  title: string;
  permissions: { permission: Permission }[];
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
  const [bulkSlot, setBulkSlot] = useState<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  return (
    <div>
      <div className="page-header">
        <div>
          <h2>نقش کاربری</h2>
        </div>
        <div className="header-toolbar" style={{ gap: 4 }}><InfoHint text={`تعریف نقش‌ها و تعیین دسترسی به تفکیک ماژول، ساب‌ماژول، فرم و عملیات`} title="نقش کاربری" /><NewRecordButton path="/roles/new" /><RefreshButton onClick={reload} /><div ref={setBulkSlot} className="bulk-slot" style={{ display: "flex" }} /></div>
      </div>
      {error && <div className="alert error">{error}</div>}
      {!loading && (
        <DataTable
        bulkActionsContainer={bulkSlot}
          columns={[
            { header: "کد", render: (r) => toFaDigits(String(r.code)), width: "80px", filterType: "number", filterValue: (r) => r.code },
            { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
            { header: "تعداد دسترسی", render: (r) => r.permissions.length, width: "120px", filterType: "number", filterValue: (r) => r.permissions.length },
          ]}
          rows={items}
          onEdit={(r) => navigate(`/roles/${r.id}/edit`)}
          onDelete={async (r) => {
            const res = await remove(r.id);
            if (!res.ok) alert(res.error);
          }}
        />
      )}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      style={{ transform: open ? "rotate(0deg)" : "rotate(90deg)", transition: "transform .15s", flexShrink: 0 }}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const OPERATIONS = ["جدید", "ویرایش", "حذف"];

function RoleForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const { create } = useCrud<Role>("/roles");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [title, setTitle] = usePersistedState(`${cacheKey}:title`, "");
  const [checked, setChecked] = usePersistedState<Set<number>>(`${cacheKey}:checked`, new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);
  const { saved, flash } = useSavedFlash();
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(`${cacheKey}:title`));

  useEffect(() => {
    api.get("/roles/permissions/tree").then(setPermissions).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editId || hasPersistedState(`${cacheKey}:title`)) return;
    api.get(`/roles/${editId}`).then((role: Role) => {
      setTitle(role.title);
      setChecked(new Set(role.permissions.map((p) => p.permission.id)));
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // نگاشت (ماژول|فرم|عملیات) -> شناسه دسترسی، برای پیدا کردن سریع
  const permMap = new Map<string, number>();
  for (const p of permissions) permMap.set(`${p.module}|${p.form}|${p.operation}`, p.id);

  function formOpIds(moduleTitle: string, formLabel: string): number[] {
    return OPERATIONS.map((op) => permMap.get(`${moduleTitle}|${formLabel}|${op}`)).filter(
      (x): x is number => x !== undefined
    );
  }
  function subModuleOpIds(moduleTitle: string, items: { label: string }[]): number[] {
    return items.flatMap((it) => formOpIds(moduleTitle, it.label));
  }
  function moduleOpIds(moduleTitle: string, subModules: { items: { label: string }[] }[]): number[] {
    return subModules.flatMap((sm) => subModuleOpIds(moduleTitle, sm.items));
  }

  function triState(ids: number[]): "all" | "none" | "some" {
    if (ids.length === 0) return "none";
    const count = ids.filter((id) => checked.has(id)).length;
    if (count === 0) return "none";
    if (count === ids.length) return "all";
    return "some";
  }

  function toggleIds(ids: number[]) {
    const state = triState(ids);
    setChecked((prev) => {
      const next = new Set(prev);
      if (state === "all") {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function toggleCollapse(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (editId) {
      try {
        await api.put(`/roles/${editId}`, { title, permissionIds: Array.from(checked) });
        flash();
      } catch (err) {
        setFormError((err as ApiError).message);
      }
    } else {
      const res = await create({ title, permissionIds: Array.from(checked) });
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
          <label>عنوان</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </div>

        <div className="form-field full">
          <label>دسترسی‌ها</label>
          <div className="perm-tree">
            {MODULES.map((mod) => {
              const modIds = moduleOpIds(mod.title, mod.subModules);
              const modOpen = !collapsed.has(mod.title);
              return (
                <div key={mod.title} className="perm-node perm-level-module">
                  <div className="perm-row">
                    <button type="button" className="perm-chevron" onClick={() => toggleCollapse(mod.title)}>
                      <ChevronIcon open={modOpen} />
                    </button>
                    <TriStateCheckbox state={triState(modIds)} onChange={() => toggleIds(modIds)} />
                    <span className="perm-label perm-label-module">{mod.title}</span>
                  </div>
                  {modOpen &&
                    mod.subModules.map((sub) => {
                      const subKey = `${mod.title}/${sub.title}`;
                      const subIds = subModuleOpIds(mod.title, sub.items);
                      const subOpen = !collapsed.has(subKey);
                      return (
                        <div key={subKey} className="perm-node perm-level-submodule">
                          <div className="perm-row">
                            <button type="button" className="perm-chevron" onClick={() => toggleCollapse(subKey)}>
                              <ChevronIcon open={subOpen} />
                            </button>
                            <TriStateCheckbox state={triState(subIds)} onChange={() => toggleIds(subIds)} />
                            <span className="perm-label perm-label-submodule">{sub.title}</span>
                          </div>
                          {subOpen &&
                            sub.items.map((item) => {
                              const formKey = `${subKey}/${item.label}`;
                              const opIds = formOpIds(mod.title, item.label);
                              const formOpen = !collapsed.has(formKey);
                              return (
                                <div key={formKey} className="perm-node perm-level-form">
                                  <div className="perm-row">
                                    <button type="button" className="perm-chevron" onClick={() => toggleCollapse(formKey)}>
                                      <ChevronIcon open={formOpen} />
                                    </button>
                                    <TriStateCheckbox state={triState(opIds)} onChange={() => toggleIds(opIds)} />
                                    <span className="perm-label perm-label-form">{item.label}</span>
                                  </div>
                                  {formOpen && (
                                    <div className="perm-ops">
                                      {OPERATIONS.map((op) => {
                                        const id = permMap.get(`${mod.title}|${item.label}|${op}`);
                                        if (id === undefined) return null;
                                        return (
                                          <label key={op} className="perm-op-row">
                                            <input
                                              type="checkbox"
                                              checked={checked.has(id)}
                                              onChange={() => toggleIds([id])}
                                            />
                                            {op}
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>
      </form>
    </FormPage>
  );
}
