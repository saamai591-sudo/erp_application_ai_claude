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

// «مصرف تولید» — طبق stockAnalysis.md بند ۳۴/۳۹/۴۲؛ این پروژه ماژول «تولید»/«دستور تولید» ندارد، پس
// این سند همیشه «بدون مبنا» است (نگاه کنید به یادداشت بالای backend/src/routes/productionConsumptions.ts).
// طبق تصمیم صریح کاربر، برخلاف طراحی اولیه، این سند یک «مرکز هزینه» الزامی دارد (دقیقاً هم‌الگوی «مصرف
// مرکز هزینه») — چون فاز بعدیِ حسابداری بهای تمام‌شده در سطح مرکز هزینه محاسبه می‌شود؛ تفاوتش با «مصرف
// مرکز هزینه» صرفاً معنایی/گزارشی است (مشخصاً برای تولید)، نه ساختاری. طبق تصمیم معماری «ادغام نمای
// انبارداری/حسابداری انبار»: این فرم دیگر دو مسیر/دو مود جدا ندارد — یک نمای واحد است که ستون‌های
// مبلغی بر اساس مجوز کاربر نمایش/عدم‌نمایش داده می‌شوند (نه بر اساس مسیر URL).
const VIEW_ACCOUNTING_PERMISSION = "inventory.outbound-issues.production-consumptions.viewAccounting";

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
interface DetailLine { id: number; goodsItemId: number; goodsItemCode: string; goodsItemTitle: string; unitId: number; unitTitle: string; quantity: number; unitCost: number; amount: number; description: string | null; serialIds: number[]; batchAllocations: { batchId: number; batchNumber: string; expiryDate: string | null; quantity: number }[]; physicalLocation: string | null }
interface Detail { id: number; number: number; date: string; warehouseId: number; warehouseTitle: string; fiscalPeriodId: number; fiscalPeriodTitle: string; costCenterId: number | null; description: string | null; status: DocStatus; finalizedAt: string | null; lines: DetailLine[] }

const STATUS_FA: Record<DocStatus, string> = { REGISTERED: "ثبت‌شده", FINALIZED: "تایید انبار شده" };
const INFO_TEXT = "ثبت مصرف تولید (خروج مواد اولیه از انبار برای مصرف در تولید) — برای تخصیص بهای تمام‌شده، این سند یک مرکز هزینه الزامی دارد. این سند همیشه بدون مبنا است؛ در صورت نیاز، شرح هر ردیف می‌تواند دستور تولید مربوطه را مشخص کند.";

export default function ProductionConsumptions() {
  const location = useLocation();
  const { id } = useParams();
  const basePath = "/production-consumptions";
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <ProductionConsumptionForm basePath={basePath} />;
  if (isEdit) return <ProductionConsumptionForm basePath={basePath} editId={Number(id)} />;
  return <ProductionConsumptionList basePath={basePath} />;
}

function PlusIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function ProductionConsumptionList({ basePath }: { basePath: string }) {
  const cacheKey = basePath;
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const { hasPermission } = usePermissions();
  const canViewAccounting = hasPermission(VIEW_ACCOUNTING_PERMISSION);

  async function reload() {
    try {
      setItems(await api.get("/production-consumptions"));
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
      await api.del(`/production-consumptions/${row.id}`);
      await reload();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="مصرف تولید" />
          <NewRecordButton path={`${basePath}/new`} />
          <ExcelImportButton
              entityLabel="مصرف تولید"
              templateFilename="قالب-مصرف-تولید"
              backendEntityType="production-consumption"
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

interface RowState { goodsItemId: string; goodsItemCode: string; goodsItemTitle: string; unitId: string; unitTitle: string; quantity: string; unitCost: number; amount: number; description: string; serialIds: string[]; batchAllocations: { batchId: string; quantity: string }[]; physicalLocation: string }

function emptyRow(): RowState {
  return { goodsItemId: "", goodsItemCode: "", goodsItemTitle: "", unitId: "", unitTitle: "", quantity: "", unitCost: 0, amount: 0, description: "", serialIds: [], batchAllocations: [], physicalLocation: "" };
}

function ProductionConsumptionForm({ editId, basePath }: { editId?: number; basePath: string }) {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canViewAccounting = hasPermission(VIEW_ACCOUNTING_PERMISSION);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [goodsItems, setGoodsItems] = useState<GoodsItemRow[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenterOption[]>([]);

  const { header, setHeader, rows, setRows, meta, fiscalPeriod, error, setError, loaded, submit, remove } = useDocumentForm<
    { date: string; warehouseId: string; costCenterId: string; description: string },
    RowState,
    Detail
  >({
    endpoint: "production-consumptions",
    editId,
    emptyHeader: (fp) => ({ date: defaultDocumentDate(fp), warehouseId: "", costCenterId: "", description: "" }),
    emptyRows: () => [emptyRow()],
    mapDetailToHeader: (d) => ({ date: d.date.slice(0, 10), warehouseId: String(d.warehouseId), costCenterId: d.costCenterId ? String(d.costCenterId) : "", description: d.description || "" }),
    mapDetailToRows: (d) =>
      d.lines.map((l) => ({
        goodsItemId: String(l.goodsItemId),
        goodsItemCode: l.goodsItemCode,
        goodsItemTitle: l.goodsItemTitle,
        unitId: String(l.unitId),
        unitTitle: l.unitTitle,
        quantity: String(l.quantity),
        unitCost: l.unitCost,
        amount: l.amount,
        description: l.description || "",
        serialIds: l.serialIds.map(String),
        batchAllocations: l.batchAllocations.map((a) => ({ batchId: String(a.batchId), quantity: String(a.quantity) })),
        physicalLocation: l.physicalLocation || "",
      })),
    mapDetailToMeta: (d) => ({ number: d.number, status: d.status, fiscalPeriodTitle: d.fiscalPeriodTitle }),
    loadExtra: async () => {
      const [whs, items, ccs]: [Warehouse[], GoodsItemRow[], CostCenterOption[]] = await Promise.all([
        api.get("/warehouses"),
        api.get("/goods-items?kind=GOODS&docDirection=OUTBOUND&docType=مصرف"),
        api.get("/cost-centers"),
      ]);
      setWarehouses(whs);
      setGoodsItems(items);
      setCostCenters(ccs);
    },
  });

  const isFinalized = meta?.status === "FINALIZED";
  // طبق تصمیم صریح کاربر: فیلدهای مبلغی تا وقتی سند Finalized نشده، اصلاً نمایش داده نمی‌شوند.
  const showAmount = canViewAccounting && isFinalized;
  const coreDisabled = isFinalized;

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
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
        if (body.lines.length === 0) return "سند مصرف تولید باید حداقل یک ردیف کالا داشته باشد";
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

  if (!loaded) return null;

  const selectedWarehouseStillListed = warehouses.some((w) => String(w.id) === header.warehouseId);
  const warehouseOptions = warehouses.filter((w) => w.isActive || String(w.id) === header.warehouseId);

  return (
    <FormPage
      title={editId ? "ویرایش مصرف تولید" : "مصرف تولید جدید"}
      description={isFinalized ? "این سند «تایید انبار» شده است؛ سرصفحه، مقدار و کالای ردیف‌ها دیگر قابل ویرایش نیستند." : undefined}
      formId="production-consumption-form"
      closePath={basePath}
      newPath={`${basePath}/new`}
      onDelete={editId && !coreDisabled ? handleDelete : undefined}
      saveDisabled={coreDisabled}
      wide
    >
      <form id="production-consumption-form" onSubmit={onSubmit}>
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
              <select value={header.warehouseId} onChange={(e) => setHeader({ ...header, warehouseId: e.target.value })} disabled={coreDisabled}>
                <option value="">انتخاب کنید</option>
                {warehouseOptions.map((w) => (
                  <option key={w.id} value={w.id}>{w.title}{!w.isActive ? " (غیرفعال)" : ""}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>تاریخ سند<RequiredMark /></label>
              <JalaliDatePicker fiscalYear value={header.date} onChange={(v) => setHeader({ ...header, date: v })} disabled={coreDisabled} />
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
                        documentType="PRODUCTION_CONSUMPTION"
                        quantity={Number(row.quantity) || 0}
                        value={row}
                        onChange={(patch) => updateRow(idx, patch)}
                        disabled={coreDisabled}
                      />
                      <td style={{ minWidth: 130 }}>
                        <AmountInput value={row.quantity} onChange={(v) => updateRow(idx, { quantity: v })} allowDecimal placeholder="۰" disabled={coreDisabled} />
                      </td>
                      {showAmount && <td style={{ minWidth: 110, color: "var(--ink-soft)" }}>{formatAmountFa(row.unitCost)}</td>}
                      {showAmount && <td style={{ minWidth: 120, color: "var(--ink-soft)" }}>{formatAmountFa(row.amount)}</td>}
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
