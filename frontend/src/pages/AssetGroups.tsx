import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { ErrorToast } from "../components/ErrorToast";
import { FormPage } from "../components/FormPage";
import { InfoHint } from "../components/InfoHint";
import { NewRecordButton } from "../components/NewRecordButton";
import { RefreshButton } from "../components/RefreshButton";
import { RequiredMark } from "../components/RequiredMark";
import { api, ApiError } from "../lib/api";
import { toFaDigits } from "../lib/formatAmount";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { hasPersistedState, usePersistedState } from "../lib/usePersistedState";

// «گروه حسابداری دارایی» (دارایی ثابت › تنظیمات): اثاثیه، ماشین‌آلات، ساختمان، نرم‌افزار، حق‌الامتیاز… کد را سرور می‌دهد.
// حساب‌های معین گروه در فرم تاریخ‌دار «حسابهای دارایی ثابت» (تنظیمات) تعریف می‌شوند، نه اینجا.

interface AssetGroup { id: number; code: number; title: string; isActive: boolean; [column: string]: unknown }

export default function AssetGroups() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <AssetGroupForm />;
  if (location.pathname.endsWith("/edit")) return <AssetGroupForm editId={Number(id)} />;
  return <AssetGroupList />;
}

function AssetGroupList() {
  const cacheKey = "/asset-groups";
  const [items, setItems] = usePersistedState<AssetGroup[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const reload = () => api.get("/asset-groups").then(setItems).catch((e) => setError(e.message));
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: AssetGroup) {
    try {
      await api.del(`/asset-groups/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="گروه‌های دارایی ثابت — اثاثیه، ماشین‌آلات، ساختمان، نرم‌افزار و…" title="گروه حسابداری دارایی" />
          <NewRecordButton path="/asset-groups/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", render: (r) => toFaDigits(String(r.code)), width: "90px", filterType: "number", filterValue: (r) => r.code },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "فعال", render: (r) => (r.isActive ? "بله" : "خیر"), width: "80px", filterType: "string", filterValue: (r) => (r.isActive ? "بله" : "خیر") },
        ]}
        rows={items}
        edit={{ path: (r) => `/asset-groups/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { code: "", title: "", isActive: true, depreciationStartRule: "DAILY" };

function AssetGroupForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) setForm(DEFAULT_FORM);
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get("/asset-groups").then((items: AssetGroup[]) => {
      const f = items.find((i) => i.id === editId);
      if (f) setForm({ code: String(f.code), title: f.title, isActive: f.isActive, depreciationStartRule: String(f.depreciationStartRule ?? "DAILY") });
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    const body = { title: form.title.trim(), isActive: form.isActive, depreciationStartRule: form.depreciationStartRule };
    try {
      if (editId) {
        await api.put(`/asset-groups/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/asset-groups", body);
        flash();
        navigate(`/asset-groups/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/asset-groups/${editId}`);
      navigate("/asset-groups");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  return (
    <FormPage title={editId ? "ویرایش گروه حسابداری دارایی" : "گروه حسابداری دارایی جدید"} formId="asset-group-form" closePath="/asset-groups" newPath="/asset-groups/new" onDelete={editId ? handleDelete : undefined}>
      <form id="asset-group-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کد</label>
            <input disabled value={form.code ? toFaDigits(form.code) : ""} placeholder="پس از ذخیره صادر می‌شود" />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> فعال
            </label>
          </div>
        </div>
        <fieldset style={{ marginTop: 18 }}>
          <legend>استهلاک</legend>
          <div className="form-grid">
            <div className="form-field">
              <label>شروع استهلاک (ماه اول)</label>
              <select value={form.depreciationStartRule} onChange={(e) => setForm({ ...form, depreciationStartRule: e.target.value })}>
                <option value="DAILY">از روز بهره‌برداری (روزشمار)</option>
                <option value="MONTH_START">از اول ماه بهره‌برداری (ماه کامل)</option>
                <option value="NEXT_MONTH">از اول ماه بعد از بهره‌برداری</option>
              </select>
            </div>
          </div>
        </fieldset>
      </form>
    </FormPage>
  );
}
