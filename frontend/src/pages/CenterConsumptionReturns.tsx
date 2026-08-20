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
import { InfoHint } from "../components/InfoHint";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";

// «برگشت مصرف مرکز هزینه» — طبق stockAnalysis.md بند ۴۰: همیشه به یک ردیف مصرف مرکز هزینه‌ی
// قطعی‌شده Reference می‌دهد (نه «بدون مبنا») + کنترل ReturnedQuantity <= IssuedQuantity. نگاه کنید به
// یادداشت بالای backend/src/routes/centerConsumptionReturns.ts.

type DocStatus = "DRAFT" | "FINALIZED" | "VOID";

interface Warehouse { id: number; code: number; title: string; isActive: boolean }
interface GoodsItemRow { id: number; isSerialTracked: boolean; isBatchTracked: boolean; isExpiryTracked: boolean; isLocationTracked: boolean }
interface PickableLine { id: number; sourceCenterConsumptionLineId: number; number: number; date: string; costCenterTitle: string | null; goodsItemId: number; goodsItemCode: string; goodsItemTitle: string; unitId: number; unitTitle: string; quantity: number; done: number; remaining: number }

interface ListRow { id: number; number: number; date: string; warehouseId: number; warehouseTitle: string; fiscalPeriodTitle: string; description: string | null; status: DocStatus; lineCount: number; totalQuantity: number }
interface DetailLine { id: number; sourceCenterConsumptionLineId: number; sourceNumber: number | null; goodsItemId: number; goodsItemCode: string; goodsItemTitle: string; unitId: number; unitTitle: string; quantity: number; unitCost: number; amount: number; description: string | null; serialNumber: string | null; batchNumber: string | null; expiryDate: string | null; physicalLocation: string | null }
interface Detail { id: number; number: number; date: string; warehouseId: number; warehouseTitle: string; fiscalPeriodId: number; fiscalPeriodTitle: string; description: string | null; status: DocStatus; finalizedAt: string | null; lines: DetailLine[] }

const STATUS_FA: Record<DocStatus, string> = { DRAFT: "ثبت", FINALIZED: "قطعی", VOID: "ابطال‌شده" };
const INFO_TEXT = "ثبت برگشت مصرف مرکز هزینه — هر ردیف باید به یک ردیف مصرف مرکز هزینه‌ی قطعی‌شده ارجاع بدهد؛ مقدار برگشتی نمی‌تواند از باقیمانده‌ی قابل برگشت آن ردیف بیشتر باشد.";

export default function CenterConsumptionReturns() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <CenterConsumptionReturnForm />;
  if (isEdit) return <CenterConsumptionReturnForm editId={Number(id)} />;
  return <CenterConsumptionReturnList />;
}

function CheckIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
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
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function CenterConsumptionReturnList() {
  const cacheKey = "/center-consumption-returns";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    try {
      setItems(await api.get("/center-consumption-returns"));
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
      await api.del(`/center-consumption-returns/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="برگشت مصرف مرکز هزینه" />
          <NewRecordButton path="/center-consumption-returns/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "انبار", render: (r) => r.warehouseTitle, filterType: "string", filterValue: (r) => r.warehouseTitle },
          { header: "شرح", render: (r) => r.description || "—", filterType: "string", filterValue: (r) => r.description || "" },
          { header: "تعداد ردیف", render: (r) => toFaDigits(String(r.lineCount)) },
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
        ]}
        rows={items}
        onEdit={(r) => navigate(`/center-consumption-returns/${r.id}/edit`)}
        onDelete={onDelete}
      />
    </div>
  );
}

interface RowState { sourceCenterConsumptionLineId: string; sourceNumber: string; goodsItemId: string; goodsItemCode: string; goodsItemTitle: string; unitId: string; unitTitle: string; quantity: string; description: string; serialNumber: string; batchNumber: string; expiryDate: string; physicalLocation: string }

function emptyRow(): RowState {
  return { sourceCenterConsumptionLineId: "", sourceNumber: "", goodsItemId: "", goodsItemCode: "", goodsItemTitle: "", unitId: "", unitTitle: "", quantity: "", description: "", serialNumber: "", batchNumber: "", expiryDate: "", physicalLocation: "" };
}

function CenterConsumptionReturnForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [goodsItems, setGoodsItems] = useState<GoodsItemRow[]>([]);
  const [pickableLines, setPickableLines] = useState<PickableLine[]>([]);
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", warehouseId: "", description: "" });
  const [rows, setRows] = usePersistedState<RowState[]>(`${cacheKey}:rows`, []);
  const [meta, setMeta] = usePersistedState<{ number: number; status: DocStatus; fiscalPeriodTitle: string } | null>(`${cacheKey}:meta`, null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    async function init() {
      const [whs, items]: [Warehouse[], GoodsItemRow[]] = await Promise.all([api.get("/warehouses"), api.get("/goods-items?kind=GOODS")]);
      setWarehouses(whs);
      setGoodsItems(items);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        return;
      }

      if (editId) {
        const d: Detail = await api.get(`/center-consumption-returns/${editId}`);
        setMeta({ number: d.number, status: d.status, fiscalPeriodTitle: d.fiscalPeriodTitle });
        setHeader({ date: d.date.slice(0, 10), warehouseId: String(d.warehouseId), description: d.description || "" });
        setRows(
          d.lines.map((l) => ({
            sourceCenterConsumptionLineId: String(l.sourceCenterConsumptionLineId),
            sourceNumber: l.sourceNumber != null ? String(l.sourceNumber) : "",
            goodsItemId: String(l.goodsItemId),
            goodsItemCode: l.goodsItemCode,
            goodsItemTitle: l.goodsItemTitle,
            unitId: String(l.unitId),
            unitTitle: l.unitTitle,
            quantity: String(l.quantity),
            description: l.description || "",
            serialNumber: l.serialNumber || "",
            batchNumber: l.batchNumber || "",
            expiryDate: l.expiryDate ? l.expiryDate.slice(0, 10) : "",
            physicalLocation: l.physicalLocation || "",
          }))
        );
      } else {
        setHeader({ date: "", warehouseId: "", description: "" });
        setRows([emptyRow()]);
        setMeta(null);
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  useEffect(() => {
    if (!header.warehouseId) {
      setPickableLines([]);
      return;
    }
    api.get(`/center-consumption-returns/pickable-lines?warehouseId=${header.warehouseId}`).then(setPickableLines).catch(() => setPickableLines([]));
  }, [header.warehouseId]);

  const status: DocStatus = meta?.status || "DRAFT";
  const coreDisabled = !!editId && status !== "DRAFT";

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function onSourceLineChange(idx: number, sourceCenterConsumptionLineId: string) {
    const src = pickableLines.find((l) => String(l.sourceCenterConsumptionLineId) === sourceCenterConsumptionLineId);
    updateRow(idx, {
      sourceCenterConsumptionLineId,
      sourceNumber: src ? String(src.number) : "",
      goodsItemId: src ? String(src.goodsItemId) : "",
      goodsItemCode: src ? src.goodsItemCode : "",
      goodsItemTitle: src ? src.goodsItemTitle : "",
      unitId: src ? String(src.unitId) : "",
      unitTitle: src ? src.unitTitle : "",
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

  function buildBody() {
    const nonEmptyRows = rows.filter((r) => r.sourceCenterConsumptionLineId);
    return {
      date: header.date,
      warehouseId: Number(header.warehouseId),
      description: header.description,
      lines: nonEmptyRows.map((r) => ({
        sourceCenterConsumptionLineId: Number(r.sourceCenterConsumptionLineId),
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
    setError(null);
    if (!header.date) return setError("تاریخ الزامی است");
    if (!header.warehouseId) return setError("انبار الزامی است");
    const body = buildBody();
    if (body.lines.length === 0) return setError("سند برگشت مصرف مرکز هزینه باید حداقل یک ردیف کالا داشته باشد");
    for (const [i, l] of body.lines.entries()) {
      if (!l.sourceCenterConsumptionLineId) return setError(`ردیف ${i + 1}: انتخاب ردیف مصرف مبدا الزامی است`);
      if (!(l.quantity > 0)) return setError(`مقدار ردیف ${i + 1} باید عددی مثبت باشد`);
    }
    try {
      if (editId) {
        await api.put(`/center-consumption-returns/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/center-consumption-returns", body);
        flash();
        navigate(`/center-consumption-returns/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/center-consumption-returns/${editId}`);
      navigate("/center-consumption-returns");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  async function handleFinalize() {
    if (!editId) return;
    try {
      await api.post(`/center-consumption-returns/${editId}/finalize`, {});
      setMeta((prev) => (prev ? { ...prev, status: "FINALIZED" } : prev));
      flash();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  async function handleRevert() {
    if (!editId) return;
    try {
      await api.post(`/center-consumption-returns/${editId}/revert`, {});
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
      title={editId ? "ویرایش برگشت مصرف مرکز هزینه" : "برگشت مصرف مرکز هزینه جدید"}
      description={
        status === "FINALIZED"
          ? "این سند «قطعی» شده و دیگر قابل ویرایش مستقیم نیست؛ برای اصلاح، ابتدا «برگشت از قطعی» را بزنید."
          : status === "VOID"
          ? "این سند «ابطال‌شده» است."
          : undefined
      }
      formId="center-consumption-return-form"
      closePath="/center-consumption-returns"
      newPath="/center-consumption-returns/new"
      onDelete={editId && status === "DRAFT" ? handleDelete : undefined}
      saveDisabled={coreDisabled}
      extraActions={
        meta
          ? [
              ...(status === "DRAFT" ? [{ label: "قطعی کردن", icon: <CheckIcon />, onClick: handleFinalize }] : []),
              ...(status === "FINALIZED" ? [{ label: "برگشت از قطعی", icon: <UndoIcon />, onClick: handleRevert }] : []),
            ]
          : []
      }
      wide
    >
      <form id="center-consumption-return-form" onSubmit={onSubmit}>
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
              <JalaliDatePicker value={header.date} onChange={(v) => setHeader({ ...header, date: v })} disabled={coreDisabled} />
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
                  <th>مصرف مرکز هزینه مبدا</th>
                  <th>کالا</th>
                  <th>واحد</th>
                  <th>سریال</th>
                  <th>شماره بچ</th>
                  <th>تاریخ انقضا</th>
                  <th>محل فیزیکی</th>
                  <th>مقدار</th>
                  <th>شرح</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const item = goodsItems.find((g) => g.id === Number(row.goodsItemId));
                  const src = pickableLines.find((l) => String(l.sourceCenterConsumptionLineId) === row.sourceCenterConsumptionLineId);
                  const sourceDisplay = src
                    ? `${toFaDigits(String(src.number))} — ${src.goodsItemTitle}${src.costCenterTitle ? ` (${src.costCenterTitle})` : ""}`
                    : row.sourceNumber
                    ? toFaDigits(row.sourceNumber)
                    : "";
                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                      <td style={{ minWidth: 240 }}>
                        <RecordPickerField
                          title="انتخاب ردیف مصرف مرکز هزینه"
                          disabled={coreDisabled}
                          displayValue={sourceDisplay}
                          rows={pickableLines}
                          columns={[
                            { header: "شماره", render: (l) => toFaDigits(String(l.number)), filterValue: (l) => String(l.number), width: "70px" },
                            { header: "مرکز هزینه", render: (l) => l.costCenterTitle || "—", filterValue: (l) => l.costCenterTitle || "" },
                            { header: "کالا", render: (l) => l.goodsItemTitle, filterValue: (l) => l.goodsItemTitle },
                            { header: "مانده قابل برگشت", render: (l) => formatAmountFa(l.remaining), filterValue: (l) => String(l.remaining), width: "100px" },
                          ]}
                          onSelect={(l) => onSourceLineChange(idx, String(l.sourceCenterConsumptionLineId))}
                        />
                      </td>
                      <td style={{ minWidth: 200 }}>
                        <span>{row.goodsItemTitle ? `${toFaDigits(row.goodsItemCode)} — ${row.goodsItemTitle}` : "—"}</span>
                      </td>
                      <td style={{ minWidth: 90, color: "var(--ink-soft)" }}>{row.unitTitle || "—"}</td>
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
                      <td style={{ minWidth: 160 }}>
                        <input value={row.description} onChange={(e) => updateRow(idx, { description: e.target.value })} disabled={coreDisabled} />
                      </td>
                      <td>
                        <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => removeRow(idx)} disabled={coreDisabled}>
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
            <span className="je-lines-totals">جمع مقدار: {formatAmountFa(totalQuantity)}</span>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
