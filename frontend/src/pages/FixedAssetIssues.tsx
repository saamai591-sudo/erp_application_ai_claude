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

// «حواله دارایی ثابت» — طبق stockAnalysis.md بند ۳۴/۴۱؛ نگاه کنید به یادداشت بالای
// backend/src/routes/fixedAssetIssues.ts. بدون طرف‌حساب در سطح سند — اطلاعات تخصصی دارایی در ماژول
// Fixed Assets (که هنوز ساخته نشده) مدیریت می‌شوند. طبق تصمیم معماری «ادغام نمای انبارداری/حسابداری
// انبار»: این فرم دیگر دو مسیر/دو مود جدا ندارد — یک نمای واحد است که ستون‌های مبلغی بر اساس مجوز
// کاربر نمایش/عدم‌نمایش داده می‌شوند.
const VIEW_ACCOUNTING_PERMISSION = "inventory.outbound-issues.fixed-asset-issues.viewAccounting";

type Basis = "NO_BASIS" | "GOODS_REQUEST";
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
interface PickableLine { id: number; sourceGoodsRequestLineId: number; number: number; date: string; orgUnitTitle: string; goodsItemId: number; goodsItemCode: string; goodsItemTitle: string; unitId: number; unitTitle: string; quantity: number; done: number; remaining: number }

interface ListRow { id: number; number: number; date: string; warehouseId: number; warehouseTitle: string; fiscalPeriodTitle: string; basis: Basis; description: string | null; status: DocStatus; lineCount: number; totalQuantity: number; totalAmount?: number }
interface DetailLine { id: number; sourceGoodsRequestLineId: number | null; goodsItemId: number; goodsItemCode: string; goodsItemTitle: string; unitId: number; unitTitle: string; quantity: number; unitCost?: number; amount?: number; description: string | null; serialIds: number[]; batchAllocations: { batchId: number; batchNumber: string; expiryDate: string | null; quantity: number }[]; physicalLocation: string | null }
interface Detail { id: number; number: number; date: string; warehouseId: number; warehouseTitle: string; fiscalPeriodId: number; fiscalPeriodTitle: string; basis: Basis; description: string | null; status: DocStatus; finalizedAt: string | null; lines: DetailLine[] }

const BASIS_FA: Record<Basis, string> = { NO_BASIS: "بدون مبنا", GOODS_REQUEST: "درخواست کالا" };
const STATUS_FA: Record<DocStatus, string> = { REGISTERED: "ثبت‌شده", FINALIZED: "تایید انبار شده" };
const INFO_TEXT = "ثبت حواله دارایی ثابت (خروج کالای دارایی ثابت از انبار) — بدون مبنا یا بر اساس یک درخواست کالای تایید‌شده از نوع دارایی ثابت.";

export default function FixedAssetIssues() {
  const location = useLocation();
  const { id } = useParams();
  const basePath = "/fixed-asset-issues";
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <FixedAssetIssueForm basePath={basePath} />;
  if (isEdit) return <FixedAssetIssueForm basePath={basePath} editId={Number(id)} />;
  return <FixedAssetIssueList basePath={basePath} />;
}

function PlusIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function FixedAssetIssueList({ basePath }: { basePath: string }) {
  const cacheKey = basePath;
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const { hasPermission } = usePermissions();
  const canViewAccounting = hasPermission(VIEW_ACCOUNTING_PERMISSION);

  async function reload() {
    try {
      setItems(await api.get("/fixed-asset-issues"));
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
      await api.del(`/fixed-asset-issues/${row.id}`);
      await reload();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="حواله دارایی ثابت" />
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
          { header: "مبنا", render: (r) => BASIS_FA[r.basis], filterType: "string", filterValue: (r) => BASIS_FA[r.basis] },
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

interface RowState { sourceGoodsRequestLineId: string; sourceNumber: string; goodsItemId: string; goodsItemCode: string; goodsItemTitle: string; unitId: string; unitTitle: string; quantity: string; unitCost: number; amount: number; description: string; serialIds: string[]; batchAllocations: { batchId: string; quantity: string }[]; physicalLocation: string }

function emptyRow(): RowState {
  return { sourceGoodsRequestLineId: "", sourceNumber: "", goodsItemId: "", goodsItemCode: "", goodsItemTitle: "", unitId: "", unitTitle: "", quantity: "", unitCost: 0, amount: 0, description: "", serialIds: [], batchAllocations: [], physicalLocation: "" };
}

function FixedAssetIssueForm({ editId, basePath }: { editId?: number; basePath: string }) {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canViewAccounting = hasPermission(VIEW_ACCOUNTING_PERMISSION);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [goodsItems, setGoodsItems] = useState<GoodsItemRow[]>([]);
  const [pickableLines, setPickableLines] = useState<PickableLine[]>([]);

  const { header, setHeader, rows, setRows, meta, fiscalPeriod, error, setError, loaded, submit, remove } = useDocumentForm<
    { date: string; basis: Basis; warehouseId: string; description: string },
    RowState,
    Detail
  >({
    endpoint: "fixed-asset-issues",
    editId,
    emptyHeader: (fp) => ({ date: defaultDocumentDate(fp), basis: "NO_BASIS", warehouseId: "", description: "" }),
    emptyRows: () => [emptyRow()],
    mapDetailToHeader: (d) => ({ date: d.date.slice(0, 10), basis: d.basis, warehouseId: String(d.warehouseId), description: d.description || "" }),
    mapDetailToRows: (d) =>
      d.lines.map((l) => ({
        sourceGoodsRequestLineId: l.sourceGoodsRequestLineId ? String(l.sourceGoodsRequestLineId) : "",
        sourceNumber: "",
        goodsItemId: String(l.goodsItemId),
        goodsItemCode: l.goodsItemCode,
        goodsItemTitle: l.goodsItemTitle,
        unitId: String(l.unitId),
        unitTitle: l.unitTitle,
        quantity: String(l.quantity),
        unitCost: l.unitCost ?? 0,
        amount: l.amount ?? 0,
        description: l.description || "",
        serialIds: l.serialIds.map(String),
        batchAllocations: l.batchAllocations.map((a) => ({ batchId: String(a.batchId), quantity: String(a.quantity) })),
        physicalLocation: l.physicalLocation || "",
      })),
    mapDetailToMeta: (d) => ({ number: d.number, status: d.status, fiscalPeriodTitle: d.fiscalPeriodTitle }),
    loadExtra: async () => {
      const [whs, items]: [Warehouse[], GoodsItemRow[]] = await Promise.all([
        api.get("/warehouses"),
        api.get("/goods-items?kind=GOODS&docDirection=OUTBOUND&docType=دارایی ثابت"),
      ]);
      setWarehouses(whs);
      setGoodsItems(items);
    },
  });

  useEffect(() => {
    if (header.basis === "NO_BASIS") {
      setPickableLines([]);
      return;
    }
    const q = header.date ? `?destDate=${header.date}` : "";
    api.get(`/fixed-asset-issues/pickable-goods-request-lines${q}`).then(setPickableLines).catch(() => setPickableLines([]));
  }, [header.basis, header.date]);

  const hasAnyLine = rows.some((r) => r.goodsItemId || r.sourceGoodsRequestLineId);
  const isFinalized = meta?.status === "FINALIZED";
  // طبق تصمیم صریح کاربر: فیلدهای مبلغی تا وقتی سند Finalized نشده، اصلاً نمایش داده نمی‌شوند.
  const showAmount = canViewAccounting && isFinalized;
  const coreDisabled = isFinalized;
  // طبق تصمیم صریح کاربر: به‌محض این‌که یک ردیف انتخاب/وارد شده باشد، کل سرصفحه قفل می‌شود — چون
  // ردیف‌ها بر اساس سرصفحه (انبار/تاریخ) انتخاب و ثبت شده‌اند و تغییر بعدی سرصفحه ناسازگاری ایجاد
  // می‌کند.
  const headerDisabled = coreDisabled || hasAnyLine;

  // طبق تصمیم صریح کاربر: تا وقتی فیلدهای الزامی سرصفحه (تاریخ/انبار) کامل نشده، ورود اطلاعات ردیف
  // مجاز نیست — اولین تلاش برای باز کردن انتخابگر کالا/درخواست کالا باید با پیام خطا رد شود.
  function guardRowEntry(): boolean {
    if (!header.date) {
      setError("تاریخ سند الزامی است");
      return false;
    }
    if (!header.warehouseId) {
      setError("انبار الزامی است");
      return false;
    }
    setError(null);
    return true;
  }

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function onSourceLineChange(idx: number, sourceGoodsRequestLineId: string) {
    const src = pickableLines.find((l) => String(l.sourceGoodsRequestLineId) === sourceGoodsRequestLineId);
    updateRow(idx, {
      sourceGoodsRequestLineId,
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
    const nonEmptyRows = rows.filter((r) => r.goodsItemId || r.sourceGoodsRequestLineId);
    return {
      date: header.date,
      basis: header.basis,
      warehouseId: Number(header.warehouseId),
      description: header.description,
      lines: nonEmptyRows.map((r) => ({
        sourceGoodsRequestLineId: r.sourceGoodsRequestLineId ? Number(r.sourceGoodsRequestLineId) : null,
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
        if (body.lines.length === 0) return "سند حواله دارایی ثابت باید حداقل یک ردیف کالا داشته باشد";
        for (const [i, l] of body.lines.entries()) {
          if (header.basis === "GOODS_REQUEST" && !l.sourceGoodsRequestLineId) return `ردیف ${i + 1}: انتخاب ردیف درخواست کالا الزامی است`;
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
  const hasSourceColumn = header.basis !== "NO_BASIS";

  return (
    <FormPage
      title={editId ? "ویرایش حواله دارایی ثابت" : "حواله دارایی ثابت جدید"}
      description={isFinalized ? "این سند «تایید انبار» شده است؛ سرصفحه، مقدار و کالای ردیف‌ها دیگر قابل ویرایش نیستند." : undefined}
      formId="fixed-asset-issue-form"
      closePath={basePath}
      newPath={`${basePath}/new`}
      onDelete={editId && !coreDisabled ? handleDelete : undefined}
      saveDisabled={coreDisabled}
      wide
    >
      <form id="fixed-asset-issue-form" onSubmit={onSubmit}>
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
            <div className="form-field full">
              <label>شرح</label>
              <input value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} disabled={headerDisabled} />
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
                  {hasSourceColumn && <th>درخواست کالای مبدا</th>}
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
                  const src = pickableLines.find((l) => String(l.sourceGoodsRequestLineId) === row.sourceGoodsRequestLineId);
                  const sourceDisplay = src ? `${toFaDigits(String(src.number))}` : row.sourceNumber ? toFaDigits(row.sourceNumber) : "";
                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                      {hasSourceColumn && (
                        <td style={{ minWidth: 90 }}>
                          <RecordPickerField
                            title="انتخاب درخواست کالا"
                            disabled={coreDisabled}
                            displayValue={sourceDisplay}
                            rows={pickableLines}
                            columns={[
                              { header: "شماره", render: (l) => toFaDigits(String(l.number)), filterValue: (l) => String(l.number), width: "70px" },
                              { header: "واحد سازمانی", render: (l) => l.orgUnitTitle, filterValue: (l) => l.orgUnitTitle },
                              { header: "کالا", render: (l) => l.goodsItemTitle, filterValue: (l) => l.goodsItemTitle },
                              { header: "مانده", render: (l) => formatAmountFa(l.remaining), filterValue: (l) => String(l.remaining), width: "90px" },
                            ]}
                            onOpen={guardRowEntry}
                            onSelect={(l) => onSourceLineChange(idx, String(l.sourceGoodsRequestLineId))}
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
                        documentType="FIXED_ASSET_ISSUE"
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
