import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { RecordPickerField } from "../components/RecordPicker";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { formatJalaliDate } from "../lib/formatDate";
import { toFaDigits } from "../lib/formatAmount";
import { partyDisplayName } from "./Users";
import { DescriptionField } from "../components/DescriptionField";

const SOURCE_TYPE_FA: Record<string, string> = { MANUAL: "دستی", PURCHASE: "خرید", PRODUCTION: "تولید" };

interface GoodsItemOption {
  id: number;
  fullCode: string;
  title: string;
  isActive: boolean;
}

interface PartyOption {
  id: number;
  detailCode: string;
  category: "LEGAL" | "INDIVIDUAL";
  isActive: boolean;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
}

interface Batch {
  id: number;
  goodsItemId: number;
  batchNumber: string;
  productionDate: string | null;
  expiryDate: string | null;
  sourceType: "MANUAL" | "PURCHASE" | "PRODUCTION";
  supplierId: number | null;
  description: string | null;
  isActive: boolean;
  hasTransactions: boolean;
  goodsItem: GoodsItemOption;
  supplier: PartyOption | null;
}

export default function Batches() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <BatchForm />;
  if (isEdit) return <BatchForm editId={Number(id)} />;
  return <BatchList />;
}

function BatchList() {
  const cacheKey = "/batches";
  const [items, setItems] = usePersistedState<Batch[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/batches").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: Batch) {
    try {
      await api.del(`/batches/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={`تعریف بچ کالا — بر اساس (کالا، شماره بچ) یکتا؛ تاریخ انقضا فقط اینجا نگه‌داری می‌شود`} title="بچ" />
          <NewRecordButton path="/batches/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کالا", render: (r) => `${toFaDigits(r.goodsItem.fullCode)} — ${r.goodsItem.title}`, filterType: "string", filterValue: (r) => r.goodsItem.title },
          { header: "شماره بچ", render: (r) => r.batchNumber, filterType: "string", filterValue: (r) => r.batchNumber },
          { header: "تاریخ تولید", render: (r) => formatJalaliDate(r.productionDate), width: "110px" },
          { header: "تاریخ انقضا", render: (r) => formatJalaliDate(r.expiryDate), width: "110px" },
          { header: "منشا", render: (r) => SOURCE_TYPE_FA[r.sourceType], width: "80px" },
          { header: "فعال", render: (r) => (r.isActive ? "بله" : "خیر"), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r) => `/batches/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = {
  goodsItemId: "",
  batchNumber: "",
  productionDate: "",
  expiryDate: "",
  sourceType: "MANUAL" as "MANUAL" | "PURCHASE" | "PRODUCTION",
  supplierId: "",
  description: "",
  isActive: true,
};

function BatchForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [goodsItems, setGoodsItems] = useState<GoodsItemOption[]>([]);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/goods-items?kind=GOODS&trackingMethod=BATCH").then(setGoodsItems).catch(() => {});
    api.get("/parties").then(setParties).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) setForm(DEFAULT_FORM);
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get("/batches").then((items: Batch[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setForm({
          goodsItemId: String(found.goodsItemId),
          batchNumber: found.batchNumber,
          productionDate: found.productionDate || "",
          expiryDate: found.expiryDate || "",
          sourceType: found.sourceType,
          supplierId: found.supplierId ? String(found.supplierId) : "",
          description: found.description || "",
          isActive: found.isActive,
        });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const selectedGoodsItem = goodsItems.find((g) => String(g.id) === form.goodsItemId);
  const selectedParty = parties.find((p) => String(p.id) === form.supplierId);

  async function suggestNumber() {
    if (!form.goodsItemId) {
      showError("ابتدا کالا را انتخاب کنید");
      return;
    }
    try {
      const res = await api.get(`/batches/suggest-number?goodsItemId=${form.goodsItemId}`);
      setForm({ ...form, batchNumber: res.batchNumber });
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const body = {
      goodsItemId: form.goodsItemId ? Number(form.goodsItemId) : undefined,
      batchNumber: form.batchNumber,
      productionDate: form.productionDate || null,
      expiryDate: form.expiryDate || null,
      sourceType: form.sourceType,
      supplierId: form.supplierId ? Number(form.supplierId) : null,
      description: form.description || null,
      isActive: form.isActive,
    };
    try {
      if (editId) {
        await api.put(`/batches/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/batches", body);
        flash();
        navigate(`/batches/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/batches/${editId}`);
      navigate("/batches");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش بچ" : "بچ جدید"}
      formId="batch-form"
      closePath="/batches"
      newPath="/batches/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="batch-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کالا<RequiredMark /></label>
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
            <label>شماره بچ<RequiredMark /></label>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} autoFocus style={{ flex: 1 }} />
              <button type="button" className="btn secondary" onClick={suggestNumber}>پیشنهاد</button>
            </div>
          </div>
          <div className="form-field">
            <label>تاریخ تولید</label>
            <JalaliDatePicker value={form.productionDate} onChange={(v) => setForm({ ...form, productionDate: v })} />
          </div>
          <div className="form-field">
            <label>تاریخ انقضا</label>
            <JalaliDatePicker value={form.expiryDate} onChange={(v) => setForm({ ...form, expiryDate: v })} />
          </div>
          <div className="form-field">
            <label>منشا <FieldHint label="منشا" text="صرفا مشخص می‌کند این بچ از کجا ایجاد شده — دستی/خرید/تولید" /></label>
            <select value={form.sourceType} onChange={(e) => setForm({ ...form, sourceType: e.target.value as typeof form.sourceType })}>
              <option value="MANUAL">دستی</option>
              <option value="PURCHASE">خرید</option>
              <option value="PRODUCTION">تولید</option>
            </select>
          </div>
          <div className="form-field">
            <label>تامین‌کننده</label>
            <RecordPickerField
              title="انتخاب تامین‌کننده"
              displayValue={selectedParty ? `${toFaDigits(selectedParty.detailCode)} — ${partyDisplayName(selectedParty)}` : ""}
              rows={parties.filter((p) => p.isActive || String(p.id) === form.supplierId)}
              columns={[
                { header: "کد", render: (p) => toFaDigits(p.detailCode), filterValue: (p) => p.detailCode, width: "90px" },
                { header: "نام", render: (p) => partyDisplayName(p), filterValue: (p) => partyDisplayName(p) },
              ]}
              onSelect={(p) => setForm({ ...form, supplierId: String(p.id) })}
              onClear={() => setForm({ ...form, supplierId: "" })}
            />
          </div>
          <div className="form-field">
            <DescriptionField value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
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
