import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { AmountInput } from "../components/AmountInput";
import { RecordPickerField } from "../components/RecordPicker";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";
import { partyDisplayName } from "./Users";

// این فرآیند («فاکتور خرید») مستند تحلیل اختصاصی در پروژه ندارد؛ ساختار این فرم حاصل تصمیم مشترک با
// کاربر است (نگاه کنید به یادداشت‌های backend/src/routes/purchaseInvoices.ts). با تایید فاکتور، مبلغ
// نهایی هر ردیف (فی×مقدار + سهم سرشکن‌شده‌ی هزینه‌های جانبی دارای مبنای سرشکن) روی ردیف رسید انبار
// خرید مبنا نوشته می‌شود.

type Basis = "NO_BASIS" | "WAREHOUSE_RECEIPT";
type Status = "DRAFT" | "APPROVED";
type AllocationBasis = "VALUE" | "QUANTITY" | "WEIGHT";

interface PartyOption {
  id: number;
  detailCode: string;
  category: "INDIVIDUAL" | "LEGAL";
  isActive: boolean;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
}
interface CurrencyOption { id: number; code: string; title: string }
interface GoodsItemRow { id: number; fullCode: string; title: string; mainUnitId: number; mainUnit?: { title: string }; isActive: boolean }
interface ServiceOption { id: number; fullCode: string; title: string; kind: string }
interface PickableReceiptLine {
  id: number;
  sourceInventoryLineId: number;
  warehouseReceiptId: number;
  number: number;
  date: string;
  goodsItemId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitId: number;
  unitTitle: string;
  quantity: number;
}

const STATUS_FA: Record<Status, string> = { DRAFT: "ثبت", APPROVED: "تایید شده" };
const BASIS_FA: Record<Basis, string> = { NO_BASIS: "بدون مبنا", WAREHOUSE_RECEIPT: "رسید انبار خرید" };
const ALLOCATION_BASIS_FA: Record<AllocationBasis, string> = { VALUE: "ارزش", QUANTITY: "مقدار", WEIGHT: "وزن" };
const INFO_TEXT = "ثبت فاکتور خرید دریافتی از تامین‌کننده — بر مبنای رسید(های) انبار خرید قطعی‌شده (هر ردیف رسید فقط یک‌بار و به‌طور کامل فاکتور می‌شود) یا بدون مبنا. هزینه‌های جانبی فاکتور (حمل، بسته‌بندی و ...) در تب «سایر هزینه‌ها» ثبت می‌شوند. با تایید فاکتور، مبلغ نهایی (فی×مقدار به‌اضافه‌ی سهم هزینه‌های جانبیِ دارای مبنای سرشکن) روی ردیف‌های رسید انبار خرید مبنا نوشته می‌شود.";

interface ListRow {
  id: number; number: number; date: string; vendorInvoiceNumber: string | null; basis: Basis;
  partyId: number; partyTitle: string | null; currencyTitle: string; status: Status; lineCount: number; totalAmount: number;
}
interface DetailLine {
  id: number; sourceInventoryLineId: number | null; sourceWarehouseReceiptNumber: number | null;
  goodsItemId: number; goodsItemCode: string; goodsItemTitle: string; unitId: number; unitTitle: string;
  quantity: number; unitPrice: number; amount: number; description: string | null;
}
interface OtherCostDetail { id: number; serviceId: number; serviceTitle: string; amount: number; allocationBasis: AllocationBasis | null; description: string | null }
interface Detail extends ListRow {
  currencyId: number;
  description: string | null;
  approverName: string | null;
  approvedAt: string | null;
  lines: DetailLine[];
  otherCostLines: OtherCostDetail[];
}

export default function PurchaseInvoices() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <PurchaseInvoiceForm />;
  if (isEdit) return <PurchaseInvoiceForm editId={Number(id)} />;
  return <PurchaseInvoiceList />;
}

function PlusIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M7 8H4V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 8A8 8 0 1 1 4 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PurchaseInvoiceList() {
  const cacheKey = "/purchase-invoices";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    try {
      setItems(await api.get("/purchase-invoices"));
      setError(null);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: ListRow) {
    try {
      await api.del(`/purchase-invoices/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="فاکتور خرید" />
          <NewRecordButton path="/purchase-invoices/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "شماره فاکتور فروشنده", render: (r) => r.vendorInvoiceNumber ? toFaDigits(r.vendorInvoiceNumber) : "—", filterType: "string", filterValue: (r) => r.vendorInvoiceNumber || "" },
          { header: "مبنا", render: (r) => BASIS_FA[r.basis], filterType: "string", filterValue: (r) => BASIS_FA[r.basis] },
          { header: "طرف مقابل", render: (r) => r.partyTitle || "—", filterType: "string", filterValue: (r) => r.partyTitle || "" },
          { header: "مبلغ کل", render: (r) => formatAmountFa(r.totalAmount) },
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
        ]}
        rows={items}
        onEdit={(r) => navigate(`/purchase-invoices/${r.id}/edit`)}
        onDelete={onDelete}
      />
    </div>
  );
}

interface RowState {
  sourceInventoryLineId: string; goodsItemId: string; goodsItemCode: string; goodsItemTitle: string;
  unitId: string; unitTitle: string; quantity: string; unitPrice: string; amount: string; description: string;
}
interface CostRowState { serviceId: string; amount: string; allocationBasis: AllocationBasis | ""; description: string }

function emptyRow(): RowState {
  return { sourceInventoryLineId: "", goodsItemId: "", goodsItemCode: "", goodsItemTitle: "", unitId: "", unitTitle: "", quantity: "", unitPrice: "", amount: "", description: "" };
}

function PurchaseInvoiceForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [goodsItems, setGoodsItems] = useState<GoodsItemRow[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [pickableLines, setPickableLines] = useState<PickableReceiptLine[]>([]);
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", vendorInvoiceNumber: "", basis: "NO_BASIS" as Basis, partyId: "", currencyId: "", description: "" });
  const [rows, setRows] = usePersistedState<RowState[]>(`${cacheKey}:rows`, []);
  const [costRows, setCostRows] = usePersistedState<CostRowState[]>(`${cacheKey}:costs`, []);
  const [meta, setMeta] = usePersistedState<{ number: number; status: Status; approverName: string | null; approvedAt: string | null } | null>(
    `${cacheKey}:meta`,
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    async function init() {
      const [p, c, g, sv] = await Promise.all([
        api.get("/parties"),
        api.get("/currencies"),
        api.get("/goods-items?kind=GOODS&docDirection=INBOUND&docType=خرید"),
        api.get("/goods-items?kind=SERVICE"),
      ]);
      setParties(p);
      setCurrencies(c);
      setGoodsItems(g);
      setServices(sv);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        return;
      }
      if (editId) {
        const d: Detail = await api.get(`/purchase-invoices/${editId}`);
        setMeta({ number: d.number, status: d.status, approverName: d.approverName, approvedAt: d.approvedAt });
        setHeader({
          date: d.date.slice(0, 10),
          vendorInvoiceNumber: d.vendorInvoiceNumber || "",
          basis: d.basis,
          partyId: String(d.partyId),
          currencyId: String(d.currencyId),
          description: d.description || "",
        });
        setRows(
          d.lines.map((l) => ({
            sourceInventoryLineId: l.sourceInventoryLineId ? String(l.sourceInventoryLineId) : "",
            goodsItemId: String(l.goodsItemId),
            goodsItemCode: l.goodsItemCode,
            goodsItemTitle: l.goodsItemTitle,
            unitId: String(l.unitId),
            unitTitle: l.unitTitle,
            quantity: String(l.quantity),
            unitPrice: String(l.unitPrice),
            amount: String(l.amount),
            description: l.description || "",
          }))
        );
        setCostRows(
          d.otherCostLines.map((l) => ({
            serviceId: String(l.serviceId),
            amount: String(l.amount),
            allocationBasis: l.allocationBasis || "",
            description: l.description || "",
          }))
        );
      } else {
        setHeader({ date: "", vendorInvoiceNumber: "", basis: "NO_BASIS", partyId: "", currencyId: "", description: "" });
        setRows([emptyRow()]);
        setCostRows([]);
        setMeta(null);
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  useEffect(() => {
    if (header.basis !== "WAREHOUSE_RECEIPT" || !header.partyId) {
      setPickableLines([]);
      return;
    }
    const q = editId ? `&excludeInvoiceId=${editId}` : "";
    api.get(`/purchase-invoices/pickable-warehouse-receipt-lines?partyId=${header.partyId}${q}`).then(setPickableLines).catch(() => setPickableLines([]));
  }, [header.basis, header.partyId, editId]);

  const status: Status = meta?.status || "DRAFT";
  const locked = status === "APPROVED";
  const hasAnyLine = rows.some((r) => r.goodsItemId || r.sourceInventoryLineId);
  const headerDisabled = hasAnyLine;
  const selectedParty = parties.find((p) => String(p.id) === header.partyId);

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function onSourceLineChange(idx: number, sourceInventoryLineId: string) {
    const src = pickableLines.find((l) => String(l.sourceInventoryLineId) === sourceInventoryLineId);
    if (!src) return;
    updateRow(idx, {
      sourceInventoryLineId,
      goodsItemId: String(src.goodsItemId),
      goodsItemCode: src.goodsItemCode,
      goodsItemTitle: src.goodsItemTitle,
      unitId: String(src.unitId),
      unitTitle: src.unitTitle,
      quantity: String(src.quantity), // مقدار کاملاً از رسید مشتق می‌شود و قابل‌ویرایش نیست
    });
  }
  function onUnitPriceChange(idx: number, unitPrice: string) {
    const row = rows[idx];
    const amount = Math.round(Number(unitPrice) * (Number(row.quantity) || 0) * 100) / 100;
    updateRow(idx, { unitPrice, amount: String(amount) });
  }
  function onAmountChange(idx: number, amount: string) {
    const row = rows[idx];
    const qty = Number(row.quantity) || 0;
    const unitPrice = qty > 0 ? Math.round((Number(amount) / qty) * 10000) / 10000 : 0;
    updateRow(idx, { amount, unitPrice: String(unitPrice) });
  }
  function onGoodsItemChange(idx: number, goodsItemId: string) {
    const item = goodsItems.find((g) => g.id === Number(goodsItemId));
    updateRow(idx, { goodsItemId, unitId: item ? String(item.mainUnitId) : "" });
  }
  function onQuantityChange(idx: number, quantity: string) {
    const row = rows[idx];
    const amount = Math.round((Number(row.unitPrice) || 0) * (Number(quantity) || 0) * 100) / 100;
    updateRow(idx, { quantity, amount: String(amount) });
  }
  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }
  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateCostRow(idx: number, patch: Partial<CostRowState>) {
    setCostRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addCostRow() {
    setCostRows((prev) => [...prev, { serviceId: "", amount: "", allocationBasis: "", description: "" }]);
  }
  function removeCostRow(idx: number) {
    setCostRows((prev) => prev.filter((_, i) => i !== idx));
  }

  const totalAmount = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalOtherCosts = costRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  function buildBody() {
    const nonEmptyRows = rows.filter((r) => r.goodsItemId || r.sourceInventoryLineId);
    return {
      date: header.date,
      vendorInvoiceNumber: header.vendorInvoiceNumber || null,
      basis: header.basis,
      partyId: Number(header.partyId),
      currencyId: Number(header.currencyId),
      description: header.description,
      lines: nonEmptyRows.map((r) => ({
        sourceInventoryLineId: r.sourceInventoryLineId ? Number(r.sourceInventoryLineId) : null,
        goodsItemId: r.goodsItemId ? Number(r.goodsItemId) : undefined,
        unitId: r.unitId ? Number(r.unitId) : undefined,
        quantity: Number(r.quantity) || 0,
        unitPrice: Number(r.unitPrice) || 0,
        amount: Number(r.amount) || 0,
        description: r.description || null,
      })),
      otherCostLines: costRows
        .filter((r) => r.serviceId)
        .map((r) => ({ serviceId: Number(r.serviceId), amount: Number(r.amount) || 0, allocationBasis: r.allocationBasis || null, description: r.description || null })),
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!header.date || !header.partyId || !header.currencyId) return setError("تاریخ، طرف مقابل و ارز الزامی است");
    const body = buildBody();
    if (body.lines.length === 0) return setError("فاکتور خرید باید حداقل یک ردیف کالا داشته باشد");
    for (const [i, l] of body.lines.entries()) {
      if (header.basis === "WAREHOUSE_RECEIPT" && !l.sourceInventoryLineId) return setError(`ردیف ${i + 1}: انتخاب ردیف رسید انبار خرید الزامی است`);
      if (header.basis === "NO_BASIS" && !l.goodsItemId) return setError(`کالا برای ردیف ${i + 1} الزامی است`);
      if (!(l.quantity > 0)) return setError(`مقدار ردیف ${i + 1} باید عددی مثبت باشد`);
      if (!(l.unitPrice >= 0)) return setError(`فی ردیف ${i + 1} نامعتبر است`);
    }
    try {
      if (editId) {
        await api.put(`/purchase-invoices/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/purchase-invoices", body);
        flash();
        navigate(`/purchase-invoices/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/purchase-invoices/${editId}`);
      navigate("/purchase-invoices");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  async function reloadMetaAndRows() {
    if (!editId) return;
    const d: Detail = await api.get(`/purchase-invoices/${editId}`);
    setMeta({ number: d.number, status: d.status, approverName: d.approverName, approvedAt: d.approvedAt });
    setRows(
      d.lines.map((l) => ({
        sourceInventoryLineId: l.sourceInventoryLineId ? String(l.sourceInventoryLineId) : "",
        goodsItemId: String(l.goodsItemId),
        goodsItemCode: l.goodsItemCode,
        goodsItemTitle: l.goodsItemTitle,
        unitId: String(l.unitId),
        unitTitle: l.unitTitle,
        quantity: String(l.quantity),
        unitPrice: String(l.unitPrice),
        amount: String(l.amount),
        description: l.description || "",
      }))
    );
  }

  async function runAction(action: string, confirmMsg?: string) {
    if (!editId) return;
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    try {
      await api.post(`/purchase-invoices/${editId}/${action}`, {});
      await reloadMetaAndRows();
      flash();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  const extraActions: { label: string; icon: JSX.Element; onClick: () => void }[] = [];
  if (editId && meta) {
    if (status === "DRAFT") {
      extraActions.push({ label: "تایید", icon: <CheckIcon />, onClick: () => runAction("approve") });
    } else if (status === "APPROVED") {
      extraActions.push({
        label: "برگشت از تایید",
        icon: <UndoIcon />,
        onClick: () => runAction("unapprove", "با برگشت از تایید، مبلغ ردیف‌های رسید انبار خرید مرتبط صفر می‌شود. ادامه می‌دهید؟"),
      });
    }
  }

  return (
    <FormPage
      title={editId ? "ویرایش فاکتور خرید" : "فاکتور خرید جدید"}
      formId="purchase-invoice-form"
      closePath="/purchase-invoices"
      newPath="/purchase-invoices/new"
      onDelete={editId && status === "DRAFT" ? handleDelete : undefined}
      saveDisabled={locked}
      extraActions={extraActions}
      wide
    >
      <form id="purchase-invoice-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}
        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="je-header-grid" style={{ marginBottom: 16, maxWidth: 900 }}>
            <div className="form-field">
              <label>شماره</label>
              <input dir="ltr" value={meta ? toFaDigits(String(meta.number)) : "خودکار پس از ذخیره"} disabled />
            </div>
            <div className="form-field">
              <label>وضعیت</label>
              <div><span className="badge">{STATUS_FA[status]}</span></div>
            </div>
            {meta?.approverName && (
              <div className="form-field">
                <label>تایید کننده</label>
                <input value={`${meta.approverName}${meta.approvedAt ? " — " + formatJalaliDate(meta.approvedAt) : ""}`} disabled />
              </div>
            )}
            <div className="form-field">
              <label>تاریخ</label>
              <JalaliDatePicker value={header.date} onChange={(v) => setHeader({ ...header, date: v })} />
            </div>
            <div className="form-field">
              <label>شماره فاکتور فروشنده</label>
              <input value={header.vendorInvoiceNumber} onChange={(e) => setHeader({ ...header, vendorInvoiceNumber: e.target.value })} />
            </div>
            <div className="form-field">
              <label>مبنا</label>
              <select value={header.basis} onChange={(e) => setHeader({ ...header, basis: e.target.value as Basis })} disabled={headerDisabled}>
                <option value="NO_BASIS">{BASIS_FA.NO_BASIS}</option>
                <option value="WAREHOUSE_RECEIPT">{BASIS_FA.WAREHOUSE_RECEIPT}</option>
              </select>
            </div>
            <div className="form-field">
              <label>طرف مقابل</label>
              <RecordPickerField
                title="انتخاب طرف مقابل"
                disabled={headerDisabled}
                displayValue={selectedParty ? `${toFaDigits(selectedParty.detailCode)} — ${partyDisplayName(selectedParty)}` : ""}
                rows={parties.filter((p) => p.isActive || String(p.id) === header.partyId)}
                columns={[
                  { header: "کد", render: (p) => toFaDigits(p.detailCode), filterValue: (p) => p.detailCode, width: "90px" },
                  { header: "نوع", render: (p) => (p.category === "LEGAL" ? "حقوقی" : "حقیقی"), filterValue: (p) => (p.category === "LEGAL" ? "حقوقی" : "حقیقی"), width: "80px" },
                  { header: "نام", render: (p) => partyDisplayName(p), filterValue: (p) => partyDisplayName(p) },
                ]}
                onSelect={(p) => setHeader({ ...header, partyId: String((p as PartyOption).id) })}
              />
            </div>
            <div className="form-field">
              <label>ارز</label>
              <select value={header.currencyId} onChange={(e) => setHeader({ ...header, currencyId: e.target.value })} disabled={headerDisabled}>
                <option value="">انتخاب کنید</option>
                {currencies.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div className="form-field full">
              <label>شرح</label>
              <input value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} />
            </div>
          </div>

          <div className="je-lines-toolbar">
            <span className="je-lines-title">اقلام</span>
            <button type="button" className="toolbar-icon-btn primary" onClick={addRow} title="ردیف جدید">
              <PlusIcon />
            </button>
          </div>
        </fieldset>

        <div className="grid-wrap je-lines-wrap">
          <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th>ردیف</th>
                  {header.basis === "WAREHOUSE_RECEIPT" && <th>رسید انبار خرید</th>}
                  <th>کالا</th>
                  <th>واحد</th>
                  <th>مقدار</th>
                  <th>فی</th>
                  <th>مبلغ</th>
                  <th>شرح</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const item = goodsItems.find((g) => g.id === Number(row.goodsItemId));
                  const pickerRows = item && !item.isActive ? goodsItems : goodsItems.filter((g) => g.isActive);
                  const src = pickableLines.find((l) => String(l.sourceInventoryLineId) === row.sourceInventoryLineId);
                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                      {header.basis === "WAREHOUSE_RECEIPT" && (
                        <td style={{ minWidth: 200 }}>
                          <RecordPickerField
                            title="انتخاب ردیف رسید انبار خرید"
                            displayValue={src ? `${toFaDigits(String(src.number))} — ${src.goodsItemTitle}` : ""}
                            rows={pickableLines}
                            columns={[
                              { header: "شماره", render: (l) => toFaDigits(String(l.number)), filterValue: (l) => String(l.number), width: "70px" },
                              { header: "کالا", render: (l) => l.goodsItemTitle, filterValue: (l) => l.goodsItemTitle },
                              { header: "مقدار", render: (l) => formatAmountFa(l.quantity), filterValue: (l) => String(l.quantity), width: "90px" },
                            ]}
                            onSelect={(l) => onSourceLineChange(idx, String((l as PickableReceiptLine).sourceInventoryLineId))}
                          />
                        </td>
                      )}
                      <td style={{ minWidth: 200 }}>
                        {header.basis === "WAREHOUSE_RECEIPT" ? (
                          <span>{row.goodsItemTitle ? `${toFaDigits(row.goodsItemCode)} — ${row.goodsItemTitle}` : "—"}</span>
                        ) : (
                          <RecordPickerField
                            title="انتخاب کالا"
                            displayValue={item ? `${toFaDigits(item.fullCode)} — ${item.title}` : ""}
                            rows={pickerRows}
                            columns={[
                              { header: "کد", render: (g) => toFaDigits(g.fullCode), filterValue: (g) => g.fullCode, width: "110px" },
                              { header: "عنوان", render: (g) => g.title, filterValue: (g) => g.title },
                            ]}
                            onSelect={(g) => onGoodsItemChange(idx, String((g as GoodsItemRow).id))}
                          />
                        )}
                      </td>
                      <td style={{ minWidth: 90, color: "var(--ink-soft)" }}>{item?.mainUnit?.title || row.unitTitle || "—"}</td>
                      <td style={{ minWidth: 120 }}>
                        <AmountInput
                          value={row.quantity}
                          onChange={(v) => onQuantityChange(idx, v)}
                          allowDecimal
                          disabled={header.basis === "WAREHOUSE_RECEIPT"}
                        />
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <AmountInput value={row.unitPrice} onChange={(v) => onUnitPriceChange(idx, v)} allowDecimal />
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <AmountInput value={row.amount} onChange={(v) => onAmountChange(idx, v)} allowDecimal />
                      </td>
                      <td style={{ minWidth: 140 }}>
                        <input value={row.description} onChange={(e) => updateRow(idx, { description: e.target.value })} />
                      </td>
                      <td>
                        <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => removeRow(idx)}>
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
            <span className="grid-footer-info">{rows.length === 0 ? "بدون ردیف" : `${toFaDigits(String(rows.length))} ردیف`}</span>
            <span className="je-lines-totals">جمع مبلغ اقلام: {formatAmountFa(totalAmount)}</span>
          </div>
        </div>

        <div className="je-lines-toolbar" style={{ marginTop: 16 }}>
          <span className="je-lines-title">سایر هزینه‌ها</span>
          <button type="button" className="toolbar-icon-btn primary" onClick={addCostRow} title="ردیف جدید">
            <PlusIcon />
          </button>
        </div>
        <div className="grid-wrap je-lines-wrap">
          <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>کد هزینه</th>
                  <th>مبلغ</th>
                  <th>مبنای سرشکن</th>
                  <th>شرح</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {costRows.map((row, idx) => {
                  const svc = services.find((s) => String(s.id) === row.serviceId);
                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                      <td style={{ minWidth: 200 }}>
                        <RecordPickerField
                          title="انتخاب کد هزینه (خدمت)"
                          displayValue={svc ? `${toFaDigits(svc.fullCode)} — ${svc.title}` : ""}
                          rows={services}
                          columns={[
                            { header: "کد", render: (s) => toFaDigits(s.fullCode), filterValue: (s) => s.fullCode, width: "110px" },
                            { header: "عنوان", render: (s) => s.title, filterValue: (s) => s.title },
                          ]}
                          onSelect={(s) => updateCostRow(idx, { serviceId: String((s as ServiceOption).id) })}
                        />
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <AmountInput value={row.amount} onChange={(v) => updateCostRow(idx, { amount: v })} allowDecimal />
                      </td>
                      <td style={{ minWidth: 130 }}>
                        <select
                          value={row.allocationBasis}
                          onChange={(e) => updateCostRow(idx, { allocationBasis: e.target.value as AllocationBasis | "" })}
                        >
                          <option value="">سرشکن نشود</option>
                          {(Object.keys(ALLOCATION_BASIS_FA) as AllocationBasis[]).map((b) => (
                            <option key={b} value={b}>{ALLOCATION_BASIS_FA[b]}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ minWidth: 140 }}>
                        <input value={row.description} onChange={(e) => updateCostRow(idx, { description: e.target.value })} />
                      </td>
                      <td>
                        <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => removeCostRow(idx)}>
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
            <span className="grid-footer-info">{costRows.length === 0 ? "بدون ردیف" : `${toFaDigits(String(costRows.length))} ردیف`}</span>
            <span className="je-lines-totals">جمع هزینه‌های جانبی: {formatAmountFa(totalOtherCosts)}</span>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
