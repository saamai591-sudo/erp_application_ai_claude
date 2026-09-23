import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RecordPickerField } from "../components/RecordPicker";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { partyDisplayName } from "./Users";

interface PartyOption {
  id: number;
  detailCode: string;
  category: "INDIVIDUAL" | "LEGAL";
  isActive: boolean;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
}

interface SupplierOption {
  id: number;
  code: number;
  partyId: number;
  party: PartyOption;
  isActive: boolean;
}

interface GoodsItemRow {
  id: number;
  fullCode: string;
  title: string;
  mainUnit?: { title: string };
  isActive: boolean;
  kind: string;
}

export interface PurchaseGroup {
  id: number;
  code: number;
  title: string;
  isActive: boolean;
  hasTransactions: boolean;
  supplierCount: number;
  goodsItemCount: number;
  suppliers: { supplierId: number; code: number; partyId: number; party: PartyOption }[];
  goodsItems: { goodsItemId: number; fullCode: string; title: string; unitTitle: string }[];
}

export default function PurchaseGroups() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <PurchaseGroupForm />;
  if (isEdit) return <PurchaseGroupForm editId={Number(id)} />;
  return <PurchaseGroupList />;
}

function PurchaseGroupList() {
  const cacheKey = "/purchase-groups";
  const [items, setItems] = usePersistedState<PurchaseGroup[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/purchase-groups").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: PurchaseGroup) {
    try {
      await api.del(`/purchase-groups/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="تعریف گروه خریدهای مختلف در سیستم" title="گروه خرید" />
          <NewRecordButton path="/purchase-groups/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "کد", render: (r) => toFaDigits(String(r.code)), width: "80px", filterType: "number", filterValue: (r) => r.code },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "تعداد تامین‌کننده", render: (r) => toFaDigits(String(r.supplierCount)), width: "120px" },
          { header: "تعداد کالا", render: (r) => toFaDigits(String(r.goodsItemCount)), width: "100px" },
          { header: "فعال", render: (r) => (r.isActive ? "بله" : "خیر"), width: "80px" },
        ]}
        rows={items}
        edit={{ path: (r) => `/purchase-groups/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

interface SupplierRowState {
  supplierId: string;
}
interface GoodsItemRowState {
  goodsItemId: string;
}

const DEFAULT_FORM = { code: "", title: "", isActive: true };

function PurchaseGroupForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [goodsItems, setGoodsItems] = useState<GoodsItemRow[]>([]);
  const [hasTransactions, setHasTransactions] = useState(false);
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [supplierRows, setSupplierRows] = usePersistedState<SupplierRowState[]>(`${cacheKey}:suppliers`, []);
  const [goodsRows, setGoodsRows] = usePersistedState<GoodsItemRowState[]>(`${cacheKey}:goods`, []);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/suppliers").then((s: SupplierOption[]) => setSuppliers(s)).catch(() => {});
    // طبق مستند «گروه خرید»: کالاهای مجاز، همان کالاهای مجاز در ماهیت «خرید» (نوع کالا-ماهیت سند انبار) + kind=GOODS
    api.get("/goods-items?kind=GOODS&docDirection=INBOUND&docType=" + encodeURIComponent("خرید")).then((g: GoodsItemRow[]) => setGoodsItems(g)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) {
        setForm(DEFAULT_FORM);
        setSupplierRows([]);
        setGoodsRows([]);
        setHasTransactions(false);
      }
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get("/purchase-groups").then((items: PurchaseGroup[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setHasTransactions(found.hasTransactions);
        setForm({ code: String(found.code), title: found.title, isActive: found.isActive });
        setSupplierRows(found.suppliers.map((s) => ({ supplierId: String(s.supplierId) })));
        setGoodsRows(found.goodsItems.map((g) => ({ goodsItemId: String(g.goodsItemId) })));
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const activeSuppliers = suppliers.filter((s) => s.isActive);
  const activeGoodsItems = goodsItems.filter((g) => g.isActive);

  function addSupplierRow() {
    setSupplierRows((prev) => [...prev, { supplierId: "" }]);
  }
  function removeSupplierRow(idx: number) {
    setSupplierRows((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateSupplierRow(idx: number, supplierId: string) {
    setSupplierRows((prev) => prev.map((r, i) => (i === idx ? { supplierId } : r)));
  }

  function addGoodsRow() {
    setGoodsRows((prev) => [...prev, { goodsItemId: "" }]);
  }
  function removeGoodsRow(idx: number) {
    setGoodsRows((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateGoodsRow(idx: number, goodsItemId: string) {
    setGoodsRows((prev) => prev.map((r, i) => (i === idx ? { goodsItemId } : r)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title) return setError("عنوان الزامی است");
    const supplierIds = supplierRows.filter((r) => r.supplierId).map((r) => Number(r.supplierId));
    const goodsItemIds = goodsRows.filter((r) => r.goodsItemId).map((r) => Number(r.goodsItemId));
    const body = { code: form.code ? Number(form.code) : undefined, title: form.title, isActive: form.isActive, supplierIds, goodsItemIds };
    try {
      if (editId) {
        await api.put(`/purchase-groups/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/purchase-groups", body);
        flash();
        navigate(`/purchase-groups/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/purchase-groups/${editId}`);
      navigate("/purchase-groups");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش گروه خرید" : "گروه خرید جدید"}
      formId="purchase-group-form"
      closePath="/purchase-groups"
      newPath="/purchase-groups/new"
      onDelete={editId ? handleDelete : undefined}
      description={hasTransactions ? "این گروه خرید گردش دارد." : undefined}
      wide
    >
      <form id="purchase-group-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>کد <FieldHint label="کد" text="اختیاری — در صورت خالی بودن، سیستم تعیین می‌کند" /></label>
            <input dir="ltr" disabled={!!editId} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              فعال
            </label>
          </div>
        </div>

        <div className="je-lines-toolbar" style={{ marginTop: 16 }}>
          <span className="je-lines-title">تامین‌کنندگان گروه</span>
          <button type="button" className="toolbar-icon-btn primary" onClick={addSupplierRow} title="ردیف جدید">
            <PlusIcon />
          </button>
        </div>
        <div className="grid-wrap je-lines-wrap">
          <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>تامین کننده</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {supplierRows.map((row, idx) => {
                  const supplier = suppliers.find((s) => String(s.id) === row.supplierId);
                  const pickerRows = activeSuppliers.filter(
                    (s) => s.id === supplier?.id || !supplierRows.some((r, i) => i !== idx && r.supplierId === String(s.id))
                  );
                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                      <td style={{ minWidth: 220 }}>
                        <RecordPickerField
                          title="انتخاب تامین کننده"
                          displayValue={supplier ? `${toFaDigits(String(supplier.code))} — ${partyDisplayName(supplier.party)}` : ""}
                          rows={pickerRows}
                          columns={[
                            { header: "کد", render: (s) => toFaDigits(String(s.code)), filterValue: (s) => String(s.code), width: "80px" },
                            { header: "طرف حساب", render: (s) => partyDisplayName(s.party), filterValue: (s) => partyDisplayName(s.party) },
                          ]}
                          onSelect={(s) => updateSupplierRow(idx, String(s.id))}
                        />
                      </td>
                      <td>
                        <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => removeSupplierRow(idx)}>
                          حذف
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="grid-footer je-lines-footer">
            <span className="grid-footer-info">{supplierRows.length === 0 ? "بدون ردیف" : `${toFaDigits(String(supplierRows.length))} ردیف`}</span>
          </div>
        </div>

        <div className="je-lines-toolbar" style={{ marginTop: 16 }}>
          <span className="je-lines-title">کالاهای مجاز گروه</span>
          <button type="button" className="toolbar-icon-btn primary" onClick={addGoodsRow} title="ردیف جدید">
            <PlusIcon />
          </button>
        </div>
        <div className="grid-wrap je-lines-wrap">
          <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>کالا</th>
                  <th>واحد</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {goodsRows.map((row, idx) => {
                  const item = goodsItems.find((g) => String(g.id) === row.goodsItemId);
                  const pickerRows = activeGoodsItems.filter(
                    (g) => g.id === item?.id || !goodsRows.some((r, i) => i !== idx && r.goodsItemId === String(g.id))
                  );
                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                      <td style={{ minWidth: 200 }}>
                        <RecordPickerField
                          title="انتخاب کالا"
                          displayValue={item ? `${toFaDigits(item.fullCode)} — ${item.title}` : ""}
                          rows={pickerRows}
                          columns={[
                            { header: "کد", render: (g) => toFaDigits(g.fullCode), filterValue: (g) => g.fullCode, width: "110px" },
                            { header: "عنوان", render: (g) => g.title, filterValue: (g) => g.title },
                          ]}
                          onSelect={(g) => updateGoodsRow(idx, String(g.id))}
                        />
                      </td>
                      <td style={{ minWidth: 90, color: "var(--ink-soft)" }}>{item?.mainUnit?.title || "—"}</td>
                      <td>
                        <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => removeGoodsRow(idx)}>
                          حذف
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="grid-footer je-lines-footer">
            <span className="grid-footer-info">{goodsRows.length === 0 ? "بدون ردیف" : `${toFaDigits(String(goodsRows.length))} ردیف`}</span>
          </div>
        </div>
      </form>
    </FormPage>
  );
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
