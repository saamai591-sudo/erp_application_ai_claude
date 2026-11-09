import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// «گروه مشتری» (فروش › تنظیمات) و «گروه تامین‌کننده» (زنجیره تامین › تنظیمات): فهرست تخت برای طبقه‌بندی؛ هر مشتری/تامین‌کننده حداکثر یک گروه دارد و
// گزارش «مانده» تبی به تفکیک گروه دارد. گروهِ دارای عضو حذف نمی‌شود، فقط غیرفعال می‌شود. منطق: backend/src/routes/partyGroups.ts.

type Kind = "CUSTOMER" | "SUPPLIER";
interface Group { id: number; code: number; title: string; isActive: boolean; usageCount: number }

const CONFIG: Record<Kind, { path: string; api: string; label: string; member: string; hint: string }> = {
  CUSTOMER: { path: "/customer-groups", api: "/customer-groups", label: "گروه مشتری", member: "مشتری", hint: "طبقه‌بندی مشتریان (مثلاً دولتی، خصوصی، پیمانکار) برای گزارش مانده مشتریان به تفکیک گروه. هر مشتری حداکثر یک گروه دارد و در فرم «مشتری» انتخاب می‌شود. گروهِ دارای مشتری حذف نمی‌شود، فقط غیرفعال می‌شود." },
  SUPPLIER: { path: "/supplier-groups", api: "/supplier-groups", label: "گروه تامین‌کننده", member: "تامین‌کننده", hint: "طبقه‌بندی تامین‌کنندگان برای گزارش مانده تامین‌کنندگان به تفکیک گروه؛ جدا از «گروه خرید» (که ساختار خرید با کارشناس و کالاست). هر تامین‌کننده حداکثر یک گروه دارد و در فرم «تامین کننده» انتخاب می‌شود. گروهِ دارای تامین‌کننده حذف نمی‌شود، فقط غیرفعال می‌شود." },
};

export default function PartyGroups({ kind }: { kind: Kind }) {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <GroupForm kind={kind} />;
  if (location.pathname.endsWith("/edit")) return <GroupForm kind={kind} editId={Number(id)} />;
  return <GroupList kind={kind} />;
}

function GroupList({ kind }: { kind: Kind }) {
  const cfg = CONFIG[kind];
  const [items, setItems] = usePersistedState<Group[]>(cfg.path, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get(cfg.api).then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cfg.path)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: Group) {
    try {
      await api.del(`${cfg.api}/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: Group) => string, extra: object = {}) => ({ render: (r: Group) => f(r), filterType: "string" as const, filterValue: (r: Group) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={cfg.hint} title={cfg.label} />
          <NewRecordButton path={`${cfg.path}/new`} />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", ...s((r) => toFaDigits(String(r.code))), width: "80px" },
          { header: "عنوان", ...s((r) => r.title) },
          { header: `تعداد ${cfg.member}`, ...s((r) => toFaDigits(String(r.usageCount))), width: "120px" },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r: Group) => `${cfg.path}/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { title: "", isActive: true };

function GroupForm({ kind, editId }: { kind: Kind; editId?: number }) {
  const cfg = CONFIG[kind];
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    if (!editId) return;
    api.get(cfg.api).then((rows: Group[]) => {
      const r = rows.find((x) => x.id === editId);
      if (r && !hasPersistedState(cacheKey)) setForm({ title: r.title, isActive: r.isActive });
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    try {
      if (editId) {
        await api.put(`${cfg.api}/${editId}`, form);
        flash();
      } else {
        const created = await api.post(cfg.api, form);
        flash();
        navigate(`${cfg.path}/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`${cfg.api}/${editId}`);
      navigate(cfg.path);
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? `ویرایش ${cfg.label}` : `${cfg.label} جدید`}
      formId="party-group-form"
      closePath={cfg.path}
      newPath={`${cfg.path}/new`}
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="party-group-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          {editId && (
            <div className="form-field">
              <label className="checkbox-row">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                فعال
              </label>
            </div>
          )}
        </div>
      </form>
    </FormPage>
  );
}
