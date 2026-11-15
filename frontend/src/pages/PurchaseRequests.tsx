import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { AmountInput } from "../components/AmountInput";
import { RecordPickerField } from "../components/RecordPicker";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { api, ApiError } from "../lib/api";
import { FiscalPeriodRange, fetchSelectedFiscalPeriod, defaultDocumentDate, validateDocumentDate } from "../lib/fiscalYearDefaultDate";
import { DescriptionField } from "../components/DescriptionField";
import { CheckIcon, UndoIcon, RejectIcon, CloseFlagIcon, PlusIcon } from "../components/icons";
import { REQUEST_STATUS_FA } from "../lib/enumLabels";
import { GoodsPickerField } from "../components/GoodsPickerField";
import { GoodsScope, cachedGoods, useGoodsCatalog } from "../lib/goodsCatalog";

const GOODS_SCOPE: GoodsScope = { kind: "GOODS", docDirection: "INBOUND", docType: "خرید" };
type PurchaseRequestBasis = "NO_BASIS" | "SUPPLY_REQUEST";
type RequestStatus = "DRAFT" | "REVIEWED" | "APPROVED" | "REJECTED" | "CLOSED";

interface OrgUnitOption { id: number; code: number; title: string }

interface PickableSupplyRequestLine {
  id: number;
  supplyRequestLineId: number;
  supplyRequestId: number;
  number: number;
  rowOrder: number;
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
  basis: PurchaseRequestBasis;
  orgUnitId: number;
  orgUnitTitle: string;
  description: string | null;
  status: RequestStatus;
  lineCount: number;
}

interface DetailLine {
  id: number;
  sourceSupplyRequestLineId: number | null;
  sourceSupplyRequestNumber: number | null;
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
  basis: PurchaseRequestBasis;
  orgUnitId: number;
  orgUnitTitle: string;
  description: string | null;
  status: RequestStatus;
  reviewedAt: string | null;
  approverName: string | null;
  approvedAt: string | null;
  lines: DetailLine[];
}

const BASIS_FA: Record<PurchaseRequestBasis, string> = { NO_BASIS: "بدون مبنا", SUPPLY_REQUEST: "درخواست تامین" };

const INFO_TEXT =
  "ثبت درخواست خرید کالا از سوی واحدهای مختلف سازمان. اگر مبنا «درخواست تامین» باشد، هر ردیف از یک ردیف تایید‌شده و دارای مانده‌ی " +
  "درخواست تامین با مسیر «خرید» انتخاب می‌شود؛ در غیر این صورت (بدون مبنا) کالا مستقیم انتخاب می‌شود.";

export default function PurchaseRequests() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <PurchaseRequestForm />;
  if (isEdit) return <PurchaseRequestForm editId={Number(id)} />;
  return <PurchaseRequestList />;
}

function PurchaseRequestList() {
  const cacheKey = "/purchase-requests";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      setItems(await api.get("/purchase-requests"));
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
      await api.del(`/purchase-requests/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="درخواست خرید" />
          <NewRecordButton path="/purchase-requests/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "مبنا", render: (r) => BASIS_FA[r.basis], filterType: "string", filterValue: (r) => BASIS_FA[r.basis] },
          { header: "واحد سازمانی", render: (r) => r.orgUnitTitle, filterType: "string", filterValue: (r) => r.orgUnitTitle },
          { header: "شرح", render: (r) => r.description || "—", filterType: "string", filterValue: (r) => r.description || "" },
          { header: "تعداد ردیف", render: (r) => toFaDigits(String(r.lineCount)) },
          { header: "وضعیت", render: (r) => <span className="badge">{REQUEST_STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => REQUEST_STATUS_FA[r.status] },
        ]}
        rows={items}
        edit={{ path: (r) => `/purchase-requests/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

interface RowState {
  sourceSupplyRequestLineId: string;
  sourceSupplyRequestNumber: string;
  goodsItemId: string;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitId: string;
  unitTitle: string;
  quantity: string;
  description: string;
}

function emptyRow(): RowState {
  return { sourceSupplyRequestLineId: "", sourceSupplyRequestNumber: "", goodsItemId: "", goodsItemCode: "", goodsItemTitle: "", unitId: "", unitTitle: "", quantity: "", description: "" };
}

function PurchaseRequestForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [orgUnits, setOrgUnits] = useState<OrgUnitOption[]>([]);
  const [pickableLines, setPickableLines] = useState<PickableSupplyRequestLine[]>([]);
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", basis: "NO_BASIS" as PurchaseRequestBasis, orgUnitId: "", description: "" });
  const [rows, setRows] = usePersistedState<RowState[]>(`${cacheKey}:rows`, []);
  useGoodsCatalog(rows.map((r) => r.goodsItemId));
  const [meta, setMeta] = usePersistedState<{ number: number; status: RequestStatus; reviewedAt: string | null; approverName: string | null; approvedAt: string | null } | null>(
    `${cacheKey}:meta`,
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fiscalPeriod, setFiscalPeriod] = useState<FiscalPeriodRange | null>(null);
  const { flash } = useSavedFlash();

  useEffect(() => {
    async function init() {
      const [units, fp]: [OrgUnitOption[], FiscalPeriodRange | null] = await Promise.all([
        api.get("/org-units"),
        fetchSelectedFiscalPeriod(),
      ]);
      setOrgUnits(units);
      setFiscalPeriod(fp);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        return;
      }

      if (editId) {
        const d: Detail = await api.get(`/purchase-requests/${editId}`);
        setMeta({ number: d.number, status: d.status, reviewedAt: d.reviewedAt, approverName: d.approverName, approvedAt: d.approvedAt });
        setHeader({ date: d.date.slice(0, 10), basis: d.basis, orgUnitId: String(d.orgUnitId), description: d.description || "" });
        setRows(
          d.lines.map((l) => ({
            sourceSupplyRequestLineId: l.sourceSupplyRequestLineId ? String(l.sourceSupplyRequestLineId) : "",
            sourceSupplyRequestNumber: l.sourceSupplyRequestNumber != null ? String(l.sourceSupplyRequestNumber) : "",
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
        setHeader({ date: defaultDocumentDate(fp), basis: "NO_BASIS", orgUnitId: "", description: "" });
        setRows([emptyRow()]);
        setMeta(null);
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  useEffect(() => {
    if (header.basis !== "SUPPLY_REQUEST") return;
    const q = header.date ? `?destDate=${header.date}` : "";
    api
      .get(`/supply-requests/pickable-lines${q}`)
      .then((rows: PickableSupplyRequestLine[]) => setPickableLines(rows))
      .catch(() => setPickableLines([]));
  }, [header.basis, header.date]);

  const status: RequestStatus = meta?.status || "DRAFT";
  const isFullyLocked = status === "APPROVED" || status === "REJECTED" || status === "CLOSED";
  const coreDisabled = isFullyLocked || status === "REVIEWED";
  const hasAnyLine = rows.some((r) => r.goodsItemId || r.sourceSupplyRequestLineId);
  // طبق تصمیم صریح کاربر: به‌محض این‌که یک ردیف انتخاب/وارد شده باشد، کل سرصفحه قفل می‌شود — چون
  // ردیف‌ها بر اساس سرصفحه (واحد سازمانی/تاریخ) انتخاب و ثبت شده‌اند و تغییر بعدی سرصفحه ناسازگاری
  // ایجاد می‌کند.
  const headerDisabled = coreDisabled || hasAnyLine;

  // طبق تصمیم صریح کاربر: تا وقتی فیلدهای الزامی سرصفحه (تاریخ/واحد سازمانی) کامل نشده، ورود اطلاعات
  // ردیف مجاز نیست — اولین تلاش برای باز کردن انتخابگر کالا/ردیف درخواست تامین باید با پیام خطا رد
  // شود.
  function guardRowEntry(): boolean {
    if (!header.date) {
      setError("تاریخ الزامی است");
      return false;
    }
    if (!header.orgUnitId) {
      setError("واحد سازمانی الزامی است");
      return false;
    }
    setError(null);
    return true;
  }

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function onSourceLineChange(idx: number, supplyRequestLineId: string) {
    const src = pickableLines.find((l) => String(l.supplyRequestLineId) === supplyRequestLineId);
    updateRow(idx, {
      sourceSupplyRequestLineId: supplyRequestLineId,
      sourceSupplyRequestNumber: src ? String(src.number) : "",
      goodsItemId: src ? String(src.goodsItemId) : "",
      goodsItemCode: src ? src.goodsItemCode : "",
      goodsItemTitle: src ? src.goodsItemTitle : "",
      unitId: src ? String(src.unitId) : "",
      unitTitle: src ? src.unitTitle : "",
      quantity: src ? String(src.remaining) : "",
    });
  }
  function onGoodsItemChange(idx: number, goodsItemId: string) {
    const item = cachedGoods(Number(goodsItemId));
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
    const nonEmptyRows = rows.filter((r) => r.goodsItemId || r.sourceSupplyRequestLineId);
    return {
      date: header.date,
      basis: header.basis,
      orgUnitId: Number(header.orgUnitId),
      description: header.description,
      lines: nonEmptyRows.map((r) => ({
        sourceSupplyRequestLineId: r.sourceSupplyRequestLineId ? Number(r.sourceSupplyRequestLineId) : null,
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
    if (!header.orgUnitId) return setError("واحد سازمانی الزامی است");
    const dateErr = validateDocumentDate(header.date, fiscalPeriod);
    if (dateErr) return setError(dateErr);
    const body = buildBody();
    if (body.lines.length === 0) return setError("درخواست خرید باید حداقل یک ردیف کالا داشته باشد");
    for (const [i, l] of body.lines.entries()) {
      if (header.basis === "SUPPLY_REQUEST" && !l.sourceSupplyRequestLineId) return setError(`ردیف ${i + 1}: انتخاب درخواست تامین الزامی است`);
      if (header.basis === "NO_BASIS" && !l.goodsItemId) return setError(`کالا برای ردیف ${i + 1} الزامی است`);
      if (!(l.quantity > 0)) return setError(`مقدار ردیف ${i + 1} باید عددی مثبت باشد`);
    }
    try {
      if (editId) {
        await api.put(`/purchase-requests/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/purchase-requests", body);
        flash();
        navigate(`/purchase-requests/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/purchase-requests/${editId}`);
      navigate("/purchase-requests");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function runAction(path: string, confirmMsg?: string) {
    if (!editId) return;
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    try {
      await api.post(`/purchase-requests/${editId}/${path}`, {});
      const d: Detail = await api.get(`/purchase-requests/${editId}`);
      setMeta({ number: d.number, status: d.status, reviewedAt: d.reviewedAt, approverName: d.approverName, approvedAt: d.approvedAt });
      flash();
    } catch (e) {
      showError((e as ApiError).message);
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
      title={editId ? "ویرایش درخواست خرید" : "درخواست خرید جدید"}
      description={isFullyLocked ? `این درخواست در وضعیت «${REQUEST_STATUS_FA[status]}» است و از این فرم قابل ویرایش نیست.` : status === "REVIEWED" ? "در وضعیت «بررسی شده» ویرایش مستقیم امکان‌پذیر نیست؛ برای اصلاح، ابتدا «برگشت از بررسی» را بزنید." : undefined}
      formId="purchase-request-form"
      closePath="/purchase-requests"
      newPath="/purchase-requests/new"
      onDelete={editId && status === "DRAFT" ? handleDelete : undefined}
      saveDisabled={isFullyLocked || status === "REVIEWED"}
      extraActions={extraActions}
      wide
    >
      <form id="purchase-request-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />

        <fieldset disabled={coreDisabled} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="je-header-grid" style={{ marginBottom: 6, maxWidth: 900 }}>
            <div className="form-field">
              <label>شماره</label>
              <input dir="ltr" value={meta ? toFaDigits(String(meta.number)) : "خودکار پس از ذخیره"} disabled />
            </div>
            <div className="form-field">
              <label>وضعیت</label>
              <div><span className="badge">{REQUEST_STATUS_FA[status]}</span></div>
            </div>
            <div className="form-field">
              <label>تاریخ<RequiredMark /></label>
              <JalaliDatePicker fiscalYear value={header.date} onChange={(v) => setHeader({ ...header, date: v })} disabled={headerDisabled} />
            </div>
            <div className="form-field">
              <label>مبنا</label>
              <select value={header.basis} onChange={(e) => setHeader({ ...header, basis: e.target.value as PurchaseRequestBasis })} disabled={headerDisabled}>
                <option value="NO_BASIS">{BASIS_FA.NO_BASIS}</option>
                <option value="SUPPLY_REQUEST">{BASIS_FA.SUPPLY_REQUEST}</option>
              </select>
            </div>
            <div className="form-field">
              <label>واحد سازمانی<RequiredMark /></label>
              <select value={header.orgUnitId} onChange={(e) => setHeader({ ...header, orgUnitId: e.target.value })} disabled={headerDisabled}>
                <option value="">انتخاب کنید</option>
                {orgUnits.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
              </select>
            </div>
            <div className="form-field full">
              <DescriptionField value={header.description} onChange={(v) => setHeader({ ...header, description: v })} disabled={headerDisabled} />
            </div>
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
                  {header.basis === "SUPPLY_REQUEST" && <th>درخواست تامین مبدا</th>}
                  <th>کالا</th>
                  <th>واحد</th>
                  <th>مقدار</th>
                  <th>شرح</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const item = cachedGoods(Number(row.goodsItemId));
                  const src = pickableLines.find((l) => String(l.supplyRequestLineId) === row.sourceSupplyRequestLineId);
                  const sourceDisplay = src ? `${toFaDigits(String(src.number))}` : row.sourceSupplyRequestNumber ? toFaDigits(row.sourceSupplyRequestNumber) : "";
                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                      {header.basis === "SUPPLY_REQUEST" && (
                        <td style={{ minWidth: 90 }}>
                          <RecordPickerField
                            title="انتخاب ردیف درخواست تامین"
                            disabled={coreDisabled}
                            displayValue={sourceDisplay}
                            rows={pickableLines}
                            columns={[
                              { header: "شماره", render: (l) => toFaDigits(String(l.number)), filterValue: (l) => String(l.number), width: "70px" },
                              { header: "کالا", render: (l) => l.goodsItemTitle, filterValue: (l) => l.goodsItemTitle },
                              { header: "مانده", render: (l) => formatAmountFa(l.remaining), filterValue: (l) => String(l.remaining), width: "90px" },
                            ]}
                            onOpen={guardRowEntry}
                            onSelect={(l) => onSourceLineChange(idx, String(l.supplyRequestLineId))}
                          />
                        </td>
                      )}
                      <td style={{ minWidth: 320 }}>
                        {header.basis === "SUPPLY_REQUEST" ? (
                          <span>{row.goodsItemTitle ? `${toFaDigits(row.goodsItemCode)} — ${row.goodsItemTitle}` : "—"}</span>
                        ) : (
                          <GoodsPickerField scope={GOODS_SCOPE} value={row.goodsItemId} title="انتخاب کالا" disabled={coreDisabled} onOpen={guardRowEntry} onSelect={(g) => onGoodsItemChange(idx, String(g.id))} />
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
            <span className="grid-footer-info">{rows.length === 0 ? "بدون ردیف" : `${toFaDigits(String(rows.length))} ردیف`}</span>
            <span className="je-lines-totals">جمع مقدار: {formatAmountFa(totalQuantity)}</span>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
