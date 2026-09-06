import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { Modal } from "../components/Modal";
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
import { partyDisplayName } from "./Users";
import { FiscalPeriodRange, fetchSelectedFiscalPeriod, defaultDocumentDate, validateDocumentDate } from "../lib/fiscalYearDefaultDate";

// طبق Documents/ServicePurchaseAndItsRelationToStockReceipt.md — این فرم عمداً از فاکتور خرید کالا
// (PurchaseInvoices.tsx) مستقل است. با تایید فاکتور، به‌ازای هر ردیف تسهیم‌شده، یک AmountLine
// (نوع «هزینه‌های مرتبط با ورود کالا») به ردیف رسید انبار مربوطه افزوده می‌شود.

type Basis = "NO_BASIS" | "WAREHOUSE_RECEIPT";
type Status = "DRAFT" | "APPROVED";
type AllocationMethod = "VALUE" | "QUANTITY";

const STATUS_FA: Record<Status, string> = { DRAFT: "ثبت", APPROVED: "تایید شده" };
const BASIS_FA: Record<Basis, string> = { NO_BASIS: "بدون مبنا", WAREHOUSE_RECEIPT: "رسید انبار" };
const ALLOCATION_METHOD_FA: Record<AllocationMethod, string> = { VALUE: "نسبت مبلغ", QUANTITY: "نسبت مقدار" };
const INFO_TEXT =
  "ثبت هزینه‌های مرتبط با ورود کالا (حمل، تخلیه، جرثقیل، بازرسی، کنترل کیفیت و ...) که از طریق ردیف‌های این فاکتور به ردیف‌های یک رسید انبار تخصیص می‌یابند. برای هر ردیف با مبنای «رسید انبار»، سیستم تسهیم اولیه را بین ردیف‌های رسید انتخاب‌شده محاسبه می‌کند؛ کاربر می‌تواند نتیجه را از طریق دکمه‌ی «تسهیم» اصلاح کند. اجرای این عملیات الزامی نیست. با تایید فاکتور، مبلغ تخصیص‌یافته به هر ردیف رسید، به‌عنوان هزینه‌ی مرتبط با ورود کالا به آن ردیف افزوده می‌شود.";

function round(value: number, decimalPlaces: number): number {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(value * factor) / factor;
}
function allocateProportionally(total: number, weights: number[], decimalPlaces: number): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum <= 0) return weights.map(() => 0);
  const shares = weights.map((w) => round((total * w) / sum, decimalPlaces));
  const allocated = shares.reduce((s, v) => s + v, 0);
  const remainder = round(total - allocated, decimalPlaces);
  if (remainder !== 0) {
    const lastPositiveIdx = weights.map((w, i) => (w > 0 ? i : -1)).filter((i) => i >= 0).pop();
    if (lastPositiveIdx !== undefined) shares[lastPositiveIdx] = round(shares[lastPositiveIdx] + remainder, decimalPlaces);
  }
  return shares;
}

interface PartyOption {
  id: number; detailCode: string; category: "INDIVIDUAL" | "LEGAL"; isActive: boolean;
  firstName: string | null; lastName: string | null; name: string | null;
}
interface CurrencyOption { id: number; code: string; title: string; isBase: boolean; decimalPlaces: number }
interface ServiceOption { id: number; fullCode: string; title: string; kind: string }
interface ReceiptOption { id: number; number: number; date: string; warehouseTitle: string }
interface ReceiptLine { id: number; goodsItemCode: string; goodsItemTitle: string; unitTitle: string; quantity: number; amount: number }

interface ListRow {
  id: number; number: number; date: string; vendorInvoiceNumber: string | null;
  partyId: number; partyTitle: string | null; currencyTitle: string; status: Status; lineCount: number; totalAmount: number;
}
interface AllocationDetail {
  inventoryDocumentLineId: number; goodsItemCode: string; goodsItemTitle: string; unitTitle: string; quantity: number; allocatedAmount: number;
}
interface DetailLine {
  id: number; serviceId: number; serviceCode: string; serviceTitle: string; amount: number; basis: Basis;
  sourceReceiptDocumentId: number | null; sourceReceiptNumber: number | null; allocationMethod: AllocationMethod | null;
  description: string | null; allocations: AllocationDetail[];
}
interface Detail extends ListRow {
  currencyId: number; description: string | null; approverName: string | null; approvedAt: string | null; lines: DetailLine[];
}

export default function ServicePurchaseInvoices() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <ServicePurchaseInvoiceForm />;
  if (isEdit) return <ServicePurchaseInvoiceForm editId={Number(id)} />;
  return <ServicePurchaseInvoiceList />;
}

function PlusIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
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

function ServicePurchaseInvoiceList() {
  const cacheKey = "/service-purchase-invoices";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      setItems(await api.get("/service-purchase-invoices"));
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
      await api.del(`/service-purchase-invoices/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="فاکتور خرید خدمات" />
          <NewRecordButton path="/service-purchase-invoices/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "شماره فاکتور فروشنده", render: (r) => (r.vendorInvoiceNumber ? toFaDigits(r.vendorInvoiceNumber) : "—"), filterType: "string", filterValue: (r) => r.vendorInvoiceNumber || "" },
          { header: "طرف مقابل", render: (r) => r.partyTitle || "—", filterType: "string", filterValue: (r) => r.partyTitle || "" },
          { header: "مبلغ کل", render: (r) => formatAmountFa(r.totalAmount) },
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
        ]}
        rows={items}
        edit={{ path: (r) => `/service-purchase-invoices/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

interface RowState {
  serviceId: string; serviceCode: string; serviceTitle: string;
  amount: string;
  basis: Basis;
  sourceReceiptDocumentId: string; sourceReceiptNumber: string;
  allocationMethod: AllocationMethod | "";
  description: string;
  allocations: AllocationDetail[];
}

function emptyRow(): RowState {
  return { serviceId: "", serviceCode: "", serviceTitle: "", amount: "", basis: "NO_BASIS", sourceReceiptDocumentId: "", sourceReceiptNumber: "", allocationMethod: "", description: "", allocations: [] };
}

function ServicePurchaseInvoiceForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [receipts, setReceipts] = useState<ReceiptOption[]>([]);
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", vendorInvoiceNumber: "", partyId: "", currencyId: "", description: "" });
  const [rows, setRows] = usePersistedState<RowState[]>(`${cacheKey}:rows`, []);
  const [meta, setMeta] = usePersistedState<{ number: number; status: Status; approverName: string | null; approvedAt: string | null } | null>(
    `${cacheKey}:meta`,
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fiscalPeriod, setFiscalPeriod] = useState<FiscalPeriodRange | null>(null);
  const [allocationDialogIdx, setAllocationDialogIdx] = useState<number | null>(null);
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    async function init() {
      const [p, c, sv, rc, fp] = await Promise.all([
        api.get("/parties"),
        api.get("/currencies"),
        api.get("/goods-items?kind=SERVICE"),
        api.get("/service-purchase-invoices/pickable-receipts"),
        fetchSelectedFiscalPeriod(),
      ]);
      setParties(p);
      setCurrencies(c);
      setServices(sv);
      setReceipts(rc);
      setFiscalPeriod(fp);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        return;
      }
      if (editId) {
        const d: Detail = await api.get(`/service-purchase-invoices/${editId}`);
        setMeta({ number: d.number, status: d.status, approverName: d.approverName, approvedAt: d.approvedAt });
        setHeader({
          date: d.date.slice(0, 10),
          vendorInvoiceNumber: d.vendorInvoiceNumber || "",
          partyId: String(d.partyId),
          currencyId: String(d.currencyId),
          description: d.description || "",
        });
        setRows(
          d.lines.map((l) => ({
            serviceId: String(l.serviceId),
            serviceCode: l.serviceCode,
            serviceTitle: l.serviceTitle,
            amount: String(l.amount),
            basis: l.basis,
            sourceReceiptDocumentId: l.sourceReceiptDocumentId ? String(l.sourceReceiptDocumentId) : "",
            sourceReceiptNumber: l.sourceReceiptNumber ? String(l.sourceReceiptNumber) : "",
            allocationMethod: l.allocationMethod || "",
            description: l.description || "",
            allocations: l.allocations.map((a) => ({ ...a })),
          }))
        );
      } else {
        setHeader({ date: defaultDocumentDate(fp), vendorInvoiceNumber: "", partyId: "", currencyId: "", description: "" });
        setRows([emptyRow()]);
        setMeta(null);
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const status: Status = meta?.status || "DRAFT";
  const locked = status === "APPROVED";
  const baseCurrency = currencies.find((c) => c.isBase);
  const decimalPlaces = baseCurrency?.decimalPlaces ?? 2;
  const selectedParty = parties.find((p) => String(p.id) === header.partyId);

  function guardRowEntry(): boolean {
    if (!header.date) {
      setError("تاریخ الزامی است");
      return false;
    }
    if (!header.partyId) {
      setError("طرف مقابل الزامی است");
      return false;
    }
    if (!header.currencyId) {
      setError("ارز الزامی است");
      return false;
    }
    setError(null);
    return true;
  }

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }
  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onBasisChange(idx: number, basis: Basis) {
    if (basis === "NO_BASIS") {
      updateRow(idx, { basis, sourceReceiptDocumentId: "", sourceReceiptNumber: "", allocationMethod: "", allocations: [] });
    } else {
      updateRow(idx, { basis });
    }
  }

  async function onReceiptSelected(idx: number, receipt: ReceiptOption) {
    const row = rows[idx];
    const lines: ReceiptLine[] = await api.get(`/service-purchase-invoices/receipt-lines/${receipt.id}`);
    let allocations: AllocationDetail[] = lines.map((l) => ({
      inventoryDocumentLineId: l.id,
      goodsItemCode: l.goodsItemCode,
      goodsItemTitle: l.goodsItemTitle,
      unitTitle: l.unitTitle,
      quantity: l.quantity,
      allocatedAmount: l.amount, // موقتاً وزن (مبلغ ردیف رسید)، تسهیم واقعی پایین بازنویسی می‌شود
    }));
    if (row.allocationMethod) {
      // برای نسبت مقدار، وزن = quantity؛ برای نسبت مبلغ، وزن = مبلغ فعلی ردیف رسید (هر دو از lines موجود است)
      const weights = allocations.map((a, i) => (row.allocationMethod === "QUANTITY" ? lines[i].quantity : lines[i].amount));
      const shares = allocateProportionally(Number(row.amount) || 0, weights, decimalPlaces);
      allocations = allocations.map((a, i) => ({ ...a, allocatedAmount: shares[i] }));
    } else {
      allocations = allocations.map((a) => ({ ...a, allocatedAmount: 0 }));
    }
    updateRow(idx, { sourceReceiptDocumentId: String(receipt.id), sourceReceiptNumber: String(receipt.number), allocations });
  }

  function onMethodChange(idx: number, method: AllocationMethod | "") {
    const row = rows[idx];
    if (!method || !row.sourceReceiptDocumentId) {
      updateRow(idx, { allocationMethod: method });
      return;
    }
    // allocatedAmount بعد از اولین تسهیم دیگر «مبلغ ردیف رسید» نیست — برای بازمحاسبه‌ی روش نسبت مبلغ به
    // مبلغ اصلی ردیف رسید نیاز است، پس ردیف‌ها دوباره از رسید خوانده می‌شوند.
    onReceiptSelectedForMethod(idx, method);
  }

  async function onReceiptSelectedForMethod(idx: number, method: AllocationMethod) {
    const row = rows[idx];
    if (!row.sourceReceiptDocumentId) {
      updateRow(idx, { allocationMethod: method });
      return;
    }
    const lines: ReceiptLine[] = await api.get(`/service-purchase-invoices/receipt-lines/${row.sourceReceiptDocumentId}`);
    const weights = lines.map((l) => (method === "QUANTITY" ? l.quantity : l.amount));
    const shares = allocateProportionally(Number(row.amount) || 0, weights, decimalPlaces);
    const allocations: AllocationDetail[] = lines.map((l, i) => ({
      inventoryDocumentLineId: l.id, goodsItemCode: l.goodsItemCode, goodsItemTitle: l.goodsItemTitle,
      unitTitle: l.unitTitle, quantity: l.quantity, allocatedAmount: shares[i],
    }));
    updateRow(idx, { allocationMethod: method, allocations });
  }

  function onLineAmountChange(idx: number, amount: string) {
    const row = rows[idx];
    if (row.basis === "WAREHOUSE_RECEIPT" && row.allocationMethod && row.sourceReceiptDocumentId) {
      onReceiptAmountChanged(idx, amount, row.allocationMethod);
    } else {
      updateRow(idx, { amount });
    }
  }

  async function onReceiptAmountChanged(idx: number, amount: string, method: AllocationMethod) {
    updateRow(idx, { amount });
    const row = rows[idx];
    if (!row.sourceReceiptDocumentId) return;
    const lines: ReceiptLine[] = await api.get(`/service-purchase-invoices/receipt-lines/${row.sourceReceiptDocumentId}`);
    const weights = lines.map((l) => (method === "QUANTITY" ? l.quantity : l.amount));
    const shares = allocateProportionally(Number(amount) || 0, weights, decimalPlaces);
    const allocations: AllocationDetail[] = lines.map((l, i) => ({
      inventoryDocumentLineId: l.id, goodsItemCode: l.goodsItemCode, goodsItemTitle: l.goodsItemTitle,
      unitTitle: l.unitTitle, quantity: l.quantity, allocatedAmount: shares[i],
    }));
    updateRow(idx, { amount, allocations });
  }

  const totalAmount = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  function buildBody() {
    const nonEmptyRows = rows.filter((r) => r.serviceId);
    return {
      date: header.date,
      vendorInvoiceNumber: header.vendorInvoiceNumber || null,
      partyId: Number(header.partyId),
      currencyId: Number(header.currencyId),
      description: header.description,
      lines: nonEmptyRows.map((r) => ({
        serviceId: Number(r.serviceId),
        amount: Number(r.amount) || 0,
        basis: r.basis,
        sourceReceiptDocumentId: r.basis === "WAREHOUSE_RECEIPT" && r.sourceReceiptDocumentId ? Number(r.sourceReceiptDocumentId) : null,
        allocationMethod: r.basis === "WAREHOUSE_RECEIPT" && r.allocationMethod ? r.allocationMethod : null,
        allocations:
          r.basis === "WAREHOUSE_RECEIPT"
            ? r.allocations.filter((a) => Number(a.allocatedAmount)).map((a) => ({ inventoryDocumentLineId: a.inventoryDocumentLineId, allocatedAmount: Number(a.allocatedAmount) || 0 }))
            : [],
        description: r.description || null,
      })),
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!header.date || !header.partyId || !header.currencyId) return setError("تاریخ، طرف مقابل و ارز الزامی است");
    const dateErr = validateDocumentDate(header.date, fiscalPeriod);
    if (dateErr) return setError(dateErr);
    const body = buildBody();
    if (body.lines.length === 0) return setError("فاکتور خرید خدمات باید حداقل یک ردیف داشته باشد");
    for (const [i, l] of body.lines.entries()) {
      if (!l.serviceId) return setError(`کد هزینه ردیف ${i + 1} الزامی است`);
      if (!(l.amount >= 0)) return setError(`مبلغ ردیف ${i + 1} نامعتبر است`);
      if (l.basis === "WAREHOUSE_RECEIPT" && !l.sourceReceiptDocumentId) return setError(`ردیف ${i + 1}: انتخاب رسید انبار الزامی است`);
    }
    try {
      if (editId) {
        await api.put(`/service-purchase-invoices/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/service-purchase-invoices", body);
        flash();
        navigate(`/service-purchase-invoices/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/service-purchase-invoices/${editId}`);
      navigate("/service-purchase-invoices");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  async function reloadMetaAndRows() {
    if (!editId) return;
    const d: Detail = await api.get(`/service-purchase-invoices/${editId}`);
    setMeta({ number: d.number, status: d.status, approverName: d.approverName, approvedAt: d.approvedAt });
    setRows(
      d.lines.map((l) => ({
        serviceId: String(l.serviceId), serviceCode: l.serviceCode, serviceTitle: l.serviceTitle, amount: String(l.amount),
        basis: l.basis, sourceReceiptDocumentId: l.sourceReceiptDocumentId ? String(l.sourceReceiptDocumentId) : "",
        sourceReceiptNumber: l.sourceReceiptNumber ? String(l.sourceReceiptNumber) : "", allocationMethod: l.allocationMethod || "",
        description: l.description || "", allocations: l.allocations.map((a) => ({ ...a })),
      }))
    );
  }

  async function runAction(action: string, confirmMsg?: string) {
    if (!editId) return;
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    try {
      await api.post(`/service-purchase-invoices/${editId}/${action}`, {});
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
      extraActions.push({ label: "تایید", icon: <CheckIcon />, onClick: () => runAction("approve") });
    } else if (status === "APPROVED") {
      extraActions.push({
        label: "برگشت از تایید",
        icon: <UndoIcon />,
        onClick: () => runAction("unapprove", "با برگشت از تایید، هزینه‌های تخصیص‌یافته از ردیف‌های رسید انبار مرتبط کسر می‌شود. ادامه می‌دهید؟"),
      });
    }
  }

  return (
    <FormPage
      title={editId ? "ویرایش فاکتور خرید خدمات" : "فاکتور خرید خدمات جدید"}
      formId="service-purchase-invoice-form"
      closePath="/service-purchase-invoices"
      newPath="/service-purchase-invoices/new"
      onDelete={editId && status === "DRAFT" ? handleDelete : undefined}
      saveDisabled={locked}
      extraActions={extraActions}
      wide
    >
      <form id="service-purchase-invoice-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}
        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="je-header-grid" style={{ marginBottom: 16, maxWidth: 900 }}>
            <div className="form-field">
              <label>شماره</label>
              <input dir="ltr" value={meta ? toFaDigits(String(meta.number)) : "خودکار پس از ذخیره"} disabled />
            </div>
            <div className="form-field">
              <label>وضعیت</label>
              <div><span className="badge">{STATUS_FA[status]}</span></div>
            </div>
            {meta?.approverName && (
              <div className="form-field">
                <label>تایید کننده</label>
                <input value={`${meta.approverName}${meta.approvedAt ? " — " + formatJalaliDate(meta.approvedAt) : ""}`} disabled />
              </div>
            )}
            <div className="form-field">
              <label>تاریخ<RequiredMark /></label>
              <JalaliDatePicker value={header.date} onChange={(v) => setHeader({ ...header, date: v })} />
            </div>
            <div className="form-field">
              <label>شماره فاکتور فروشنده</label>
              <input value={header.vendorInvoiceNumber} onChange={(e) => setHeader({ ...header, vendorInvoiceNumber: e.target.value })} />
            </div>
            <div className="form-field">
              <label>طرف مقابل<RequiredMark /></label>
              <RecordPickerField
                title="انتخاب طرف مقابل"
                displayValue={selectedParty ? `${toFaDigits(selectedParty.detailCode)} — ${partyDisplayName(selectedParty)}` : ""}
                rows={parties.filter((p) => p.isActive || String(p.id) === header.partyId)}
                columns={[
                  { header: "کد", render: (p) => toFaDigits(p.detailCode), filterValue: (p) => p.detailCode, width: "90px" },
                  { header: "نوع", render: (p) => (p.category === "LEGAL" ? "حقوقی" : "حقیقی"), filterValue: (p) => (p.category === "LEGAL" ? "حقوقی" : "حقیقی"), width: "80px" },
                  { header: "نام", render: (p) => partyDisplayName(p), filterValue: (p) => partyDisplayName(p) },
                ]}
                onSelect={(p) => setHeader({ ...header, partyId: String((p as PartyOption).id) })}
              />
            </div>
            <div className="form-field">
              <label>ارز<RequiredMark /></label>
              <select value={header.currencyId} onChange={(e) => setHeader({ ...header, currencyId: e.target.value })}>
                <option value="">انتخاب کنید</option>
                {currencies.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div className="form-field full">
              <label>شرح</label>
              <input value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} />
            </div>
          </div>

          <div className="je-lines-toolbar">
            <span className="je-lines-title">اقلام</span>
            <button type="button" className="toolbar-icon-btn primary" onClick={() => { if (guardRowEntry()) addRow(); }} title="ردیف جدید">
              <PlusIcon />
            </button>
          </div>

          <div className="grid-wrap je-lines-wrap">
            <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
              <table className="je-lines-table">
                <thead>
                  <tr>
                    <th>ردیف</th>
                    <th>خدمت</th>
                    <th>مبلغ</th>
                    <th>مبنا</th>
                    <th>رسید انبار</th>
                    <th>روش تسهیم</th>
                    <th>شرح</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const svc = services.find((s) => String(s.id) === row.serviceId);
                    const receipt = receipts.find((r) => String(r.id) === row.sourceReceiptDocumentId);
                    const allocatedSum = round(row.allocations.reduce((s, a) => s + (Number(a.allocatedAmount) || 0), 0), decimalPlaces);
                    const balanced = row.basis !== "WAREHOUSE_RECEIPT" || !row.sourceReceiptDocumentId || allocatedSum === round(Number(row.amount) || 0, decimalPlaces);
                    return (
                      <tr key={idx}>
                        <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                        <td style={{ minWidth: 220 }}>
                          <RecordPickerField
                            title="انتخاب کد هزینه (خدمت)"
                            displayValue={svc ? `${toFaDigits(svc.fullCode)} — ${svc.title}` : ""}
                            rows={services}
                            columns={[
                              { header: "کد", render: (s) => toFaDigits((s as ServiceOption).fullCode), filterValue: (s) => (s as ServiceOption).fullCode, width: "110px" },
                              { header: "عنوان", render: (s) => (s as ServiceOption).title, filterValue: (s) => (s as ServiceOption).title },
                            ]}
                            onOpen={guardRowEntry}
                            onSelect={(s) => updateRow(idx, { serviceId: String((s as ServiceOption).id) })}
                          />
                        </td>
                        <td style={{ minWidth: 120 }}>
                          <AmountInput value={row.amount} onChange={(v) => onLineAmountChange(idx, v)} allowDecimal />
                        </td>
                        <td style={{ minWidth: 110 }}>
                          <select value={row.basis} onChange={(e) => onBasisChange(idx, e.target.value as Basis)}>
                            <option value="NO_BASIS">{BASIS_FA.NO_BASIS}</option>
                            <option value="WAREHOUSE_RECEIPT">{BASIS_FA.WAREHOUSE_RECEIPT}</option>
                          </select>
                        </td>
                        <td style={{ minWidth: 130 }}>
                          {row.basis === "WAREHOUSE_RECEIPT" && (
                            <RecordPickerField
                              title="انتخاب رسید انبار"
                              displayValue={receipt ? toFaDigits(String(receipt.number)) : (row.sourceReceiptNumber ? toFaDigits(row.sourceReceiptNumber) : "")}
                              rows={receipts}
                              columns={[
                                { header: "شماره", render: (r) => toFaDigits(String((r as ReceiptOption).number)), filterValue: (r) => String((r as ReceiptOption).number), width: "80px" },
                                { header: "تاریخ", render: (r) => formatJalaliDate((r as ReceiptOption).date), filterValue: (r) => (r as ReceiptOption).date.slice(0, 10), width: "100px" },
                                { header: "انبار", render: (r) => (r as ReceiptOption).warehouseTitle, filterValue: (r) => (r as ReceiptOption).warehouseTitle },
                              ]}
                              onSelect={(r) => onReceiptSelected(idx, r as ReceiptOption)}
                            />
                          )}
                        </td>
                        <td style={{ minWidth: 150 }}>
                          {row.basis === "WAREHOUSE_RECEIPT" && (
                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                              <select value={row.allocationMethod} onChange={(e) => onMethodChange(idx, e.target.value as AllocationMethod | "")}>
                                <option value="">انتخاب کنید</option>
                                {(Object.keys(ALLOCATION_METHOD_FA) as AllocationMethod[]).map((m) => (
                                  <option key={m} value={m}>{ALLOCATION_METHOD_FA[m]}</option>
                                ))}
                              </select>
                              {row.sourceReceiptDocumentId && (
                                <button
                                  type="button"
                                  className="btn secondary"
                                  style={{ padding: "5px 8px", fontSize: 11, whiteSpace: "nowrap" }}
                                  onClick={() => setAllocationDialogIdx(idx)}
                                  title="مشاهده و ویرایش تسهیم"
                                >
                                  تسهیم{!balanced ? " ⚠" : ""}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ minWidth: 140 }}>
                          <input value={row.description} onChange={(e) => updateRow(idx, { description: e.target.value })} />
                        </td>
                        <td>
                          <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => removeRow(idx)}>
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
              <span className="je-lines-totals">جمع مبلغ اقلام: {formatAmountFa(totalAmount)}</span>
            </div>
          </div>
        </fieldset>
      </form>

      {allocationDialogIdx !== null && (
        <AllocationDialog
          serviceTitle={(() => {
            const r = rows[allocationDialogIdx];
            const svc = services.find((s) => String(s.id) === r.serviceId);
            return svc ? svc.title : "";
          })()}
          receiptNumber={Number(rows[allocationDialogIdx].sourceReceiptNumber) || 0}
          lineAmount={Number(rows[allocationDialogIdx].amount) || 0}
          rows={rows[allocationDialogIdx].allocations}
          decimalPlaces={decimalPlaces}
          onApply={(next) => updateRow(allocationDialogIdx, { allocations: next })}
          onClose={() => setAllocationDialogIdx(null)}
        />
      )}
    </FormPage>
  );
}

function AllocationDialog({
  serviceTitle,
  receiptNumber,
  lineAmount,
  rows,
  decimalPlaces,
  onApply,
  onClose,
}: {
  serviceTitle: string;
  receiptNumber: number;
  lineAmount: number;
  rows: AllocationDetail[];
  decimalPlaces: number;
  onApply: (rows: AllocationDetail[]) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<AllocationDetail[]>(rows.map((r) => ({ ...r })));
  const sum = round(local.reduce((s, r) => s + (Number(r.allocatedAmount) || 0), 0), decimalPlaces);
  const target = round(lineAmount, decimalPlaces);
  const balanced = sum === target;

  function updateLocal(idx: number, v: string) {
    setLocal((prev) => prev.map((r, i) => (i === idx ? { ...r, allocatedAmount: Number(v) || 0 } : r)));
  }
  function apply() {
    if (!balanced) return;
    onApply(local);
    onClose();
  }

  return (
    <Modal title={`مشاهده و ویرایش تسهیم — ${serviceTitle} (رسید انبار ${toFaDigits(String(receiptNumber))})`} onClose={onClose}>
      <div className="grid-wrap je-lines-wrap">
        <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", maxHeight: 320, overflowY: "auto" }}>
          <table className="je-lines-table">
            <thead>
              <tr>
                <th>کالا</th>
                <th>مقدار</th>
                <th>مبلغ تسهیم‌شده</th>
              </tr>
            </thead>
            <tbody>
              {local.map((r, idx) => (
                <tr key={r.inventoryDocumentLineId}>
                  <td style={{ minWidth: 220 }}>{toFaDigits(r.goodsItemCode)} — {r.goodsItemTitle}</td>
                  <td style={{ minWidth: 100 }}>{formatAmountFa(r.quantity)} {r.unitTitle}</td>
                  <td style={{ minWidth: 140 }}>
                    <AmountInput value={String(r.allocatedAmount)} onChange={(v) => updateLocal(idx, v)} allowDecimal />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 13 }}>
        جمع تسهیم‌شده: {formatAmountFa(sum)} — مبلغ ردیف فاکتور: {formatAmountFa(target)}
      </div>
      {!balanced && (
        <div className="alert error" style={{ marginTop: 6 }}>
          تسهیم به‌درستی انجام نشده است. مجموع مبالغ تسهیم‌شده باید برابر مبلغ ردیف فاکتور باشد.
        </div>
      )}
      <div className="actions" style={{ marginTop: 12 }}>
        <button type="button" className="btn" onClick={apply} disabled={!balanced}>تایید</button>
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
      </div>
    </Modal>
  );
}
