import { FormEvent, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
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

interface Warehouse { id: number; code: number; title: string; isActive: boolean }
interface UnitOfMeasure { id: number; code: number; title: string }
interface GoodsItemRow {
  id: number;
  fullCode: string;
  title: string;
  mainUnitId: number;
  isActive: boolean;
  kind: string;
  isSerialTracked: boolean;
  isBatchTracked: boolean;
  isExpiryTracked: boolean;
  isLocationTracked: boolean;
}

interface ListRow {
  id: number;
  number: number;
  date: string;
  warehouseId: number;
  warehouseTitle: string;
  fiscalPeriodTitle: string;
  description: string | null;
  creationType: "MANUAL" | "SYSTEM";
  status: "DRAFT" | "FINALIZED" | "VOID";
  lineCount: number;
  totalQuantity: number;
  totalAmount: number;
}

interface DetailLine {
  id: number;
  goodsItemId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitId: number;
  unitTitle: string;
  quantity: number;
  unitCost: number;
  amount: number;
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
  fiscalPeriodId: number;
  fiscalPeriodTitle: string;
  description: string | null;
  creationType: "MANUAL" | "SYSTEM";
  status: "DRAFT" | "FINALIZED" | "VOID";
  finalizedAt: string | null;
  lines: DetailLine[];
}

const STATUS_FA: Record<string, string> = { DRAFT: "ثبت", FINALIZED: "قطعی", VOID: "ابطال‌شده" };
const CREATION_TYPE_FA: Record<string, string> = { MANUAL: "دستی", SYSTEM: "سیستمی" };

type ViewMode = "warehousing" | "accounting";

function infoText(mode: ViewMode) {
  const base =
    "ثبت موجودی اول دوره برای راه‌اندازی اولیه سیستم؛ برای هر انبار حداکثر یک سند در هر دوره مالی مجاز است. " +
    "سند تا زمانی که «قطعی» نشده در موجودی انبار اثری ندارد؛ پس از «قطعی کردن» دیگر قابل ویرایش مستقیم نیست " +
    "(برای اصلاح، ابتدا «برگشت از قطعی» را بزنید). مقدار هر ردیف مستقیماً توسط شما وارد می‌شود.";
  if (mode === "warehousing") {
    return base + " این نمای «انبارداری» فقط مقدار را ثبت می‌کند؛ ثبت فی و مبلغ از نمای «حسابداری انبار» انجام می‌شود.";
  }
  return (
    base +
    " مقدار هرگز از فی/مبلغ محاسبه نمی‌شود؛ مبلغ = مقدار × فی است — اگر مبلغ را ویرایش کنید، فی واحد به‌طور خودکار بازمحاسبه می‌شود."
  );
}

// این کامپوننت زیر دو ماژول جدا در منو سوار می‌شود («انبارداری» و «حسابداری انبار»)، هر دو روی همان
// entity/API مشترک (سند موجودی اول دوره) کار می‌کنند؛ فقط نمایش/ویرایش‌پذیری فیلدهای مبلغی («فی واحد»،
// «مبلغ») بر اساس mode فرق می‌کند. نمای «انبارداری» اصلاً این دو فیلد را نشان نمی‌دهد (نه حتی به‌صورت
// فقط-خواندنی)؛ نمای «حسابداری انبار» دقیقاً همان فرم انبارداری را با این دو فیلد اضافه‌شده نمایش می‌دهد.
export default function InitialInventory({ mode }: { mode: ViewMode }) {
  const location = useLocation();
  const { id } = useParams();
  const basePath = mode === "warehousing" ? "/warehousing/initial-inventory" : "/warehouse-accounting/initial-inventory";
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  // در «حسابداری انبار» هرگز امکان ثبت سند جدید نیست (فقط از فهرست باز می‌شود)؛ حتی اگر کاربر مستقیماً
  // آدرس «/new» را وارد کند، به فهرست هدایت می‌شود.
  if (isNew && mode === "accounting") return <Navigate to={basePath} replace />;
  if (isNew) return <InitialInventoryForm mode={mode} basePath={basePath} />;
  if (isEdit) return <InitialInventoryForm mode={mode} basePath={basePath} editId={Number(id)} />;
  return <InitialInventoryList mode={mode} basePath={basePath} />;
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

function InitialInventoryList({ mode, basePath }: { mode: ViewMode; basePath: string }) {
  const cacheKey = basePath;
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const [bulkSlot, setBulkSlot] = useState<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  async function reload() {
    try {
      const rows = await api.get("/initial-inventories");
      setItems(rows);
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
      await api.del(`/initial-inventories/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>موجودی اول دوره</h2>
        </div>
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={infoText(mode)} title="موجودی اول دوره" />
          {mode === "warehousing" && <NewRecordButton path={`${basePath}/new`} />}
          <RefreshButton onClick={reload} />
          <div ref={setBulkSlot} className="bulk-slot" style={{ display: "flex" }} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        bulkActionsContainer={bulkSlot}
        columns={[
          { header: "شماره", render: (r) => r.number, width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "انبار", render: (r) => r.warehouseTitle, filterType: "string", filterValue: (r) => r.warehouseTitle },
          { header: "دوره مالی", render: (r) => r.fiscalPeriodTitle, filterType: "string", filterValue: (r) => r.fiscalPeriodTitle },
          { header: "شرح", render: (r) => r.description || "—", filterType: "string", filterValue: (r) => r.description || "" },
          { header: "نوع ایجاد", render: (r) => CREATION_TYPE_FA[r.creationType], filterType: "string", filterValue: (r) => CREATION_TYPE_FA[r.creationType] },
          { header: "تعداد ردیف", render: (r) => r.lineCount },
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
  id?: number;
  goodsItemId: string;
  unitId: string;
  quantity: string;
  unitCost: string;
  amount: string;
  serialNumber: string;
  batchNumber: string;
  expiryDate: string;
  physicalLocation: string;
}

function emptyRow(): RowState {
  return { goodsItemId: "", unitId: "", quantity: "", unitCost: "", amount: "", serialNumber: "", batchNumber: "", expiryDate: "", physicalLocation: "" };
}

// طبق بند ۳-۴ «مستند عمومی عملیات انبار»: مبلغ باید بر اساس تعداد ارقام اعشار «ارز پایه» گرد شود، نه
// یک عدد هاردکد (قبلاً همیشه ۲ رقم بود). این تابع فقط برای پیش‌نمایش لحظه‌ای در فرانت‌اند است؛ مرجع
// نهایی محاسبه، بک‌اند (`computeAmount` در initialInventory.ts) است.
function recomputeAmount(row: RowState, baseDecimalPlaces: number): RowState {
  const qty = Number(row.quantity) || 0;
  const cost = Number(row.unitCost) || 0;
  if (!qty) return { ...row, amount: "" };
  const factor = Math.pow(10, baseDecimalPlaces);
  const amount = Math.round(qty * cost * factor) / factor;
  return { ...row, amount: amount ? String(amount) : "" };
}

function recomputeUnitCostFromAmount(row: RowState): RowState {
  const qty = Number(row.quantity) || 0;
  const amount = Number(row.amount) || 0;
  if (!qty) return row;
  return { ...row, unitCost: String(amount / qty) };
}

function InitialInventoryForm({ editId, mode, basePath }: { editId?: number; mode: ViewMode; basePath: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [goodsItems, setGoodsItems] = useState<GoodsItemRow[]>([]);
  const [baseDecimalPlaces, setBaseDecimalPlaces] = useState(2);
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { warehouseId: "", date: "", description: "" });
  const [rows, setRows] = usePersistedState<RowState[]>(`${cacheKey}:rows`, []);
  const [meta, setMeta] = usePersistedState<{
    number: number;
    status: "DRAFT" | "FINALIZED" | "VOID";
    creationType: "MANUAL" | "SYSTEM";
    fiscalPeriodTitle: string;
  } | null>(`${cacheKey}:meta`, null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    async function init() {
      const [whs, unitsList, items, currencies]: [Warehouse[], UnitOfMeasure[], GoodsItemRow[], { isBase: boolean; decimalPlaces: number }[]] = await Promise.all([
        api.get("/warehouses"),
        api.get("/units-of-measure"),
        api.get("/goods-items?kind=GOODS"),
        api.get("/currencies"),
      ]);
      setWarehouses(whs);
      setUnits(unitsList);
      setGoodsItems(items);
      const baseCurrency = currencies.find((c) => c.isBase);
      if (baseCurrency) setBaseDecimalPlaces(baseCurrency.decimalPlaces);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        return;
      }

      if (editId) {
        const d: Detail = await api.get(`/initial-inventories/${editId}`);
        setMeta({ number: d.number, status: d.status, creationType: d.creationType, fiscalPeriodTitle: d.fiscalPeriodTitle });
        setHeader({ warehouseId: String(d.warehouseId), date: d.date.slice(0, 10), description: d.description || "" });
        setRows(
          d.lines.map((l) => ({
            id: l.id,
            goodsItemId: String(l.goodsItemId),
            unitId: String(l.unitId),
            quantity: String(l.quantity),
            unitCost: l.unitCost ? String(l.unitCost) : "",
            amount: l.amount ? String(l.amount) : "",
            serialNumber: l.serialNumber || "",
            batchNumber: l.batchNumber || "",
            expiryDate: l.expiryDate ? l.expiryDate.slice(0, 10) : "",
            physicalLocation: l.physicalLocation || "",
          }))
        );
      } else {
        setHeader({ warehouseId: "", date: "", description: "" });
        setRows([emptyRow(), emptyRow()]);
        setMeta(null);
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // «انبارداری»: سند پس از قطعی‌شدن (یا اگر سیستمی/ابطال‌شده باشد) دیگر قابل ویرایش نیست.
  const isReadOnly = !!editId && (meta?.status === "FINALIZED" || meta?.status === "VOID" || meta?.creationType === "SYSTEM");

  // «حسابداری انبار»: طبق تصمیم کاربر، این نما هرگز امکان ثبت سند جدید یا تغییر مقدار/کالا/واحد/انبار/
  // تاریخ را ندارد؛ این فیلدها همیشه فقط‌خواندنی هستند (صرف‌نظر از وضعیت سند). فقط فی/مبلغ قابل ویرایش‌اند،
  // و آن هم فقط زمانی که سند سیستمی یا ابطال‌شده نباشد (برخلاف مقدار، فی می‌تواند حتی روی سند «قطعی»
  // هم ثبت شود، چون قیمت‌گذاری معمولاً بعد از قطعی‌شدن رسید/موجودی انجام می‌شود).
  const isSystemDoc = meta?.creationType === "SYSTEM";
  const isVoidDoc = meta?.status === "VOID";
  const nonMoneyReadOnly = mode === "accounting" ? true : isReadOnly;
  const moneyEditable = mode === "accounting" && !!editId && !isSystemDoc && !isVoidDoc;

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function onGoodsItemChange(idx: number, goodsItemId: string) {
    const item = goodsItems.find((g) => g.id === Number(goodsItemId));
    updateRow(idx, { goodsItemId, unitId: item ? String(item.mainUnitId) : "" });
  }

  function onQuantityChange(idx: number, quantity: string) {
    setRows((prev) => prev.map((r, i) => (i === idx ? recomputeAmount({ ...r, quantity }, baseDecimalPlaces) : r)));
  }
  function onUnitCostChange(idx: number, unitCost: string) {
    setRows((prev) => prev.map((r, i) => (i === idx ? recomputeAmount({ ...r, unitCost }, baseDecimalPlaces) : r)));
  }
  function onAmountChange(idx: number, amount: string) {
    setRows((prev) => prev.map((r, i) => (i === idx ? recomputeUnitCostFromAmount({ ...r, amount }) : r)));
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
    const nonEmptyRows = rows.filter((r) => r.goodsItemId);
    return {
      warehouseId: Number(header.warehouseId),
      date: header.date,
      description: header.description,
      lines: nonEmptyRows.map((r) => ({
        goodsItemId: Number(r.goodsItemId),
        unitId: Number(r.unitId),
        quantity: Number(r.quantity) || 0,
        unitCost: Number(r.unitCost) || 0,
        serialNumber: r.serialNumber || null,
        batchNumber: r.batchNumber || null,
        expiryDate: r.expiryDate || null,
        physicalLocation: r.physicalLocation || null,
      })),
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // «حسابداری انبار»: هرگز سند جدید ثبت نمی‌شود؛ فقط فی/مبلغ ردیف‌های موجود از این فرم به یک مسیر
    // اختصاصی (که مقدار/کالا/واحد/انبار/تاریخ را دست‌نخورده می‌گذارد) ارسال می‌شود.
    if (mode === "accounting") {
      if (!editId) return setError("امکان ثبت سند جدید از حسابداری انبار وجود ندارد");
      const lines = rows.filter((r) => r.id != null).map((r) => ({ id: r.id as number, unitCost: Number(r.unitCost) || 0 }));
      if (lines.length === 0) return setError("سند باید حداقل یک ردیف کالا داشته باشد");
      try {
        await api.put(`/initial-inventories/${editId}/accounting`, { lines });
        flash();
      } catch (err) {
        setError((err as ApiError).message);
      }
      return;
    }

    if (!header.warehouseId) return setError("انبار الزامی است");
    if (!header.date) return setError("تاریخ سند الزامی است");
    const body = buildBody();
    if (body.lines.length === 0) return setError("سند باید حداقل یک ردیف کالا داشته باشد");
    for (const [i, l] of body.lines.entries()) {
      if (!l.unitId) return setError(`واحد سنجش ردیف ${i + 1} الزامی است`);
      if (!(l.quantity > 0)) return setError(`مقدار ردیف ${i + 1} باید عددی مثبت باشد`);
    }
    try {
      if (editId) {
        await api.put(`/initial-inventories/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/initial-inventories", body);
        flash();
        navigate(`${basePath}/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/initial-inventories/${editId}`);
      navigate(basePath);
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  async function handleFinalize() {
    if (!editId) return;
    try {
      await api.post(`/initial-inventories/${editId}/finalize`, {});
      setMeta((prev) => (prev ? { ...prev, status: "FINALIZED" } : prev));
      flash();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  async function handleRevert() {
    if (!editId) return;
    try {
      await api.post(`/initial-inventories/${editId}/revert`, {});
      setMeta((prev) => (prev ? { ...prev, status: "DRAFT" } : prev));
      flash();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  const selectedWarehouseStillListed = warehouses.some((w) => String(w.id) === header.warehouseId);
  const warehouseOptions = warehouses.filter((w) => w.isActive || String(w.id) === header.warehouseId);

  return (
    <FormPage
      title={editId ? "ویرایش موجودی اول دوره" : "موجودی اول دوره جدید"}
      description={
        mode === "accounting"
          ? isSystemDoc
            ? "این سند به‌صورت سیستمی صادر شده و از این فرم قابل ویرایش نیست."
            : isVoidDoc
            ? "این سند «ابطال‌شده» است."
            : "در «حسابداری انبار» فقط فی/مبلغ قابل ویرایش است؛ مقدار و سایر مشخصات سند از این نما قابل تغییر نیستند."
          : isReadOnly
          ? meta?.creationType === "SYSTEM"
            ? "این سند به‌صورت سیستمی صادر شده و از این فرم قابل ویرایش نیست."
            : meta?.status === "FINALIZED"
            ? "این سند «قطعی» شده و دیگر قابل ویرایش مستقیم نیست؛ برای اصلاح، ابتدا «برگشت از قطعی» را بزنید."
            : "این سند «ابطال‌شده» است."
          : undefined
      }
      formId="initial-inventory-form"
      closePath={basePath}
      newPath={mode === "warehousing" ? `${basePath}/new` : undefined}
      onDelete={mode === "warehousing" && editId && meta?.status === "DRAFT" ? handleDelete : undefined}
      saveDisabled={mode === "accounting" ? !moneyEditable : isReadOnly}
      extraActions={
        mode === "warehousing" && meta
          ? [
              ...(meta.status === "DRAFT" ? [{ label: "قطعی کردن", icon: <CheckIcon />, onClick: handleFinalize }] : []),
              ...(meta.status === "FINALIZED" ? [{ label: "برگشت از قطعی", icon: <UndoIcon />, onClick: handleRevert }] : []),
            ]
          : []
      }
      wide
    >
      <form id="initial-inventory-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}

        <fieldset disabled={nonMoneyReadOnly} style={{ border: 0, padding: 0, margin: 0 }}>
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
            <div><span className="badge">{STATUS_FA[meta?.status || "DRAFT"]}</span></div>
          </div>
          <div className="form-field">
            <label>نوع ایجاد سند</label>
            <input value={CREATION_TYPE_FA[meta?.creationType || "MANUAL"]} disabled title="در این فاز فقط امکان ثبت دستی موجودی اول دوره فراهم است" />
          </div>
          <div className="form-field">
            <label>انبار</label>
            <select value={header.warehouseId} onChange={(e) => setHeader({ ...header, warehouseId: e.target.value })} disabled={nonMoneyReadOnly}>
              <option value="">انتخاب کنید</option>
              {warehouseOptions.map((w) => (
                <option key={w.id} value={w.id}>{w.title}{!w.isActive ? " (غیرفعال)" : ""}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>تاریخ سند</label>
            <JalaliDatePicker value={header.date} onChange={(v) => setHeader({ ...header, date: v })} disabled={nonMoneyReadOnly} />
          </div>
          <div className="form-field full">
            <label>شرح</label>
            <input value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} />
          </div>
          {!selectedWarehouseStillListed && header.warehouseId && (
            <div className="form-field full">
              <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>این انبار دیگر در فهرست انبارها یافت نشد</span>
            </div>
          )}
        </div>

        <div className="je-lines-toolbar">
          <span className="je-lines-title">ردیف‌های کالا</span>
          {mode === "warehousing" && (
            <button type="button" className="toolbar-icon-btn primary" onClick={addRow} title="ردیف جدید">
              <PlusIcon />
            </button>
          )}
        </div>
        </fieldset>

        <div className="grid-wrap je-lines-wrap">
        <fieldset disabled={mode === "warehousing" ? isReadOnly : false} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
          <table className="je-lines-table">
            <thead>
              <tr>
                <th>ردیف</th>
                <th>کالا</th>
                <th>واحد سنجش</th>
                <th>سریال</th>
                <th>شماره بچ</th>
                <th>تاریخ انقضا</th>
                <th>محل فیزیکی</th>
                <th>مقدار</th>
                {mode === "accounting" && <th>فی واحد</th>}
                {mode === "accounting" && <th>مبلغ</th>}
                {mode === "warehousing" && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const item = goodsItems.find((g) => g.id === Number(row.goodsItemId));
                const pickerRows = item && !item.isActive ? goodsItems : goodsItems.filter((g) => g.isActive);
                return (
                  <tr key={idx} onClick={() => setFocusedRow(idx)} className={focusedRow === idx ? "active-list" : ""}>
                    <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                    <td style={{ minWidth: 220 }}>
                      <RecordPickerField
                        title="انتخاب کالا"
                        displayValue={item ? `${toFaDigits(item.fullCode)} — ${item.title}` : ""}
                        rows={pickerRows}
                        columns={[
                          { header: "کد", render: (g) => toFaDigits(g.fullCode), filterValue: (g) => g.fullCode, width: "110px" },
                          { header: "عنوان", render: (g) => g.title, filterValue: (g) => g.title },
                        ]}
                        onOpen={() => setFocusedRow(idx)}
                        onSelect={(g) => onGoodsItemChange(idx, String(g.id))}
                        disabled={nonMoneyReadOnly}
                      />
                    </td>
                    <td style={{ minWidth: 110 }}>
                      <select value={row.unitId} onChange={(e) => updateRow(idx, { unitId: e.target.value })} disabled={nonMoneyReadOnly}>
                        <option value="">—</option>
                        {units.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
                      </select>
                    </td>
                    <td style={{ minWidth: 110 }}>
                      {item?.isSerialTracked ? (
                        <input value={row.serialNumber} onChange={(e) => updateRow(idx, { serialNumber: e.target.value })} disabled={nonMoneyReadOnly} placeholder="سریال" />
                      ) : (
                        <span style={{ color: "var(--ink-soft)" }}>—</span>
                      )}
                    </td>
                    <td style={{ minWidth: 110 }}>
                      {item?.isBatchTracked ? (
                        <input value={row.batchNumber} onChange={(e) => updateRow(idx, { batchNumber: e.target.value })} disabled={nonMoneyReadOnly} placeholder="شماره بچ" />
                      ) : (
                        <span style={{ color: "var(--ink-soft)" }}>—</span>
                      )}
                    </td>
                    <td style={{ minWidth: 130 }}>
                      {item?.isExpiryTracked ? (
                        <JalaliDatePicker value={row.expiryDate} onChange={(v) => updateRow(idx, { expiryDate: v })} disabled={nonMoneyReadOnly} />
                      ) : (
                        <span style={{ color: "var(--ink-soft)" }}>—</span>
                      )}
                    </td>
                    <td style={{ minWidth: 110 }}>
                      {item?.isLocationTracked ? (
                        <input value={row.physicalLocation} onChange={(e) => updateRow(idx, { physicalLocation: e.target.value })} disabled={nonMoneyReadOnly} placeholder="محل فیزیکی" />
                      ) : (
                        <span style={{ color: "var(--ink-soft)" }}>—</span>
                      )}
                    </td>
                    <td style={{ minWidth: 130 }}>
                      <AmountInput value={row.quantity} onChange={(v) => onQuantityChange(idx, v)} allowDecimal placeholder="۰" disabled={nonMoneyReadOnly} />
                    </td>
                    {mode === "accounting" && (
                      <td style={{ minWidth: 130 }}>
                        <AmountInput value={row.unitCost} onChange={(v) => onUnitCostChange(idx, v)} allowDecimal placeholder="۰" disabled={!moneyEditable} />
                      </td>
                    )}
                    {mode === "accounting" && (
                      <td style={{ minWidth: 140 }}>
                        <AmountInput value={row.amount} onChange={(v) => onAmountChange(idx, v)} allowDecimal placeholder="۰" disabled={!moneyEditable} />
                      </td>
                    )}
                    {mode === "warehousing" && (
                      <td>
                        <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => removeRow(idx)} disabled={nonMoneyReadOnly}>
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
        </fieldset>

        <div className="grid-footer je-lines-footer">
          <span className="grid-footer-info">
            {rows.length === 0 ? "بدون ردیف" : `${toFaDigits(String(rows.length))} ردیف`}
          </span>
          <span className="je-lines-totals">
            جمع مقدار: {formatAmountFa(totalQuantity)}
            {mode === "accounting" && <> — جمع مبلغ: {formatAmountFa(totalAmount)}</>}
          </span>
        </div>
        </div>

        {focusedRow !== null && rows[focusedRow]?.goodsItemId && (
          <div className="je-breadcrumb">
            <div><b>کالا:</b> {goodsItems.find((g) => g.id === Number(rows[focusedRow].goodsItemId))?.title || "—"}</div>
          </div>
        )}
      </form>
    </FormPage>
  );
}
