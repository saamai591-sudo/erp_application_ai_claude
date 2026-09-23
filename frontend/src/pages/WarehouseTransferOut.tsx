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
import { RequiredMark } from "../components/RequiredMark";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";
import { usePermissions } from "../lib/usePermissions";
import { defaultDocumentDate } from "../lib/fiscalYearDefaultDate";
import { useDocumentForm } from "../lib/useDocumentForm";

// «انتقال بین انبارها» به دو سند مستقل تقسیم شده — این صفحه («حواله انتقالی») فقط طرف ارسال (خروج از
// انبار مبدا) را پوشش می‌دهد. با قطعی‌کردن این سند، فقط موجودی انبار مبدا کم می‌شود؛ کالا تا زمانی که
// طرف مقابل با سند مستقل «رسید انتقال» (صفحه‌ی WarehouseTransferIn) آن را دریافت نکند، در موجودی انبار
// مقصد ظاهر نمی‌شود. این فرآیند مستند تحلیل اختصاصی در پروژه ندارد؛ بدون مبنا — نگاه کنید به
// یادداشت‌های backend/src/routes/warehouseTransferOut.ts. طبق تصمیم معماری «ادغام نمای انبارداری/
// حسابداری انبار»: این فرم دیگر دو مسیر/دو مود جدا ندارد — یک نمای واحد است که ستون‌های مبلغی بر اساس
// مجوز کاربر نمایش/عدم‌نمایش داده می‌شوند.
const VIEW_ACCOUNTING_PERMISSION = "inventory.outbound-issues.warehousing-warehouse-transfer-out.viewAccounting";

type DocStatus = "REGISTERED" | "FINALIZED";

interface Warehouse { id: number; code: number; title: string; isActive: boolean }
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

interface ListRow {
  id: number;
  number: number;
  date: string;
  warehouseId: number;
  warehouseTitle: string;
  destWarehouseId: number;
  destWarehouseTitle: string;
  fiscalPeriodTitle: string;
  description: string | null;
  status: DocStatus;
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
  destWarehouseId: number;
  destWarehouseTitle: string;
  fiscalPeriodTitle: string;
  description: string | null;
  status: DocStatus;
  finalizedAt: string | null;
  usedBy: { id: number; number: number }[];
  lines: DetailLine[];
}

const STATUS_FA: Record<DocStatus, string> = { REGISTERED: "ثبت‌شده", FINALIZED: "تایید انبار شده" };
const INFO_TEXT =
  "ثبت طرف ارسال انتقال کالا از این انبار به یک انبار مقصد؛ بدون مبنا. با ذخیره، فقط موجودی انبار مبدا کم می‌شود — افزایش موجودی انبار مقصد با سند جداگانه‌ی «رسید انتقال» و در برابر همین سند ثبت می‌شود.";

export default function WarehouseTransferOut() {
  const location = useLocation();
  const { id } = useParams();
  const basePath = "/warehousing/warehouse-transfer-out";
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <WarehouseTransferOutForm basePath={basePath} />;
  if (isEdit) return <WarehouseTransferOutForm basePath={basePath} editId={Number(id)} />;
  return <WarehouseTransferOutList basePath={basePath} />;
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function WarehouseTransferOutList({ basePath }: { basePath: string }) {
  const cacheKey = basePath;
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const { hasPermission } = usePermissions();
  const canViewAccounting = hasPermission(VIEW_ACCOUNTING_PERMISSION);

  async function reload() {
    try {
      setItems(await api.get("/warehouse-transfer-out"));
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
      await api.del(`/warehouse-transfer-out/${row.id}`);
      await reload();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="حواله انتقالی" />
          <NewRecordButton path={`${basePath}/new`} />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "انبار مبدا", render: (r) => r.warehouseTitle, filterType: "string", filterValue: (r) => r.warehouseTitle },
          { header: "انبار مقصد", render: (r) => r.destWarehouseTitle, filterType: "string", filterValue: (r) => r.destWarehouseTitle },
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
  goodsItemId: string;
  unitId: string;
  quantity: string;
  unitCost: number;
  amount: number;
  description: string;
  serialIds: string[];
  batchAllocations: { batchId: string; quantity: string }[];
  physicalLocation: string;
}

function emptyRow(): RowState {
  return {
    goodsItemId: "",
    unitId: "",
    quantity: "",
    unitCost: 0,
    amount: 0,
    description: "",
    serialIds: [],
    batchAllocations: [],
    physicalLocation: "",
  };
}

function WarehouseTransferOutForm({ editId, basePath }: { editId?: number; basePath: string }) {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canViewAccounting = hasPermission(VIEW_ACCOUNTING_PERMISSION);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [goodsItems, setGoodsItems] = useState<GoodsItemRow[]>([]);

  const { header, setHeader, rows, setRows, meta, fiscalPeriod, error, setError, loaded, submit, remove } = useDocumentForm<
    { date: string; warehouseId: string; destWarehouseId: string; description: string },
    RowState,
    Detail
  >({
    endpoint: "warehouse-transfer-out",
    editId,
    emptyHeader: (fp) => ({ date: defaultDocumentDate(fp), warehouseId: "", destWarehouseId: "", description: "" }),
    emptyRows: () => [emptyRow()],
    mapDetailToHeader: (d) => ({
      date: d.date.slice(0, 10),
      warehouseId: String(d.warehouseId),
      destWarehouseId: String(d.destWarehouseId),
      description: d.description || "",
    }),
    mapDetailToRows: (d) =>
      d.lines.map((l) => ({
        goodsItemId: String(l.goodsItemId),
        unitId: String(l.unitId),
        quantity: String(l.quantity),
        unitCost: l.unitCost ?? 0,
        amount: l.amount ?? 0,
        description: l.description || "",
        serialIds: l.serialIds.map(String),
        batchAllocations: l.batchAllocations.map((a) => ({ batchId: String(a.batchId), quantity: String(a.quantity) })),
        physicalLocation: l.physicalLocation || "",
      })),
    mapDetailToMeta: (d) => ({ number: d.number, status: d.status, fiscalPeriodTitle: d.fiscalPeriodTitle, usedBy: d.usedBy }),
    loadExtra: async () => {
      const [whs, items]: [Warehouse[], GoodsItemRow[]] = await Promise.all([
        api.get("/warehouses"),
        api.get("/goods-items?kind=GOODS&docDirection=OUTBOUND&docType=انتقالی"),
      ]);
      setWarehouses(whs);
      setGoodsItems(items);
    },
  });

  const usedBy = meta?.usedBy ?? [];
  // طبق درخواست صریح کاربر: سندی که یک سند «دریافت» (چه پیش‌نویس چه قطعی) به آن ارجاع دارد، «قفل»
  // است و دیگر قابل ویرایش/حذف نیست — این قفل مستقل از قطعی/غیرقطعی بودن سند است و باید صریحاً همین‌جا
  // فرم را غیرفعال کند؛ بک‌اند هم دقیقاً همین کنترل را قبل از هر نوشتنی اجرا می‌کند.
  const isLocked = usedBy.length > 0;
  const isFinalized = meta?.status === "FINALIZED";
  // طبق تصمیم صریح کاربر: فیلدهای مبلغی تا وقتی سند Finalized نشده، اصلاً نمایش داده نمی‌شوند.
  const showAmount = canViewAccounting && isFinalized;
  const coreDisabled = isFinalized || isLocked;

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function onGoodsItemChange(idx: number, goodsItemId: string) {
    const item = goodsItems.find((g) => g.id === Number(goodsItemId));
    updateRow(idx, { goodsItemId, unitId: item ? String(item.mainUnitId) : "" });
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
      destWarehouseId: Number(header.destWarehouseId),
      description: header.description,
      lines: nonEmptyRows.map((r) => ({
        goodsItemId: Number(r.goodsItemId),
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
        if (!header.warehouseId) return "انبار مبدا الزامی است";
        if (!header.destWarehouseId) return "انبار مقصد الزامی است";
        if (header.warehouseId === header.destWarehouseId) return "انبار مبدا و مقصد نمی‌توانند یکسان باشند";
        if (body.lines.length === 0) return "سند حواله انتقالی باید حداقل یک ردیف کالا داشته باشد";
        for (const [i, l] of body.lines.entries()) {
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

  const sourceOptions = warehouses.filter((w) => w.isActive || String(w.id) === header.warehouseId);
  const destOptions = warehouses.filter((w) => w.isActive || String(w.id) === header.destWarehouseId);

  return (
    <FormPage
      title={editId ? "ویرایش حواله انتقالی" : "حواله انتقالی جدید"}
      description={
        isFinalized
          ? "این سند «تایید انبار» شده است؛ سرصفحه، مقدار و کالای ردیف‌ها دیگر قابل ویرایش نیستند."
          : isLocked
          ? `این سند توسط سند(های) «رسید انتقال» شماره ${usedBy.map((u: { number: number }) => toFaDigits(String(u.number))).join("، ")} استفاده شده و قفل است؛ دیگر قابل ویرایش یا حذف نیست. برای اصلاح، ابتدا آن سند(ها) را حذف کنید.`
          : undefined
      }
      formId="warehouse-transfer-out-form"
      closePath={basePath}
      newPath={`${basePath}/new`}
      onDelete={editId && !coreDisabled ? handleDelete : undefined}
      saveDisabled={coreDisabled}
      wide
    >
      <form id="warehouse-transfer-out-form" onSubmit={onSubmit}>
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
              <label>تاریخ سند<RequiredMark /></label>
              <JalaliDatePicker value={header.date} onChange={(v) => setHeader({ ...header, date: v })} disabled={coreDisabled} />
            </div>
            <div className="form-field">
              <label>انبار مبدا<RequiredMark /></label>
              <select value={header.warehouseId} onChange={(e) => setHeader({ ...header, warehouseId: e.target.value })} disabled={coreDisabled}>
                <option value="">انتخاب کنید</option>
                {sourceOptions.map((w) => (
                  <option key={w.id} value={w.id}>{w.title}{!w.isActive ? " (غیرفعال)" : ""}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>انبار مقصد<RequiredMark /></label>
              <select value={header.destWarehouseId} onChange={(e) => setHeader({ ...header, destWarehouseId: e.target.value })} disabled={coreDisabled}>
                <option value="">انتخاب کنید</option>
                {destOptions.map((w) => (
                  <option key={w.id} value={w.id}>{w.title}{!w.isActive ? " (غیرفعال)" : ""}</option>
                ))}
              </select>
            </div>
            <div className="form-field full">
              <label>شرح</label>
              <input value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} disabled={coreDisabled} />
            </div>
            {header.warehouseId && header.destWarehouseId && header.warehouseId === header.destWarehouseId && (
              <div className="form-field full">
                <span style={{ fontSize: 11, color: "var(--danger, #c0392b)" }}>انبار مبدا و مقصد نمی‌توانند یکسان باشند</span>
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
                      <td style={{ minWidth: 90, color: "var(--ink-soft)" }}>{item?.mainUnit?.title || "—"}</td>
                      <TrackingCells
                        goodsItemId={row.goodsItemId ? Number(row.goodsItemId) : null}
                        item={item}
                        warehouseId={header.warehouseId ? Number(header.warehouseId) : null}
                        documentType="WAREHOUSE_TRANSFER_OUT"
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
