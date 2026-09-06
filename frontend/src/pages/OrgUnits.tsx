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
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";

interface OrgUnit { id: number; code: number; title: string; orgStructureId?: number; orgStructure: { title: string } }
interface OrgNode { id: number; parentId: number | null; title: string }

export default function OrgUnits() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <OrgUnitForm />;
  if (isEdit) return <OrgUnitForm editId={Number(id)} />;
  return <OrgUnitList />;
}

function OrgUnitList() {
  const cacheKey = "/org-units";
  const [items, setItems] = usePersistedState<OrgUnit[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/org-units").then(setItems).catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: OrgUnit) {
    try {
      await api.del(`/org-units/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}><InfoHint text={`برای گزارش‌گیری به تفکیک واحد؛ فقط آخرین شاخه (برگ) ساختار سازمانی قابل انتخاب است`} title="واحد سازمانی" /><NewRecordButton path="/org-units/new" />
          <ExcelImportButton
            entityLabel="واحدهای سازمانی"
            templateFilename="قالب-واحد-سازمانی"
            backendEntityType="org-unit"
            columns={[
              { key: "title", label: "عنوان", required: true },
              { key: "orgStructureTitle", label: "عنوان شاخه ساختار سازمانی", required: true, hint: "باید دقیقاً عنوان یک آخرین شاخه (برگ) موجود باشد" },
              { key: "code", label: "کد", hint: "اختیاری — اگر خالی بگذارید خودکار صادر می‌شود" },
            ]}
            onDone={reload}
          />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "کد", render: (r) => toFaDigits(String(r.code)), width: "80px", filterType: "number", filterValue: (r) => r.code },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "شاخه ساختار سازمانی", render: (r) => r.orgStructure?.title, filterType: "string", filterValue: (r) => r.orgStructure?.title },
        ]}
        rows={items}
        edit={{ path: (r) => `/org-units/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function OrgUnitForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [leafNodes, setLeafNodes] = useState<OrgNode[]>([]);
  const [form, setForm] = usePersistedState(cacheKey, { title: "", orgStructureId: "" });
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    api.get("/org-structure").then((nodes: OrgNode[]) => {
      const parentIds = new Set(nodes.map((n) => n.parentId).filter(Boolean));
      setLeafNodes(nodes.filter((n) => !parentIds.has(n.id)));
    });
  }, []);

  useEffect(() => {
    if (!editId || hasPersistedState(cacheKey)) return;
    api.get("/org-units").then((items: OrgUnit[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setForm({ title: found.title, orgStructureId: String(found.orgStructureId ?? "") });
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
        await api.put(`/org-units/${editId}`, { title: form.title, orgStructureId: Number(form.orgStructureId) });
        flash();
      } else {
        const created = await api.post("/org-units", { title: form.title, orgStructureId: Number(form.orgStructureId) });
        flash();
        navigate(`/org-units/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/org-units/${editId}`);
      navigate("/org-units");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش واحد سازمانی" : "واحد سازمانی جدید"}
      formId="org-unit-form"
      closePath="/org-units"
      newPath="/org-units/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="org-unit-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>شاخه ساختار سازمانی (برگ)<RequiredMark /></label>
            <select value={form.orgStructureId} onChange={(e) => setForm({ ...form, orgStructureId: e.target.value })}>
              <option value="">انتخاب کنید</option>
              {leafNodes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
            </select>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
