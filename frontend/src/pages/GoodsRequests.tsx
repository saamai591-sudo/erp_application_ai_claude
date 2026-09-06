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
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";
import { partyDisplayName } from "./Users";
import { FiscalPeriodRange, fetchSelectedFiscalPeriod, defaultDocumentDate, validateDocumentDate } from "../lib/fiscalYearDefaultDate";

type RequestNature = "CENTER_REQUEST" | "PROJECT_REQUEST" | "FIXED_ASSET_REQUEST";
type RequestStatus = "DRAFT" | "REVIEWED" | "APPROVED" | "REJECTED" | "CLOSED";

interface RequestTypeOption { id: number; code: number; title: string; nature: RequestNature }
interface OrgUnitOption { id: number; code: number; title: string }
interface GoodsItemRow { id: number; fullCode: string; title: string; mainUnitId: number; mainUnit?: { title: string }; isActive: boolean; kind: string }
interface CostCenterOption { id: number; title: string }
interface ProjectOption { id: number; detailCode: string; title: string; isActive: boolean }
interface PartyOption { id: number; detailCode: string; firstName: string | null; lastName: string | null; name: string | null; category: "INDIVIDUAL" | "LEGAL"; isActive: boolean }

interface ListRow {
  id: number;
  number: number;
  date: string;
  requestTypeId: number;
  requestTypeTitle: string;
  orgUnitId: number;
  orgUnitTitle: string;
  description: string | null;
  status: RequestStatus;
  lineCount: number;
  totalQuantity: number;
}

interface DetailLine {
  id: number;
  goodsItemId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitId: number;
  unitTitle: string;
  quantity: number;
  approvedQuantity: number | null;
  costCenterId: number | null;
  costCenterTitle: string | null;
  projectId: number | null;
  projectTitle: string | null;
  partyId: number | null;
  partyTitle: string | null;
  description: string | null;
  approvalDescription: string | null;
}

interface Detail {
  id: number;
  number: number;
  date: string;
  requestTypeId: number;
  requestTypeTitle: string;
  requestNature: RequestNature;
  orgUnitId: number;
  orgUnitTitle: string;
  description: string | null;
  status: RequestStatus;
  reviewerId: number | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  approverId: number | null;
  approverName: string | null;
  approvedAt: string | null;
  lines: DetailLine[];
}

const STATUS_FA: Record<RequestStatus, string> = { DRAFT: "ثبت", REVIEWED: "بررسی شده", APPROVED: "تایید", REJECTED: "رد", CLOSED: "پایان" };
const NATURE_FA: Record<RequestNature, string> = { CENTER_REQUEST: "درخواست مرکز", PROJECT_REQUEST: "درخواست پروژه", FIXED_ASSET_REQUEST: "درخواست دارایی ثابت" };

const INFO_TEXT =
  "یکپارچه‌سازی فرآیندهای درخواست کالا توسط کاربران مختلف از واحدهای سازمانی مختلف. " +
  "بسته به «ماهیت» نوع درخواست انتخاب‌شده، فیلد «محل مصرف» هر ردیف به‌ترتیب مرکز هزینه، پروژه یا طرف حساب (شخص حقیقی) خواهد بود. " +
  "گردش وضعیت: ثبت ← بررسی/رد ← تایید ← پایان.";

export default function GoodsRequests() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <GoodsRequestForm />;
  if (isEdit) return <GoodsRequestForm editId={Number(id)} />;
  return <GoodsRequestList />;
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

function GoodsRequestList() {
  const cacheKey = "/goods-requests";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    try {
      const rows = await api.get("/goods-requests");
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
      await api.del(`/goods-requests/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="درخواست کالا" />
          <NewRecordButton path="/goods-requests/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "نوع درخواست", render: (r) => r.requestTypeTitle, filterType: "string", filterValue: (r) => r.requestTypeTitle },
          { header: "واحد سازمانی", render: (r) => r.orgUnitTitle, filterType: "string", filterValue: (r) => r.orgUnitTitle },
          { header: "شرح", render: (r) => r.description || "—", filterType: "string", filterValue: (r) => r.description || "" },
          { header: "تعداد ردیف", render: (r) => toFaDigits(String(r.lineCount)) },
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
        ]}
        rows={items}
        edit={{ path: (r) => `/goods-requests/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

interface RowState {
  id?: number;
  goodsItemId: string;
  unitId: string;
  unitTitle: string;
  quantity: string;
  costCenterId: string;
  projectId: string;
  partyId: string;
  description: string;
  approvedQuantity: string;
  approvalDescription: string;
}

function emptyRow(): RowState {
  return { goodsItemId: "", unitId: "", unitTitle: "", quantity: "", costCenterId: "", projectId: "", partyId: "", description: "", approvedQuantity: "", approvalDescription: "" };
}

function GoodsRequestForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [requestTypes, setRequestTypes] = useState<RequestTypeOption[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnitOption[]>([]);
  const [goodsItems, setGoodsItems] = useState<GoodsItemRow[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenterOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { requestTypeId: "", orgUnitId: "", date: "", description: "" });
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
  const [fiscalPeriod, setFiscalPeriod] = useState<FiscalPeriodRange | null>(null);
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    async function init() {
      const [types, units, items, ccs, projs, pts, fp]: [RequestTypeOption[], OrgUnitOption[], GoodsItemRow[], CostCenterOption[], ProjectOption[], PartyOption[], FiscalPeriodRange | null] =
        await Promise.all([
          api.get("/goods-request-types"),
          api.get("/org-units"),
          api.get("/goods-items?kind=GOODS"),
          api.get("/cost-centers"),
          api.get("/projects").catch(() => []),
          api.get("/parties?category=INDIVIDUAL"),
          fetchSelectedFiscalPeriod(),
        ]);
      setRequestTypes(types);
      setOrgUnits(units);
      setGoodsItems(items);
      setCostCenters(ccs);
      setProjects(projs);
      setParties(pts);
      setFiscalPeriod(fp);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        return;
      }

      if (editId) {
        const d: Detail = await api.get(`/goods-requests/${editId}`);
        setMeta({ number: d.number, status: d.status, reviewerName: d.reviewerName, reviewedAt: d.reviewedAt, approverName: d.approverName, approvedAt: d.approvedAt });
        setHeader({ requestTypeId: String(d.requestTypeId), orgUnitId: String(d.orgUnitId), date: d.date.slice(0, 10), description: d.description || "" });
        setRows(
          d.lines.map((l) => ({
            id: l.id,
            goodsItemId: String(l.goodsItemId),
            unitId: String(l.unitId),
            unitTitle: l.unitTitle,
            quantity: String(l.quantity),
            costCenterId: l.costCenterId ? String(l.costCenterId) : "",
            projectId: l.projectId ? String(l.projectId) : "",
            partyId: l.partyId ? String(l.partyId) : "",
            description: l.description || "",
            approvedQuantity: l.approvedQuantity !== null ? String(l.approvedQuantity) : "",
            approvalDescription: l.approvalDescription || "",
          }))
        );
      } else {
        setHeader({ requestTypeId: "", orgUnitId: "", date: defaultDocumentDate(fp), description: "" });
        setRows([emptyRow(), emptyRow()]);
        setMeta(null);
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const status: RequestStatus = meta?.status || "DRAFT";
  const isFullyLocked = status === "APPROVED" || status === "REJECTED" || status === "CLOSED";
  const isReviewedMode = status === "REVIEWED";
  const coreDisabled = isFullyLocked || isReviewedMode; // فقط در ثبت قابل ویرایش کامل است
  const approvedFieldsDisabled = !isReviewedMode; // فقط در بررسی‌شده قابل ویرایش

  const selectedRequestType = requestTypes.find((t) => String(t.id) === header.requestTypeId);
  const nature = selectedRequestType?.nature;
  const hasAnyLine = rows.some((r) => r.goodsItemId);
  const requestTypeDisabled = coreDisabled || hasAnyLine;

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

  function buildBody() {
    const nonEmptyRows = rows.filter((r) => r.goodsItemId);
    return {
      date: header.date,
      requestTypeId: Number(header.requestTypeId),
      orgUnitId: Number(header.orgUnitId),
      description: header.description,
      lines: nonEmptyRows.map((r) => ({
        goodsItemId: Number(r.goodsItemId),
        unitId: Number(r.unitId),
        quantity: Number(r.quantity) || 0,
        costCenterId: r.costCenterId ? Number(r.costCenterId) : null,
        projectId: r.projectId ? Number(r.projectId) : null,
        partyId: r.partyId ? Number(r.partyId) : null,
        description: r.description || null,
      })),
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (isReviewedMode) {
      try {
        await api.put(`/goods-requests/${editId}/approved-lines`, {
          lines: rows.filter((r) => r.id).map((r) => ({ id: r.id, approvedQuantity: Number(r.approvedQuantity) || 0, approvalDescription: r.approvalDescription || null })),
        });
        flash();
      } catch (err) {
        setError((err as ApiError).message);
      }
      return;
    }

    if (!header.requestTypeId) return setError("نوع درخواست الزامی است");
    if (!header.orgUnitId) return setError("واحد سازمانی الزامی است");
    if (!header.date) return setError("تاریخ الزامی است");
    const dateErr = validateDocumentDate(header.date, fiscalPeriod);
    if (dateErr) return setError(dateErr);
    const body = buildBody();
    if (body.lines.length === 0) return setError("درخواست باید حداقل یک ردیف کالا داشته باشد");
    for (const [i, l] of body.lines.entries()) {
      if (!l.unitId) return setError(`واحد سنجش ردیف ${i + 1} الزامی است`);
      if (!(l.quantity > 0)) return setError(`مقدار درخواست ردیف ${i + 1} باید عددی مثبت باشد`);
      if (nature === "CENTER_REQUEST" && !l.costCenterId) return setError(`محل مصرف (مرکز هزینه) ردیف ${i + 1} الزامی است`);
      if (nature === "PROJECT_REQUEST" && !l.projectId) return setError(`محل مصرف (پروژه) ردیف ${i + 1} الزامی است`);
    }
    try {
      if (editId) {
        await api.put(`/goods-requests/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/goods-requests", body);
        flash();
        navigate(`/goods-requests/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/goods-requests/${editId}`);
      navigate("/goods-requests");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  async function reloadMetaAndRows() {
    if (!editId) return;
    const d: Detail = await api.get(`/goods-requests/${editId}`);
    setMeta({ number: d.number, status: d.status, reviewerName: d.reviewerName, reviewedAt: d.reviewedAt, approverName: d.approverName, approvedAt: d.approvedAt });
    setRows(
      d.lines.map((l) => ({
        id: l.id,
        goodsItemId: String(l.goodsItemId),
        unitId: String(l.unitId),
        unitTitle: l.unitTitle,
        quantity: String(l.quantity),
        costCenterId: l.costCenterId ? String(l.costCenterId) : "",
        projectId: l.projectId ? String(l.projectId) : "",
        partyId: l.partyId ? String(l.partyId) : "",
        description: l.description || "",
        approvedQuantity: l.approvedQuantity !== null ? String(l.approvedQuantity) : "",
        approvalDescription: l.approvalDescription || "",
      }))
    );
  }

  async function runAction(path: string, confirmMsg?: string) {
    if (!editId) return;
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    try {
      await api.post(`/goods-requests/${editId}/${path}`, {});
      await reloadMetaAndRows();
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
      extraActions.push({ label: "برگشت از بررسی", icon: <UndoIcon />, onClick: () => runAction("unreview", "با این عملیات، مقدار تایید شده و شرح تایید حذف خواهد شد") });
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
      title={editId ? "ویرایش درخواست کالا" : "درخواست کالای جدید"}
      description={
        isFullyLocked
          ? `این درخواست در وضعیت «${STATUS_FA[status]}» است و از این فرم قابل ویرایش نیست.`
          : isReviewedMode
          ? "در وضعیت «بررسی شده» فقط ستون‌های «مقدار تایید شده» و «شرح تایید» قابل ویرایش هستند."
          : undefined
      }
      formId="goods-request-form"
      closePath="/goods-requests"
      newPath="/goods-requests/new"
      onDelete={editId && status === "DRAFT" ? handleDelete : undefined}
      saveDisabled={isFullyLocked}
      extraActions={extraActions}
      wide
    >
      <form id="goods-request-form" onSubmit={onSubmit}>
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
            <label>تاریخ<RequiredMark /></label>
            <JalaliDatePicker value={header.date} onChange={(v) => setHeader({ ...header, date: v })} />
          </div>
          <div className="form-field">
            <label>
              نوع درخواست<RequiredMark />
              {hasAnyLine && <FieldHint label="نوع درخواست" text="این درخواست ردیف کالا دارد؛ امکان تغییر نوع وجود ندارد" />}
            </label>
            <select value={header.requestTypeId} onChange={(e) => setHeader({ ...header, requestTypeId: e.target.value })} disabled={requestTypeDisabled}>
              <option value="">انتخاب کنید</option>
              {requestTypes.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>واحد سازمانی<RequiredMark /></label>
            <select value={header.orgUnitId} onChange={(e) => setHeader({ ...header, orgUnitId: e.target.value })}>
              <option value="">انتخاب کنید</option>
              {orgUnits.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
            </select>
          </div>
          <div className="form-field full">
            <label>شرح</label>
            <input value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} />
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
                <th>کالا</th>
                <th>واحد</th>
                <th>مقدار درخواست</th>
                <th>محل مصرف</th>
                <th>شرح</th>
                <th>مقدار تایید شده</th>
                <th>شرح تایید</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const item = goodsItems.find((g) => g.id === Number(row.goodsItemId));
                const pickerRows = item && !item.isActive ? goodsItems : goodsItems.filter((g) => g.isActive);
                const cc = costCenters.find((c) => String(c.id) === row.costCenterId);
                const proj = projects.find((p) => String(p.id) === row.projectId);
                const party = parties.find((p) => String(p.id) === row.partyId);
                return (
                  <tr key={idx} onClick={() => setFocusedRow(idx)} className={focusedRow === idx ? "active-list" : ""}>
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
                        onOpen={() => setFocusedRow(idx)}
                        onSelect={(g) => onGoodsItemChange(idx, String(g.id))}
                      />
                    </td>
                    <td style={{ minWidth: 90, color: "var(--ink-soft)" }}>{item?.mainUnit?.title || row.unitTitle || "—"}</td>
                    <td style={{ minWidth: 130 }}>
                      <AmountInput value={row.quantity} onChange={(v) => updateRow(idx, { quantity: v })} allowDecimal placeholder="۰" disabled={coreDisabled} />
                    </td>
                    <td style={{ minWidth: 180 }}>
                      {nature === "CENTER_REQUEST" && (
                        <RecordPickerField
                          title="انتخاب مرکز هزینه"
                          disabled={coreDisabled}
                          displayValue={cc ? cc.title : ""}
                          rows={costCenters}
                          columns={[{ header: "عنوان", render: (c) => c.title, filterValue: (c) => c.title }]}
                          onSelect={(c) => updateRow(idx, { costCenterId: String(c.id) })}
                          onClear={() => updateRow(idx, { costCenterId: "" })}
                        />
                      )}
                      {nature === "PROJECT_REQUEST" && (
                        <RecordPickerField
                          title="انتخاب پروژه"
                          disabled={coreDisabled}
                          displayValue={proj ? proj.title : ""}
                          rows={projects.filter((p) => p.isActive)}
                          columns={[{ header: "عنوان", render: (p) => p.title, filterValue: (p) => p.title }]}
                          onSelect={(p) => updateRow(idx, { projectId: String(p.id) })}
                          onClear={() => updateRow(idx, { projectId: "" })}
                        />
                      )}
                      {nature === "FIXED_ASSET_REQUEST" && (
                        <RecordPickerField
                          title="انتخاب طرف حساب (شخص حقیقی)"
                          disabled={coreDisabled}
                          displayValue={party ? `${toFaDigits(party.detailCode)} — ${partyDisplayName(party)}` : ""}
                          rows={parties}
                          columns={[
                            { header: "کد", render: (p) => toFaDigits(p.detailCode), filterValue: (p) => p.detailCode, width: "90px" },
                            { header: "نام", render: (p) => partyDisplayName(p), filterValue: (p) => partyDisplayName(p) },
                          ]}
                          onSelect={(p) => updateRow(idx, { partyId: String(p.id) })}
                          onClear={() => updateRow(idx, { partyId: "" })}
                        />
                      )}
                      {!nature && <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>ابتدا نوع درخواست را انتخاب کنید</span>}
                    </td>
                    <td style={{ minWidth: 140 }}>
                      <input value={row.description} onChange={(e) => updateRow(idx, { description: e.target.value })} disabled={coreDisabled} />
                    </td>
                    <td style={{ minWidth: 130 }}>
                      <AmountInput
                        value={row.approvedQuantity}
                        onChange={(v) => updateRow(idx, { approvedQuantity: v })}
                        allowDecimal
                        placeholder="۰"
                        disabled={approvedFieldsDisabled}
                      />
                    </td>
                    <td style={{ minWidth: 140 }}>
                      <input value={row.approvalDescription} onChange={(e) => updateRow(idx, { approvalDescription: e.target.value })} disabled={approvedFieldsDisabled} />
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

        {focusedRow !== null && rows[focusedRow]?.goodsItemId && (
          <div className="je-breadcrumb">
            <div><b>کالا:</b> {goodsItems.find((g) => g.id === Number(rows[focusedRow].goodsItemId))?.title || "—"}</div>
          </div>
        )}
      </form>
    </FormPage>
  );
}
