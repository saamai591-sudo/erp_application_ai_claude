import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { AmountInput } from "../components/AmountInput";
import { RecordPickerField } from "../components/RecordPicker";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";

type SupplyBasis = "FROM_GOODS_REQUEST" | "NO_BASIS";
type SupplyRoute = "TRANSFER" | "PURCHASE";
type RequestStatus = "DRAFT" | "REVIEWED" | "APPROVED" | "REJECTED" | "CLOSED";

interface OrgUnitOption { id: number; code: number; title: string }
interface GoodsItemRow { id: number; fullCode: string; title: string; mainUnitId: number; mainUnit?: { title: string }; isActive: boolean; kind: string }

interface PickableGoodsRequestLine {
  id: number; // = goodsRequestLineId (برای سازگاری با RecordPickerField)
  goodsRequestLineId: number;
  goodsRequestId: number;
  number: number;
  rowOrder: number;
  date: string;
  goodsItemId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitId: number;
  unitTitle: string;
  orgUnitTitle: string;
  quantity: number;
  done: number;
  remaining: number;
}

interface ListRow {
  id: number;
  number: number;
  date: string;
  basis: SupplyBasis;
  route: SupplyRoute;
  orgUnitId: number;
  orgUnitTitle: string;
  description: string | null;
  status: RequestStatus;
  lineCount: number;
  totalQuantity: number;
}

interface DetailLine {
  id: number;
  sourceGoodsRequestLineId: number | null;
  sourceGoodsRequestNumber: number | null;
  sourceGoodsRequestRowOrder: number | null;
  goodsItemId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitId: number;
  unitTitle: string;
  quantity: number;
  description: string | null;
}

interface Detail {
  id: number;
  number: number;
  date: string;
  basis: SupplyBasis;
  route: SupplyRoute;
  orgUnitId: number;
  orgUnitTitle: string;
  description: string | null;
  status: RequestStatus;
  reviewerName: string | null;
  reviewedAt: string | null;
  approverName: string | null;
  approvedAt: string | null;
  lines: DetailLine[];
}

const STATUS_FA: Record<RequestStatus, string> = { DRAFT: "ثبت", REVIEWED: "بررسی شده", APPROVED: "تایید", REJECTED: "رد", CLOSED: "پایان" };
const BASIS_FA: Record<SupplyBasis, string> = { FROM_GOODS_REQUEST: "درخواست تامین (بر مبنای درخواست کالا)", NO_BASIS: "بدون مبنا" };
const ROUTE_FA: Record<SupplyRoute, string> = { TRANSFER: "انتقالی", PURCHASE: "خرید" };

const INFO_TEXT =
  "ثبت اطلاعات درخواست تامین در سیستم. اگر مبنا «درخواست تامین» باشد، هر ردیف از یک ردیف تایید‌شده و دارای مانده‌ی درخواست کالا انتخاب می‌شود " +
  "و کد کالا/واحد آن به‌صورت خودکار پر می‌شود؛ در غیر این صورت (بدون مبنا) کالا مستقیم انتخاب می‌شود. " +
  "فیلد «مسیر تامین» تعیین می‌کند این درخواست در آینده در کدام فرم (حواله انبار یا درخواست خرید) قابل مشاهده خواهد بود.";

export default function SupplyRequests() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <SupplyRequestForm />;
  if (isEdit) return <SupplyRequestForm editId={Number(id)} />;
  return <SupplyRequestList />;
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M7 8H4V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 8A8 8 0 1 1 4 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function RejectIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function CloseFlagIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M6 21V4M6 4h12l-3 4 3 4H6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SupplyRequestList() {
  const cacheKey = "/supply-requests";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const [bulkSlot, setBulkSlot] = useState<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  async function reload() {
    try {
      const rows = await api.get("/supply-requests");
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
    if (row.status !== "DRAFT") {
      alert("فقط درخواست‌های در وضعیت «ثبت» قابل حذف هستند");
      return;
    }
    try {
      await api.del(`/supply-requests/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="درخواست تامین" />
          <NewRecordButton path="/supply-requests/new" />
          <RefreshButton onClick={reload} />
          <div ref={setBulkSlot} className="bulk-slot" style={{ display: "flex" }} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        bulkActionsContainer={bulkSlot}
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "مبنا", render: (r) => BASIS_FA[r.basis], filterType: "string", filterValue: (r) => BASIS_FA[r.basis] },
          { header: "مسیر تامین", render: (r) => ROUTE_FA[r.route], filterType: "string", filterValue: (r) => ROUTE_FA[r.route] },
          { header: "واحد سازمانی", render: (r) => r.orgUnitTitle, filterType: "string", filterValue: (r) => r.orgUnitTitle },
          { header: "شرح", render: (r) => r.description || "—", filterType: "string", filterValue: (r) => r.description || "" },
          { header: "تعداد ردیف", render: (r) => toFaDigits(String(r.lineCount)) },
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
        ]}
        rows={items}
        onEdit={(r) => navigate(`/supply-requests/${r.id}/edit`)}
        onDelete={onDelete}
      />
    </div>
  );
}

interface RowState {
  id?: number;
  sourceGoodsRequestLineId: string;
  sourceGoodsRequestNumber: string;
  sourceGoodsRequestRowOrder: string;
  goodsItemId: string;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitId: string;
  unitTitle: string;
  quantity: string;
  description: string;
}

function emptyRow(): RowState {
  return {
    sourceGoodsRequestLineId: "",
    sourceGoodsRequestNumber: "",
    sourceGoodsRequestRowOrder: "",
    goodsItemId: "",
    goodsItemCode: "",
    goodsItemTitle: "",
    unitId: "",
    unitTitle: "",
    quantity: "",
    description: "",
  };
}

function SupplyRequestForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [orgUnits, setOrgUnits] = useState<OrgUnitOption[]>([]);
  const [goodsItems, setGoodsItems] = useState<GoodsItemRow[]>([]);
  const [pickableLines, setPickableLines] = useState<PickableGoodsRequestLine[]>([]);
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", basis: "NO_BASIS" as SupplyBasis, route: "" as SupplyRoute | "", orgUnitId: "", description: "" });
  const [rows, setRows] = usePersistedState<RowState[]>(`${cacheKey}:rows`, []);
  const [meta, setMeta] = usePersistedState<{
    number: number;
    status: RequestStatus;
    reviewerName: string | null;
    reviewedAt: string | null;
    approverName: string | null;
    approvedAt: string | null;
  } | null>(`${cacheKey}:meta`, null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    async function init() {
      const [units, items]: [OrgUnitOption[], GoodsItemRow[]] = await Promise.all([
        api.get("/org-units"),
        api.get("/goods-items?kind=GOODS"),
      ]);
      setOrgUnits(units);
      setGoodsItems(items);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        return;
      }

      if (editId) {
        const d: Detail = await api.get(`/supply-requests/${editId}`);
        setMeta({ number: d.number, status: d.status, reviewerName: d.reviewerName, reviewedAt: d.reviewedAt, approverName: d.approverName, approvedAt: d.approvedAt });
        setHeader({ date: d.date.slice(0, 10), basis: d.basis, route: d.route, orgUnitId: String(d.orgUnitId), description: d.description || "" });
        setRows(
          d.lines.map((l) => ({
            id: l.id,
            sourceGoodsRequestLineId: l.sourceGoodsRequestLineId ? String(l.sourceGoodsRequestLineId) : "",
            sourceGoodsRequestNumber: l.sourceGoodsRequestNumber != null ? String(l.sourceGoodsRequestNumber) : "",
            sourceGoodsRequestRowOrder: l.sourceGoodsRequestRowOrder != null ? String(l.sourceGoodsRequestRowOrder) : "",
            goodsItemId: String(l.goodsItemId),
            goodsItemCode: l.goodsItemCode,
            goodsItemTitle: l.goodsItemTitle,
            unitId: String(l.unitId),
            unitTitle: l.unitTitle,
            quantity: String(l.quantity),
            description: l.description || "",
          }))
        );
      } else {
        setHeader({ date: "", basis: "NO_BASIS", route: "", orgUnitId: "", description: "" });
        setRows([emptyRow()]);
        setMeta(null);
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  useEffect(() => {
    if (header.basis !== "FROM_GOODS_REQUEST") return;
    const q = header.date ? `?destDate=${header.date}` : "";
    api
      .get(`/goods-requests/pickable-lines${q}`)
      .then((rows: Omit<PickableGoodsRequestLine, "id">[]) => setPickableLines(rows.map((r) => ({ ...r, id: r.goodsRequestLineId }))))
      .catch(() => setPickableLines([]));
  }, [header.basis, header.date]);

  const status: RequestStatus = meta?.status || "DRAFT";
  const isFullyLocked = status === "APPROVED" || status === "REJECTED" || status === "CLOSED";
  const coreDisabled = isFullyLocked || status === "REVIEWED"; // این سند «مقدار تایید شده» مجزا ندارد
  const hasAnyLine = rows.some((r) => r.goodsItemId || r.sourceGoodsRequestLineId);
  const headerDisabled = coreDisabled || hasAnyLine; // کنترل ۳: با درج آیتم، ویرایش هدر ممنوع است

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function onSourceLineChange(idx: number, goodsRequestLineId: string) {
    const src = pickableLines.find((l) => String(l.goodsRequestLineId) === goodsRequestLineId);
    updateRow(idx, {
      sourceGoodsRequestLineId: goodsRequestLineId,
      sourceGoodsRequestNumber: src ? String(src.number) : "",
      sourceGoodsRequestRowOrder: src ? String(src.rowOrder) : "",
      goodsItemId: src ? String(src.goodsItemId) : "",
      goodsItemCode: src ? src.goodsItemCode : "",
      goodsItemTitle: src ? src.goodsItemTitle : "",
      unitId: src ? String(src.unitId) : "",
      unitTitle: src ? src.unitTitle : "",
      // با انتخاب ردیف درخواست کالا، مقدار تایید شده‌ی آن ردیف به‌عنوان مقدار درخواست تامین پیش‌فرض ست می‌شود
      quantity: src ? String(src.quantity) : "",
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

  function buildBody() {
    const nonEmptyRows = rows.filter((r) => r.goodsItemId || r.sourceGoodsRequestLineId);
    return {
      date: header.date,
      basis: header.basis,
      route: header.route,
      orgUnitId: Number(header.orgUnitId),
      description: header.description,
      lines: nonEmptyRows.map((r) => ({
        sourceGoodsRequestLineId: r.sourceGoodsRequestLineId ? Number(r.sourceGoodsRequestLineId) : null,
        goodsItemId: r.goodsItemId ? Number(r.goodsItemId) : undefined,
        unitId: Number(r.unitId),
        quantity: Number(r.quantity) || 0,
        description: r.description || null,
      })),
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!header.date) return setError("تاریخ الزامی است");
    if (!header.route) return setError("مسیر تامین الزامی است");
    if (!header.orgUnitId) return setError("واحد سازمانی الزامی است");
    const body = buildBody();
    if (body.lines.length === 0) return setError("درخواست تامین باید حداقل یک ردیف کالا داشته باشد");
    for (const [i, l] of body.lines.entries()) {
      if (header.basis === "FROM_GOODS_REQUEST" && !l.sourceGoodsRequestLineId) return setError(`ردیف ${i + 1}: انتخاب ردیف درخواست کالای مبدا الزامی است`);
      if (header.basis === "NO_BASIS" && !l.goodsItemId) return setError(`کالا برای ردیف ${i + 1} الزامی است`);
      if (!(l.quantity > 0)) return setError(`مقدار درخواست ردیف ${i + 1} باید عددی مثبت باشد`);
    }
    try {
      if (editId) {
        await api.put(`/supply-requests/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/supply-requests", body);
        flash();
        navigate(`/supply-requests/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/supply-requests/${editId}`);
      navigate("/supply-requests");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  async function runAction(path: string, confirmMsg?: string) {
    if (!editId) return;
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    try {
      await api.post(`/supply-requests/${editId}/${path}`, {});
      const d: Detail = await api.get(`/supply-requests/${editId}`);
      setMeta({ number: d.number, status: d.status, reviewerName: d.reviewerName, reviewedAt: d.reviewedAt, approverName: d.approverName, approvedAt: d.approvedAt });
      flash();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  const extraActions: { label: string; icon: JSX.Element; onClick: () => void }[] = [];
  if (editId && meta) {
    if (status === "DRAFT") {
      extraActions.push({ label: "بررسی", icon: <CheckIcon />, onClick: () => runAction("review") });
      extraActions.push({ label: "تایید", icon: <CheckIcon />, onClick: () => runAction("approve") });
      extraActions.push({ label: "رد درخواست", icon: <RejectIcon />, onClick: () => runAction("reject", "از رد درخواست اطمینان دارید؟") });
    } else if (status === "REVIEWED") {
      extraActions.push({ label: "برگشت از بررسی", icon: <UndoIcon />, onClick: () => runAction("unreview") });
      extraActions.push({ label: "تایید", icon: <CheckIcon />, onClick: () => runAction("approve") });
    } else if (status === "APPROVED") {
      extraActions.push({ label: "برگشت از تایید", icon: <UndoIcon />, onClick: () => runAction("unapprove") });
      extraActions.push({ label: "پایان درخواست", icon: <CloseFlagIcon />, onClick: () => runAction("close", "با انجام این عملیات، این درخواست پایان یافته و امکان استفاده از آن وجود نخواهد داشت.") });
    } else if (status === "REJECTED") {
      extraActions.push({ label: "برگشت از رد", icon: <UndoIcon />, onClick: () => runAction("unreject", "از تغییر وضعیت به ثبت این درخواست اطمینان دارید؟") });
    }
  }

  return (
    <FormPage
      title={editId ? "ویرایش درخواست تامین" : "درخواست تامین جدید"}
      description={
        isFullyLocked
          ? `این درخواست در وضعیت «${STATUS_FA[status]}» است و از این فرم قابل ویرایش نیست.`
          : status === "REVIEWED"
          ? "در وضعیت «بررسی شده» ویرایش مستقیم امکان‌پذیر نیست؛ برای اصلاح، ابتدا «برگشت از بررسی» را بزنید."
          : undefined
      }
      formId="supply-request-form"
      closePath="/supply-requests"
      newPath="/supply-requests/new"
      onDelete={editId && status === "DRAFT" ? handleDelete : undefined}
      saveDisabled={isFullyLocked || status === "REVIEWED"}
      extraActions={extraActions}
      wide
    >
      <form id="supply-request-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}

        <fieldset disabled={coreDisabled} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="je-header-grid" style={{ marginBottom: 16, maxWidth: 900 }}>
          <div className="form-field">
            <label>شماره</label>
            <input dir="ltr" value={meta ? toFaDigits(String(meta.number)) : "خودکار پس از ذخیره"} disabled />
          </div>
          <div className="form-field">
            <label>وضعیت</label>
            <div><span className="badge">{STATUS_FA[status]}</span></div>
          </div>
          <div className="form-field">
            <label>تاریخ</label>
            <JalaliDatePicker value={header.date} onChange={(v) => setHeader({ ...header, date: v })} />
          </div>
          <div className="form-field">
            <label>مبنا</label>
            <select value={header.basis} onChange={(e) => setHeader({ ...header, basis: e.target.value as SupplyBasis })} disabled={headerDisabled}>
              <option value="NO_BASIS">{BASIS_FA.NO_BASIS}</option>
              <option value="FROM_GOODS_REQUEST">{BASIS_FA.FROM_GOODS_REQUEST}</option>
            </select>
          </div>
          <div className="form-field">
            <label>مسیر تامین</label>
            <select value={header.route} onChange={(e) => setHeader({ ...header, route: e.target.value as SupplyRoute })} disabled={headerDisabled}>
              <option value="">انتخاب کنید</option>
              <option value="TRANSFER">{ROUTE_FA.TRANSFER}</option>
              <option value="PURCHASE">{ROUTE_FA.PURCHASE}</option>
            </select>
          </div>
          <div className="form-field">
            <label>واحد سازمانی</label>
            <select value={header.orgUnitId} onChange={(e) => setHeader({ ...header, orgUnitId: e.target.value })} disabled={headerDisabled}>
              <option value="">انتخاب کنید</option>
              {orgUnits.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
            </select>
          </div>
          <div className="form-field full">
            <label>شرح</label>
            <input value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} disabled={headerDisabled} />
          </div>
          {meta?.reviewerName && (
            <div className="form-field">
              <label>بررسی کننده</label>
              <input value={`${meta.reviewerName}${meta.reviewedAt ? " — " + formatJalaliDate(meta.reviewedAt) : ""}`} disabled />
            </div>
          )}
          {meta?.approverName && (
            <div className="form-field">
              <label>تایید کننده</label>
              <input value={`${meta.approverName}${meta.approvedAt ? " — " + formatJalaliDate(meta.approvedAt) : ""}`} disabled />
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
                {header.basis === "FROM_GOODS_REQUEST" && <th>درخواست کالای مبدا</th>}
                <th>کالا</th>
                <th>واحد</th>
                <th>مقدار درخواست</th>
                <th>شرح</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const item = goodsItems.find((g) => g.id === Number(row.goodsItemId));
                const pickerRows = item && !item.isActive ? goodsItems : goodsItems.filter((g) => g.isActive);
                const src = pickableLines.find((l) => String(l.goodsRequestLineId) === row.sourceGoodsRequestLineId);
                const sourceNumber = src ? src.number : (row.sourceGoodsRequestNumber ? Number(row.sourceGoodsRequestNumber) : null);
                const sourceRowOrder = src ? src.rowOrder : (row.sourceGoodsRequestRowOrder ? Number(row.sourceGoodsRequestRowOrder) : null);
                const sourceDisplay =
                  sourceNumber != null && sourceRowOrder != null
                    ? `${toFaDigits(String(sourceNumber))} - ${toFaDigits(String(sourceRowOrder + 1))}`
                    : row.goodsItemTitle
                    ? `${row.goodsItemTitle} (مانده: —)`
                    : "";
                return (
                  <tr key={idx} onClick={() => setFocusedRow(idx)} className={focusedRow === idx ? "active-list" : ""}>
                    <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                    {header.basis === "FROM_GOODS_REQUEST" && (
                      <td style={{ minWidth: 220 }}>
                        <RecordPickerField
                          title="انتخاب ردیف درخواست کالا"
                          disabled={coreDisabled}
                          displayValue={sourceDisplay}
                          rows={pickableLines}
                          columns={[
                            { header: "شماره", render: (l) => toFaDigits(String(l.number)), filterValue: (l) => String(l.number), width: "70px" },
                            { header: "ردیف", render: (l) => toFaDigits(String(l.rowOrder + 1)), filterValue: (l) => String(l.rowOrder + 1), width: "60px" },
                            { header: "کالا", render: (l) => l.goodsItemTitle, filterValue: (l) => l.goodsItemTitle },
                            { header: "واحد سازمانی", render: (l) => l.orgUnitTitle, filterValue: (l) => l.orgUnitTitle },
                            { header: "مانده", render: (l) => formatAmountFa(l.remaining), filterValue: (l) => String(l.remaining), width: "90px" },
                          ]}
                          onOpen={() => setFocusedRow(idx)}
                          onSelect={(l) => onSourceLineChange(idx, String(l.goodsRequestLineId))}
                        />
                      </td>
                    )}
                    <td style={{ minWidth: 200 }}>
                      {header.basis === "FROM_GOODS_REQUEST" ? (
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
                          onOpen={() => setFocusedRow(idx)}
                          onSelect={(g) => onGoodsItemChange(idx, String(g.id))}
                        />
                      )}
                    </td>
                    <td style={{ minWidth: 90, color: "var(--ink-soft)" }}>{item?.mainUnit?.title || row.unitTitle || "—"}</td>
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
          <span className="grid-footer-info">
            {rows.length === 0 ? "بدون ردیف" : `${toFaDigits(String(rows.length))} ردیف`}
          </span>
          <span className="je-lines-totals">جمع مقدار درخواست: {formatAmountFa(totalQuantity)}</span>
        </div>
        </div>
      </form>
    </FormPage>
  );
}
