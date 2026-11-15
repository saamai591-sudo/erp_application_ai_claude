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
import { takeFormPrefill } from "../lib/formPrefill";
import { ReceiptFromStatPrefill } from "../components/DownstreamDialogs";
import { api, ApiError } from "../lib/api";
import { usePermissions } from "../lib/usePermissions";
import { defaultDocumentDate } from "../lib/fiscalYearDefaultDate";
import { useDocumentForm } from "../lib/useDocumentForm";
import { DescriptionField } from "../components/DescriptionField";
import { DocDetailHeaderFields, DocDetailItemHeadCells, DocDetailItemCells } from "../components/WarehouseDocDetailFields";
import { DetailValues, DetailValueDto, useDocDetailConfig, detailsToValues, valuesToPayload, changeHeaderDetail, newRowDetails } from "../lib/warehouseDocDetails";
import { CostCenterPickerField } from "../components/TypePickerFields";
import { PlusIcon } from "../components/icons";
import { recomputeAmount } from "../lib/rowHelpers";
import { GoodsPickerField } from "../components/GoodsPickerField";
import { GoodsScope, cachedGoods, ensureGoods, useGoodsCatalog } from "../lib/goodsCatalog";
import { WarehousePickerField } from "../components/WarehousePickerField";

// «رسید تولید» — طبق stockAnalysis.md بند ۳۴/۴۲ («دریافت محصول»)؛ این پروژه ماژول «تولید» ندارد، پس
// این سند همیشه «بدون مبنا» و بدون طرف‌حساب است (نگاه کنید به یادداشت بالای
// backend/src/routes/productionReceipts.ts). فقط کالای نوع نیمه‌ساخته/محصول مجاز است. طبق تصمیم
// معماری «ادغام نمای انبارداری/حسابداری انبار»: این فرم دیگر دو مسیر/دو مود جدا ندارد — یک نمای واحد
// است که ستون‌های مبلغی بر اساس مجوز کاربر نمایش/عدم‌نمایش داده می‌شوند (نه بر اساس مسیر URL). دقیقاً
// هم‌الگوی رسید انبار خرید (WarehouseReceipts.tsx): کاربر ابتدا «تایید حسابداری» را می‌زند (که سرصفحه/
// مقدار را قفل می‌کند) و بعد از آن فی/مبلغ را وارد می‌کند؛ تا وقتی Finalized نشده، فیلدهای مبلغی اصلاً
// نمایش داده نمی‌شوند، حتی برای کاربر دارای دسترسی «مشاهده اطلاعات حسابداری».
//
// طبق تصمیم صریح کاربر: این سند یک «مرکز هزینه» الزامی دارد (دقیقاً هم‌الگوی مصرف تولید — یک فیلد
// سرصفحه، از طریق detailCode یکپارچه) تا مرکز هزینه‌ی تولیدکننده‌ی این محصول مشخص باشد. چون سرصفحه‌ای
// است، بعد از تایید حسابداری مثل انبار/تاریخ/شرح قفل می‌شود، نه بخشی از فی/مبلغ قابل‌ویرایش.
const VIEW_ACCOUNTING_PERMISSION = "inventory.inbound-receipts.production-receipts.viewAccounting";
const CONFIRM_PERMISSION = "inventory.inbound-receipts.production-receipts.accountingConfirm";
const REVERT_PERMISSION = "inventory.inbound-receipts.production-receipts.accountingConfirmRevert";

const GOODS_SCOPE: GoodsScope = { kind: "GOODS", docDirection: "INBOUND", docType: "تولید" };
type DocStatus = "REGISTERED" | "FINALIZED";

interface Warehouse { id: number; code: number; title: string; isActive: boolean }

interface CostCenterOption { id: number; detailCode: string; title: string; isActive?: boolean }

interface ListRow { id: number; number: number; date: string; warehouseId: number; warehouseTitle: string; fiscalPeriodTitle: string; costCenterId: number | null; costCenterTitle: string | null; description: string | null; status: DocStatus; lineCount: number; totalQuantity: number; totalAmount?: number }
interface DetailLine { id: number; sourceProductionStatLineId?: number | null; statNumber?: number | null; goodsItemId: number; goodsItemCode: string; goodsItemTitle: string; unitId: number; unitTitle: string; quantity: number; unitCost?: number; amount?: number; description: string | null; serialIds: number[]; batchAllocations: { batchId: number; batchNumber: string; expiryDate: string | null; quantity: number }[]; physicalLocation: string | null; details?: DetailValueDto[] }
interface Detail { id: number; number: number; date: string; basis?: "NO_BASIS" | "PRODUCTION_STAT"; warehouseId: number; warehouseTitle: string; fiscalPeriodId: number; fiscalPeriodTitle: string; costCenterId: number | null; description: string | null; status: DocStatus; finalizedAt: string | null; details?: DetailValueDto[]; lines: DetailLine[] }

const STATUS_FA: Record<DocStatus, string> = { REGISTERED: "ثبت‌شده", FINALIZED: "تایید حسابداری شده" };
const INFO_TEXT = "ثبت رسید تولید (ورود محصول/نیمه‌ساخته‌ی تولیدشده به انبار) — این سند یک مرکز هزینه الزامی دارد. مبنای «آمار تولید»: ردیف‌ها از آمار تولید همان مرکز انتخاب می‌شوند و مقدارشان بیش از مانده‌ی آمار نمی‌شود (با لایسنس بهای تمام‌شده این مبنا الزامی است)؛ «بدون مبنا» فقط برای نصب‌های بدون محاسبه‌ی بهای تمام‌شده است.";
const BASIS_FA: Record<string, string> = { PRODUCTION_STAT: "بر مبنای آمار تولید", NO_BASIS: "بدون مبنا" };
interface StatPick { id: number; lineId: number; batchId?: number | null; batchNumber?: string | null; statNumber: number; statDate: string; goodsItemId: number; itemCode: string; itemTitle: string; unit: string; quantity: number; remaining: number }

export default function ProductionReceipts() {
  const location = useLocation();
  const { id } = useParams();
  const basePath = "/production-receipts";
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <ProductionReceiptForm basePath={basePath} />;
  if (isEdit) return <ProductionReceiptForm basePath={basePath} editId={Number(id)} />;
  return <ProductionReceiptList basePath={basePath} />;
}

function ProductionReceiptList({ basePath }: { basePath: string }) {
  const cacheKey = basePath;
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const { hasPermission } = usePermissions();
  const canViewAccounting = hasPermission(VIEW_ACCOUNTING_PERMISSION);

  async function reload() {
    try {
      setItems(await api.get("/production-receipts"));
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
      await api.del(`/production-receipts/${row.id}`);
      await reload();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="رسید تولید" />
          <NewRecordButton path={`${basePath}/new`} />
          <ExcelImportButton
              entityLabel="رسید تولید"
              templateFilename="قالب-رسید-تولید"
              backendEntityType="production-receipt"
              allowDuplicateOption
              columns={[
                { key: "warehouseCode", label: "کد انبار", required: true },
                { key: "date", label: "تاریخ", required: true, hint: "شمسی (مثلاً 1405/05/06) یا میلادی" },
                { key: "number", label: "شماره سند", required: true, hint: "همان شماره‌ی سند در سیستم قبلی؛ هم برای گروه‌بندی ردیف‌های یک سند (با کد انبار و تاریخ) و هم به‌عنوان شماره‌ی نهایی سند استفاده می‌شود — باید در این دوره مالی یکتا باشد" },
                { key: "costCenterDetailCode", label: "کد تفصیل مرکز هزینه", required: true },
                { key: "description", label: "شرح سند" },
                { key: "goodsItemCode", label: "کد کالا" },
                { key: "goodsItemOldCode", label: "کد کالا (سیستم قدیم)", hint: "برای مهاجرت از سیستم قبلی؛ دقیقاً یکی از این دو ستون باید در هر ردیف پر باشد" },
                { key: "quantity", label: "مقدار", required: true },
                { key: "amount", label: "مبلغ", hint: "اختیاری — اگر همه‌ی ردیف‌های سند مبلغ داشته باشند، سند همان لحظه با همان مبلغ و به‌صورت تایید حسابداری‌شده ثبت می‌شود؛ اگر خالی بماند، سند بدون مبلغ ثبت می‌شود و باید بعداً از فرم تایید حسابداری شود" },
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
          { header: "مرکز هزینه", render: (r) => r.costCenterTitle || "—", filterType: "string", filterValue: (r) => r.costCenterTitle || "" },
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

interface RowState { statLineId: string; statNumber: string; goodsItemId: string; goodsItemCode: string; goodsItemTitle: string; unitId: string; unitTitle: string; quantity: string; unitCost: string; amount: string; description: string; serialIds: string[]; batchAllocations: { batchId: string; quantity: string }[]; physicalLocation: string; details?: DetailValues; /** بچ از ردیف آمار تولید آمده و قابل تغییر نیست */ batchLocked?: boolean }

function emptyRow(): RowState {
  return { statLineId: "", statNumber: "", goodsItemId: "", goodsItemCode: "", goodsItemTitle: "", unitId: "", unitTitle: "", quantity: "", unitCost: "", amount: "", description: "", serialIds: [], batchAllocations: [], physicalLocation: "" };
}

function mapRows(d: Detail): RowState[] {
  return d.lines.map((l) => ({
    statLineId: l.sourceProductionStatLineId ? String(l.sourceProductionStatLineId) : "",
    statNumber: l.statNumber ? String(l.statNumber) : "",
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
    batchLocked: !!l.sourceProductionStatLineId && l.batchAllocations.length === 1,
  }));
}

// طبق بند ۳-۴ «مستند عمومی عملیات انبار»: مبلغ باید بر اساس تعداد ارقام اعشار «ارز پایه» گرد شود، نه
// یک عدد هاردکد. این تابع فقط برای پیش‌نمایش لحظه‌ای در فرانت‌اند است؛ مرجع نهایی محاسبه، بک‌اند است.
function ProductionReceiptForm({ editId, basePath }: { editId?: number; basePath: string }) {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canViewAccounting = hasPermission(VIEW_ACCOUNTING_PERMISSION);
  const canConfirm = hasPermission(CONFIRM_PERMISSION);
  const canRevert = hasPermission(REVERT_PERMISSION);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenterOption[]>([]);
  const [baseDecimalPlaces, setBaseDecimalPlaces] = useState(2);

  const detailConfig = useDocDetailConfig("PRODUCTION_RECEIPT");
  const { header, setHeader, rows, setRows, meta, setMeta, error, setError, loaded, flash, submit, remove } = useDocumentForm<
    { date: string; warehouseId: string; costCenterId: string; basis: string; description: string; details: DetailValues },
    RowState,
    Detail
  >({
    endpoint: "production-receipts",
    editId,
    emptyHeader: (fp) => ({ date: defaultDocumentDate(fp), warehouseId: "", costCenterId: "", basis: "PRODUCTION_STAT", description: "", details: {} }),
    emptyRows: () => [emptyRow()],
    mapDetailToHeader: (d) => ({ date: d.date.slice(0, 10), warehouseId: String(d.warehouseId), costCenterId: d.costCenterId ? String(d.costCenterId) : "", basis: d.basis === "PRODUCTION_STAT" ? "PRODUCTION_STAT" : "NO_BASIS", description: d.description || "", details: detailsToValues(d.details) }),
    mapDetailToRows: mapRows,
    mapDetailToMeta: (d) => ({ number: d.number, status: d.status, fiscalPeriodTitle: d.fiscalPeriodTitle }),
    loadExtra: async () => {
      const [whs, currencies, ccs]: [Warehouse[], { isBase: boolean; decimalPlaces: number }[], CostCenterOption[]] = await Promise.all([
        api.get("/warehouses"),
        api.get("/currencies"),
        api.get("/cost-centers"),
      ]);
      setWarehouses(whs);
      const baseCurrency = currencies.find((c) => c.isBase);
      if (baseCurrency) setBaseDecimalPlaces(baseCurrency.decimalPlaces);
      setCostCenters(ccs);
    },
  });
  // کالاهای ردیف‌ها (واحد، ردیابی، عنوان) از روی شناسه و دسته‌ای از سرور خوانده می‌شوند؛ فهرست کامل کالا دیگر گرفته نمی‌شود
  useGoodsCatalog(rows.map((r) => r.goodsItemId));

  // طبق طرح جدید چرخه‌ی عمر سند («ثبت‌شده → تایید حسابداری‌شده»): بعد از تایید حسابداری، سرصفحه/مقدار/
  // کالای ردیف‌ها برای همه قفل می‌شود؛ فقط فی/مبلغ (برای کاربر دارای دسترسی مشاهده اطلاعات حسابداری)
  // قابل ویرایش می‌ماند — نگاه کنید به شاخه‌ی status==="FINALIZED" در PUT بک‌اند.
  const isFinalized = meta?.status === "FINALIZED";
  const coreDisabled = isFinalized;
  const moneyEditable = isFinalized && canViewAccounting;
  // طبق تصمیم صریح کاربر: فیلدهای مبلغی تا وقتی سند Finalized نشده، اصلاً نمایش داده نمی‌شوند — حتی
  // برای کاربر دارای دسترسی «مشاهده اطلاعات حسابداری».
  const showAmount = canViewAccounting && isFinalized;

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function onGoodsItemChange(idx: number, goodsItemId: string) {
    const item = cachedGoods(Number(goodsItemId));
    updateRow(idx, { goodsItemId, unitId: item ? String(item.mainUnitId) : "", unitTitle: "" });
  }

  function onQuantityChange(idx: number, quantity: string) {
    setRows((prev) => prev.map((r, i) => (i === idx ? recomputeAmount({ ...r, quantity, ...(r.batchLocked && r.batchAllocations.length === 1 ? { batchAllocations: [{ ...r.batchAllocations[0], quantity }] } : {}) }, baseDecimalPlaces) : r)));
  }
  function onUnitCostChange(idx: number, unitCost: string) {
    setRows((prev) => prev.map((r, i) => (i === idx ? recomputeAmount({ ...r, unitCost }, baseDecimalPlaces) : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { ...emptyRow(), details: newRowDetails(detailConfig, header.details) }]);
  }
  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  const statBasis = header.basis === "PRODUCTION_STAT";
  // ردیف‌های آمارِ دارای مانده‌ی همان مرکز (تا تاریخ سند) — منبع انتخابگر ردیفِ مبنا در هر ردیف
  const [pickableStat, setPickableStat] = useState<StatPick[]>([]);
  useEffect(() => {
    if (!statBasis || !header.costCenterId || !header.date) return setPickableStat([]);
    const q = new URLSearchParams({ costCenterId: header.costCenterId, date: header.date });
    if (editId) q.set("receiptDocId", String(editId));
    api.get(`/production-stats/pickable-lines?${q.toString()}`)
      .then((lines: any[]) => setPickableStat(lines.map((l) => ({ ...l, id: l.lineId }))))
      .catch(() => setPickableStat([]));
  }, [statBasis, header.costCenterId, header.date, editId]);

  // راهبری از آمار تولید: سرصفحه همین‌جا پر می‌شود؛ ردیف‌های آمار بعد از رسیدن فهرست ردیف‌های دارای مانده (effect بالا) با همان انتخابگر ردیف می‌نشینند
  const [pendingStat, setPendingStat] = useState<number | null>(null);
  const location = useLocation();
  useEffect(() => {
    if (!loaded || editId) return;
    const p = takeFormPrefill<ReceiptFromStatPrefill>(location.pathname);
    if (!p) return;
    setHeader((h) => ({ ...h, basis: "PRODUCTION_STAT", date: p.date, warehouseId: String(p.warehouseId), costCenterId: String(p.costCenterId) }));
    setPendingStat(p.statNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);
  useEffect(() => {
    if (pendingStat === null || !statBasis || !pickableStat.length) return;
    const mine = pickableStat.filter((s) => s.statNumber === pendingStat);
    setPendingStat(null);
    if (!mine.length) return setError("هیچ ردیف دارای مانده‌ای از این آمار باقی نمانده است");
    onStatLinesPicked(0, mine);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingStat, pickableStat]);

  // مانده‌ی زنده: مقدارِ سایر ردیف‌های همین سند که به همان ردیف آمار وصل‌اند کم می‌شود
  function liveRemaining(s: StatPick, exceptIdx: number) {
    const other = rows.reduce((sum, r, i) => (i !== exceptIdx && r.statLineId === String(s.lineId) ? sum + (Number(r.quantity) || 0) : sum), 0);
    return Math.max(0, Math.round((s.remaining - other) * 1e6) / 1e6);
  }
  function availableStatLines(idx: number) {
    return pickableStat.map((s) => ({ ...s, remaining: liveRemaining(s, idx) })).filter((s) => s.remaining > 0);
  }
  function rowFromStat(s: StatPick) {
    const item = cachedGoods(s.goodsItemId);
    return recomputeAmount({ ...emptyRow(), statLineId: String(s.lineId), statNumber: String(s.statNumber), goodsItemId: String(s.goodsItemId), unitId: item ? String(item.mainUnitId) : "", quantity: String(s.remaining), details: newRowDetails(detailConfig, header.details), ...(s.batchId ? { batchAllocations: [{ batchId: String(s.batchId), quantity: String(s.remaining) }], batchLocked: true } : {}) }, baseDecimalPlaces);
  }
  // انتخاب چندتایی: اولین مورد در همین ردیف، بقیه ردیف‌های جدید بعد از آن
  async function onStatLinesPicked(idx: number, picked: StatPick[]) {
    if (!picked.length) return;
    await ensureGoods(picked.map((p) => p.goodsItemId)); // واحد اصلی کالای ردیف‌های مبنا باید همین لحظه در کش باشد
    setRows((prev) => {
      const [first, ...rest] = picked;
      const next = prev.slice();
      next[idx] = rowFromStat(first);
      next.splice(idx + 1, 0, ...rest.map(rowFromStat));
      return next;
    });
  }
  function changeBasis(basis: string) {
    if (basis === header.basis) return;
    if (rows.some((r) => r.goodsItemId) && !window.confirm("با تغییر مبنا ردیف‌های فعلی پاک می‌شوند. ادامه می‌دهید؟")) return;
    setHeader({ ...header, basis });
    setRows([emptyRow()]);
  }

  const totalQuantity = rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const totalAmount = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  function buildBody() {
    const nonEmptyRows = rows.filter((r) => r.goodsItemId);
    return {
      date: header.date,
      warehouseId: Number(header.warehouseId),
      costCenterId: header.costCenterId ? Number(header.costCenterId) : null,
      basis: header.basis,
      description: header.description,
      details: valuesToPayload(header.details),
      lines: nonEmptyRows.map((r) => ({
        sourceProductionStatLineId: header.basis === "PRODUCTION_STAT" && r.statLineId ? Number(r.statLineId) : null,
        details: valuesToPayload(r.details),
        goodsItemId: r.goodsItemId ? Number(r.goodsItemId) : undefined,
        unitId: Number(r.unitId),
        quantity: Number(r.quantity) || 0,
        unitCost: Number(r.unitCost) || 0,
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
        if (!header.costCenterId) return "مرکز هزینه الزامی است";
        if (body.lines.length === 0) return "سند رسید تولید باید حداقل یک ردیف کالا داشته باشد";
        for (const [i, l] of body.lines.entries()) {
          if (!l.goodsItemId) return `کالا برای ردیف ${i + 1} الزامی است`;
          if (!(l.quantity > 0)) return `مقدار ردیف ${i + 1} باید عددی مثبت باشد`;
          if (header.basis === "PRODUCTION_STAT" && !l.sourceProductionStatLineId) return `ردیف ${i + 1}: ردیف آمار تولید انتخاب نشده است`;
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
    const d: Detail = await api.get(`/production-receipts/${editId}`);
    setMeta({ number: d.number, status: d.status, fiscalPeriodTitle: d.fiscalPeriodTitle });
    setRows(mapRows(d));
  }

  async function handleAccountingConfirm() {
    if (!window.confirm("این سند تایید حسابداری شود؟ پس از تایید، سرصفحه و مقدار ردیف‌ها دیگر قابل ویرایش نخواهند بود.")) return;
    setError(null);
    try {
      await api.post(`/production-receipts/${editId}/accounting-confirm`);
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
      await api.post(`/production-receipts/${editId}/accounting-confirm-revert`);
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
  if (editId && !isFinalized && canConfirm) {
    extraActions.push({ label: "تایید حسابداری", onClick: handleAccountingConfirm });
  }
  if (editId && isFinalized && canRevert) {
    extraActions.push({ label: "برگشت از تایید حسابداری", onClick: handleAccountingConfirmRevert });
  }

  return (
    <FormPage
      title={editId ? "ویرایش رسید تولید" : "رسید تولید جدید"}
      description={isFinalized ? "این سند تایید حسابداری شده است؛ سرصفحه، مقدار و کالای ردیف‌ها دیگر قابل ویرایش نیستند." : undefined}
      formId="production-receipt-form"
      closePath={basePath}
      newPath={`${basePath}/new`}
      onDelete={editId && !coreDisabled ? handleDelete : undefined}
      extraActions={extraActions}
      saveDisabled={isFinalized && !moneyEditable}
      wide
    >
      <form id="production-receipt-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />

        {meta && (
          <div className="form-field" style={{ maxWidth: 220, marginBottom: 8 }}>
            <label>وضعیت</label>
            <div><span className="badge">{STATUS_FA[meta.status]}</span></div>
          </div>
        )}

        <fieldset disabled={coreDisabled} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="je-header-grid cols-3" style={{ marginBottom: 6, maxWidth: 900 }}>
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
              <WarehousePickerField warehouses={warehouseOptions} value={header.warehouseId} onChange={(id) => setHeader({ ...header, warehouseId: id })} disabled={coreDisabled} />
            </div>
            <div className="form-field">
              <label>تاریخ سند<RequiredMark /></label>
              <JalaliDatePicker fiscalYear value={header.date} onChange={(v) => setHeader({ ...header, date: v })} disabled={coreDisabled} />
            </div>
            <div className="form-field">
              <label>مرکز هزینه<RequiredMark /></label>
              <CostCenterPickerField costCenters={costCenters} value={header.costCenterId} onChange={(id) => setHeader({ ...header, costCenterId: id })} disabled={coreDisabled} />
            </div>
            <div className="form-field">
              <label>مبنا<RequiredMark /></label>
              <select value={header.basis} onChange={(e) => changeBasis(e.target.value)} disabled={coreDisabled}>
                {Object.entries(BASIS_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <DocDetailHeaderFields
              config={detailConfig}
              values={header.details}
              disabled={coreDisabled}
              onChange={(typeId, code) => {
                const next = changeHeaderDetail(detailConfig, header, rows, typeId, code);
                setHeader(next.header);
                setRows(next.rows);
              }}
            />
            <div className="form-field full">
              <DescriptionField value={header.description} onChange={(v) => setHeader({ ...header, description: v })} disabled={coreDisabled} />
            </div>
            {!selectedWarehouseStillListed && header.warehouseId && (
              <div className="form-field full">
                <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>این انبار دیگر در فهرست انبارها یافت نشد</span>
              </div>
            )}
          </div>

          <div className="je-lines-toolbar">
            <span className="je-lines-title">ردیف‌های کالا</span>
            {!coreDisabled && (
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
                  {statBasis && <th>آمار</th>}
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
                  const item = cachedGoods(Number(row.goodsItemId));
                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                      {statBasis && (
                        <td style={{ minWidth: 90 }}>
                          <RecordPickerField<StatPick>
                            title="انتخاب ردیف آمار تولید"
                            disabled={coreDisabled}
                            displayValue={row.statNumber ? toFaDigits(row.statNumber) : ""}
                            rows={availableStatLines(idx)}
                            columns={[
                              { header: "آمار", render: (x) => toFaDigits(String(x.statNumber)), filterValue: (x) => String(x.statNumber), width: "70px" },
                              { header: "تاریخ", render: (x) => formatJalaliDate(x.statDate), filterValue: (x) => formatJalaliDate(x.statDate), width: "110px" },
                              { header: "کالا", render: (x) => x.itemTitle, filterValue: (x) => x.itemTitle },
                              { header: "مانده", render: (x) => toFaDigits(String(x.remaining)), filterValue: (x) => String(x.remaining), width: "90px" },
                            ]}
                            multiSelect
                            onSelectMultiple={(ls) => onStatLinesPicked(idx, ls)}
                            onSelect={(x) => onStatLinesPicked(idx, [x])}
                          />
                        </td>
                      )}
                      <td style={{ minWidth: 200 }}>
                        {statBasis ? (
                          <span>{row.goodsItemTitle || item ? `${toFaDigits(item?.fullCode ?? row.goodsItemCode)} — ${item?.title ?? row.goodsItemTitle}` : "—"}</span>
                        ) : (
                          <GoodsPickerField scope={GOODS_SCOPE} value={row.goodsItemId} title="انتخاب کالا" disabled={coreDisabled} onSelect={(g) => onGoodsItemChange(idx, String(g.id))} />
                        )}
                      </td>
                      <td style={{ minWidth: 90, color: "var(--ink-soft)" }}>{item?.mainUnit?.title || row.unitTitle || "—"}</td>
                      <TrackingCells
                        goodsItemId={row.goodsItemId ? Number(row.goodsItemId) : null}
                        item={item}
                        warehouseId={header.warehouseId ? Number(header.warehouseId) : null}
                        documentType="PRODUCTION_RECEIPT"
                        quantity={Number(row.quantity) || 0}
                        value={row}
                        onChange={(patch) => updateRow(idx, patch)}
                        disabled={coreDisabled || !!row.batchLocked}
                      />
                      <td style={{ minWidth: 130 }}>
                        <AmountInput value={row.quantity} onChange={(v) => onQuantityChange(idx, v)} allowDecimal placeholder="۰" disabled={coreDisabled} />
                      </td>
                      {showAmount && (
                        <td style={{ minWidth: 130 }}>
                          <AmountInput value={row.unitCost} onChange={(v) => onUnitCostChange(idx, v)} allowDecimal placeholder="۰" disabled={!moneyEditable} />
                        </td>
                      )}
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
    </FormPage>
  );
}
