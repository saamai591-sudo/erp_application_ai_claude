import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { AmountInput } from "../components/AmountInput";
import { RecordPickerField } from "../components/RecordPicker";
import { TrackingCells } from "../components/TrackingCells";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { ExcelImportButton } from "../components/ExcelImport";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";
import { usePermissions } from "../lib/usePermissions";
import { defaultDocumentDate } from "../lib/fiscalYearDefaultDate";
import { useDocumentForm } from "../lib/useDocumentForm";

// طبق تصمیم معماری «ادغام نمای انبارداری/حسابداری انبار»: این فرم دیگر دو مسیر/دو مود جدا ندارد —
// یک نمای واحد است که ستون‌های مبلغی بر اساس مجوز کاربر نمایش داده می‌شوند، نه بر اساس مسیر URL. دقیقاً
// هم‌الگوی رسید انبار خرید/رسید تولید: کاربر ابتدا «تایید حسابداری» را می‌زند (که سرصفحه/مقدار را قفل
// می‌کند) و بعد از آن فی/مبلغ را وارد می‌کند؛ تا وقتی Finalized نشده، فیلدهای مبلغی اصلاً نمایش داده
// نمی‌شوند، حتی برای کاربر دارای دسترسی «مشاهده اطلاعات حسابداری».
const VIEW_ACCOUNTING_PERMISSION = "inventory.inbound-receipts.warehousing-initial-inventory.viewAccounting";
const CONFIRM_PERMISSION = "inventory.inbound-receipts.warehousing-initial-inventory.accountingConfirm";
const REVERT_PERMISSION = "inventory.inbound-receipts.warehousing-initial-inventory.accountingConfirmRevert";

interface Warehouse { id: number; code: number; title: string; isActive: boolean }
interface UnitOfMeasure { id: number; code: number; title: string }
interface GoodsItemRow {
  id: number;
  fullCode: string;
  title: string;
  mainUnitId: number;
  isActive: boolean;
  kind: string;
  trackingMethod: "NONE" | "BATCH" | "SERIAL";
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
  status: "REGISTERED" | "FINALIZED";
  lineCount: number;
  totalQuantity: number;
  totalAmount?: number;
}

interface DetailLine {
  id: number;
  goodsItemId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitId: number;
  unitTitle: string;
  quantity: number;
  unitCost?: number;
  amount?: number;
  serialIds: number[];
  batchAllocations: { batchId: number; batchNumber: string; expiryDate: string | null; quantity: number }[];
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
  status: "REGISTERED" | "FINALIZED";
  finalizedAt: string | null;
  lines: DetailLine[];
}

const CREATION_TYPE_FA: Record<string, string> = { MANUAL: "دستی", SYSTEM: "سیستمی" };
const STATUS_FA: Record<"REGISTERED" | "FINALIZED", string> = { REGISTERED: "ثبت‌شده", FINALIZED: "تایید حسابداری شده" };

const INFO_TEXT =
  "ثبت موجودی اول دوره برای راه‌اندازی اولیه سیستم؛ برای هر انبار حداکثر یک سند در هر دوره مالی مجاز است. " +
  "سند از همان لحظه‌ی ذخیره در موجودی انبار اثر می‌گذارد. مقدار هر ردیف مستقیماً توسط شما وارد می‌شود. فی/مبلغ فقط پس از " +
  "«تایید حسابداری» و برای کاربر دارای دسترسی مشاهده اطلاعات حسابداری وارد/نمایش داده می‌شود؛ مبلغ = مقدار × فی است — " +
  "اگر مبلغ را ویرایش کنید، فی واحد به‌طور خودکار بازمحاسبه می‌شود.";

export default function InitialInventory() {
  const location = useLocation();
  const { id } = useParams();
  const basePath = "/warehousing/initial-inventory";
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <InitialInventoryForm basePath={basePath} />;
  if (isEdit) return <InitialInventoryForm basePath={basePath} editId={Number(id)} />;
  return <InitialInventoryList basePath={basePath} />;
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function InitialInventoryList({ basePath }: { basePath: string }) {
  const cacheKey = basePath;
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const { hasPermission } = usePermissions();
  const canViewAccounting = hasPermission(VIEW_ACCOUNTING_PERMISSION);

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
    if (row.creationType === "SYSTEM") {
      setError("این سند سیستمی است و از این فرم قابل حذف نیست");
      return;
    }
    try {
      await api.del(`/initial-inventories/${row.id}`);
      await reload();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="موجودی اول دوره" />
          <NewRecordButton path={`${basePath}/new`} />
          <ExcelImportButton
              entityLabel="موجودی اول دوره"
              templateFilename="قالب-موجودی-اول-دوره"
              backendEntityType="initial-inventory"
              columns={[
                { key: "documentGroup", label: "شماره گروه سند", required: true, hint: "ردیف‌هایی با کد انبار، تاریخ و این شماره یکسان، یک سند می‌شوند" },
                { key: "warehouseCode", label: "کد انبار", required: true },
                { key: "date", label: "تاریخ", required: true, hint: "شمسی (مثلاً 1405/05/06) یا میلادی" },
                { key: "description", label: "شرح سند" },
                { key: "goodsItemCode", label: "کد کالا" },
                { key: "goodsItemOldCode", label: "کد کالا (سیستم قدیم)", hint: "برای مهاجرت از سیستم قبلی؛ دقیقاً یکی از این دو ستون باید در هر ردیف پر باشد" },
                { key: "quantity", label: "مقدار", required: true },
                { key: "serialNumber", label: "سریال" },
                { key: "batchNumber", label: "شماره بچ" },
                { key: "expiryDate", label: "تاریخ انقضا" },
                { key: "physicalLocation", label: "محل فیزیکی" },
                { key: "lineDescription", label: "شرح ردیف" },
              ]}
              onDone={reload}
            />
          {canViewAccounting && (
            // طبق طرح جدید («تایید اول، سپس فی») این ورود اکسل فقط روی اسنادی کار می‌کند که از قبل
            // «تایید حسابداری» شده‌اند — دقیقاً هم‌الگوی دکمه‌ی «ذخیره فی/مبلغ» که دیگر با فرم معمول
            // (بعد از تایید حسابداری) جایگزین شده. برای مهاجرت داده، ترتیب کار: ۱) ورود مقدار (این
            // دکمه یا فرم دستی)، ۲) تایید حسابداری هر سند از فرم، ۳) این ورود اکسل برای ثبت فی/مبلغ.
            <ExcelImportButton
              entityLabel="فی/مبلغ موجودی اول دوره (فقط برای اسناد تایید حسابداری‌شده)"
              templateFilename="قالب-فی-موجودی-اول-دوره"
              backendEntityType="initial-inventory-cost"
              columns={[
                { key: "documentGroup", label: "شماره گروه سند", required: true, hint: "ردیف‌هایی با کد انبار، تاریخ و این شماره یکسان، یک رویداد اصلاح فی می‌شوند" },
                { key: "warehouseCode", label: "کد انبار", required: true, hint: "برای یافتن سند موجودی اول دوره‌ی موجود با این انبار و تاریخ" },
                { key: "date", label: "تاریخ", required: true, hint: "شمسی (مثلاً 1405/05/06) یا میلادی" },
                { key: "description", label: "شرح سند" },
                { key: "goodsItemCode", label: "کد کالا" },
                { key: "goodsItemOldCode", label: "کد کالا (سیستم قدیم)", hint: "برای مهاجرت از سیستم قبلی؛ دقیقاً یکی از این دو ستون باید در هر ردیف پر باشد" },
                { key: "quantity", label: "مقدار", hint: "فقط برای تطبیق با ردیف سند موجود؛ مقدار سند تغییر نمی‌کند" },
                { key: "amount", label: "مبلغ", hint: "فی واحد به‌طور خودکار از روی مبلغ ÷ مقدار محاسبه می‌شود" },
                { key: "serialNumber", label: "سریال" },
                { key: "batchNumber", label: "شماره بچ" },
                { key: "expiryDate", label: "تاریخ انقضا" },
                { key: "physicalLocation", label: "محل فیزیکی" },
                { key: "lineDescription", label: "شرح ردیف" },
              ]}
              onDone={reload}
            />
          )}
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "شماره", render: (r) => r.number, width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "انبار", render: (r) => r.warehouseTitle, filterType: "string", filterValue: (r) => r.warehouseTitle },
          { header: "دوره مالی", render: (r) => r.fiscalPeriodTitle, filterType: "string", filterValue: (r) => r.fiscalPeriodTitle },
          { header: "شرح", render: (r) => r.description || "—", filterType: "string", filterValue: (r) => r.description || "" },
          { header: "نوع ایجاد", render: (r) => CREATION_TYPE_FA[r.creationType], filterType: "string", filterValue: (r) => CREATION_TYPE_FA[r.creationType] },
          { header: "تعداد ردیف", render: (r) => r.lineCount },
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
          ...(canViewAccounting ? [{ header: "جمع مبلغ", render: (r: ListRow) => (r.totalAmount != null ? formatAmountFa(r.totalAmount) : "—") }] : []),
        ]}
        rows={items}
        edit={{ path: (r) => `${basePath}/${r.id}/edit` }}
        onDelete={onDelete}
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
  serialIds: string[];
  batchAllocations: { batchId: string; quantity: string }[];
  physicalLocation: string;
}

function emptyRow(): RowState {
  return { goodsItemId: "", unitId: "", quantity: "", unitCost: "", amount: "", serialIds: [], batchAllocations: [], physicalLocation: "" };
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

function mapRows(d: Detail): RowState[] {
  return d.lines.map((l) => ({
    id: l.id,
    goodsItemId: String(l.goodsItemId),
    unitId: String(l.unitId),
    quantity: String(l.quantity),
    unitCost: l.unitCost != null ? String(l.unitCost) : "",
    amount: l.amount != null ? String(l.amount) : "",
    serialIds: l.serialIds.map(String),
    batchAllocations: l.batchAllocations.map((a) => ({ batchId: String(a.batchId), quantity: String(a.quantity) })),
    physicalLocation: l.physicalLocation || "",
  }));
}

function InitialInventoryForm({ editId, basePath }: { editId?: number; basePath: string }) {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canViewAccounting = hasPermission(VIEW_ACCOUNTING_PERMISSION);
  const canConfirm = hasPermission(CONFIRM_PERMISSION);
  const canRevert = hasPermission(REVERT_PERMISSION);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [goodsItems, setGoodsItems] = useState<GoodsItemRow[]>([]);
  const [baseDecimalPlaces, setBaseDecimalPlaces] = useState(2);
  const [focusedRow, setFocusedRow] = useState<number | null>(null);

  const { header, setHeader, rows, setRows, meta, setMeta, fiscalPeriod, error, setError, loaded, saved, flash, submit, remove } = useDocumentForm<
    { warehouseId: string; date: string; description: string },
    RowState,
    Detail
  >({
    endpoint: "initial-inventories",
    editId,
    emptyHeader: (fp) => ({ warehouseId: "", date: defaultDocumentDate(fp), description: "" }),
    emptyRows: () => [emptyRow(), emptyRow()],
    mapDetailToHeader: (d) => ({ warehouseId: String(d.warehouseId), date: d.date.slice(0, 10), description: d.description || "" }),
    mapDetailToRows: mapRows,
    mapDetailToMeta: (d) => ({ number: d.number, status: d.status, creationType: d.creationType, fiscalPeriodTitle: d.fiscalPeriodTitle }),
    dateField: "date",
    loadExtra: async () => {
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
    },
  });

  // طبق طرح جدید چرخه‌ی عمر سند («ثبت‌شده → تایید حسابداری‌شده»): مقدار/کالا/واحد/انبار/تاریخ فقط تا
  // وقتی سند «تایید حسابداری» نشده (یا سیستمی نباشد) قابل ویرایش‌اند؛ بعد از تایید حسابداری، فقط فی/
  // مبلغ (برای کاربر دارای دسترسی مشاهده اطلاعات حسابداری) قابل ویرایش می‌ماند — دقیقاً هم‌الگوی رسید
  // انبار خرید/رسید تولید.
  const isSystemDoc = meta?.creationType === "SYSTEM";
  const isFinalized = meta?.status === "FINALIZED";
  const nonMoneyReadOnly = !!editId && (isFinalized || isSystemDoc);
  const moneyEditable = isFinalized && canViewAccounting && !isSystemDoc;
  // طبق تصمیم صریح کاربر: فیلدهای مبلغی تا وقتی سند Finalized نشده، اصلاً نمایش داده نمی‌شوند — حتی
  // برای کاربر دارای دسترسی «مشاهده اطلاعات حسابداری».
  const showAmount = canViewAccounting && isFinalized;

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
        serialIds: r.serialIds.map(Number),
        batchAllocations: r.batchAllocations.filter((a) => a.batchId).map((a) => ({ batchId: Number(a.batchId), quantity: Number(a.quantity) || 0 })),
        physicalLocation: r.physicalLocation || null,
      })),
    };
  }

  async function onSubmit(e: FormEvent) {
    return submit(e, {
      buildBody,
      validateBody: (body) => {
        if (!header.warehouseId) return "انبار الزامی است";
        if (body.lines.length === 0) return "سند باید حداقل یک ردیف کالا داشته باشد";
        for (const [i, l] of body.lines.entries()) {
          if (!l.unitId) return `واحد سنجش ردیف ${i + 1} الزامی است`;
          if (!(l.quantity > 0)) return `مقدار ردیف ${i + 1} باید عددی مثبت باشد`;
          const item = goodsItems.find((g) => g.id === l.goodsItemId);
          if (item?.trackingMethod === "SERIAL" && l.serialIds.length !== l.quantity) {
            return `ردیف ${i + 1}: تعداد سریال‌های انتخاب‌شده باید با مقدار ردیف برابر باشد`;
          }
          if (item?.trackingMethod === "BATCH") {
            const sum = l.batchAllocations.reduce((s: number, a: any) => s + a.quantity, 0);
            if (Math.abs(sum - l.quantity) > 1e-9) return `ردیف ${i + 1}: مجموع مقدار بچ‌های انتخاب‌شده باید با مقدار ردیف برابر باشد`;
          }
        }
        return null;
      },
      afterCreate: (created) => navigate(`${basePath}/${created.id}/edit`),
    });
  }

  async function handleDelete() {
    await remove(() => navigate(basePath));
  }

  async function reloadDetail() {
    if (!editId) return;
    const d: Detail = await api.get(`/initial-inventories/${editId}`);
    setMeta({ number: d.number, status: d.status, creationType: d.creationType, fiscalPeriodTitle: d.fiscalPeriodTitle });
    setRows(mapRows(d));
  }

  async function handleAccountingConfirm() {
    if (!window.confirm("این سند تایید حسابداری شود؟ پس از تایید، سرصفحه و مقدار ردیف‌ها دیگر قابل ویرایش نخواهند بود.")) return;
    setError(null);
    try {
      await api.post(`/initial-inventories/${editId}/accounting-confirm`);
      await reloadDetail();
      flash();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleAccountingConfirmRevert() {
    if (!window.confirm("تایید حسابداری این سند برگشت بخورد؟ مقادیر فی/مبلغ قبلاً واردشده پاک نمی‌شوند.")) return;
    setError(null);
    try {
      await api.post(`/initial-inventories/${editId}/accounting-confirm-revert`);
      await reloadDetail();
      flash();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  const selectedWarehouseStillListed = warehouses.some((w) => String(w.id) === header.warehouseId);
  const warehouseOptions = warehouses.filter((w) => w.isActive || String(w.id) === header.warehouseId);

  const extraActions = [];
  if (editId && !isSystemDoc && !isFinalized && canConfirm) {
    extraActions.push({ label: "تایید حسابداری", onClick: handleAccountingConfirm });
  }
  if (editId && !isSystemDoc && isFinalized && canRevert) {
    extraActions.push({ label: "برگشت از تایید حسابداری", onClick: handleAccountingConfirmRevert });
  }

  return (
    <FormPage
      title={editId ? "ویرایش موجودی اول دوره" : "موجودی اول دوره جدید"}
      description={
        isSystemDoc
          ? "این سند به‌صورت سیستمی صادر شده و از این فرم قابل ویرایش نیست."
          : isFinalized
          ? "این سند تایید حسابداری شده است؛ سرصفحه، مقدار و کالای ردیف‌ها دیگر قابل ویرایش نیستند."
          : undefined
      }
      formId="initial-inventory-form"
      closePath={basePath}
      newPath={`${basePath}/new`}
      onDelete={editId && !nonMoneyReadOnly ? handleDelete : undefined}
      extraActions={extraActions}
      saveDisabled={nonMoneyReadOnly && !moneyEditable}
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
            <label>نوع ایجاد سند</label>
            <input value={CREATION_TYPE_FA[meta?.creationType || "MANUAL"]} disabled title="در این فاز فقط امکان ثبت دستی موجودی اول دوره فراهم است" />
          </div>
          {meta && (
            <div className="form-field">
              <label>وضعیت</label>
              <div><span className="badge">{STATUS_FA[meta.status]}</span></div>
            </div>
          )}
          <div className="form-field">
            <label>انبار<RequiredMark /></label>
            <select value={header.warehouseId} onChange={(e) => setHeader({ ...header, warehouseId: e.target.value })} disabled={nonMoneyReadOnly}>
              <option value="">انتخاب کنید</option>
              {warehouseOptions.map((w) => (
                <option key={w.id} value={w.id}>{w.title}{!w.isActive ? " (غیرفعال)" : ""}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>تاریخ سند<RequiredMark /></label>
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
          {!nonMoneyReadOnly && (
            <button type="button" className="toolbar-icon-btn primary" onClick={addRow} title="ردیف جدید">
              <PlusIcon />
            </button>
          )}
        </div>
        </fieldset>

        <div className="grid-wrap je-lines-wrap">
        <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
          <table className="je-lines-table">
            <thead>
              <tr>
                <th>ردیف</th>
                <th>کالا</th>
                <th>واحد سنجش</th>
                <th>ردیابی</th>
                <th>محل فیزیکی</th>
                <th>مقدار</th>
                {showAmount && <th>فی واحد</th>}
                {showAmount && <th>مبلغ</th>}
                {!nonMoneyReadOnly && <th></th>}
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
                    <td style={{ minWidth: 110, color: "var(--ink-soft)" }}>
                      {units.find((u) => u.id === item?.mainUnitId)?.title || "—"}
                    </td>
                    <TrackingCells
                      goodsItemId={row.goodsItemId ? Number(row.goodsItemId) : null}
                      item={item}
                      warehouseId={header.warehouseId ? Number(header.warehouseId) : null}
                      documentType="INITIAL_INVENTORY"
                      quantity={Number(row.quantity) || 0}
                      value={row}
                      onChange={(patch) => updateRow(idx, patch)}
                      disabled={nonMoneyReadOnly}
                    />
                    <td style={{ minWidth: 130 }}>
                      <AmountInput value={row.quantity} onChange={(v) => onQuantityChange(idx, v)} allowDecimal placeholder="۰" disabled={nonMoneyReadOnly} />
                    </td>
                    {showAmount && (
                      <td style={{ minWidth: 130 }}>
                        <AmountInput value={row.unitCost} onChange={(v) => onUnitCostChange(idx, v)} allowDecimal placeholder="۰" disabled={!moneyEditable} />
                      </td>
                    )}
                    {showAmount && (
                      <td style={{ minWidth: 140 }}>
                        <AmountInput value={row.amount} onChange={(v) => onAmountChange(idx, v)} allowDecimal placeholder="۰" disabled={!moneyEditable} />
                      </td>
                    )}
                    {!nonMoneyReadOnly && (
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

        <div className="grid-footer je-lines-footer">
          <span className="grid-footer-info">
            {rows.length === 0 ? "بدون ردیف" : `${toFaDigits(String(rows.length))} ردیف`}
          </span>
          <span className="je-lines-totals">
            جمع مقدار: {formatAmountFa(totalQuantity)}
            {showAmount && <> — جمع مبلغ: {formatAmountFa(totalAmount)}</>}
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
