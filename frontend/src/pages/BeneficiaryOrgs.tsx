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

// منابع انسانی › تنظیمات › سازمان ذینفع: کد (خالی = آخرین + ۱)، عنوان، نوع (تامین اجتماعی / امور مالیاتی / سایر)، فعال.
// نوع تعیین می‌کند فرم «شعب سازمان ذینفع» چه فیلدهایی دارد (کد کارگاه، ردیف پیمان، کارفرما و آدرس فقط برای تامین اجتماعی).

export const BENEFICIARY_TYPE_FA: Record<string, string> = {
  SOCIAL_SECURITY: "سازمان تامین اجتماعی",
  TAX: "سازمان امور مالیاتی",
  OTHER: "سایر",
};

interface OrgRow {
  id: number;
  code: number;
  title: string;
  type: string;
  typeTitle: string;
  isActive: boolean;
  branchCount: number;
}

export default function BeneficiaryOrgs() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <OrgForm />;
  if (location.pathname.endsWith("/edit")) return <OrgForm editId={Number(id)} />;
  return <OrgList />;
}

function OrgList() {
  const cacheKey = "/beneficiary-orgs";
  const [items, setItems] = usePersistedState<OrgRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/beneficiary-orgs").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: OrgRow) {
    try {
      await api.del(`/beneficiary-orgs/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: OrgRow) => string, extra: object = {}) => ({ render: (r: OrgRow) => f(r), filterType: "string" as const, filterValue: (r: OrgRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="سازمان‌هایی که کارمندان در آن‌ها مشمول یا غیرمشمول‌اند (تامین اجتماعی، امور مالیاتی، …). شعبه‌های هر سازمان در «شعب سازمان ذینفع» تعریف می‌شود و در فرم کارمند مشمولیت هر سازمان مشخص می‌شود." title="سازمان ذینفع" />
          <NewRecordButton path="/beneficiary-orgs/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", render: (r: OrgRow) => toFaDigits(String(r.code)), filterType: "number" as const, filterValue: (r: OrgRow) => r.code, width: "80px" },
          { header: "عنوان", ...s((r) => r.title) },
          { header: "نوع", ...s((r) => r.typeTitle), width: "180px" },
          { header: "تعداد شعبه", ...s((r) => toFaDigits(String(r.branchCount))), width: "100px" },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r: OrgRow) => `/beneficiary-orgs/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const EMPTY = { code: "", title: "", type: "SOCIAL_SECURITY", isActive: true };

function OrgForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, EMPTY);
  const [meta, setMeta] = useState<{ branchCount: number }>({ branchCount: 0 });
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    if (!editId) return;
    api.get(`/beneficiary-orgs/${editId}`).then((o: OrgRow) => {
      setMeta({ branchCount: o.branchCount });
      if (!hasPersistedState(cacheKey)) setForm({ code: String(o.code), title: o.title, type: o.type, isActive: o.isActive });
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
        await api.put(`/beneficiary-orgs/${editId}`, form);
        flash();
      } else {
        const created = await api.post("/beneficiary-orgs", form);
        flash();
        navigate(`/beneficiary-orgs/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/beneficiary-orgs/${editId}`);
      navigate("/beneficiary-orgs");
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش سازمان ذینفع" : "سازمان ذینفع جدید"}
      formId="beneficiary-org-form"
      closePath="/beneficiary-orgs"
      newPath="/beneficiary-orgs/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="beneficiary-org-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کد <FieldHint label="کد" text="اگر خالی بماند، آخرین کد + ۱ ثبت می‌شود" /></label>
            <input dir="ltr" inputMode="numeric" value={form.code} placeholder="خودکار" onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, "") })} />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>نوع<RequiredMark /> {meta.branchCount > 0 && <FieldHint label="نوع" text="برای این سازمان شعبه تعریف شده و نوع آن قابل تغییر نیست" />}</label>
            <select value={form.type} disabled={meta.branchCount > 0} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(BENEFICIARY_TYPE_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              فعال
            </label>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
