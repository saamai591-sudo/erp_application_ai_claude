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

type DocStatus = "REGISTERED" | "FINALIZED";

interface Warehouse { id: number; code: number; title: string; isActive: boolean }
interface GoodsItemRow {
  id: number;
  fullCode: string;
  title: string;
  mainUnitId: number;
  mainUnit?: { title: string };
  isActive: boolean;
  trackingMethod: "NONE" | "BATCH" | "SERIAL";
  isLocationTracked: boolean;
}

interface CostCenterOption { id: number; detailCode: string; title: string; isActive?: boolean }

interface ListRow { id: number; number: number; date: string; warehouseId: number; warehouseTitle: string; fiscalPeriodTitle: string; costCenterId: number | null; costCenterTitle: string | null; description: string | null; status: DocStatus; lineCount: number; totalQuantity: number; totalAmount?: number }
interface DetailLine { id: number; goodsItemId: number; goodsItemCode: string; goodsItemTitle: string; unitId: number; unitTitle: string; quantity: number; unitCost?: number; amount?: number; description: string | null; serialIds: number[]; batchAllocations: { batchId: number; batchNumber: string; expiryDate: string | null; quantity: number }[]; physicalLocation: string | null }
interface Detail { id: number; number: number; date: string; warehouseId: number; warehouseTitle: string; fiscalPeriodId: number; fiscalPeriodTitle: string; costCenterId: number | null; description: string | null; status: DocStatus; finalizedAt: string | null; lines: DetailLine[] }

const STATUS_FA: Record<DocStatus, string> = { REGISTERED: "ثبت‌شده", FINALIZED: "تایید حسابداری شده" };
const INFO_TEXT = "ثبت رسید تولید (ورود محصول/نیمه‌ساخته‌ی تولیدشده به انبار) — برای تخصیص بهای تمام‌شده، این سند یک مرکز هزینه الزامی دارد. این سند همیشه بدون مبنا و بدون طرف‌حساب است.";

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

function PlusIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
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
      {error && <div className="alert error">{error}</div>}
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

interface RowState { goodsItemId: string; goodsItemCode: string; goodsItemTitle: string; unitId: string; unitTitle: string; quantity: string; unitCost: string; amount: string; description: string; serialIds: string[]; batchAllocations: { batchId: string; quantity: string }[]; physicalLocation: string }

function emptyRow(): RowState {
  return { goodsItemId: "", goodsItemCode: "", goodsItemTitle: "", unitId: "", unitTitle: "", quantity: "", unitCost: "", amount: "", description: "", serialIds: [], batchAllocations: [], physicalLocation: "" };
}

function mapRows(d: Detail): RowState[] {
  return d.lines.map((l) => ({
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

// طبق بند ۳-۴ «مستند عمومی عملیات انبار»: مبلغ باید بر اساس تعداد ارقام اعشار «ارز پایه» گرد شود، نه
// یک عدد هاردکد. این تابع فقط برای پیش‌نمایش لحظه‌ای در فرانت‌اند است؛ مرجع نهایی محاسبه، بک‌اند است.
function recomputeAmount(row: RowState, baseDecimalPlaces: number): RowState {
  const qty = Number(row.quantity) || 0;
  const cost = Number(row.unitCost) || 0;
  if (!qty) return { ...row, amount: "" };
  const factor = Math.pow(10, baseDecimalPlaces);
  const amount = Math.round(qty * cost * factor) / factor;
  return { ...row, amount: amount ? String(amount) : "" };
}

function ProductionReceiptForm({ editId, basePath }: { editId?: number; basePath: string }) {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canViewAccounting = hasPermission(VIEW_ACCOUNTING_PERMISSION);
  const canConfirm = hasPermission(CONFIRM_PERMISSION);
  const canRevert = hasPermission(REVERT_PERMISSION);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [goodsItems, setGoodsItems] = useState<GoodsItemRow[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenterOption[]>([]);
  const [baseDecimalPlaces, setBaseDecimalPlaces] = useState(2);

  const { header, setHeader, rows, setRows, meta, setMeta, fiscalPeriod, error, setError, loaded, flash, submit, remove } = useDocumentForm<
    { date: string; warehouseId: string; costCenterId: string; description: string },
    RowState,
    Detail
  >({
    endpoint: "production-receipts",
    editId,
    emptyHeader: (fp) => ({ date: defaultDocumentDate(fp), warehouseId: "", costCenterId: "", description: "" }),
    emptyRows: () => [emptyRow()],
    mapDetailToHeader: (d) => ({ date: d.date.slice(0, 10), warehouseId: String(d.warehouseId), costCenterId: d.costCenterId ? String(d.costCenterId) : "", description: d.description || "" }),
    mapDetailToRows: mapRows,
    mapDetailToMeta: (d) => ({ number: d.number, status: d.status, fiscalPeriodTitle: d.fiscalPeriodTitle }),
    loadExtra: async () => {
      const [whs, items, currencies, ccs]: [Warehouse[], GoodsItemRow[], { isBase: boolean; decimalPlaces: number }[], CostCenterOption[]] = await Promise.all([
        api.get("/warehouses"),
        api.get("/goods-items?kind=GOODS&docDirection=INBOUND&docType=تولید"),
        api.get("/currencies"),
        api.get("/cost-centers"),
      ]);
      setWarehouses(whs);
      setGoodsItems(items);
      const baseCurrency = currencies.find((c) => c.isBase);
      if (baseCurrency) setBaseDecimalPlaces(baseCurrency.decimalPlaces);
      setCostCenters(ccs);
    },
  });

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
    const item = goodsItems.find((g) => g.id === Number(goodsItemId));
    updateRow(idx, { goodsItemId, unitId: item ? String(item.mainUnitId) : "", unitTitle: "" });
  }

  function onQuantityChange(idx: number, quantity: string) {
    setRows((prev) => prev.map((r, i) => (i === idx ? recomputeAmount({ ...r, quantity }, baseDecimalPlaces) : r)));
  }
  function onUnitCostChange(idx: number, unitCost: string) {
    setRows((prev) => prev.map((r, i) => (i === idx ? recomputeAmount({ ...r, unitCost }, baseDecimalPlaces) : r)));
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
      date: header.date,
      warehouseId: Number(header.warehouseId),
      costCenterId: header.costCenterId ? Number(header.costCenterId) : null,
      description: header.description,
      lines: nonEmptyRows.map((r) => ({
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
        {error && <div className="alert error">{error}</div>}

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
              <select value={header.warehouseId} onChange={(e) => setHeader({ ...header, warehouseId: e.target.value })} disabled={coreDisabled}>
                <option value="">انتخاب کنید</option>
                {warehouseOptions.map((w) => (
                  <option key={w.id} value={w.id}>{w.title}{!w.isActive ? " (غیرفعال)" : ""}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>تاریخ سند<RequiredMark /></label>
              <JalaliDatePicker value={header.date} onChange={(v) => setHeader({ ...header, date: v })} disabled={coreDisabled} />
            </div>
            <div className="form-field">
              <label>مرکز هزینه<RequiredMark /></label>
              <select value={header.costCenterId} onChange={(e) => setHeader({ ...header, costCenterId: e.target.value })} disabled={coreDisabled}>
                <option value="">انتخاب کنید</option>
                {costCenters.map((c) => (
                  <option key={c.id} value={c.id}>{toFaDigits(c.detailCode)} — {c.title}</option>
                ))}
              </select>
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
                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                      <td style={{ minWidth: 200 }}>
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
                        disabled={coreDisabled}
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
