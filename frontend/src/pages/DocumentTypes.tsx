import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { toFaDigits } from "../lib/formatAmount";

interface DocType { id: number; code: number; title: string; isSystem: boolean }

export default function DocumentTypes() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <TypeForm />;
  if (isEdit) return <TypeForm editId={Number(id)} />;
  return <TypeList />;
}

function TypeList() {
  const cacheKey = "/document-types";
  const [items, setItems] = usePersistedState<DocType[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const [bulkSlot, setBulkSlot] = useState<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/document-types").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: DocType) {
    try {
      await api.del(`/document-types/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}><InfoHint text={`انواع پیش‌فرض سیستمی (عملیاتی، افتتاحیه، بستن حسابها، اختتامیه) قابل حذف نیستند؛ انواع سفارشی برای گزارش‌گیری قابل تعریف است`} title="نوع سند" /><NewRecordButton path="/document-types/new" /><RefreshButton onClick={reload} /><div ref={setBulkSlot} className="bulk-slot" style={{ display: "flex" }} /></div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        bulkActionsContainer={bulkSlot}
        columns={[
          { header: "کد", render: (r) => toFaDigits(String(r.code)), width: "80px", filterType: "number", filterValue: (r) => r.code },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "نوع", render: (r) => (r.isSystem ? <span className="badge">سیستمی</span> : "سفارشی"), filterType: "string", filterValue: (r) => (r.isSystem ? "سیستمی" : "سفارشی") },
        ]}
        rows={items}
        onEdit={(r) => navigate(`/document-types/${r.id}/edit`)}
        onDelete={onDelete}
      />
    </div>
  );
}

function TypeForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [title, setTitle] = usePersistedState(`${cacheKey}:title`, "");
  const [isSystem, setIsSystem] = usePersistedState(`${cacheKey}:isSystem`, false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(`${cacheKey}:title`));
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    if (!editId || hasPersistedState(`${cacheKey}:title`)) return;
    api.get("/document-types").then((items: DocType[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setTitle(found.title);
        setIsSystem(found.isSystem);
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
        await api.put(`/document-types/${editId}`, { title });
        flash();
      } else {
        const created = await api.post("/document-types", { title });
        flash();
        navigate(`/document-types/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/document-types/${editId}`);
      navigate("/document-types");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش نوع سند" : "نوع سند جدید"}
      formId="doctype-form"
      closePath="/document-types"
      newPath="/document-types/new"
      onDelete={editId && !isSystem ? handleDelete : undefined}
    >
      <form id="doctype-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}
        {isSystem && <div className="alert warn">این یک نوع سند سیستمی است و قابل حذف نیست؛ فقط عنوان قابل ویرایش است.</div>}
        <div className="form-field full">
          <label>عنوان</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </div>
      </form>
    </FormPage>
  );
}
