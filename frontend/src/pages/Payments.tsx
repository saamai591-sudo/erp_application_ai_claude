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
import { partyDisplayName } from "./Users";

// ماژول «خزانه‌داری» > پرداخت. مشابه Receipts.tsx (نگاه کنید به یادداشت‌های آن فایل)، با یک تفاوت
// اصلی: ردیف ابزار «چک» می‌تواند یا صدور چک پرداختنی تازه باشد یا «خرج‌کردن» یک چک دریافتنی موجود
// (که قبلاً از طریق یک سند دریافت دیگر وارد سیستم شده). نگاه کنید به backend/src/routes/payments.ts.

type InstrumentType = "CASH" | "BANK_TRANSFER" | "CHEQUE" | "POS";
type DocStatus = "DRAFT" | "APPROVED";

const TYPE_FA: Record<InstrumentType, string> = { CASH: "نقد", BANK_TRANSFER: "حواله/انتقال بانکی", CHEQUE: "چک", POS: "پوز/درگاه" };
const STATUS_FA: Record<DocStatus, string> = { DRAFT: "ثبت", APPROVED: "تایید" };

interface PartyOption { id: number; detailCode: string; category: "INDIVIDUAL" | "LEGAL"; isActive: boolean; firstName: string | null; lastName: string | null; name: string | null }
interface CurrencyOption { id: number; code: string; title: string }
interface CashBoxOption { id: number; title: string }
interface BankAccountOption { id: number; accountNumber: string; detailCode: string; bankBranch: { title: string } }
interface BankBranchOption { id: number; title: string }
interface PickableInvoice { id: number; purchaseInvoiceId: number; number: number; date: string; total: number; applied: number; remaining: number }
interface PickableCheque { id: number; number: string; dueDate: string; amount: number; partyDisplay: string; currencyTitle: string }

interface ListRow {
  id: number;
  number: number;
  date: string;
  partyId: number;
  partyDisplay: string;
  fiscalPeriodTitle: string;
  currencyId: number;
  currencyTitle: string;
  description: string | null;
  status: DocStatus;
  totalAmount: number;
}

interface DetailInstrumentLine {
  id: number;
  type: InstrumentType;
  amount: number;
  cashBoxId: number | null;
  bankAccountId: number | null;
  referenceNumber: string | null;
  chequeItemId: number | null;
  chequeItemNumber?: string;
  // برای تشخیص ردیف «قفل» (فاز ۲.۲ — سند نیمه‌باز): نگاه کنید به توضیح مشابه در Receipts.tsx و
  // backend/src/routes/payments.ts.
  chequeStep: number | null;
  chequeItemStep: number | null;
  chequeNumber: string | null;
  chequeDueDate: string | null;
  chequeBankBranchId: number | null;
  posTerminal: string | null;
  description: string | null;
}
interface DetailSettlementLine {
  id: number;
  purchaseInvoiceId: number | null;
  purchaseInvoiceNumber?: number;
  amount: number;
  description: string | null;
}
interface Detail {
  id: number;
  number: number;
  date: string;
  partyId: number;
  partyDisplay: string;
  fiscalPeriodTitle: string;
  currencyId: number;
  currencyTitle: string;
  description: string | null;
  status: DocStatus;
  instrumentLines: DetailInstrumentLine[];
  settlementLines: DetailSettlementLine[];
}

function infoText() {
  return (
    "ثبت پرداخت وجه به یک طرف حساب از طریق نقد، حواله/انتقال بانکی، چک یا پوز. تسویه می‌تواند بابت حساب طرف " +
    "(عمومی) یا عطف به یک فاکتور خرید مشخص باشد. ردیف «چک» می‌تواند صدور یک چک پرداختنی تازه باشد یا خرج‌کردن " +
    "یک چک دریافتنی موجود که قبلاً از یک سند دریافت دیگر وارد سیستم شده. فعلاً هیچ سند حسابداری خودکاری صادر نمی‌شود."
  );
}

export default function Payments() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <PaymentForm />;
  if (isEdit) return <PaymentForm editId={Number(id)} />;
  return <PaymentList />;
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
function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PaymentList() {
  const cacheKey = "/payments";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const [bulkSlot, setBulkSlot] = useState<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  async function reload() {
    try {
      setItems(await api.get("/payments"));
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
      alert("فقط اسناد در وضعیت «ثبت» قابل حذف هستند؛ ابتدا از «تایید» برگردانید");
      return;
    }
    try {
      await api.del(`/payments/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={infoText()} title="پرداخت" />
          <NewRecordButton path="/payments/new" />
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
          { header: "طرف حساب", render: (r) => r.partyDisplay, filterType: "string", filterValue: (r) => r.partyDisplay },
          { header: "ارز", render: (r) => r.currencyTitle, filterType: "string", filterValue: (r) => r.currencyTitle },
          { header: "شرح", render: (r) => r.description || "—", filterType: "string", filterValue: (r) => r.description || "" },
          { header: "جمع مبلغ", render: (r) => formatAmountFa(r.totalAmount) },
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
        ]}
        rows={items}
        onEdit={(r) => navigate(`/payments/${r.id}/edit`)}
        onDelete={onDelete}
      />
    </div>
  );
}

interface InstrumentRowState {
  id?: number;
  type: InstrumentType;
  amount: string;
  cashBoxId: string;
  bankAccountId: string;
  referenceNumber: string;
  chequeMode: "NEW" | "SPEND";
  chequeItemId: string;
  chequeItemDisplay: string;
  chequeNumber: string;
  chequeDueDate: string;
  chequeBankBranchId: string;
  posTerminal: string;
  description: string;
  // فقط برای ردیف‌های موجود (id دار) — برای تشخیص «قفل» بودن ردیف در سند «تایید»شده.
  chequeStep?: number | null;
  chequeItemStep?: number | null;
}
function emptyInstrumentRow(): InstrumentRowState {
  return {
    type: "CASH",
    amount: "",
    cashBoxId: "",
    bankAccountId: "",
    referenceNumber: "",
    chequeMode: "NEW",
    chequeItemId: "",
    chequeItemDisplay: "",
    chequeNumber: "",
    chequeDueDate: "",
    chequeBankBranchId: "",
    posTerminal: "",
    description: "",
  };
}
// مشابه isRowLocked در Receipts.tsx: ردیف چک «قفل» است اگر step فعلی چک با chequeStep همین ردیف
// برابر نباشد (یعنی از زمان این سند، اتفاق دیگری برای آن چک افتاده — واگذاری/وصول/خرج در سند دیگر).
function isRowLocked(row: InstrumentRowState, semiOpen: boolean) {
  return semiOpen && !!row.id && !!row.chequeItemId && row.chequeStep !== row.chequeItemStep;
}

interface SettlementRowState {
  purchaseInvoiceId: string;
  invoiceDisplay: string;
  amount: string;
  description: string;
}
function emptySettlementRow(): SettlementRowState {
  return { purchaseInvoiceId: "", invoiceDisplay: "", amount: "", description: "" };
}

function PaymentForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [cashBoxes, setCashBoxes] = useState<CashBoxOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [bankBranches, setBankBranches] = useState<BankBranchOption[]>([]);
  const [pickableCheques, setPickableCheques] = useState<PickableCheque[]>([]);
  const [pickableInvoices, setPickableInvoices] = useState<PickableInvoice[]>([]);
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", partyId: "", partyDisplay: "", currencyId: "", description: "" });
  const [instrumentRows, setInstrumentRows] = usePersistedState<InstrumentRowState[]>(`${cacheKey}:instrumentRows`, []);
  const [settlementRows, setSettlementRows] = usePersistedState<SettlementRowState[]>(`${cacheKey}:settlementRows`, []);
  const [meta, setMeta] = usePersistedState<{ number: number; status: DocStatus; fiscalPeriodTitle: string } | null>(`${cacheKey}:meta`, null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { saved, flash } = useSavedFlash();

  function applyDetail(d: Detail) {
    setMeta({ number: d.number, status: d.status, fiscalPeriodTitle: d.fiscalPeriodTitle });
    setHeader({ date: d.date.slice(0, 10), partyId: String(d.partyId), partyDisplay: d.partyDisplay, currencyId: String(d.currencyId), description: d.description || "" });
    setInstrumentRows(
      d.instrumentLines.map((l) => ({
        id: l.id,
        type: l.type,
        amount: String(l.amount),
        cashBoxId: l.cashBoxId ? String(l.cashBoxId) : "",
        bankAccountId: l.bankAccountId ? String(l.bankAccountId) : "",
        referenceNumber: l.referenceNumber || "",
        chequeMode: l.chequeItemId && !l.chequeNumber ? "SPEND" : "NEW",
        chequeItemId: l.chequeItemId ? String(l.chequeItemId) : "",
        chequeItemDisplay: l.chequeItemNumber ? toFaDigits(l.chequeItemNumber) : "",
        chequeNumber: l.chequeNumber || "",
        chequeDueDate: l.chequeDueDate ? l.chequeDueDate.slice(0, 10) : "",
        chequeBankBranchId: l.chequeBankBranchId ? String(l.chequeBankBranchId) : "",
        posTerminal: l.posTerminal || "",
        description: l.description || "",
        chequeStep: l.chequeStep,
        chequeItemStep: l.chequeItemStep,
      }))
    );
    setSettlementRows(
      d.settlementLines.map((l) => ({
        purchaseInvoiceId: l.purchaseInvoiceId ? String(l.purchaseInvoiceId) : "",
        invoiceDisplay: l.purchaseInvoiceNumber ? toFaDigits(String(l.purchaseInvoiceNumber)) : "",
        amount: String(l.amount),
        description: l.description || "",
      }))
    );
  }

  useEffect(() => {
    async function init() {
      const [ps, cs, cbs, bas, bbs, cheques]: [PartyOption[], CurrencyOption[], CashBoxOption[], BankAccountOption[], BankBranchOption[], PickableCheque[]] = await Promise.all([
        api.get("/parties"),
        api.get("/currencies"),
        api.get("/cash-boxes"),
        api.get("/banking/accounts"),
        api.get("/banking/branches"),
        api.get("/cheques/pickable-receivable"),
      ]);
      setParties(ps);
      setCurrencies(cs);
      setCashBoxes(cbs);
      setBankAccounts(bas);
      setBankBranches(bbs);
      setPickableCheques(cheques);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        // این تب می‌تواند مدت‌ها باز مانده باشد (سوییچ بین تب‌ها مقدار کش‌شده را حفظ می‌کند —
        // نگاه کنید به usePersistedState) و در همین فاصله چک یکی از ردیف‌ها از طریق سند دیگری
        // جابه‌جا شده باشد. بدون این بازخوانی، chequeItemStep کش‌شده قدیمی می‌ماند و isRowLocked
        // ردیف را اشتباهاً «قفل‌نشده» تشخیص می‌دهد. فقط وضعیت سند و step ردیف‌های چکی را از سرور
        // تازه می‌کنیم؛ بقیه‌ی ورودی‌های کاربر دست‌نخورده می‌ماند.
        if (editId) {
          try {
            const d: Detail = await api.get(`/payments/${editId}`);
            setMeta((prev) => (prev ? { ...prev, status: d.status } : prev));
            const stepById = new Map(d.instrumentLines.map((l) => [l.id, { chequeStep: l.chequeStep, chequeItemStep: l.chequeItemStep }]));
            setInstrumentRows((prev) => prev.map((r) => (r.id && stepById.has(r.id) ? { ...r, ...stepById.get(r.id)! } : r)));
          } catch {
            // اگر واکشی ناموفق شد، به مقادیر کش‌شده بسنده می‌شود؛ ذخیره‌سازی همچنان توسط سرور اعتبارسنجی می‌شود
          }
        }
        return;
      }

      if (editId) {
        const d: Detail = await api.get(`/payments/${editId}`);
        applyDetail(d);
      } else {
        setHeader({ date: "", partyId: "", partyDisplay: "", currencyId: "", description: "" });
        setInstrumentRows([emptyInstrumentRow()]);
        setSettlementRows([emptySettlementRow()]);
        setMeta(null);
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  useEffect(() => {
    if (!header.partyId) {
      setPickableInvoices([]);
      return;
    }
    const excl = editId ? `&excludePaymentId=${editId}` : "";
    api
      .get(`/payments/pickable-purchase-invoices?partyId=${header.partyId}${excl}`)
      .then((rows: PickableInvoice[]) => setPickableInvoices(rows))
      .catch(() => setPickableInvoices([]));
  }, [header.partyId, editId]);

  const status: DocStatus = meta?.status || "DRAFT";
  // فقط فیلدهای هدر (تاریخ/طرف حساب/ارز) با این معیار قفل می‌شوند.
  const coreDisabled = !!editId && status !== "DRAFT";
  // فاز ۲.۲ — سند نیمه‌باز: نگاه کنید به توضیح مشابه در Receipts.tsx.
  const isApprovedSemiOpen = !!editId && status === "APPROVED";

  function updateInstrumentRow(idx: number, patch: Partial<InstrumentRowState>) {
    setInstrumentRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addInstrumentRow() {
    setInstrumentRows((prev) => [...prev, emptyInstrumentRow()]);
  }
  function removeInstrumentRow(idx: number) {
    setInstrumentRows((prev) => {
      const row = prev[idx];
      if (row && isRowLocked(row, isApprovedSemiOpen)) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  }

  function updateSettlementRow(idx: number, patch: Partial<SettlementRowState>) {
    setSettlementRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addSettlementRow() {
    setSettlementRows((prev) => [...prev, emptySettlementRow()]);
  }
  function removeSettlementRow(idx: number) {
    setSettlementRows((prev) => prev.filter((_, i) => i !== idx));
  }

  const instrumentTotal = instrumentRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const settlementTotal = settlementRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  function buildBody() {
    return {
      date: header.date,
      partyId: Number(header.partyId),
      currencyId: Number(header.currencyId),
      description: header.description,
      instrumentLines: instrumentRows
        .filter((r) => Number(r.amount) > 0)
        .map((r) => ({
          type: r.type,
          amount: Number(r.amount) || 0,
          cashBoxId: r.cashBoxId ? Number(r.cashBoxId) : null,
          bankAccountId: r.type === "CHEQUE" && r.chequeMode === "SPEND" ? null : r.bankAccountId ? Number(r.bankAccountId) : null,
          referenceNumber: r.referenceNumber || null,
          chequeItemId: r.type === "CHEQUE" && r.chequeMode === "SPEND" ? Number(r.chequeItemId) : null,
          chequeNumber: r.type === "CHEQUE" && r.chequeMode === "NEW" ? r.chequeNumber || null : null,
          chequeDueDate: r.type === "CHEQUE" && r.chequeMode === "NEW" ? r.chequeDueDate || null : null,
          chequeBankBranchId: r.type === "CHEQUE" && r.chequeMode === "NEW" ? (r.chequeBankBranchId ? Number(r.chequeBankBranchId) : null) : null,
          posTerminal: r.posTerminal || null,
          description: r.description || null,
        })),
      settlementLines: settlementRows
        .filter((r) => Number(r.amount) > 0)
        .map((r) => ({
          purchaseInvoiceId: r.purchaseInvoiceId ? Number(r.purchaseInvoiceId) : null,
          amount: Number(r.amount) || 0,
          description: r.description || null,
        })),
    };
  }

  // بدنه‌ی درخواست PUT /payments/:id/edit-approved (سند نیمه‌باز): مشابه buildBody اما فقط ردیف‌های
  // ابزار «قفل‌نشده» را می‌فرستد (با id برای ردیف‌های موجود) و ردیف‌های قفل‌شده اصلاً در درخواست
  // حاضر نیستند — سرور خودش آن‌ها را حفظ می‌کند.
  function buildApprovedEditBody() {
    return {
      description: header.description,
      instrumentLines: instrumentRows
        .filter((r) => !isRowLocked(r, isApprovedSemiOpen))
        .filter((r) => Number(r.amount) > 0)
        .map((r) => ({
          id: r.id,
          type: r.type,
          amount: Number(r.amount) || 0,
          cashBoxId: r.cashBoxId ? Number(r.cashBoxId) : null,
          bankAccountId: r.type === "CHEQUE" && r.chequeMode === "SPEND" ? null : r.bankAccountId ? Number(r.bankAccountId) : null,
          referenceNumber: r.referenceNumber || null,
          chequeItemId: r.type === "CHEQUE" && r.chequeMode === "SPEND" ? Number(r.chequeItemId) : null,
          chequeNumber: r.type === "CHEQUE" && r.chequeMode === "NEW" ? r.chequeNumber || null : null,
          chequeDueDate: r.type === "CHEQUE" && r.chequeMode === "NEW" ? r.chequeDueDate || null : null,
          chequeBankBranchId: r.type === "CHEQUE" && r.chequeMode === "NEW" ? (r.chequeBankBranchId ? Number(r.chequeBankBranchId) : null) : null,
          posTerminal: r.posTerminal || null,
          description: r.description || null,
        })),
      settlementLines: settlementRows
        .filter((r) => Number(r.amount) > 0)
        .map((r) => ({
          purchaseInvoiceId: r.purchaseInvoiceId ? Number(r.purchaseInvoiceId) : null,
          amount: Number(r.amount) || 0,
          description: r.description || null,
        })),
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (isApprovedSemiOpen) {
      const body = buildApprovedEditBody();
      if (body.settlementLines.length === 0) return setError("حداقل یک ردیف تسویه الزامی است");
      if (Math.abs(instrumentTotal - settlementTotal) > 0.001) return setError("مجموع ردیف‌های تسویه باید با مجموع ردیف‌های ابزار پرداخت برابر باشد");
      try {
        await api.put(`/payments/${editId}/edit-approved`, body);
        const d: Detail = await api.get(`/payments/${editId}`);
        applyDetail(d);
        flash();
      } catch (err) {
        setError((err as ApiError).message);
      }
      return;
    }

    if (!header.date) return setError("تاریخ الزامی است");
    if (!header.partyId) return setError("طرف حساب الزامی است");
    if (!header.currencyId) return setError("ارز الزامی است");
    const body = buildBody();
    if (body.instrumentLines.length === 0) return setError("حداقل یک ردیف ابزار پرداخت الزامی است");
    if (body.settlementLines.length === 0) return setError("حداقل یک ردیف تسویه الزامی است");
    if (Math.abs(instrumentTotal - settlementTotal) > 0.001) return setError("مجموع ردیف‌های تسویه باید با مجموع ردیف‌های ابزار پرداخت برابر باشد");
    try {
      if (editId) {
        await api.put(`/payments/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/payments", body);
        flash();
        navigate(`/payments/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/payments/${editId}`);
      navigate("/payments");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  async function handleApprove() {
    if (!editId) return;
    try {
      await api.post(`/payments/${editId}/approve`, {});
      const d: Detail = await api.get(`/payments/${editId}`);
      applyDetail(d);
      flash();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  async function handleUnapprove() {
    if (!editId) return;
    try {
      await api.post(`/payments/${editId}/unapprove`, {});
      const d: Detail = await api.get(`/payments/${editId}`);
      applyDetail(d);
      flash();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش سند پرداخت" : "سند پرداخت جدید"}
      description={status === "APPROVED" ? "این سند «تایید» شده؛ تاریخ/طرف حساب/ارز دیگر قابل تغییر نیستند، اما شرح، ردیف‌های ابزار قفل‌نشده و ردیف‌های تسویه مستقیماً قابل ویرایش‌اند." : undefined}
      formId="payment-form"
      closePath="/payments"
      newPath="/payments/new"
      onDelete={!editId || status === "DRAFT" ? handleDelete : undefined}
      saveDisabled={false}
      extraActions={
        meta
          ? [
              ...(status === "DRAFT" ? [{ label: "تایید", icon: <CheckIcon />, onClick: handleApprove }] : []),
              ...(status === "APPROVED" ? [{ label: "برگشت از تایید", icon: <UndoIcon />, onClick: handleUnapprove }] : []),
            ]
          : []
      }
      wide
    >
      <form id="payment-form" onSubmit={onSubmit}>
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
              <label>تاریخ سند</label>
              <JalaliDatePicker value={header.date} onChange={(v) => setHeader({ ...header, date: v })} />
            </div>
            <div className="form-field">
              <label>طرف حساب</label>
              <RecordPickerField
                title="انتخاب طرف حساب"
                disabled={coreDisabled}
                displayValue={header.partyDisplay}
                rows={parties.filter((p) => p.isActive)}
                columns={[
                  { header: "کد", render: (p) => toFaDigits(p.detailCode), filterValue: (p) => p.detailCode, width: "100px" },
                  { header: "نام", render: (p) => partyDisplayName(p), filterValue: (p) => partyDisplayName(p) },
                ]}
                onSelect={(p) => setHeader({ ...header, partyId: String(p.id), partyDisplay: partyDisplayName(p) })}
              />
            </div>
            <div className="form-field">
              <label>ارز</label>
              <select value={header.currencyId} onChange={(e) => setHeader({ ...header, currencyId: e.target.value })} disabled={coreDisabled}>
                <option value="">انتخاب کنید</option>
                {currencies.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        {/* شرح، برخلاف بقیه‌ی فیلدهای هدر، حتی در سند «تایید»شده هم قابل ویرایش است — نگاه کنید به
            توضیح مشابه در Receipts.tsx. */}
        <div className="je-header-grid" style={{ marginBottom: 16, maxWidth: 900 }}>
          <div className="form-field full">
            <label>شرح</label>
            <input value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} />
          </div>
        </div>

        {isApprovedSemiOpen && (
          <div className="alert warn" style={{ marginBottom: 12 }}>
            این سند «تایید» شده است. ردیف‌های ابزار قفل‌نشده (چک‌هایی که هنوز واگذار/وصول/برگشت نشده‌اند، یا ردیف‌های غیرچک) و کل ردیف‌های تسویه
            مستقیماً قابل ویرایش/افزودن/حذف‌اند، بدون نیاز به «برگشت از تایید». ردیف‌های قفل‌شده (علامت‌خورده با «قفل») فقط قابل مشاهده‌اند. برای چک
            دریافتنیِ خرج‌شده‌ی متعلق به سند دیگر، فقط شرح قابل تغییر است.
          </div>
        )}

        <div className="je-lines-toolbar">
          <span className="je-lines-title">ردیف‌های ابزار پرداخت</span>
          <button type="button" className="toolbar-icon-btn primary" onClick={addInstrumentRow} title="ردیف جدید">
            <PlusIcon />
          </button>
        </div>

        <div className="grid-wrap je-lines-wrap">
          <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>نوع</th>
                  <th>مبلغ</th>
                  <th>جزئیات</th>
                  <th>شرح</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {instrumentRows.map((row, idx) => {
                  const locked = isRowLocked(row, isApprovedSemiOpen);
                  const existingRow = isApprovedSemiOpen && !!row.id;
                  // نوع ابزار و حالت چک (صدور تازه/خرج‌کردن موجود) یک ردیف موجود، حتی اگر قفل نباشد،
                  // در «ویرایش سند تایید‌شده» قابل تغییر نیست.
                  const typeDisabled = locked || existingRow;
                  // چک دریافتنیِ خرج‌شده که متعلق به همین سند است ولی اطلاعات اصلی‌اش به سند دریافت
                  // دیگری تعلق دارد: فقط شرح قابل تغییر است؛ انتخاب چک دیگر برای یک ردیف موجود معنا
                  // ندارد (سرور هم آن را نادیده می‌گیرد).
                  const spendPickerDisabled = locked || existingRow;
                  return (
                    <tr key={idx} style={locked ? { opacity: 0.65 } : undefined}>
                      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                      <td style={{ minWidth: 140 }}>
                        <select value={row.type} onChange={(e) => updateInstrumentRow(idx, { type: e.target.value as InstrumentType })} disabled={typeDisabled}>
                          {(Object.keys(TYPE_FA) as InstrumentType[]).map((t) => (
                            <option key={t} value={t}>{TYPE_FA[t]}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ minWidth: 130 }}>
                        <AmountInput
                          value={row.amount}
                          onChange={(v) => updateInstrumentRow(idx, { amount: v })}
                          allowDecimal
                          placeholder="۰"
                          disabled={locked || (row.type === "CHEQUE" && row.chequeMode === "SPEND")}
                        />
                      </td>
                      <td style={{ minWidth: 340 }}>
                        {row.type === "CASH" && (
                          <select value={row.cashBoxId} onChange={(e) => updateInstrumentRow(idx, { cashBoxId: e.target.value })} disabled={locked}>
                            <option value="">انتخاب صندوق</option>
                            {cashBoxes.map((c) => (
                              <option key={c.id} value={c.id}>{c.title}</option>
                            ))}
                          </select>
                        )}
                        {(row.type === "BANK_TRANSFER" || row.type === "POS") && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <select value={row.bankAccountId} onChange={(e) => updateInstrumentRow(idx, { bankAccountId: e.target.value })} disabled={locked} style={{ flex: 1 }}>
                              <option value="">انتخاب حساب بانکی</option>
                              {bankAccounts.map((a) => (
                                <option key={a.id} value={a.id}>{a.accountNumber} — {a.bankBranch.title}</option>
                              ))}
                            </select>
                            <input
                              placeholder={row.type === "POS" ? "شماره ترمینال" : "شماره پیگیری"}
                              value={row.type === "POS" ? row.posTerminal : row.referenceNumber}
                              onChange={(e) => updateInstrumentRow(idx, row.type === "POS" ? { posTerminal: e.target.value } : { referenceNumber: e.target.value })}
                              disabled={locked}
                              style={{ flex: 1 }}
                            />
                          </div>
                        )}
                        {row.type === "CHEQUE" && (
                          <div>
                            <div style={{ display: "flex", gap: 10, marginBottom: 6, fontSize: 12 }}>
                              <label style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                <input type="radio" checked={row.chequeMode === "NEW"} onChange={() => updateInstrumentRow(idx, { chequeMode: "NEW", chequeItemId: "", chequeItemDisplay: "" })} disabled={typeDisabled} />
                                صدور چک جدید
                              </label>
                              <label style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                <input type="radio" checked={row.chequeMode === "SPEND"} onChange={() => updateInstrumentRow(idx, { chequeMode: "SPEND", chequeNumber: "", chequeDueDate: "", chequeBankBranchId: "" })} disabled={typeDisabled} />
                                خرج‌کردن چک دریافتنی موجود
                              </label>
                            </div>
                            {row.chequeMode === "NEW" ? (
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                <input placeholder="شماره چک" value={row.chequeNumber} onChange={(e) => updateInstrumentRow(idx, { chequeNumber: e.target.value })} disabled={locked} style={{ width: 110 }} />
                                <div style={{ width: 140 }}>
                                  <JalaliDatePicker value={row.chequeDueDate} onChange={(v) => updateInstrumentRow(idx, { chequeDueDate: v })} />
                                </div>
                                <select value={row.chequeBankBranchId} onChange={(e) => updateInstrumentRow(idx, { chequeBankBranchId: e.target.value })} disabled={locked} style={{ flex: "1 1 140px" }}>
                                  <option value="">شعبه بانک (اختیاری)</option>
                                  {bankBranches.map((b) => (
                                    <option key={b.id} value={b.id}>{b.title}</option>
                                  ))}
                                </select>
                                <select value={row.bankAccountId} onChange={(e) => updateInstrumentRow(idx, { bankAccountId: e.target.value })} disabled={locked} style={{ flex: "1 1 160px" }}>
                                  <option value="">حساب بانکی صادرکننده</option>
                                  {bankAccounts.map((a) => (
                                    <option key={a.id} value={a.id}>{a.accountNumber} — {a.bankBranch.title}</option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <RecordPickerField
                                title="انتخاب چک دریافتنی موجود"
                                disabled={spendPickerDisabled}
                                displayValue={row.chequeItemDisplay}
                                rows={pickableCheques}
                                columns={[
                                  { header: "شماره", render: (c) => c.number, filterValue: (c) => c.number, width: "100px" },
                                  { header: "طرف حساب", render: (c) => c.partyDisplay, filterValue: (c) => c.partyDisplay },
                                  { header: "مبلغ", render: (c) => formatAmountFa(c.amount), filterValue: (c) => String(c.amount), width: "100px" },
                                ]}
                                onSelect={(c) =>
                                  updateInstrumentRow(idx, {
                                    chequeItemId: String((c as PickableCheque).id),
                                    chequeItemDisplay: (c as PickableCheque).number,
                                    amount: String((c as PickableCheque).amount),
                                  })
                                }
                              />
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ minWidth: 140 }}>
                        <input value={row.description} onChange={(e) => updateInstrumentRow(idx, { description: e.target.value })} disabled={locked} />
                      </td>
                      <td>
                        {locked ? (
                          <span className="badge" title="این چک از زمان این سند تغییر کرده (واگذار/وصول/برگشت/...) و فقط از همان سند مربوطه قابل اصلاح است">قفل</span>
                        ) : (
                          <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => removeInstrumentRow(idx)}>
                            حذف
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="grid-footer je-lines-footer">
            <span className="grid-footer-info">{instrumentRows.length === 0 ? "بدون ردیف" : `${toFaDigits(String(instrumentRows.length))} ردیف`}</span>
            <span className="je-lines-totals">جمع ابزار پرداخت: {formatAmountFa(instrumentTotal)}</span>
          </div>
        </div>

        <div className="je-lines-toolbar" style={{ marginTop: 16 }}>
          <span className="je-lines-title">ردیف‌های تسویه</span>
          <button type="button" className="toolbar-icon-btn primary" onClick={addSettlementRow} title="ردیف جدید">
            <PlusIcon />
          </button>
        </div>
        <div className="grid-wrap je-lines-wrap">
          <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>فاکتور خرید (اختیاری)</th>
                  <th>مبلغ</th>
                  <th>شرح</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {settlementRows.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                    <td style={{ minWidth: 220 }}>
                      <RecordPickerField
                        title="انتخاب فاکتور خرید"
                        disabled={!header.partyId}
                        placeholder="بابت حساب (عمومی)"
                        displayValue={row.invoiceDisplay}
                        rows={pickableInvoices}
                        columns={[
                          { header: "شماره", render: (l) => toFaDigits(String(l.number)), filterValue: (l) => String(l.number), width: "70px" },
                          { header: "مانده", render: (l) => formatAmountFa(l.remaining), filterValue: (l) => String(l.remaining), width: "100px" },
                        ]}
                        onSelect={(l) =>
                          updateSettlementRow(idx, {
                            purchaseInvoiceId: String((l as PickableInvoice).purchaseInvoiceId),
                            invoiceDisplay: toFaDigits(String((l as PickableInvoice).number)),
                            amount: row.amount || String((l as PickableInvoice).remaining),
                          })
                        }
                        onClear={() => updateSettlementRow(idx, { purchaseInvoiceId: "", invoiceDisplay: "" })}
                      />
                    </td>
                    <td style={{ minWidth: 130 }}>
                      <AmountInput value={row.amount} onChange={(v) => updateSettlementRow(idx, { amount: v })} allowDecimal placeholder="۰" />
                    </td>
                    <td style={{ minWidth: 160 }}>
                      <input value={row.description} onChange={(e) => updateSettlementRow(idx, { description: e.target.value })} />
                    </td>
                    <td>
                      <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => removeSettlementRow(idx)}>
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid-footer je-lines-footer">
            <span className="grid-footer-info">{settlementRows.length === 0 ? "بدون ردیف" : `${toFaDigits(String(settlementRows.length))} ردیف`}</span>
            <span className="je-lines-totals">
              جمع تسویه: {formatAmountFa(settlementTotal)}
              {Math.abs(instrumentTotal - settlementTotal) > 0.001 && <span style={{ color: "var(--danger, #c0392b)" }}> — با جمع ابزار پرداخت برابر نیست</span>}
            </span>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
