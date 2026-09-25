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
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";
import { usePermissions } from "../lib/usePermissions";
import { defaultDocumentDate } from "../lib/fiscalYearDefaultDate";
import { useDocumentForm } from "../lib/useDocumentForm";

// «برگشت مصرف تولید» — همان الگوی CenterConsumptionReturns.tsx (بدون طرف‌مقابل، چون مصرف تولید هم
// طرف‌مقابل ندارد). طبق تصمیم معماری «ادغام نمای انبارداری/حسابداری انبار»: این فرم دیگر دو مسیر/دو
// مود جدا ندارد — یک نمای واحد است که ستون‌های مبلغی بر اساس مجوز کاربر نمایش/عدم‌نمایش داده می‌شوند
// (نه بر اساس مسیر URL).
const VIEW_ACCOUNTING_PERMISSION = "inventory.issue-returns.production-consumption-returns.viewAccounting";

type DocStatus = "REGISTERED" | "FINALIZED";

interface Warehouse { id: number; code: number; title: string; isActive: boolean }
interface GoodsItemRow { id: number; trackingMethod: "NONE" | "BATCH" | "SERIAL"; isLocationTracked: boolean }
interface PickableLine { id: number; sourceProductionConsumptionLineId: number; number: number; date: string; goodsItemId: number; goodsItemCode: string; goodsItemTitle: string; unitId: number; unitTitle: string; quantity: number; done: number; remaining: number }

interface ListRow { id: number; number: number; date: string; warehouseId: number; warehouseTitle: string; fiscalPeriodTitle: string; description: string | null; status: DocStatus; lineCount: number; totalQuantity: number; totalAmount?: number }
interface DetailLine { id: number; sourceProductionConsumptionLineId: number; sourceNumber: number | null; goodsItemId: number; goodsItemCode: string; goodsItemTitle: string; unitId: number; unitTitle: string; quantity: number; unitCost: number; amount: number; description: string | null; serialIds: number[]; batchAllocations: { batchId: number; batchNumber: string; expiryDate: string | null; quantity: number }[]; physicalLocation: string | null }
interface Detail { id: number; number: number; date: string; warehouseId: number; warehouseTitle: string; fiscalPeriodId: number; fiscalPeriodTitle: string; description: string | null; status: DocStatus; finalizedAt: string | null; lines: DetailLine[] }

const STATUS_FA: Record<DocStatus, string> = { REGISTERED: "ثبت‌شده", FINALIZED: "تایید انبار شده" };
const INFO_TEXT = "ثبت برگشت مصرف تولید — هر ردیف باید به یک ردیف مصرف تولید قطعی‌شده ارجاع بدهد؛ مقدار برگشتی نمی‌تواند از باقیمانده‌ی قابل برگشت آن ردیف بیشتر باشد.";

export default function ProductionConsumptionReturns() {
  const location = useLocation();
  const { id } = useParams();
  const basePath = "/production-consumption-returns";
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <ProductionConsumptionReturnForm basePath={basePath} />;
  if (isEdit) return <ProductionConsumptionReturnForm basePath={basePath} editId={Number(id)} />;
  return <ProductionConsumptionReturnList basePath={basePath} />;
}

function PlusIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function ProductionConsumptionReturnList({ basePath }: { basePath: string }) {
  const cacheKey = basePath;
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const { hasPermission } = usePermissions();
  const canViewAccounting = hasPermission(VIEW_ACCOUNTING_PERMISSION);

  async function reload() {
    try {
      setItems(await api.get("/production-consumption-returns"));
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
      await api.del(`/production-consumption-returns/${row.id}`);
      await reload();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="برگشت مصرف تولید" />
          <NewRecordButton path={`${basePath}/new`} />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "انبار", render: (r) => r.warehouseTitle, filterType: "string", filterValue: (r) => r.warehouseTitle },
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

interface RowState { sourceProductionConsumptionLineId: string; sourceNumber: string; goodsItemId: string; goodsItemCode: string; goodsItemTitle: string; unitId: string; unitTitle: string; quantity: string; unitCost: number; amount: number; description: string; serialIds: string[]; batchAllocations: { batchId: string; quantity: string }[]; physicalLocation: string }

function emptyRow(): RowState {
  return { sourceProductionConsumptionLineId: "", sourceNumber: "", goodsItemId: "", goodsItemCode: "", goodsItemTitle: "", unitId: "", unitTitle: "", quantity: "", unitCost: 0, amount: 0, description: "", serialIds: [], batchAllocations: [], physicalLocation: "" };
}

function ProductionConsumptionReturnForm({ editId, basePath }: { editId?: number; basePath: string }) {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canViewAccounting = hasPermission(VIEW_ACCOUNTING_PERMISSION);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [goodsItems, setGoodsItems] = useState<GoodsItemRow[]>([]);
  const [pickableLines, setPickableLines] = useState<PickableLine[]>([]);

  const { header, setHeader, rows, setRows, meta, fiscalPeriod, error, setError, loaded, submit, remove } = useDocumentForm<
    { date: string; warehouseId: string; description: string },
    RowState,
    Detail
  >({
    endpoint: "production-consumption-returns",
    editId,
    emptyHeader: (fp) => ({ date: defaultDocumentDate(fp), warehouseId: "", description: "" }),
    emptyRows: () => [emptyRow()],
    mapDetailToHeader: (d) => ({ date: d.date.slice(0, 10), warehouseId: String(d.warehouseId), description: d.description || "" }),
    mapDetailToRows: (d) =>
      d.lines.map((l) => ({
        sourceProductionConsumptionLineId: String(l.sourceProductionConsumptionLineId),
        sourceNumber: l.sourceNumber != null ? String(l.sourceNumber) : "",
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
      const [whs, items]: [Warehouse[], GoodsItemRow[]] = await Promise.all([api.get("/warehouses"), api.get("/goods-items?kind=GOODS")]);
      setWarehouses(whs);
      setGoodsItems(items);
    },
  });

  useEffect(() => {
    if (!header.warehouseId) {
      setPickableLines([]);
      return;
    }
    api.get(`/production-consumption-returns/pickable-lines?warehouseId=${header.warehouseId}`).then(setPickableLines).catch(() => setPickableLines([]));
  }, [header.warehouseId]);

  const isFinalized = meta?.status === "FINALIZED";
  // طبق تصمیم صریح کاربر: فیلدهای مبلغی تا وقتی سند Finalized نشده، اصلاً نمایش داده نمی‌شوند.
  const showAmount = canViewAccounting && isFinalized;
  const coreDisabled = isFinalized;

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function onSourceLineChange(idx: number, sourceProductionConsumptionLineId: string) {
    const src = pickableLines.find((l) => String(l.sourceProductionConsumptionLineId) === sourceProductionConsumptionLineId);
    updateRow(idx, {
      sourceProductionConsumptionLineId,
      sourceNumber: src ? String(src.number) : "",
      goodsItemId: src ? String(src.goodsItemId) : "",
      goodsItemCode: src ? src.goodsItemCode : "",
      goodsItemTitle: src ? src.goodsItemTitle : "",
      unitId: src ? String(src.unitId) : "",
      unitTitle: src ? String(src.unitTitle) : "",
      quantity: src ? String(src.remaining) : "",
    });
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
    const nonEmptyRows = rows.filter((r) => r.sourceProductionConsumptionLineId);
    return {
      date: header.date,
      warehouseId: Number(header.warehouseId),
      description: header.description,
      lines: nonEmptyRows.map((r) => ({
        sourceProductionConsumptionLineId: Number(r.sourceProductionConsumptionLineId),
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
        if (body.lines.length === 0) return "سند برگشت مصرف تولید باید حداقل یک ردیف کالا داشته باشد";
        for (const [i, l] of body.lines.entries()) {
          if (!l.sourceProductionConsumptionLineId) return `ردیف ${i + 1}: انتخاب ردیف مصرف مبدا الزامی است`;
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
      title={editId ? "ویرایش برگشت مصرف تولید" : "برگشت مصرف تولید جدید"}
      description={isFinalized ? "این سند «تایید انبار» شده است؛ سرصفحه، مقدار و کالای ردیف‌ها دیگر قابل ویرایش نیستند." : undefined}
      formId="production-consumption-return-form"
      closePath={basePath}
      newPath={`${basePath}/new`}
      onDelete={editId && !coreDisabled ? handleDelete : undefined}
      saveDisabled={coreDisabled}
      wide
    >
      <form id="production-consumption-return-form" onSubmit={onSubmit}>
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
                  <th>مصرف تولید مبدا</th>
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
                  const src = pickableLines.find((l) => String(l.sourceProductionConsumptionLineId) === row.sourceProductionConsumptionLineId);
                  const sourceDisplay = src ? `${toFaDigits(String(src.number))}` : row.sourceNumber ? toFaDigits(row.sourceNumber) : "";
                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                      <td style={{ minWidth: 90 }}>
                        <RecordPickerField
                          title="انتخاب ردیف مصرف تولید"
                          disabled={coreDisabled}
                          displayValue={sourceDisplay}
                          rows={pickableLines}
                          columns={[
                            { header: "شماره", render: (l) => toFaDigits(String(l.number)), filterValue: (l) => String(l.number), width: "70px" },
                            { header: "کالا", render: (l) => l.goodsItemTitle, filterValue: (l) => l.goodsItemTitle },
                            { header: "مانده قابل برگشت", render: (l) => formatAmountFa(l.remaining), filterValue: (l) => String(l.remaining), width: "100px" },
                          ]}
                          onSelect={(l) => onSourceLineChange(idx, String(l.sourceProductionConsumptionLineId))}
                        />
                      </td>
                      <td style={{ minWidth: 320 }}>
                        <span>{row.goodsItemTitle ? `${toFaDigits(row.goodsItemCode)} — ${row.goodsItemTitle}` : "—"}</span>
                      </td>
                      <td style={{ minWidth: 90, color: "var(--ink-soft)" }}>{row.unitTitle || "—"}</td>
                      <TrackingCells
                        goodsItemId={row.goodsItemId ? Number(row.goodsItemId) : null}
                        item={item}
                        warehouseId={header.warehouseId ? Number(header.warehouseId) : null}
                        documentType="PRODUCTION_CONSUMPTION_RETURN"
                        sourceLineId={row.sourceProductionConsumptionLineId ? Number(row.sourceProductionConsumptionLineId) : null}
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
