import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useCrud } from "../lib/useCrud";
import { DataTable } from "../components/DataTable";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { FormPage } from "../components/FormPage";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { digitsOnly } from "../lib/digits";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RecordPickerField } from "../components/RecordPicker";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";
import { PermissionTree, TreeModule } from "../components/PermissionTree";

interface Role { id: number; title: string }

interface PartyOption {
  id: number;
  detailCode: string;
  category: "INDIVIDUAL" | "LEGAL";
  isActive: boolean;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
}

export function partyDisplayName(p: PartyOption): string {
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

interface UserRow {
  id: number;
  code: number;
  mobile: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roles: { role: Role }[];
  actions: { action: { id: number } }[];
  partyId: number | null;
  party: PartyOption | null;
}

export default function Users() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <UserForm />;
  if (isEdit) return <UserForm editId={Number(id)} />;
  return <UserList />;
}

function UserList() {
  const { items, loading, error, remove, reload } = useCrud<UserRow>("/users");
  const navigate = useNavigate();
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}><InfoHint text={`تعریف کاربران سیستم و تخصیص نقش کاربری`} title="کاربر" /><NewRecordButton path="/users/new" /><RefreshButton onClick={reload} /></div>
      </div>
      <ErrorToast message={error} />
      {!loading && (
        <DataTable
          columns={[
            { header: "کد", render: (r) => toFaDigits(String(r.code)), width: "70px", filterType: "number", filterValue: (r) => r.code },
            { header: "شماره همراه", render: (r) => r.mobile, filterType: "string", filterValue: (r) => r.mobile },
            { header: "نام", render: (r) => `${r.firstName} ${r.lastName}`, filterType: "string", filterValue: (r) => `${r.firstName} ${r.lastName}` },
            { header: "نقش‌ها", render: (r) => r.roles.map((x) => x.role.title).join("، ") || "—", filterType: "string", filterValue: (r) => r.roles.map((x) => x.role.title).join("، ") },
            { header: "طرف حساب", render: (r) => (r.party ? partyDisplayName(r.party) : "—"), filterType: "string", filterValue: (r) => (r.party ? partyDisplayName(r.party) : "") },
            { header: "وضعیت", render: (r) => <span className="badge">{r.isActive ? "فعال" : "غیرفعال"}</span>, filterType: "string", filterValue: (r) => (r.isActive ? "فعال" : "غیرفعال") },
          ]}
          rows={items}
          edit={{ path: (r) => `/users/${r.id}/edit` }}
          onDelete={async (r) => {
            const res = await remove(r.id);
            if (!res.ok) showError(res.error);
          }}
        />
      )}
    </div>
  );
}

function UserForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const { create } = useCrud<UserRow>("/users");
  const [roles, setRoles] = useState<Role[]>([]);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [tree, setTree] = useState<TreeModule[]>([]);
  const [form, setForm] = usePersistedState(`${cacheKey}:form`, { mobile: "", firstName: "", lastName: "", password: "", isActive: true, partyId: "" });
  const [roleIds, setRoleIds] = usePersistedState<Set<number>>(`${cacheKey}:roleIds`, new Set());
  const [actionIds, setActionIds] = usePersistedState<Set<number>>(`${cacheKey}:actionIds`, new Set());
  const [formError, setFormError] = useState<string | null>(null);
  const { flash } = useSavedFlash();
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(`${cacheKey}:form`));

  useEffect(() => {
    api.get("/roles").then(setRoles).catch(() => {});
    api.get("/authz/tree").then(setTree).catch(() => {});
    // طرف حساب: هر دو نوع حقیقی و حقوقی مجازند (طبق تصمیم پروژه)
    api.get("/parties").then((p: PartyOption[]) => setParties(p.filter((x) => x.isActive))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editId || hasPersistedState(`${cacheKey}:form`)) return;
    api.get("/users").then((items: UserRow[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setForm({
          mobile: found.mobile,
          firstName: found.firstName,
          lastName: found.lastName,
          password: "",
          isActive: found.isActive,
          partyId: found.partyId ? String(found.partyId) : "",
        });
        setRoleIds(new Set(found.roles.map((r) => r.role.id)));
        setActionIds(new Set(found.actions.map((a) => a.action.id)));
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const selectedParty = parties.find((p) => String(p.id) === form.partyId);

  function toggleActionIds(ids: number[]) {
    const count = ids.filter((id) => actionIds.has(id)).length;
    const allChecked = ids.length > 0 && count === ids.length;
    setActionIds((prev) => {
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
        const body: any = {
          firstName: form.firstName,
          lastName: form.lastName,
          isActive: form.isActive,
          partyId: form.partyId ? Number(form.partyId) : null,
          roleIds: Array.from(roleIds),
          actionIds: Array.from(actionIds),
        };
        if (form.password) body.password = form.password;
        await api.put(`/users/${editId}`, body);
        flash();
      } catch (err) {
        setFormError((err as ApiError).message);
      }
    } else {
      const res = await create({
        ...form,
        partyId: form.partyId ? Number(form.partyId) : null,
        roleIds: Array.from(roleIds),
        actionIds: Array.from(actionIds),
      });
      if (res.ok && res.data) {
        flash();
        navigate(`/users/${res.data.id}/edit`);
      } else setFormError(res.error || "خطا");
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/users/${editId}`);
      navigate("/users");
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش کاربر" : "کاربر جدید"}
      formId="user-form"
      closePath="/users"
      newPath="/users/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="user-form" onSubmit={onSubmit} autoComplete="off">
        <ErrorToast message={formError} />
        <div className="form-grid">
          <div className="form-field">
            <label>شماره همراه (۱۱ رقم)<RequiredMark /></label>
            <input
              dir="ltr"
              disabled={!!editId}
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: digitsOnly(e.target.value).slice(0, 11) })}
              autoComplete="off"
              name="user-mobile"
            />
          </div>
          <div className="form-field">
            <label>رمز عبور {editId ? "(خالی = بدون تغییر)" : <RequiredMark />}</label>
            <input
              dir="ltr"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="new-password"
              name="user-password"
            />
          </div>
          <div className="form-field">
            <label>نام<RequiredMark /></label>
            <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </div>
          <div className="form-field">
            <label>نام خانوادگی</label>
            <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <div className="form-field">
            <label>طرف حساب <FieldHint label="طرف حساب" text="اختیاری — هر دو نوع شخص حقیقی و حقوقی قابل انتخاب است" /></label>
            <RecordPickerField
              title="انتخاب طرف حساب"
              placeholder="ندارد"
              displayValue={selectedParty ? `${toFaDigits(selectedParty.detailCode)} — ${partyDisplayName(selectedParty)}` : ""}
              rows={parties}
              columns={[
                { header: "کد", render: (p) => toFaDigits(p.detailCode), filterValue: (p) => p.detailCode, width: "90px" },
                { header: "نام", render: (p) => partyDisplayName(p), filterValue: (p) => partyDisplayName(p) },
                { header: "نوع", render: (p) => (p.category === "LEGAL" ? "حقوقی" : "حقیقی"), filterValue: (p) => (p.category === "LEGAL" ? "حقوقی" : "حقیقی"), width: "80px" },
              ]}
              onSelect={(p) => setForm({ ...form, partyId: String(p.id) })}
              onClear={() => setForm({ ...form, partyId: "" })}
            />
          </div>
          {editId && (
            <div className="form-field">
              <label className="checkbox-row">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                فعال
              </label>
            </div>
          )}
          <div className="form-field full">
            <label>نقش‌های کاربری</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {roles.map((r) => (
                <label key={r.id} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={roleIds.has(r.id)}
                    onChange={() =>
                      setRoleIds((prev) => {
                        const next = new Set(prev);
                        next.has(r.id) ? next.delete(r.id) : next.add(r.id);
                        return next;
                      })
                    }
                  />
                  {r.title}
                </label>
              ))}
            </div>
          </div>
          <div className="form-field full">
            <label>
              دسترسی‌های مستقیم (مستقل از نقش){" "}
              <FieldHint
                label="دسترسی مستقیم"
                text="این دسترسی‌ها علاوه‌بر دسترسی‌های نقش‌های بالا به کاربر داده می‌شود — نیازی نیست نقش جدا فقط برای یک استثنا ساخته شود"
              />
            </label>
            <PermissionTree tree={tree} checked={actionIds} onToggle={toggleActionIds} persistKey={`${cacheKey}:permTree`} />
          </div>
        </div>
      </form>
    </FormPage>
  );
}
