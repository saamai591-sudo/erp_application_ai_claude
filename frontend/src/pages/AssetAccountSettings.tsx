import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { ErrorToast } from "../components/ErrorToast";
import { useTabs } from "../lib/TabsContext";
import AssetAccountSettingsBulk from "./AssetAccountSettingsBulk";
import { FormPage } from "../components/FormPage";
import { InfoHint } from "../components/InfoHint";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { LeafAccountField } from "../components/LeafAccountField";
import { NewRecordButton } from "../components/NewRecordButton";
import { RefreshButton } from "../components/RefreshButton";
import { RequiredMark } from "../components/RequiredMark";
import { api, ApiError } from "../lib/api";
import { formatJalaliDate } from "../lib/formatDate";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { hasPersistedState, usePersistedState } from "../lib/usePersistedState";

// «حسابهای دارایی ثابت» (دارایی ثابت › تنظیمات): حساب هر نوع برای هر گروه دارایی (و برای هزینه/پیش‌پرداخت بیمه، به‌تفکیک نوع بیمه) با
// «تاریخ اجرا». برای یک سند، آخرین رکورد با تاریخ اجرای ≤ تاریخ سند به‌کار می‌رود. رکوردی که در سند حسابداری استفاده شده قابل ویرایش/حذف نیست؛
// برای تغییر حساب، رکورد جدید با تاریخ اجرای جدید ثبت کنید.

interface Setting {
  id: number;
  accountType: string;
  accountTypeTitle: string;
  assetGroupId: number;
  assetGroupTitle: string;
  insuranceTypeId: number | null;
  insuranceTypeTitle: string | null;
  effectiveDate: string;
  accountId: number;
  accountCode: string;
  accountTitle: string;
  locked: boolean;
  lockedReason?: string | null;
}
interface AccountType { key: string; title: string; perInsuranceType?: boolean }
interface Named { id: number; title: string; isActive?: boolean }

export default function AssetAccountSettings() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/bulk")) return <AssetAccountSettingsBulk />;
  if (location.pathname.endsWith("/new")) return <SettingForm />;
  if (location.pathname.endsWith("/edit")) return <SettingForm editId={Number(id)} />;
  return <SettingList />;
}

function SettingList() {
  const { openTab } = useTabs();
  const cacheKey = "/asset-account-settings";
  const [items, setItems] = usePersistedState<Setting[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/asset-account-settings").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: Setting) {
    try {
      await api.del(`/asset-account-settings/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: Setting) => string, extra: object = {}) => ({ render: (r: Setting) => f(r), filterType: "string" as const, filterValue: (r: Setting) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="حساب معین هر نوع (دارایی، هزینه و انباشته‌ی استهلاک، بیمه، سود و زیان فروش، اسقاط، …) برای هر گروه دارایی، با تاریخ اجرا. برای هزینه و پیش‌پرداخت بیمه نوع بیمه هم کلید است. رکورد استفاده‌شده در سند حسابداری قفل است." title="حسابهای دارایی ثابت" />
          <NewRecordButton path="/asset-account-settings/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "گروه دارایی", ...s((r) => r.assetGroupTitle) },
          { header: "نوع حساب", ...s((r) => r.accountTypeTitle) },
          { header: "نوع بیمه", ...s((r) => r.insuranceTypeTitle ?? "—"), width: "130px" },
          { header: "تاریخ اجرا", ...s((r) => formatJalaliDate(r.effectiveDate)), width: "110px" },
          { header: "کد حساب", ...s((r) => r.accountCode), width: "110px" },
          { header: "حساب", ...s((r) => r.accountTitle) },
          { header: "قفل", ...s((r) => (r.locked ? "بله" : "خیر")), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r: Setting) => `/asset-account-settings/${r.id}/edit` }}
        onDelete={onDelete}
        bulkActions={[{ label: () => "درج گروهی", onClick: () => openTab("/asset-account-settings/bulk"), noSelection: true }]}
      />
    </div>
  );
}

const DEFAULT_FORM = { accountType: "", assetGroupId: "", insuranceTypeId: "", effectiveDate: "", accountId: "", locked: false, lockedReason: "" };

function SettingForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const [types, setTypes] = useState<AccountType[]>([]);
  const [groups, setGroups] = useState<Named[]>([]);
  const [insTypes, setInsTypes] = useState<Named[]>([]);
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/asset-account-types").then(setTypes);
    api.get("/asset-groups?activeOnly=true").then(setGroups);
    api.get("/asset-insurance-types").then(setInsTypes);
  }, []);

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) setForm({ ...DEFAULT_FORM, effectiveDate: new Date().toISOString().slice(0, 10) });
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get(`/asset-account-settings/${editId}`).then((r: Setting) => {
      setForm({ accountType: r.accountType, assetGroupId: String(r.assetGroupId), insuranceTypeId: r.insuranceTypeId ? String(r.insuranceTypeId) : "", effectiveDate: String(r.effectiveDate).slice(0, 10), accountId: String(r.accountId), locked: r.locked, lockedReason: r.lockedReason ?? "" });
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const perInsurance = !!types.find((t) => t.key === form.accountType)?.perInsuranceType;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.accountType) return setError("نوع حساب الزامی است");
    if (!form.assetGroupId) return setError("گروه دارایی الزامی است");
    if (perInsurance && !form.insuranceTypeId) return setError("نوع بیمه الزامی است");
    if (!form.effectiveDate) return setError("تاریخ اجرا الزامی است");
    if (!form.accountId) return setError("حساب الزامی است");
    const body = { accountType: form.accountType, assetGroupId: Number(form.assetGroupId), insuranceTypeId: perInsurance ? Number(form.insuranceTypeId) : null, effectiveDate: form.effectiveDate, accountId: Number(form.accountId) };
    try {
      if (editId) {
        await api.put(`/asset-account-settings/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/asset-account-settings", body);
        flash();
        navigate(`/asset-account-settings/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/asset-account-settings/${editId}`);
      navigate("/asset-account-settings");
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  if (!loaded) return null;
  const locked = form.locked;
  return (
    <FormPage title={editId ? "ویرایش حساب دارایی ثابت" : "حساب دارایی ثابت جدید"} formId="asset-account-setting-form" closePath="/asset-account-settings" newPath="/asset-account-settings/new" onDelete={editId ? handleDelete : undefined}>
      <form id="asset-account-setting-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {locked && <div className="hint" style={{ marginBottom: 10 }}>{form.lockedReason || "این رکورد در سند حسابداری استفاده شده و قابل ویرایش نیست."}</div>}
        <fieldset disabled={locked}>
          <div className="form-grid">
            <div className="form-field">
              <label>گروه دارایی<RequiredMark /></label>
              <select value={form.assetGroupId} onChange={(e) => setForm({ ...form, assetGroupId: e.target.value })}>
                <option value="">—</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>نوع حساب<RequiredMark /></label>
              <select value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value, insuranceTypeId: "" })}>
                <option value="">—</option>
                {types.map((t) => <option key={t.key} value={t.key}>{t.title}</option>)}
              </select>
            </div>
            {perInsurance && (
              <div className="form-field">
                <label>نوع بیمه<RequiredMark /></label>
                <select value={form.insuranceTypeId} onChange={(e) => setForm({ ...form, insuranceTypeId: e.target.value })}>
                  <option value="">—</option>
                  {insTypes.filter((x) => x.isActive !== false || String(x.id) === form.insuranceTypeId).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                </select>
              </div>
            )}
            <div className="form-field">
              <label>تاریخ اجرا<RequiredMark /></label>
              <JalaliDatePicker value={form.effectiveDate} onChange={(v) => setForm({ ...form, effectiveDate: v })} />
            </div>
            <div className="form-field">
              <label>حساب معین<RequiredMark /></label>
              <LeafAccountField value={form.accountId} disabled={locked} onChange={(v) => setForm({ ...form, accountId: v })} />
            </div>
          </div>
        </fieldset>
      </form>
    </FormPage>
  );
}
