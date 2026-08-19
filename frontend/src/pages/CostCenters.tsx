import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { ExcelImportButton } from "../components/ExcelImport";
import { InfoHint } from "../components/InfoHint";
import { toFaDigits } from "../lib/formatAmount";

interface CostCenter { id: number; detailCode: string; title: string; type: string; orgUnitId?: number; orgUnit: { title: string } }
interface OrgUnit { id: number; title: string }

const TYPE_FA: Record<string, string> = {
  OPERATIONAL: "عملیاتی/تولیدی",
  SUPPORT: "پشتیبانی",
  SERVICE: "خدماتی",
  ADMIN: "اداری و تشکیلاتی",
};

export default function CostCenters() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <CostCenterForm />;
  if (isEdit) return <CostCenterForm editId={Number(id)} />;
  return <CostCenterList />;
}

function CostCenterList() {
  const cacheKey = "/cost-centers";
  const [items, setItems] = usePersistedState<CostCenter[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const [bulkSlot, setBulkSlot] = useState<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/cost-centers").then(setItems).catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: CostCenter) {
    try {
      await api.del(`/cost-centers/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  const TYPE_FA_REVERSE: Record<string, string> = Object.fromEntries(Object.entries(TYPE_FA).map(([k, v]) => [v, k]));

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}><InfoHint text={`زیربنای محاسبات بهای تمام‌شده — کد به صورت خودکار بر اساس «نوع تفصیل» صادر می‌شود`} title="مرکز هزینه" /><NewRecordButton path="/cost-centers/new" />
          <ExcelImportButton
            entityLabel="مراکز هزینه"
            templateFilename="قالب-مرکز-هزینه"
            backendEntityType="cost-center"
            columns={[
              { key: "title", label: "عنوان", required: true },
              { key: "type", label: "نوع", required: true, hint: Object.values(TYPE_FA).join(" / ") },
              { key: "orgUnitTitle", label: "عنوان واحد سازمانی", required: true },
              { key: "detailCode", label: "کد تفصیل", hint: "اختیاری — اگر خالی بگذارید خودکار صادر می‌شود" },
            ]}
            onDone={reload}
          />
          <RefreshButton onClick={reload} /><div ref={setBulkSlot} className="bulk-slot" style={{ display: "flex" }} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        bulkActionsContainer={bulkSlot}
        columns={[
          { header: "کد", render: (r) => toFaDigits(r.detailCode), width: "100px", filterType: "string", filterValue: (r) => r.detailCode },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "نوع", render: (r) => TYPE_FA[r.type], filterType: "string", filterValue: (r) => TYPE_FA[r.type] },
          { header: "واحد سازمانی", render: (r) => r.orgUnit?.title, filterType: "string", filterValue: (r) => r.orgUnit?.title },
        ]}
        rows={items}
        onEdit={(r) => navigate(`/cost-centers/${r.id}/edit`)}
        onDelete={onDelete}
      />
    </div>
  );
}

function CostCenterForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [form, setForm] = usePersistedState(cacheKey, { title: "", type: "ADMIN", orgUnitId: "" });
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    api.get("/org-units").then(setOrgUnits);
  }, []);

  useEffect(() => {
    if (!editId || hasPersistedState(cacheKey)) return;
    api.get("/cost-centers").then((items: CostCenter[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setForm({ title: found.title, type: found.type, orgUnitId: String(found.orgUnitId ?? "") });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editId) {
        await api.put(`/cost-centers/${editId}`, { title: form.title, type: form.type, orgUnitId: Number(form.orgUnitId) });
        flash();
      } else {
        const created = await api.post("/cost-centers", { title: form.title, type: form.type, orgUnitId: Number(form.orgUnitId) });
        flash();
        navigate(`/cost-centers/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/cost-centers/${editId}`);
      navigate("/cost-centers");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش مرکز هزینه" : "مرکز هزینه جدید"}
      formId="cost-center-form"
      closePath="/cost-centers"
      newPath="/cost-centers/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="cost-center-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>عنوان</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>نوع</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(TYPE_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-field full">
            <label>واحد سازمانی</label>
            <select value={form.orgUnitId} onChange={(e) => setForm({ ...form, orgUnitId: e.target.value })}>
              <option value="">انتخاب کنید</option>
              {orgUnits.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
            </select>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
