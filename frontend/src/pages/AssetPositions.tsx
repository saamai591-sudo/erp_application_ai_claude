import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AssetLocationField } from "../components/AssetLocationField";
import { BulkErrorDialog } from "../components/BulkErrorDialog";
import { DataTable } from "../components/DataTable";
import { ErrorToast } from "../components/ErrorToast";
import { FormPage } from "../components/FormPage";
import { InfoHint } from "../components/InfoHint";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { MultiRecordPickerField } from "../components/MultiRecordPicker";
import { NewRecordButton } from "../components/NewRecordButton";
import { PickerColumn } from "../components/RecordPicker";
import { RefreshButton } from "../components/RefreshButton";
import { RequiredMark } from "../components/RequiredMark";
import { CostCenterPickerField } from "../components/TypePickerFields";
import { api, ApiError } from "../lib/api";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { showError } from "../lib/toast";
import { hasPersistedState, usePersistedState } from "../lib/usePersistedState";
import { useSavedFlash } from "../lib/useSavedFlash";

// «تغییر موقعیت دارایی» (دارایی ثابت › عملیات): موقعیت (مرکز هزینه + پروژه اختیاری + محل) تاریخ‌دار است؛ از «تاریخ تغییر» به بعد دارایی در موقعیت جدید است
// و استهلاک (مرحله‌ی بعد) هر بازه را روی مرکز هزینه‌ی همان بازه می‌شکند. تغییر چند پلاک با هم و «همه یا هیچ» است.

interface PositionRow { id: number; assetId: number; assetCode: string; assetTitle: string; fromDate: string; costCenterTitle: string; projectTitle: string; location: string }
interface AssetOption { id: number; detailCode: string; title: string; status: string; costCenterTitle: string }
interface CostCenter { id: number; detailCode: string; title: string }
interface Project { id: number; title: string; isActive: boolean }

export default function AssetPositions() {
  const location = useLocation();
  if (location.pathname.endsWith("/new")) return <PositionForm />;
  return <PositionList />;
}

function PositionList() {
  const cacheKey = "/asset-positions";
  const [items, setItems] = usePersistedState<PositionRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const reload = () => api.get("/asset-positions").then(setItems).catch((e) => setError(e.message));
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: PositionRow) {
    try {
      await api.del(`/asset-positions/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="تاریخچه‌ی موقعیت دارایی‌ها. فقط آخرین موقعیتِ هر دارایی (به‌جز موقعیت اول) قابل حذف است." title="تغییر موقعیت دارایی" />
          <NewRecordButton path="/asset-positions/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "پلاک", render: (r) => toFaDigits(r.assetCode), width: "100px", filterType: "string", filterValue: (r) => r.assetCode },
          { header: "دارایی", render: (r) => r.assetTitle, filterType: "string", filterValue: (r) => r.assetTitle },
          { header: "از تاریخ", render: (r) => formatJalaliDate(r.fromDate), width: "110px", filterType: "string", filterValue: (r) => formatJalaliDate(r.fromDate) },
          { header: "مرکز هزینه", render: (r) => r.costCenterTitle, filterType: "string", filterValue: (r) => r.costCenterTitle },
          { header: "پروژه", render: (r) => r.projectTitle, filterType: "string", filterValue: (r) => r.projectTitle },
          { header: "موقعیت", render: (r) => r.location, filterType: "string", filterValue: (r) => r.location },
        ]}
        rows={items}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { fromDate: "", costCenterId: "", projectId: "", locationId: "", assets: [] as AssetOption[] };

function PositionForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<ApiError | null>(null);
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/fixed-assets").then((r: AssetOption[]) => setAssets(r.filter((a) => a.status === "ACTIVE")));
    api.get("/cost-centers").then(setCostCenters);
    api.get("/projects").then((r: Project[]) => setProjects(r.filter((p) => p.isActive)));
    if (!hasPersistedState(cacheKey)) setForm({ ...DEFAULT_FORM, fromDate: new Date().toISOString().slice(0, 10) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cols: PickerColumn<AssetOption>[] = [
    { header: "پلاک", render: (r) => toFaDigits(r.detailCode), filterValue: (r) => r.detailCode, width: "100px" },
    { header: "عنوان", render: (r) => r.title, filterValue: (r) => r.title },
    { header: "مرکز هزینه فعلی", render: (r) => r.costCenterTitle, filterValue: (r) => r.costCenterTitle },
  ];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.assets.length) return setError("دارایی‌ای انتخاب نشده است");
    if (!form.fromDate) return setError("تاریخ تغییر الزامی است");
    if (!form.costCenterId) return setError("مرکز هزینه الزامی است");
    try {
      await api.post("/asset-positions/bulk", {
        assetIds: form.assets.map((a) => a.id),
        fromDate: form.fromDate,
        costCenterId: Number(form.costCenterId),
        projectId: form.projectId ? Number(form.projectId) : null,
        locationId: form.locationId ? Number(form.locationId) : null,
      });
      flash();
      navigate("/asset-positions");
    } catch (e) {
      const err = e as ApiError;
      if (err.details?.length) setBulkError(err);
      else setError(err.message);
    }
  }

  return (
    <FormPage title="تغییر موقعیت دارایی" formId="asset-position-form" closePath="/asset-positions" newPath="/asset-positions/new">
      <form id="asset-position-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>تاریخ تغییر<RequiredMark /></label>
            <JalaliDatePicker value={form.fromDate} onChange={(v) => setForm({ ...form, fromDate: v })} />
          </div>
          <div className="form-field">
            <label>مرکز هزینه‌ی جدید<RequiredMark /></label>
            <CostCenterPickerField costCenters={costCenters} value={form.costCenterId} onChange={(v) => setForm({ ...form, costCenterId: v })} />
          </div>
          <div className="form-field">
            <label>پروژه</label>
            <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
              <option value="">—</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>شاخه‌ی موقعیت</label>
            <AssetLocationField value={form.locationId} onChange={(v) => setForm({ ...form, locationId: v })} />
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <label>دارایی‌ها<RequiredMark /></label>
          <MultiRecordPickerField<AssetOption>
            title="انتخاب دارایی‌ها"
            rows={assets}
            columns={cols}
            selected={form.assets}
            onChange={(rows) => setForm({ ...form, assets: rows })}
            getLabel={(r) => r.detailCode}
          />
        </div>
      </form>
      {bulkError && (
        <BulkErrorDialog
          error={bulkError}
          gridName="خطاهای تغییر موقعیت"
          detailColumns={[
            { header: "پلاک", render: (r: Record<string, string>) => r["پلاک"] },
            { header: "عنوان", render: (r: Record<string, string>) => r["عنوان"] ?? "" },
            { header: "علت", render: (r: Record<string, string>) => r["علت"] },
          ]}
          onClose={() => setBulkError(null)}
        />
      )}
    </FormPage>
  );
}
