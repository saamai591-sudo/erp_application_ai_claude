import { FormEvent, useEffect, useRef, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { Modal } from "../components/Modal";
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
import { DownstreamMenu } from "../components/DownstreamMenu";
import { RECEIPT_DOWNSTREAM_ACTIONS } from "../components/DownstreamDialogs";
import { DescriptionField } from "../components/DescriptionField";
import { DocDetailHeaderFields, DocDetailItemHeadCells, DocDetailItemCells } from "../components/WarehouseDocDetailFields";
import { DetailValues, DetailValueDto, useDocDetailConfig, detailsToValues, valuesToPayload, changeHeaderDetail, newRowDetails } from "../lib/warehouseDocDetails";
import { PlusIcon } from "../components/icons";
import { toEnglishDigits } from "../lib/digits";

// این فرآیند («رسید انبار خرید») مستند تحلیل اختصاصی در پروژه ندارد؛ ساختار این فرم حاصل تصمیم
// مشترک با کاربر است (نگاه کنید به یادداشت‌های backend/src/routes/warehouseReceipts.ts). طبق تصمیم
// معماری «ادغام نمای انبارداری/حسابداری انبار»: این فرم دیگر دو مسیر/دو مود جدا ندارد — یک نمای
// واحد است که ستون‌های مبلغی بر اساس مجوز کاربر نمایش/عدم‌نمایش داده می‌شوند (نه بر اساس مسیر URL).
// این سند هیچ اقدام «تایید حسابداری» کلیک‌شدنی روی خودش ندارد — طبق تصمیم صریح کاربر، فقط با تایید
// فاکتور خرید (purchaseInvoices.ts) مبتنی بر آن Finalized می‌شود؛ فی/مبلغ هم فقط از همان مسیر نوشته
// می‌شود، نه از این فرم. تا وقتی Finalized نشده، فیلدهای مبلغی اصلاً نمایش داده نمی‌شوند، حتی برای
// کاربر دارای دسترسی «مشاهده اطلاعات حسابداری».
const VIEW_ACCOUNTING_PERMISSION = "inventory.inbound-receipts.warehousing-warehouse-receipts.viewAccounting";

type Basis = "NO_BASIS" | "SUPPLY_REQUEST" | "PURCHASE_ORDER" | "DELIVERY_AUTHORIZATION" | "TEMP_RECEIPT";
type DocStatus = "REGISTERED" | "FINALIZED";

interface Warehouse { id: number; code: number; title: string; isActive: boolean }
// «طرف مقابل» یک رسید انبار خرید همیشه باید تامین‌کننده‌ی فعال باشد، نه هر طرف‌حسابی — طبق تصمیم صریح
// کاربر («انتخابگر تفصیل پایه»)، این فهرست دیگر از /suppliers خوانده نمی‌شود؛ از اندپوینت مشترک
// /detail-selector-options با شرط SUPPLIER_PARTY خوانده می‌شود (همان شرطی که بک‌اند در لحظه‌ی ذخیره هم
// دوباره چک می‌کند — نگاه کنید به services/detailSelector.ts). فقط code/title دارد.
interface PartyOption {
  /** برابر code — فقط برای برآوردن الزام id در RecordPickerField (کد تفصیل، خودش یکتاست) */
  id: string;
  code: string;
  title: string;
}
interface GoodsItemRow {
  id: number;
  fullCode: string;
  barcode?: string | null;
  title: string;
  mainUnitId: number;
  mainUnit?: { title: string };
  isActive: boolean;
  kind: string;
  trackingMethod: "NONE" | "BATCH" | "SERIAL";
  isLocationTracked: boolean;
}

interface PickableLine {
  id: number;
  sourceSupplyRequestLineId?: number;
  sourcePurchaseOrderLineId?: number;
  sourceDeliveryAuthorizationLineId?: number;
  sourceTempReceiptLineId?: number;
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
  totalAmount?: number;
}

interface DetailLine {
  id: number;
  sourceSupplyRequestLineId: number | null;
  sourcePurchaseOrderLineId: number | null;
  sourceDeliveryAuthorizationLineId: number | null;
  sourceTempReceiptLineId: number | null;
  goodsItemId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitId: number;
  unitTitle: string;
  quantity: number;
  unitCost?: number;
  amount?: number;
  description: string | null;
  serialIds: number[];
  batchAllocations: { batchId: number; batchNumber: string; expiryDate: string | null; quantity: number }[];
  physicalLocation: string | null;
  details?: DetailValueDto[];
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
  partyDetailCode: string | null;
  partyTitle: string | null;
  description: string | null;
  status: DocStatus;
  finalizedAt: string | null;
  lines: DetailLine[];
  details?: DetailValueDto[];
}

const BASIS_FA: Record<Basis, string> = {
  NO_BASIS: "بدون مبنا",
  SUPPLY_REQUEST: "درخواست تامین",
  PURCHASE_ORDER: "سفارش خرید",
  DELIVERY_AUTHORIZATION: "مجوز تحویل",
  TEMP_RECEIPT: "رسید موقت",
};
const STATUS_FA: Record<DocStatus, string> = { REGISTERED: "ثبت‌شده", FINALIZED: "تایید حسابداری شده" };
const PICKABLE_ENDPOINT: Record<Exclude<Basis, "NO_BASIS">, string> = {
  SUPPLY_REQUEST: "/warehouse-receipts/pickable-supply-request-lines",
  PURCHASE_ORDER: "/warehouse-receipts/pickable-purchase-order-lines",
  DELIVERY_AUTHORIZATION: "/warehouse-receipts/pickable-delivery-authorization-lines",
  TEMP_RECEIPT: "/warehouse-receipts/pickable-temp-receipt-lines",
};
const SOURCE_FIELD: Record<Exclude<Basis, "NO_BASIS">, keyof PickableLine> = {
  SUPPLY_REQUEST: "sourceSupplyRequestLineId",
  PURCHASE_ORDER: "sourcePurchaseOrderLineId",
  DELIVERY_AUTHORIZATION: "sourceDeliveryAuthorizationLineId",
  TEMP_RECEIPT: "sourceTempReceiptLineId",
};
const SOURCE_LABEL: Record<Exclude<Basis, "NO_BASIS">, string> = {
  SUPPLY_REQUEST: "درخواست تامین مبدا",
  PURCHASE_ORDER: "سفارش خرید مبدا",
  DELIVERY_AUTHORIZATION: "مجوز تحویل مبدا",
  TEMP_RECEIPT: "رسید موقت مبدا",
};

const INFO_TEXT =
  "ثبت رسید انبار برای کالاهای دریافتی از تامین‌کننده. مبنا می‌تواند بدون مبنا، درخواست تامین، سفارش خرید، مجوز تحویل یا رسید موقت (کالای تاییدشده‌ی انبار قرنطینه؛ انبار رسید می‌تواند با انبار رسید موقت فرق کند) باشد؛ " +
  "در حالت‌های دارای مبنا، هر ردیف از یک ردیف تایید‌شده و دارای مانده انتخاب می‌شود. سند از همان لحظه‌ی ذخیره در موجودی انبار اثر " +
  "می‌گذارد و مقدار مستقیماً توسط شما وارد می‌شود؛ فی/مبلغ فقط پس از «تایید حسابداری» توسط کاربر دارای دسترسی حسابداری انبار وارد می‌شود.";

export default function WarehouseReceipts() {
  const location = useLocation();
  const { id } = useParams();
  const basePath = "/warehousing/warehouse-receipts";
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <WarehouseReceiptForm basePath={basePath} />;
  if (isEdit) return <WarehouseReceiptForm basePath={basePath} editId={Number(id)} />;
  return <WarehouseReceiptList basePath={basePath} />;
}

function WarehouseReceiptList({ basePath }: { basePath: string }) {
  const cacheKey = basePath;
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const { hasPermission } = usePermissions();
  const canViewAccounting = hasPermission(VIEW_ACCOUNTING_PERMISSION);

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
    try {
      await api.del(`/warehouse-receipts/${row.id}`);
      await reload();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="رسید انبار خرید" />
          <NewRecordButton path={`${basePath}/new`} />
          <ExcelImportButton
            entityLabel="رسید انبار خرید"
            templateFilename="قالب-رسید-انبار-خرید"
            backendEntityType="warehouse-receipt"
            allowDuplicateOption
            columns={[
              { key: "warehouseCode", label: "کد انبار", required: true },
              { key: "date", label: "تاریخ", required: true, hint: "شمسی (مثلاً 1405/05/06) یا میلادی" },
              { key: "number", label: "شماره سند", required: true, hint: "همان شماره‌ی سند در سیستم قبلی؛ هم برای گروه‌بندی ردیف‌های یک سند (با کد انبار و تاریخ) و هم به‌عنوان شماره‌ی نهایی سند استفاده می‌شود — باید در این دوره مالی یکتا باشد" },
              { key: "partyDetailCode", label: "کد تفصیل طرف مقابل", required: true },
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
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "انبار", render: (r) => r.warehouseTitle, filterType: "string", filterValue: (r) => r.warehouseTitle },
          { header: "مبنا", render: (r) => BASIS_FA[r.basis], filterType: "string", filterValue: (r) => BASIS_FA[r.basis] },
          { header: "طرف مقابل", render: (r) => r.partyTitle || "—", filterType: "string", filterValue: (r) => r.partyTitle || "" },
          { header: "شرح", render: (r) => r.description || "—", filterType: "string", filterValue: (r) => r.description || "" },
          { header: "تعداد ردیف", render: (r) => toFaDigits(String(r.lineCount)) },
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
          ...(canViewAccounting ? [{ header: "جمع مبلغ", render: (r: ListRow) => (r.totalAmount != null ? formatAmountFa(r.totalAmount) : "—"), filterType: "number" as const, filterValue: (r: ListRow) => r.totalAmount ?? undefined, decimal: true }] : []),
        ]}
        rows={items}
        edit={{ path: (r) => `${basePath}/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

interface RowState {
  sourceSupplyRequestLineId: string;
  sourcePurchaseOrderLineId: string;
  sourceDeliveryAuthorizationLineId: string;
  sourceTempReceiptLineId: string;
  sourceNumber: string;
  goodsItemId: string;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitId: string;
  unitTitle: string;
  quantity: string;
  unitCost: string;
  amount: string;
  description: string;
  serialIds: string[];
  batchAllocations: { batchId: string; quantity: string }[];
  physicalLocation: string;
  details?: DetailValues;
}

function emptyRow(): RowState {
  return {
    sourceSupplyRequestLineId: "",
    sourcePurchaseOrderLineId: "",
    sourceDeliveryAuthorizationLineId: "",
    sourceTempReceiptLineId: "",
    sourceNumber: "",
    goodsItemId: "",
    goodsItemCode: "",
    goodsItemTitle: "",
    unitId: "",
    unitTitle: "",
    quantity: "",
    unitCost: "",
    amount: "",
    description: "",
    serialIds: [],
    batchAllocations: [],
    physicalLocation: "",
  };
}

function mapRows(d: Detail): RowState[] {
  return d.lines.map((l) => ({
    sourceSupplyRequestLineId: l.sourceSupplyRequestLineId ? String(l.sourceSupplyRequestLineId) : "",
    sourcePurchaseOrderLineId: l.sourcePurchaseOrderLineId ? String(l.sourcePurchaseOrderLineId) : "",
    sourceDeliveryAuthorizationLineId: l.sourceDeliveryAuthorizationLineId ? String(l.sourceDeliveryAuthorizationLineId) : "",
    sourceTempReceiptLineId: l.sourceTempReceiptLineId ? String(l.sourceTempReceiptLineId) : "",
    sourceNumber: "",
    goodsItemId: String(l.goodsItemId),
    goodsItemCode: l.goodsItemCode,
    goodsItemTitle: l.goodsItemTitle,
    unitId: String(l.unitId),
    unitTitle: l.unitTitle,
    quantity: String(l.quantity),
    unitCost: l.unitCost != null ? String(l.unitCost) : "",
    amount: l.amount != null ? String(l.amount) : "",
    description: l.description || "",
    serialIds: l.serialIds.map(String),
    batchAllocations: l.batchAllocations.map((a) => ({ batchId: String(a.batchId), quantity: String(a.quantity) })),
    physicalLocation: l.physicalLocation || "",
    details: detailsToValues(l.details),
  }));
}

function WarehouseReceiptForm({ editId, basePath }: { editId?: number; basePath: string }) {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canViewAccounting = hasPermission(VIEW_ACCOUNTING_PERMISSION);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [goodsItems, setGoodsItems] = useState<GoodsItemRow[]>([]);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [pickableLines, setPickableLines] = useState<PickableLine[]>([]);
  const [barcode, setBarcode] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const detailConfig = useDocDetailConfig("WAREHOUSE_RECEIPT");
  const { header, setHeader, rows, setRows, meta, error, setError, loaded, submit, remove } = useDocumentForm<
    { date: string; basis: Basis; warehouseId: string; partyDetailCode: string; description: string; details: DetailValues },
    RowState,
    Detail
  >({
    endpoint: "warehouse-receipts",
    editId,
    emptyHeader: (fp) => ({ date: defaultDocumentDate(fp), basis: "NO_BASIS", warehouseId: "", partyDetailCode: "", description: "", details: {} }),
    emptyRows: () => [emptyRow()],
    mapDetailToHeader: (d) => ({ date: d.date.slice(0, 10), basis: d.basis, warehouseId: String(d.warehouseId), partyDetailCode: d.partyDetailCode || "", description: d.description || "", details: detailsToValues(d.details) }),
    mapDetailToRows: mapRows,
    mapDetailToMeta: (d) => ({ number: d.number, status: d.status, fiscalPeriodTitle: d.fiscalPeriodTitle }),
    loadExtra: async () => {
      const [whs, items, partyOptions]: [Warehouse[], GoodsItemRow[], { code: string; title: string }[]] = await Promise.all([
        api.get("/warehouses"),
        api.get("/goods-items?kind=GOODS&docDirection=INBOUND&docType=خرید"),
        api.get("/detail-selector-options?kind=SUPPLIER_PARTY"),
      ]);
      setWarehouses(whs);
      setGoodsItems(items);
      setParties(partyOptions.map((p) => ({ id: p.code, code: p.code, title: p.title })));
    },
  });

  useEffect(() => {
    if (header.basis === "NO_BASIS") {
      setPickableLines([]);
      return;
    }
    const params = new URLSearchParams();
    if (header.date) params.set("destDate", header.date);
    // برای مبنای سفارش خرید/مجوز تحویل، فقط مبناهایی نشان داده می‌شوند که تامین‌کننده‌شان با «طرف
    // مقابل» انتخاب‌شده در هدر یکی است
    if ((header.basis === "PURCHASE_ORDER" || header.basis === "DELIVERY_AUTHORIZATION" || header.basis === "TEMP_RECEIPT") && header.partyDetailCode) {
      params.set("partyDetailCode", header.partyDetailCode);
    }
    const q = params.toString() ? `?${params.toString()}` : "";
    api
      .get(`${PICKABLE_ENDPOINT[header.basis]}${q}`)
      .then((rows: PickableLine[]) => setPickableLines(rows))
      .catch(() => setPickableLines([]));
  }, [header.basis, header.date, header.partyDetailCode]);

  const hasAnyLine = rows.some((r) => r.goodsItemId || r.sourceSupplyRequestLineId || r.sourcePurchaseOrderLineId || r.sourceDeliveryAuthorizationLineId || r.sourceTempReceiptLineId);
  // طبق طرح جدید چرخه‌ی عمر سند («ثبت‌شده → تایید حسابداری‌شده»): بعد از تایید حسابداری، سرصفحه/مقدار/
  // کالای ردیف‌ها برای همه (از جمله کاربر انباردار) قفل می‌شود. فی/مبلغ هرگز از این فرم ویرایش نمی‌شود
  // (فقط از طریق تایید فاکتور خرید مبتنی بر این رسید — نگاه کنید به یادداشت بالای فایل).
  const isFinalized = meta?.status === "FINALIZED";
  const coreDisabled = isFinalized;
  // طبق تصمیم صریح کاربر: به‌محض این‌که یک ردیف انتخاب/وارد شده باشد، کل سرصفحه (انبار/تاریخ/مبنا/
  // طرف مقابل/شرح) قفل می‌شود — چون ردیف‌ها بر اساس سرصفحه انتخاب و ثبت شده‌اند و تغییر بعدی سرصفحه
  // ناسازگاری ایجاد می‌کند.
  const headerDisabled = coreDisabled || hasAnyLine;

  // طبق تصمیم صریح کاربر: تا وقتی فیلدهای الزامی سرصفحه (تاریخ/انبار/طرف مقابل) کامل نشده، ورود
  // اطلاعات ردیف مجاز نیست — اولین تلاش برای باز کردن انتخابگر کالا/ردیف مبنا باید با پیام خطا رد شود.
  function guardRowEntry(): boolean {
    if (!header.date) {
      setError("تاریخ سند الزامی است");
      return false;
    }
    if (!header.warehouseId) {
      setError("انبار الزامی است");
      return false;
    }
    if (!header.partyDetailCode) {
      setError("طرف مقابل الزامی است");
      return false;
    }
    setError(null);
    return true;
  }

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
      sourceTempReceiptLineId: header.basis === "TEMP_RECEIPT" ? sourceLineId : "",
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
    setRows((prev) => [...prev, { ...emptyRow(), details: newRowDetails(detailConfig, header.details) }]);
  }

  // ورود بارکد: تطبیق مستقیم با بارکد/کد کالا، وگرنه «تفسیر بارکد» (کالا و خدمت › تنظیمات) کالا، مقدار، سریال و بچ را استخراج می‌کند.
  // سریال/بچ استخراج‌شده در همان دیالوگ ردیابی ردیف ست می‌شود (سریالِ تعریف‌شده‌ی قابل‌انتخاب برای این نوع سند / بچِ تعریف‌شده‌ی کالا).
  // بدون مبنا: ردیف کالا؛ با مبنا: همان کالا از ردیف‌های قابل انتخابِ مبنا (فقط ردیفِ مبنا؛ مقدار را سرور کنترل می‌کند).
  // پردازشِ یک بارکد؛ پیام خطا یا null برمی‌گرداند. تغییر ردیف‌ها فقط با به‌روزرسانی تابعی است تا چند بارکد پشت‌سرهم (ورود تجمعی) درست جمع شوند.
  const scannedSerials = useRef<Set<string>>(new Set());
  useEffect(() => {
    scannedSerials.current = new Set(rows.flatMap((r) => r.serialIds.map((id) => `${r.goodsItemId}:${id}`)));
  }, [rows]);

  async function processBarcode(raw: string): Promise<string | null> {
    const code = toEnglishDigits(raw.trim());
    if (!code) return null;
    let itemId: number | null = null;
    let qty = 1;
    let serialText: string | null = null;
    let batchText: string | null = null;
    const direct = goodsItems.find((g) => g.isActive && (g.barcode === code || g.fullCode === code));
    if (direct) itemId = direct.id;
    else {
      try {
        const { result } = await api.post("/barcode-interpretations/interpret", { barcode: code });
        if (result?.goodsItemId == null) return result?.error ?? `بارکد/کد «${code}» یافت نشد`;
        itemId = result.goodsItemId;
        if (result.quantity != null && result.quantity > 0) qty = result.quantity;
        serialText = result.serial ?? null;
        batchText = result.batch ?? null;
      } catch (e) {
        return (e as ApiError).message;
      }
    }
    const item = goodsItems.find((g) => g.id === itemId);
    if (!item) return "کالای بارکد در فهرست کالاها نیست";

    // سریال/بچ استخراج‌شده را به شناسه‌ی رکورد تعریف‌شده تبدیل می‌کنیم (همان فهرستی که دیالوگ ردیابی نشان می‌دهد)
    let serialId: string | null = null;
    let batchId: string | null = null;
    if (item.trackingMethod === "SERIAL" && serialText) {
      try {
        const list: { id: number; serialNumber: string }[] = await api.get(`/serials/pickable?documentType=WAREHOUSE_RECEIPT&goodsItemId=${item.id}`);
        const hit = list.find((x) => x.serialNumber === serialText);
        if (!hit) return `سریال «${serialText}» برای «${item.title}» تعریف نشده یا برای رسید انبار قابل انتخاب نیست`;
        serialId = String(hit.id);
      } catch (e) {
        return (e as ApiError).message;
      }
      const key = `${item.id}:${serialId}`;
      if (scannedSerials.current.has(key)) return `سریال «${serialText}» قبلاً در ردیف‌ها آمده است`;
      scannedSerials.current.add(key);
      qty = 1; // هر سریال یک واحد است
    } else if (item.trackingMethod === "BATCH" && batchText) {
      try {
        const list: { id: number; batchNumber: string; isActive: boolean }[] = await api.get(`/batches?goodsItemId=${item.id}`);
        const hit = list.find((x) => x.batchNumber === batchText && x.isActive);
        if (!hit) return `بچ «${batchText}» برای «${item.title}» تعریف نشده یا غیرفعال است`;
        batchId = String(hit.id);
      } catch (e) {
        return (e as ApiError).message;
      }
    }

    const add = (x: number, y: number) => Math.round((x + y) * 1e6) / 1e6;
    // مقدار را اضافه می‌کند و سریال/بچ را (اگر از بارکد آمده) به ردیف می‌افزاید
    const applyTrack = (r: RowState): RowState => {
      const q = String(add(Number(r.quantity) || 0, qty));
      if (serialId) return { ...r, quantity: q, serialIds: [...r.serialIds, serialId] };
      if (batchId) {
        const has = r.batchAllocations.some((x) => x.batchId === batchId);
        return {
          ...r,
          quantity: q,
          batchAllocations: has
            ? r.batchAllocations.map((x) => (x.batchId === batchId ? { ...x, quantity: String(add(Number(x.quantity) || 0, qty)) } : x))
            : [...r.batchAllocations, { batchId, quantity: String(qty) }],
        };
      }
      return { ...r, quantity: q };
    };
    // ردیف‌های هم‌کالا فقط وقتی ادغام می‌شوند که ردیابی اجازه دهد (بدون ردیابی، یا سریال/بچ از بارکد آمده باشد)
    const mergeable = item.trackingMethod === "NONE" || (item.trackingMethod === "SERIAL" && !!serialId) || (item.trackingMethod === "BATCH" && !!batchId);

    if (header.basis === "NO_BASIS") {
      setRows((prev) => {
        const i = prev.findIndex((r) => r.goodsItemId === String(item.id) && mergeable);
        if (i >= 0) return prev.map((r, k) => (k === i ? applyTrack(r) : r));
        const blank = prev.findIndex((r) => !r.goodsItemId && !r.quantity);
        const row = applyTrack({ ...emptyRow(), goodsItemId: String(item.id), goodsItemCode: item.fullCode, goodsItemTitle: item.title, unitId: String(item.mainUnitId), unitTitle: item.mainUnit?.title ?? "", quantity: "0", details: newRowDetails(detailConfig, header.details) });
        return blank >= 0 ? prev.map((r, k) => (k === blank ? row : r)) : [...prev, row];
      });
      return null;
    }
    const field = SOURCE_FIELD[header.basis];
    const srcOf = (r: RowState) => (field === "sourceSupplyRequestLineId" ? r.sourceSupplyRequestLineId : field === "sourcePurchaseOrderLineId" ? r.sourcePurchaseOrderLineId : field === "sourceTempReceiptLineId" ? r.sourceTempReceiptLineId : r.sourceDeliveryAuthorizationLineId);
    const cand = pickableLines.filter((l) => l.goodsItemId === item.id);
    if (cand.length === 0) return `«${item.title}» در ردیف‌های قابل انتخاب مبنای این سند نیست`;
    setRows((prev) => {
      const existing = cand.find((l) => prev.some((r) => srcOf(r) === String(l[field])));
      if (existing) return prev.map((r) => (srcOf(r) === String(existing[field]) ? applyTrack(r) : r));
      const src = cand[0];
      return [
        ...prev.filter((r) => r.goodsItemId || r.sourceSupplyRequestLineId || r.sourcePurchaseOrderLineId || r.sourceDeliveryAuthorizationLineId || r.sourceTempReceiptLineId),
        applyTrack({
          ...emptyRow(),
          sourceSupplyRequestLineId: header.basis === "SUPPLY_REQUEST" ? String(src[field]) : "",
          sourcePurchaseOrderLineId: header.basis === "PURCHASE_ORDER" ? String(src[field]) : "",
          sourceDeliveryAuthorizationLineId: header.basis === "DELIVERY_AUTHORIZATION" ? String(src[field]) : "",
          sourceTempReceiptLineId: header.basis === "TEMP_RECEIPT" ? String(src[field]) : "",
          sourceNumber: String(src.number),
          goodsItemId: String(src.goodsItemId),
          goodsItemCode: src.goodsItemCode,
          goodsItemTitle: src.goodsItemTitle,
          unitId: String(src.unitId),
          unitTitle: src.unitTitle,
          quantity: "0",
          details: newRowDetails(detailConfig, header.details),
        }),
      ];
    });
    return null;
  }

  async function onBarcodeEnter() {
    const code = barcode;
    if (!code.trim()) return;
    setBarcode("");
    const err = await processBarcode(code);
    setError(err);
  }

  // «بارکد تجمیعی»: هر خط یک بارکد؛ خط‌ها یکی‌یکی تفسیر و اعمال می‌شوند. خط‌های ناموفق در کادر می‌مانند تا اصلاح شوند.
  async function applyBulkBarcodes() {
    const lines = bulkText.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    if (lines.length === 0) return setBulkOpen(false);
    setBulkBusy(true);
    const failed: string[] = [];
    const messages: string[] = [];
    for (const [i, line] of lines.entries()) {
      const err = await processBarcode(line);
      if (err) {
        failed.push(line);
        messages.push(`خط ${i + 1} (${line}): ${err}`);
      }
    }
    setBulkBusy(false);
    setBulkErrors(messages);
    setBulkText(failed.join("\n"));
    if (failed.length === 0) setBulkOpen(false);
  }
  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  const totalQuantity = rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const totalAmount = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  function buildBody() {
    const nonEmptyRows = rows.filter((r) => r.goodsItemId || r.sourceSupplyRequestLineId || r.sourcePurchaseOrderLineId || r.sourceDeliveryAuthorizationLineId || r.sourceTempReceiptLineId);
    return {
      date: header.date,
      basis: header.basis,
      warehouseId: Number(header.warehouseId),
      partyDetailCode: header.partyDetailCode || null,
      description: header.description,
      details: valuesToPayload(header.details),
      lines: nonEmptyRows.map((r) => ({
        details: valuesToPayload(r.details),
        sourceSupplyRequestLineId: r.sourceSupplyRequestLineId ? Number(r.sourceSupplyRequestLineId) : null,
        sourcePurchaseOrderLineId: r.sourcePurchaseOrderLineId ? Number(r.sourcePurchaseOrderLineId) : null,
        sourceDeliveryAuthorizationLineId: r.sourceDeliveryAuthorizationLineId ? Number(r.sourceDeliveryAuthorizationLineId) : null,
        sourceTempReceiptLineId: r.sourceTempReceiptLineId ? Number(r.sourceTempReceiptLineId) : null,
        goodsItemId: r.goodsItemId ? Number(r.goodsItemId) : undefined,
        unitId: Number(r.unitId),
        quantity: Number(r.quantity) || 0,
        description: r.description || null,
        serialIds: r.serialIds.map(Number),
        batchAllocations: r.batchAllocations.filter((a) => a.batchId).map((a) => ({ batchId: Number(a.batchId), quantity: Number(a.quantity) || 0 })),
        physicalLocation: r.physicalLocation || null,
      })),
    };
  }

  function onSubmit(e: FormEvent) {
    return submit(e, {
      buildBody,
      validateBody: (body) => {
        if (!header.warehouseId) return "انبار الزامی است";
        if (!header.partyDetailCode) return "طرف مقابل الزامی است";
        if (body.lines.length === 0) return "رسید انبار باید حداقل یک ردیف کالا داشته باشد";
        for (const [i, l] of body.lines.entries()) {
          if (header.basis === "SUPPLY_REQUEST" && !l.sourceSupplyRequestLineId) return `ردیف ${i + 1}: انتخاب ردیف درخواست تامین الزامی است`;
          if (header.basis === "PURCHASE_ORDER" && !l.sourcePurchaseOrderLineId) return `ردیف ${i + 1}: انتخاب ردیف سفارش خرید الزامی است`;
          if (header.basis === "DELIVERY_AUTHORIZATION" && !l.sourceDeliveryAuthorizationLineId) return `ردیف ${i + 1}: انتخاب ردیف مجوز تحویل الزامی است`;
          if (header.basis === "TEMP_RECEIPT" && !l.sourceTempReceiptLineId) return `ردیف ${i + 1}: انتخاب ردیف رسید موقت الزامی است`;
          if (header.basis === "NO_BASIS" && !l.goodsItemId) return `کالا برای ردیف ${i + 1} الزامی است`;
          if (!(l.quantity > 0)) return `مقدار ردیف ${i + 1} باید عددی مثبت باشد`;
        }
        return null;
      },
      afterCreate: (created) => navigate(`${basePath}/${created.id}/edit`),
    });
  }

  async function handleDelete() {
    await remove(() => navigate(basePath));
  }

  if (!loaded) return null;

  const selectedWarehouseStillListed = warehouses.some((w) => String(w.id) === header.warehouseId);
  const warehouseOptions = warehouses.filter((w) => w.isActive || String(w.id) === header.warehouseId);
  const selectedParty = parties.find((p) => p.code === header.partyDetailCode);
  const hasSourceColumn = header.basis !== "NO_BASIS";
  // طبق تصمیم صریح کاربر: فیلدهای مبلغی تا وقتی سند Finalized نشده، اصلاً نمایش داده نمی‌شوند — حتی
  // برای کاربر دارای دسترسی «مشاهده اطلاعات حسابداری».
  const showAmount = canViewAccounting && isFinalized;

  return (
    <FormPage
      title={editId ? "ویرایش رسید انبار خرید" : "رسید انبار خرید جدید"}
      description={
        isFinalized
          ? "این رسید با تایید فاکتور خرید مبتنی بر آن نهایی شده است؛ سرصفحه، مقدار و کالای ردیف‌ها دیگر قابل ویرایش نیستند."
          : undefined
      }
      formId="warehouse-receipt-form"
      closePath={basePath}
      newPath={`${basePath}/new`}
      onDelete={editId && !isFinalized ? handleDelete : undefined}
      saveDisabled={isFinalized}
      toolbarExtra={editId ? <DownstreamMenu actions={RECEIPT_DOWNSTREAM_ACTIONS} sourceId={editId} disabledReason={isFinalized ? "این رسید قبلاً با فاکتور خرید قطعی شده است" : null} /> : undefined}
      wide
    >
      <form id="warehouse-receipt-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />

        {meta && (
          <div className="form-field" style={{ maxWidth: 220, marginBottom: 8 }}>
            <label>وضعیت</label>
            <div><span className="badge">{STATUS_FA[meta.status]}</span></div>
          </div>
        )}

        <fieldset disabled={coreDisabled} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="je-header-grid" style={{ marginBottom: 6, maxWidth: 900 }}>
            <div className="form-field">
              <label>شماره</label>
              <input dir="ltr" value={meta ? toFaDigits(String(meta.number)) : "خودکار پس از ذخیره"} disabled />
            </div>
            <div className="form-field">
              <label>دوره مالی</label>
              <input value={meta?.fiscalPeriodTitle ?? "بر اساس تاریخ سند"} disabled />
            </div>
            <div className="form-field">
              <label>انبار<RequiredMark /></label>
              <select value={header.warehouseId} onChange={(e) => setHeader({ ...header, warehouseId: e.target.value })} disabled={headerDisabled}>
                <option value="">انتخاب کنید</option>
                {warehouseOptions.map((w) => (
                  <option key={w.id} value={w.id}>{w.title}{!w.isActive ? " (غیرفعال)" : ""}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>تاریخ سند<RequiredMark /></label>
              <JalaliDatePicker fiscalYear value={header.date} onChange={(v) => setHeader({ ...header, date: v })} disabled={headerDisabled} />
            </div>
            <div className="form-field">
              <label>مبنا</label>
              <select value={header.basis} onChange={(e) => setHeader({ ...header, basis: e.target.value as Basis })} disabled={headerDisabled}>
                {(Object.keys(BASIS_FA) as Basis[]).map((b) => (
                  <option key={b} value={b}>{BASIS_FA[b]}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>طرف مقابل<RequiredMark /></label>
              <RecordPickerField
                title="انتخاب طرف مقابل"
                disabled={headerDisabled}
                displayValue={selectedParty ? `${toFaDigits(selectedParty.code)} — ${selectedParty.title}` : ""}
                rows={parties}
                columns={[
                  { header: "کد", render: (p) => toFaDigits(p.code), filterValue: (p) => p.code, width: "90px" },
                  { header: "عنوان", render: (p) => p.title, filterValue: (p) => p.title },
                ]}
                onSelect={(p) => setHeader({ ...header, partyDetailCode: (p as PartyOption).code })}
              />
            </div>
            <DocDetailHeaderFields
              config={detailConfig}
              values={header.details}
              disabled={headerDisabled}
              onChange={(typeId, code) => {
                const next = changeHeaderDetail(detailConfig, header, rows, typeId, code);
                setHeader(next.header);
                setRows(next.rows);
              }}
            />
            <div className="form-field full">
              <DescriptionField value={header.description} onChange={(v) => setHeader({ ...header, description: v })} disabled={headerDisabled} />
            </div>
            {!selectedWarehouseStillListed && header.warehouseId && (
              <div className="form-field full">
                <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>این انبار دیگر در فهرست انبارها یافت نشد</span>
              </div>
            )}
          </div>

          {!coreDisabled && (
            <div className="je-lines-toolbar">
              <div style={{ display: "flex", alignItems: "center" }}>
              <span className="je-lines-title" style={{ marginInlineEnd: 6 }}>ردیف‌های کالا</span>
              <input
                dir="ltr"
                inputMode="text"
                placeholder="بارکد کالا — Enter"
                style={{ width: 200, margin: 0, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onBarcodeEnter();
                  }
                }}
                title="بارکد یا کد کالا را وارد/اسکن کنید و Enter بزنید؛ با «تفسیر بارکد» کالا و مقدار از بارکد استخراج می‌شود"
              />
              <button type="button" className="btn secondary" style={{ padding: "4px 10px", fontSize: 12, margin: 0, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: 0 }} onClick={() => { setBulkErrors([]); setBulkOpen(true); }} title="چندین بارکد را یک‌جا (هر خط یک بارکد) وارد کنید">
                بارکد تجمیعی
              </button>
              </div>
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
                  <th>ردیابی</th>
                  <th>محل فیزیکی</th>
                  <th>مقدار</th>
                  {showAmount && <th>فی واحد</th>}
                  {showAmount && <th>مبلغ</th>}
                  <DocDetailItemHeadCells config={detailConfig} />
                  <th>شرح</th>
                  {!coreDisabled && <th></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const item = goodsItems.find((g) => g.id === Number(row.goodsItemId));
                  const pickerRows = item && !item.isActive ? goodsItems : goodsItems.filter((g) => g.isActive);
                  const field = header.basis !== "NO_BASIS" ? SOURCE_FIELD[header.basis] : null;
                  const selectedSourceId = field ? (row as any)[field] : "";
                  const src = field ? pickableLines.find((l) => String(l[field]) === selectedSourceId) : undefined;
                  const sourceDisplay = src ? `${toFaDigits(String(src.number))}` : row.sourceNumber ? toFaDigits(row.sourceNumber) : "";
                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                      {hasSourceColumn && (
                        <td style={{ minWidth: 90 }}>
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
                            onOpen={guardRowEntry}
                            onSelect={(l) => onSourceLineChange(idx, String((l as PickableLine)[SOURCE_FIELD[header.basis as Exclude<Basis, "NO_BASIS">]]))}
                          />
                        </td>
                      )}
                      <td style={{ minWidth: 320 }}>
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
                            onOpen={guardRowEntry}
                            onSelect={(g) => onGoodsItemChange(idx, String(g.id))}
                          />
                        )}
                      </td>
                      <td style={{ minWidth: 90, color: "var(--ink-soft)" }}>{item?.mainUnit?.title || row.unitTitle || "—"}</td>
                      <TrackingCells
                        goodsItemId={row.goodsItemId ? Number(row.goodsItemId) : null}
                        item={item}
                        warehouseId={header.warehouseId ? Number(header.warehouseId) : null}
                        documentType="WAREHOUSE_RECEIPT"
                        quantity={Number(row.quantity) || 0}
                        value={row}
                        onChange={(patch) => updateRow(idx, patch)}
                        disabled={coreDisabled}
                      />
                      <td style={{ minWidth: 130 }}>
                        <AmountInput value={row.quantity} onChange={(v) => updateRow(idx, { quantity: v })} allowDecimal placeholder="۰" disabled={coreDisabled} />
                      </td>
                      {showAmount && <td style={{ minWidth: 110, color: "var(--ink-soft)" }}>{formatAmountFa(row.unitCost || "0")}</td>}
                      {showAmount && <td style={{ minWidth: 120, color: "var(--ink-soft)" }}>{formatAmountFa(row.amount || "0")}</td>}
                      <DocDetailItemCells config={detailConfig} values={row.details} disabled={coreDisabled} onChange={(typeId, code) => updateRow(idx, { details: { ...(row.details ?? {}), [typeId]: code } })} />
                      <td style={{ minWidth: 160 }}>
                        <input value={row.description} onChange={(e) => updateRow(idx, { description: e.target.value })} disabled={coreDisabled} />
                      </td>
                      {!coreDisabled && (
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
              {showAmount && <> — جمع مبلغ: {formatAmountFa(totalAmount)}</>}
            </span>
          </div>
        </div>
      </form>
    {bulkOpen && (
        <Modal title="بارکد تجمیعی" onClose={() => !bulkBusy && setBulkOpen(false)}>
          <div style={{ minWidth: 380 }}>
            <p style={{ fontSize: 12, opacity: 0.75, margin: "0 0 8px" }}>هر بارکد (یا کد کالا) را در یک خط بنویسید یا اسکن کنید؛ با Enter خط بعد شروع می‌شود. با «تایید» بارکدها یکی‌یکی تفسیر و به ردیف‌های سند اضافه می‌شوند.</p>
            <textarea
              dir="ltr"
              autoFocus
              rows={12}
              style={{ width: "100%", fontFamily: "monospace" }}
              value={bulkText}
              disabled={bulkBusy}
              onChange={(e) => setBulkText(e.target.value)}
            />
            {bulkErrors.length > 0 && (
              <div style={{ margin: "8px 0", maxHeight: 140, overflow: "auto", color: "var(--danger, #c0392b)", fontSize: 12 }}>
                <div style={{ fontWeight: 600 }}>بارکدهای زیر اعمال نشدند (در کادر مانده‌اند):</div>
                {bulkErrors.map((m, i) => <div key={i}>{m}</div>)}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
              <button type="button" className="btn secondary" disabled={bulkBusy} onClick={() => setBulkOpen(false)}>انصراف</button>
              <button type="button" className="btn" disabled={bulkBusy || !bulkText.trim()} onClick={applyBulkBarcodes}>{bulkBusy ? "در حال تفسیر…" : "تایید"}</button>
            </div>
          </div>
        </Modal>
      )}
      </FormPage>
  );
}
