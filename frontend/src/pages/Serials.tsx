import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RecordPickerField } from "../components/RecordPicker";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { toFaDigits } from "../lib/formatAmount";

interface GoodsItemOption {
  id: number;
  fullCode: string;
  title: string;
  isActive: boolean;
}

interface Serial {
  id: number;
  goodsItemId: number;
  serialNumber: string;
  description: string | null;
  isActive: boolean;
  hasTransactions: boolean;
  goodsItem: GoodsItemOption;
}

export default function Serials() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <SerialForm />;
  if (isEdit) return <SerialForm editId={Number(id)} />;
  return <SerialList />;
}

function SerialList() {
  const cacheKey = "/serials";
  const [items, setItems] = usePersistedState<Serial[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const [bulkSlot, setBulkSlot] = useState<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/serials").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: Serial) {
    try {
      await api.del(`/serials/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={`تعریف سریال کالا — Master مستقل؛ اسناد انبار فقط سریال‌های موجود را انتخاب می‌کنند`} title="سریال" />
          <NewRecordButton path="/serials/new" />
          <RefreshButton onClick={reload} />
          <div ref={setBulkSlot} className="bulk-slot" style={{ display: "flex" }} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        bulkActionsContainer={bulkSlot}
        columns={[
          { header: "کالا", render: (r) => `${toFaDigits(r.goodsItem.fullCode)} — ${r.goodsItem.title}`, filterType: "string", filterValue: (r) => r.goodsItem.title },
          { header: "شماره سریال", render: (r) => r.serialNumber, filterType: "string", filterValue: (r) => r.serialNumber },
          { header: "شرح", render: (r) => r.description || "—", filterType: "string", filterValue: (r) => r.description || "" },
          { header: "فعال", render: (r) => (r.isActive ? "بله" : "خیر"), width: "70px" },
        ]}
        rows={items}
        onEdit={(r) => navigate(`/serials/${r.id}/edit`)}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { goodsItemId: "", serialNumber: "", description: "", isActive: true };

function SerialForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [goodsItems, setGoodsItems] = useState<GoodsItemOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    api.get("/goods-items?kind=GOODS").then(setGoodsItems).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) setForm(DEFAULT_FORM);
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get("/serials").then((items: Serial[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setForm({
          goodsItemId: String(found.goodsItemId),
          serialNumber: found.serialNumber,
          description: found.description || "",
          isActive: found.isActive,
        });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const selectedGoodsItem = goodsItems.find((g) => String(g.id) === form.goodsItemId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const body = {
      goodsItemId: form.goodsItemId ? Number(form.goodsItemId) : undefined,
      serialNumber: form.serialNumber,
      description: form.description || null,
      isActive: form.isActive,
    };
    try {
      if (editId) {
        await api.put(`/serials/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/serials", body);
        flash();
        navigate(`/serials/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/serials/${editId}`);
      navigate("/serials");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش سریال" : "سریال جدید"}
      formId="serial-form"
      closePath="/serials"
      newPath="/serials/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="serial-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>کالا</label>
            <RecordPickerField
              title="انتخاب کالا"
              disabled={!!editId}
              displayValue={selectedGoodsItem ? `${toFaDigits(selectedGoodsItem.fullCode)} — ${selectedGoodsItem.title}` : ""}
              rows={goodsItems.filter((g) => g.isActive || String(g.id) === form.goodsItemId)}
              columns={[
                { header: "کد", render: (g) => toFaDigits(g.fullCode), filterValue: (g) => g.fullCode, width: "110px" },
                { header: "عنوان", render: (g) => g.title, filterValue: (g) => g.title },
              ]}
              onSelect={(g) => setForm({ ...form, goodsItemId: String(g.id) })}
            />
          </div>
          <div className="form-field">
            <label>شماره سریال</label>
            <input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>شرح</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              فعال است؟
            </label>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
