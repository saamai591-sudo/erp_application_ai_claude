import { FormEvent, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { AmountInput } from "../components/AmountInput";
import { RecordPickerField } from "../components/RecordPicker";
import { TrackingCells } from "../components/TrackingCells";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";
import { partyDisplayName } from "./Users";

// این فرآیند («رسید انبار خرید») مستند تحلیل اختصاصی در پروژه ندارد؛ ساختار این فرم حاصل تصمیم
// مشترک با کاربر است (نگاه کنید به یادداشت‌های backend/src/routes/warehouseReceipts.ts).

type Basis = "NO_BASIS" | "SUPPLY_REQUEST" | "PURCHASE_ORDER" | "DELIVERY_AUTHORIZATION";
type DocStatus = "DRAFT" | "FINALIZED" | "VOID";
type ViewMode = "warehousing" | "accounting";

interface Warehouse { id: number; code: number; title: string; isActive: boolean }
interface PartyOption {
  id: number;
  detailCode: string;
  category: "INDIVIDUAL" | "LEGAL";
  isActive: boolean;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
}
interface GoodsItemRow {
  id: number;
  fullCode: string;
  title: string;
  mainUnitId: number;
  mainUnit?: { title: string };
  isActive: boolean;
  kind: string;
  isSerialTracked: boolean;
  isBatchTracked: boolean;
  isExpiryTracked: boolean;
  isLocationTracked: boolean;
}

interface PickableLine {
  id: number;
  sourceSupplyRequestLineId?: number;
  sourcePurchaseOrderLineId?: number;
  sourceDeliveryAuthorizationLineId?: number;
  number: number;
  date: string;
  goodsItemId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitId: number;
  unitTitle: string;
  quantity: number;
  done: number;
  remaining: number;
}

interface ListRow {
  id: number;
  number: number;
  date: string;
  warehouseId: number;
  warehouseTitle: string;
  fiscalPeriodTitle: string;
  basis: Basis;
  partyId: number | null;
  partyTitle: string | null;
  description: string | null;
  status: DocStatus;
  lineCount: number;
  totalQuantity: number;
  totalAmount: number;
}

interface DetailLine {
  id: number;
  sourceSupplyRequestLineId: number | null;
  sourcePurchaseOrderLineId: number | null;
  sourceDeliveryAuthorizationLineId: number | null;
  goodsItemId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitId: number;
  unitTitle: string;
  quantity: number;
  unitCost: number;
  amount: number;
  description: string | null;
  serialNumber: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  physicalLocation: string | null;
}

interface Detail {
  id: number;
  number: number;
  date: string;
  warehouseId: number;
  warehouseTitle: string;
  fiscalPeriodTitle: string;
  basis: Basis;
  partyId: number | null;
  partyTitle: string | null;
  description: string | null;
  status: DocStatus;
  finalizedAt: string | null;
  lines: DetailLine[];
}

const STATUS_FA: Record<DocStatus, string> = { DRAFT: "ثبت", FINALIZED: "قطعی", VOID: "ابطال‌شده" };
const BASIS_FA: Record<Basis, string> = {
  NO_BASIS: "بدون مبنا",
  SUPPLY_REQUEST: "درخواست تامین",
  PURCHASE_ORDER: "سفارش خرید",
  DELIVERY_AUTHORIZATION: "مجوز تحویل",
};
const PICKABLE_ENDPOINT: Record<Exclude<Basis, "NO_BASIS">, string> = {
  SUPPLY_REQUEST: "/warehouse-receipts/pickable-supply-request-lines",
  PURCHASE_ORDER: "/warehouse-receipts/pickable-purchase-order-lines",
  DELIVERY_AUTHORIZATION: "/warehouse-receipts/pickable-delivery-authorization-lines",
};
const SOURCE_FIELD: Record<Exclude<Basis, "NO_BASIS">, keyof PickableLine> = {
  SUPPLY_REQUEST: "sourceSupplyRequestLineId",
  PURCHASE_ORDER: "sourcePurchaseOrderLineId",
  DELIVERY_AUTHORIZATION: "sourceDeliveryAuthorizationLineId",
};
const SOURCE_LABEL: Record<Exclude<Basis, "NO_BASIS">, string> = {
  SUPPLY_REQUEST: "درخواست تامین مبدا",
  PURCHASE_ORDER: "سفارش خرید مبدا",
  DELIVERY_AUTHORIZATION: "مجوز تحویل مبدا",
};

function infoText(mode: ViewMode) {
  const base =
    "ثبت رسید انبار برای کالاهای دریافتی از تامین‌کننده. مبنا می‌تواند بدون مبنا، درخواست تامین، سفارش خرید یا مجوز تحویل باشد؛ " +
    "در حالت‌های دارای مبنا، هر ردیف از یک ردیف تایید‌شده و دارای مانده انتخاب می‌شود.";
  if (mode === "warehousing") {
    return base + " این نمای «انبارداری» فقط مقدار را ثبت می‌کند. فی و مبلغ در این سند اصلاً وارد نمی‌شود؛ این مقادیر بعداً با تایید فاکتور خرید (ماژول آینده) تعیین خواهند شد.";
  }
  return base + " این نمای «حسابداری انبار» فقط نمایشی است. فی/مبلغ تا زمانی که ماژول «فاکتور خرید» ساخته شود همیشه صفر خواهد بود.";
}

export default function WarehouseReceipts({ mode }: { mode: ViewMode }) {
  const location = useLocation();
  const { id } = useParams();
  const basePath = mode === "warehousing" ? "/warehousing/warehouse-receipts" : "/warehouse-accounting/warehouse-receipts";
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  // در «حسابداری انبار» هرگز امکان ثبت سند جدید نیست (فقط از فهرست باز می‌شود)؛ حتی اگر کاربر مستقیماً
  // آدرس «/new» را وارد کند، به فهرست هدایت می‌شود.
  if (isNew && mode === "accounting") return <Navigate to={basePath} replace />;
  if (isNew) return <WarehouseReceiptForm mode={mode} basePath={basePath} />;
  if (isEdit) return <WarehouseReceiptForm mode={mode} basePath={basePath} editId={Number(id)} />;
  return <WarehouseReceiptList mode={mode} basePath={basePath} />;
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
function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function WarehouseReceiptList({ mode, basePath }: { mode: ViewMode; basePath: string }) {
  const cacheKey = basePath;
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const [bulkSlot, setBulkSlot] = useState<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  async function reload() {
    try {
      setItems(await api.get("/warehouse-receipts"));
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
    if (row.status !== "DRAFT") {
      alert("فقط اسناد در وضعیت «ثبت» قابل حذف هستند؛ ابتدا از «قطعی» برگردانید");
      return;
    }
    try {
      await api.del(`/warehouse-receipts/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={infoText(mode)} title="رسید انبار خرید" />
          {mode === "warehousing" && <NewRecordButton path={`${basePath}/new`} />}
          <RefreshButton onClick={reload} />
          <div ref={setBulkSlot} className="bulk-slot" style={{ display: "flex" }} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        bulkActionsContainer={bulkSlot}
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "انبار", render: (r) => r.warehouseTitle, filterType: "string", filterValue: (r) => r.warehouseTitle },
          { header: "مبنا", render: (r) => BASIS_FA[r.basis], filterType: "string", filterValue: (r) => BASIS_FA[r.basis] },
          { header: "طرف مقابل", render: (r) => r.partyTitle || "—", filterType: "string", filterValue: (r) => r.partyTitle || "" },
          { header: "شرح", render: (r) => r.description || "—", filterType: "string", filterValue: (r) => r.description || "" },
          { header: "تعداد ردیف", render: (r) => toFaDigits(String(r.lineCount)) },
          ...(mode === "accounting" ? [{ header: "جمع مبلغ", render: (r: ListRow) => formatAmountFa(r.totalAmount) }] : []),
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
        ]}
        rows={items}
        onEdit={(r) => navigate(`${basePath}/${r.id}/edit`)}
        onDelete={mode === "warehousing" ? onDelete : undefined}
      />
    </div>
  );
}

interface RowState {
  sourceSupplyRequestLineId: string;
  sourcePurchaseOrderLineId: string;
  sourceDeliveryAuthorizationLineId: string;
  sourceNumber: string;
  goodsItemId: string;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitId: string;
  unitTitle: string;
  quantity: string;
  unitCost: number;
  amount: number;
  description: string;
  serialNumber: string;
  batchNumber: string;
  expiryDate: string;
  physicalLocation: string;
}

function emptyRow(): RowState {
  return {
    sourceSupplyRequestLineId: "",
    sourcePurchaseOrderLineId: "",
    sourceDeliveryAuthorizationLineId: "",
    sourceNumber: "",
    goodsItemId: "",
    goodsItemCode: "",
    goodsItemTitle: "",
    unitId: "",
    unitTitle: "",
    quantity: "",
    unitCost: 0,
    amount: 0,
    description: "",
    serialNumber: "",
    batchNumber: "",
    expiryDate: "",
    physicalLocation: "",
  };
}

function WarehouseReceiptForm({ editId, mode, basePath }: { editId?: number; mode: ViewMode; basePath: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const readOnly = mode === "accounting"; // نمای حسابداری انبار برای این سند کاملاً فقط‌خواندنی است — چیزی برای ویرایش در این فاز وجود ندارد
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [goodsItems, setGoodsItems] = useState<GoodsItemRow[]>([]);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [pickableLines, setPickableLines] = useState<PickableLine[]>([]);
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", basis: "NO_BASIS" as Basis, warehouseId: "", partyId: "", description: "" });
  const [rows, setRows] = usePersistedState<RowState[]>(`${cacheKey}:rows`, []);
  const [meta, setMeta] = usePersistedState<{ number: number; status: DocStatus; fiscalPeriodTitle: string } | null>(`${cacheKey}:meta`, null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    async function init() {
      const [whs, items, partyList]: [Warehouse[], GoodsItemRow[], PartyOption[]] = await Promise.all([
        api.get("/warehouses"),
        api.get("/goods-items?kind=GOODS&docDirection=INBOUND&docType=خرید"),
        api.get("/parties"),
      ]);
      setWarehouses(whs);
      setGoodsItems(items);
      setParties(partyList);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        return;
      }

      if (editId) {
        const d: Detail = await api.get(`/warehouse-receipts/${editId}`);
        setMeta({ number: d.number, status: d.status, fiscalPeriodTitle: d.fiscalPeriodTitle });
        setHeader({ date: d.date.slice(0, 10), basis: d.basis, warehouseId: String(d.warehouseId), partyId: d.partyId ? String(d.partyId) : "", description: d.description || "" });
        setRows(
          d.lines.map((l) => ({
            sourceSupplyRequestLineId: l.sourceSupplyRequestLineId ? String(l.sourceSupplyRequestLineId) : "",
            sourcePurchaseOrderLineId: l.sourcePurchaseOrderLineId ? String(l.sourcePurchaseOrderLineId) : "",
            sourceDeliveryAuthorizationLineId: l.sourceDeliveryAuthorizationLineId ? String(l.sourceDeliveryAuthorizationLineId) : "",
            sourceNumber: "",
            goodsItemId: String(l.goodsItemId),
            goodsItemCode: l.goodsItemCode,
            goodsItemTitle: l.goodsItemTitle,
            unitId: String(l.unitId),
            unitTitle: l.unitTitle,
            quantity: String(l.quantity),
            unitCost: l.unitCost,
            amount: l.amount,
            description: l.description || "",
            serialNumber: l.serialNumber || "",
            batchNumber: l.batchNumber || "",
            expiryDate: l.expiryDate ? l.expiryDate.slice(0, 10) : "",
            physicalLocation: l.physicalLocation || "",
          }))
        );
      } else {
        setHeader({ date: "", basis: "NO_BASIS", warehouseId: "", partyId: "", description: "" });
        setRows([emptyRow()]);
        setMeta(null);
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  useEffect(() => {
    if (header.basis === "NO_BASIS") {
      setPickableLines([]);
      return;
    }
    const params = new URLSearchParams();
    if (header.date) params.set("destDate", header.date);
    // برای مبنای سفارش خرید/مجوز تحویل، فقط مبناهایی نشان داده می‌شوند که تامین‌کننده‌شان با «طرف
    // مقابل» انتخاب‌شده در هدر یکی است
    if ((header.basis === "PURCHASE_ORDER" || header.basis === "DELIVERY_AUTHORIZATION") && header.partyId) {
      params.set("partyId", header.partyId);
    }
    const q = params.toString() ? `?${params.toString()}` : "";
    api
      .get(`${PICKABLE_ENDPOINT[header.basis]}${q}`)
      .then((rows: PickableLine[]) => setPickableLines(rows))
      .catch(() => setPickableLines([]));
  }, [header.basis, header.date, header.partyId]);

  const status: DocStatus = meta?.status || "DRAFT";
  const hasAnyLine = rows.some((r) => r.goodsItemId || r.sourceSupplyRequestLineId || r.sourcePurchaseOrderLineId || r.sourceDeliveryAuthorizationLineId);
  const coreDisabled = readOnly || (!!editId && status !== "DRAFT");
  const headerBasisDisabled = coreDisabled || hasAnyLine;
  // طرف مقابل هم مثل مبنا، پیش از افزودن ردیف باید مشخص شود — چون در حالت مبنادار، پیکر ردیف‌های
  // مبنا بر اساس همین فیلد فیلتر می‌شود؛ تغییرش بعد از افزودن ردیف می‌تواند ناسازگاری ایجاد کند
  const headerPartyDisabled = coreDisabled || hasAnyLine;

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function onSourceLineChange(idx: number, sourceLineId: string) {
    if (header.basis === "NO_BASIS") return;
    const field = SOURCE_FIELD[header.basis];
    const src = pickableLines.find((l) => String(l[field]) === sourceLineId);
    updateRow(idx, {
      sourceSupplyRequestLineId: header.basis === "SUPPLY_REQUEST" ? sourceLineId : "",
      sourcePurchaseOrderLineId: header.basis === "PURCHASE_ORDER" ? sourceLineId : "",
      sourceDeliveryAuthorizationLineId: header.basis === "DELIVERY_AUTHORIZATION" ? sourceLineId : "",
      sourceNumber: src ? String(src.number) : "",
      goodsItemId: src ? String(src.goodsItemId) : "",
      goodsItemCode: src ? src.goodsItemCode : "",
      goodsItemTitle: src ? src.goodsItemTitle : "",
      unitId: src ? String(src.unitId) : "",
      unitTitle: src ? src.unitTitle : "",
      quantity: src ? String(src.remaining) : "",
    });
  }

  function onGoodsItemChange(idx: number, goodsItemId: string) {
    const item = goodsItems.find((g) => g.id === Number(goodsItemId));
    updateRow(idx, { goodsItemId, unitId: item ? String(item.mainUnitId) : "", unitTitle: "" });
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }
  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  const totalQuantity = rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const totalAmount = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  function buildBody() {
    const nonEmptyRows = rows.filter((r) => r.goodsItemId || r.sourceSupplyRequestLineId || r.sourcePurchaseOrderLineId || r.sourceDeliveryAuthorizationLineId);
    return {
      date: header.date,
      basis: header.basis,
      warehouseId: Number(header.warehouseId),
      partyId: header.partyId ? Number(header.partyId) : null,
      description: header.description,
      lines: nonEmptyRows.map((r) => ({
        sourceSupplyRequestLineId: r.sourceSupplyRequestLineId ? Number(r.sourceSupplyRequestLineId) : null,
        sourcePurchaseOrderLineId: r.sourcePurchaseOrderLineId ? Number(r.sourcePurchaseOrderLineId) : null,
        sourceDeliveryAuthorizationLineId: r.sourceDeliveryAuthorizationLineId ? Number(r.sourceDeliveryAuthorizationLineId) : null,
        goodsItemId: r.goodsItemId ? Number(r.goodsItemId) : undefined,
        unitId: Number(r.unitId),
        quantity: Number(r.quantity) || 0,
        description: r.description || null,
        serialNumber: r.serialNumber || null,
        batchNumber: r.batchNumber || null,
        expiryDate: r.expiryDate || null,
        physicalLocation: r.physicalLocation || null,
      })),
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    setError(null);
    if (!header.date) return setError("تاریخ الزامی است");
    if (!header.warehouseId) return setError("انبار الزامی است");
    if (!header.partyId) return setError("طرف مقابل الزامی است");
    const body = buildBody();
    if (body.lines.length === 0) return setError("رسید انبار باید حداقل یک ردیف کالا داشته باشد");
    for (const [i, l] of body.lines.entries()) {
      if (header.basis === "SUPPLY_REQUEST" && !l.sourceSupplyRequestLineId) return setError(`ردیف ${i + 1}: انتخاب ردیف درخواست تامین الزامی است`);
      if (header.basis === "PURCHASE_ORDER" && !l.sourcePurchaseOrderLineId) return setError(`ردیف ${i + 1}: انتخاب ردیف سفارش خرید الزامی است`);
      if (header.basis === "DELIVERY_AUTHORIZATION" && !l.sourceDeliveryAuthorizationLineId) return setError(`ردیف ${i + 1}: انتخاب ردیف مجوز تحویل الزامی است`);
      if (header.basis === "NO_BASIS" && !l.goodsItemId) return setError(`کالا برای ردیف ${i + 1} الزامی است`);
      if (!(l.quantity > 0)) return setError(`مقدار ردیف ${i + 1} باید عددی مثبت باشد`);
    }
    try {
      if (editId) {
        await api.put(`/warehouse-receipts/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/warehouse-receipts", body);
        flash();
        navigate(`${basePath}/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId || readOnly) return;
    try {
      await api.del(`/warehouse-receipts/${editId}`);
      navigate(basePath);
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  async function handleFinalize() {
    if (!editId) return;
    try {
      await api.post(`/warehouse-receipts/${editId}/finalize`, {});
      setMeta((prev) => (prev ? { ...prev, status: "FINALIZED" } : prev));
      flash();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  async function handleRevert() {
    if (!editId) return;
    try {
      await api.post(`/warehouse-receipts/${editId}/revert`, {});
      setMeta((prev) => (prev ? { ...prev, status: "DRAFT" } : prev));
      flash();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  const selectedWarehouseStillListed = warehouses.some((w) => String(w.id) === header.warehouseId);
  const warehouseOptions = warehouses.filter((w) => w.isActive || String(w.id) === header.warehouseId);
  const selectedParty = parties.find((p) => String(p.id) === header.partyId);
  const hasSourceColumn = header.basis !== "NO_BASIS";

  return (
    <FormPage
      title={editId ? "ویرایش رسید انبار خرید" : "رسید انبار خرید جدید"}
      description={
        readOnly
          ? "این نما («حسابداری انبار») فقط نمایشی است؛ ثبت/ویرایش رسید انبار از نمای «انبارداری» انجام می‌شود."
          : status === "FINALIZED"
          ? "این سند «قطعی» شده و دیگر قابل ویرایش مستقیم نیست؛ برای اصلاح، ابتدا «برگشت از قطعی» را بزنید."
          : status === "VOID"
          ? "این سند «ابطال‌شده» است."
          : undefined
      }
      formId="warehouse-receipt-form"
      closePath={basePath}
      newPath={mode === "warehousing" ? `${basePath}/new` : undefined}
      onDelete={!readOnly && editId && status === "DRAFT" ? handleDelete : undefined}
      saveDisabled={coreDisabled}
      extraActions={
        !readOnly && meta
          ? [
              ...(status === "DRAFT" ? [{ label: "قطعی کردن", icon: <CheckIcon />, onClick: handleFinalize }] : []),
              ...(status === "FINALIZED" ? [{ label: "برگشت از قطعی", icon: <UndoIcon />, onClick: handleRevert }] : []),
            ]
          : []
      }
      wide
    >
      <form id="warehouse-receipt-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}

        <fieldset disabled={coreDisabled} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="je-header-grid" style={{ marginBottom: 16, maxWidth: 900 }}>
            <div className="form-field">
              <label>شماره</label>
              <input dir="ltr" value={meta ? toFaDigits(String(meta.number)) : "خودکار پس از ذخیره"} disabled />
            </div>
            <div className="form-field">
              <label>دوره مالی</label>
              <input value={meta?.fiscalPeriodTitle ?? "بر اساس تاریخ سند"} disabled />
            </div>
            <div className="form-field">
              <label>وضعیت</label>
              <div><span className="badge">{STATUS_FA[status]}</span></div>
            </div>
            <div className="form-field">
              <label>انبار</label>
              <select value={header.warehouseId} onChange={(e) => setHeader({ ...header, warehouseId: e.target.value })} disabled={coreDisabled}>
                <option value="">انتخاب کنید</option>
                {warehouseOptions.map((w) => (
                  <option key={w.id} value={w.id}>{w.title}{!w.isActive ? " (غیرفعال)" : ""}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>تاریخ سند</label>
              <JalaliDatePicker value={header.date} onChange={(v) => setHeader({ ...header, date: v })} />
            </div>
            <div className="form-field">
              <label>مبنا</label>
              <select value={header.basis} onChange={(e) => setHeader({ ...header, basis: e.target.value as Basis })} disabled={headerBasisDisabled}>
                {(Object.keys(BASIS_FA) as Basis[]).map((b) => (
                  <option key={b} value={b}>{BASIS_FA[b]}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>طرف مقابل</label>
              <RecordPickerField
                title="انتخاب طرف مقابل"
                disabled={headerPartyDisabled}
                displayValue={
                  selectedParty ? `${toFaDigits(selectedParty.detailCode)} — ${partyDisplayName(selectedParty)}` : ""
                }
                rows={parties.filter((p) => p.isActive || String(p.id) === header.partyId)}
                columns={[
                  { header: "کد", render: (p) => toFaDigits(p.detailCode), filterValue: (p) => p.detailCode, width: "90px" },
                  { header: "نوع", render: (p) => (p.category === "LEGAL" ? "حقوقی" : "حقیقی"), filterValue: (p) => (p.category === "LEGAL" ? "حقوقی" : "حقیقی"), width: "80px" },
                  { header: "نام", render: (p) => partyDisplayName(p), filterValue: (p) => partyDisplayName(p) },
                ]}
                onSelect={(p) => setHeader({ ...header, partyId: String((p as PartyOption).id) })}
              />
            </div>
            <div className="form-field full">
              <label>شرح</label>
              <input value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} disabled={coreDisabled} />
            </div>
            {!selectedWarehouseStillListed && header.warehouseId && (
              <div className="form-field full">
                <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>این انبار دیگر در فهرست انبارها یافت نشد</span>
              </div>
            )}
          </div>

          {!readOnly && (
            <div className="je-lines-toolbar">
              <span className="je-lines-title">ردیف‌های کالا</span>
              <button type="button" className="toolbar-icon-btn primary" onClick={addRow} title="ردیف جدید">
                <PlusIcon />
              </button>
            </div>
          )}
        </fieldset>

        <div className="grid-wrap je-lines-wrap">
          <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th>ردیف</th>
                  {hasSourceColumn && <th>{SOURCE_LABEL[header.basis as Exclude<Basis, "NO_BASIS">]}</th>}
                  <th>کالا</th>
                  <th>واحد</th>
                  <th>سریال</th>
                  <th>شماره بچ</th>
                  <th>تاریخ انقضا</th>
                  <th>محل فیزیکی</th>
                  <th>مقدار</th>
                  {mode === "accounting" && <th>فی واحد</th>}
                  {mode === "accounting" && <th>مبلغ</th>}
                  <th>شرح</th>
                  {!readOnly && <th></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const item = goodsItems.find((g) => g.id === Number(row.goodsItemId));
                  const pickerRows = item && !item.isActive ? goodsItems : goodsItems.filter((g) => g.isActive);
                  const field = header.basis !== "NO_BASIS" ? SOURCE_FIELD[header.basis] : null;
                  const selectedSourceId = field ? (row as any)[field] : "";
                  const src = field ? pickableLines.find((l) => String(l[field]) === selectedSourceId) : undefined;
                  const sourceDisplay = src ? `${toFaDigits(String(src.number))} — ${src.goodsItemTitle}` : row.sourceNumber ? toFaDigits(row.sourceNumber) : "";
                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                      {hasSourceColumn && (
                        <td style={{ minWidth: 220 }}>
                          <RecordPickerField
                            title={`انتخاب ${SOURCE_LABEL[header.basis as Exclude<Basis, "NO_BASIS">]}`}
                            disabled={coreDisabled}
                            displayValue={sourceDisplay}
                            rows={pickableLines}
                            columns={[
                              { header: "شماره", render: (l) => toFaDigits(String(l.number)), filterValue: (l) => String(l.number), width: "70px" },
                              { header: "کالا", render: (l) => l.goodsItemTitle, filterValue: (l) => l.goodsItemTitle },
                              { header: "مانده", render: (l) => formatAmountFa(l.remaining), filterValue: (l) => String(l.remaining), width: "90px" },
                            ]}
                            onSelect={(l) => onSourceLineChange(idx, String((l as PickableLine)[SOURCE_FIELD[header.basis as Exclude<Basis, "NO_BASIS">]]))}
                          />
                        </td>
                      )}
                      <td style={{ minWidth: 200 }}>
                        {hasSourceColumn ? (
                          <span>{row.goodsItemTitle ? `${toFaDigits(row.goodsItemCode)} — ${row.goodsItemTitle}` : "—"}</span>
                        ) : (
                          <RecordPickerField
                            title="انتخاب کالا"
                            disabled={coreDisabled}
                            displayValue={item ? `${toFaDigits(item.fullCode)} — ${item.title}` : ""}
                            rows={pickerRows}
                            columns={[
                              { header: "کد", render: (g) => toFaDigits(g.fullCode), filterValue: (g) => g.fullCode, width: "110px" },
                              { header: "عنوان", render: (g) => g.title, filterValue: (g) => g.title },
                            ]}
                            onSelect={(g) => onGoodsItemChange(idx, String(g.id))}
                          />
                        )}
                      </td>
                      <td style={{ minWidth: 90, color: "var(--ink-soft)" }}>{item?.mainUnit?.title || row.unitTitle || "—"}</td>
                      <TrackingCells
                        goodsItemId={row.goodsItemId ? Number(row.goodsItemId) : null}
                        item={item}
                        warehouseId={header.warehouseId ? Number(header.warehouseId) : null}
                        value={row}
                        onChange={(patch) => updateRow(idx, patch)}
                        disabled={coreDisabled}
                      />
                      <td style={{ minWidth: 130 }}>
                        <AmountInput value={row.quantity} onChange={(v) => updateRow(idx, { quantity: v })} allowDecimal placeholder="۰" disabled={coreDisabled} />
                      </td>
                      {mode === "accounting" && <td style={{ minWidth: 110, color: "var(--ink-soft)" }}>{formatAmountFa(row.unitCost)}</td>}
                      {mode === "accounting" && <td style={{ minWidth: 120, color: "var(--ink-soft)" }}>{formatAmountFa(row.amount)}</td>}
                      <td style={{ minWidth: 160 }}>
                        <input value={row.description} onChange={(e) => updateRow(idx, { description: e.target.value })} disabled={coreDisabled} />
                      </td>
                      {!readOnly && (
                        <td>
                          <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => removeRow(idx)} disabled={coreDisabled}>
                            حذف
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="grid-footer je-lines-footer">
            <span className="grid-footer-info">{rows.length === 0 ? "بدون ردیف" : `${toFaDigits(String(rows.length))} ردیف`}</span>
            <span className="je-lines-totals">
              جمع مقدار: {formatAmountFa(totalQuantity)}
              {mode === "accounting" && <> — جمع مبلغ: {formatAmountFa(totalAmount)}</>}
            </span>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
