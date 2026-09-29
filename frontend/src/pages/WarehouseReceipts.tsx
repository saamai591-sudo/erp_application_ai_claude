import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
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
import { DescriptionField } from "../components/DescriptionField";

// این فرآیند («رسید انبار خرید») مستند تحلیل اختصاصی در پروژه ندارد؛ ساختار این فرم حاصل تصمیم
// مشترک با کاربر است (نگاه کنید به یادداشت‌های backend/src/routes/warehouseReceipts.ts). طبق تصمیم
// معماری «ادغام نمای انبارداری/حسابداری انبار»: این فرم دیگر دو مسیر/دو مود جدا ندارد — یک نمای
// واحد است که ستون‌های مبلغی بر اساس مجوز کاربر نمایش/عدم‌نمایش داده می‌شوند (نه بر اساس مسیر URL).
// این سند هیچ اقدام «تایید حسابداری» کلیک‌شدنی روی خودش ندارد — طبق تصمیم صریح کاربر، فقط با تایید
// فاکتور خرید (purchaseInvoices.ts) مبتنی بر آن Finalized می‌شود؛ فی/مبلغ هم فقط از همان مسیر نوشته
// می‌شود، نه از این فرم. تا وقتی Finalized نشده، فیلدهای مبلغی اصلاً نمایش داده نمی‌شوند، حتی برای
// کاربر دارای دسترسی «مشاهده اطلاعات حسابداری».
const VIEW_ACCOUNTING_PERMISSION = "inventory.inbound-receipts.warehousing-warehouse-receipts.viewAccounting";

type Basis = "NO_BASIS" | "SUPPLY_REQUEST" | "PURCHASE_ORDER" | "DELIVERY_AUTHORIZATION";
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
}

const BASIS_FA: Record<Basis, string> = {
  NO_BASIS: "بدون مبنا",
  SUPPLY_REQUEST: "درخواست تامین",
  PURCHASE_ORDER: "سفارش خرید",
  DELIVERY_AUTHORIZATION: "مجوز تحویل",
};
const STATUS_FA: Record<DocStatus, string> = { REGISTERED: "ثبت‌شده", FINALIZED: "تایید حسابداری شده" };
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

const INFO_TEXT =
  "ثبت رسید انبار برای کالاهای دریافتی از تامین‌کننده. مبنا می‌تواند بدون مبنا، درخواست تامین، سفارش خرید یا مجوز تحویل باشد؛ " +
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

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
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

  const { header, setHeader, rows, setRows, meta, error, setError, loaded, submit, remove } = useDocumentForm<
    { date: string; basis: Basis; warehouseId: string; partyDetailCode: string; description: string },
    RowState,
    Detail
  >({
    endpoint: "warehouse-receipts",
    editId,
    emptyHeader: (fp) => ({ date: defaultDocumentDate(fp), basis: "NO_BASIS", warehouseId: "", partyDetailCode: "", description: "" }),
    emptyRows: () => [emptyRow()],
    mapDetailToHeader: (d) => ({ date: d.date.slice(0, 10), basis: d.basis, warehouseId: String(d.warehouseId), partyDetailCode: d.partyDetailCode || "", description: d.description || "" }),
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
    if ((header.basis === "PURCHASE_ORDER" || header.basis === "DELIVERY_AUTHORIZATION") && header.partyDetailCode) {
      params.set("partyDetailCode", header.partyDetailCode);
    }
    const q = params.toString() ? `?${params.toString()}` : "";
    api
      .get(`${PICKABLE_ENDPOINT[header.basis]}${q}`)
      .then((rows: PickableLine[]) => setPickableLines(rows))
      .catch(() => setPickableLines([]));
  }, [header.basis, header.date, header.partyDetailCode]);

  const hasAnyLine = rows.some((r) => r.goodsItemId || r.sourceSupplyRequestLineId || r.sourcePurchaseOrderLineId || r.sourceDeliveryAuthorizationLineId);
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
      partyDetailCode: header.partyDetailCode || null,
      description: header.description,
      lines: nonEmptyRows.map((r) => ({
        sourceSupplyRequestLineId: r.sourceSupplyRequestLineId ? Number(r.sourceSupplyRequestLineId) : null,
        sourcePurchaseOrderLineId: r.sourcePurchaseOrderLineId ? Number(r.sourcePurchaseOrderLineId) : null,
        sourceDeliveryAuthorizationLineId: r.sourceDeliveryAuthorizationLineId ? Number(r.sourceDeliveryAuthorizationLineId) : null,
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
                  <th>ردیابی</th>
                  <th>محل فیزیکی</th>
                  <th>مقدار</th>
                  {showAmount && <th>فی واحد</th>}
                  {showAmount && <th>مبلغ</th>}
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
    </FormPage>
  );
}
