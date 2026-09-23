import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { AmountInput } from "../components/AmountInput";
import { RecordPickerField } from "../components/RecordPicker";
import { Modal } from "../components/Modal";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { useTabs } from "../lib/TabsContext";
import { api, ApiError } from "../lib/api";
import { partyDisplayName } from "./Users";
import { FiscalPeriodRange, fetchSelectedFiscalPeriod, defaultDocumentDate, validateDocumentDate } from "../lib/fiscalYearDefaultDate";
import { toBaseCurrencyAmount, fromBaseCurrencyAmount, calculateExchangeGainLoss, roundToCurrencyDecimals } from "../lib/currencyConversion";

// ماژول «خزانه‌داری» > دریافت. طبق تصمیم‌های صریح کاربر: چهار ابزار (نقد/حواله بانکی/چک/پوز)،
// تسویه‌ی عمومی یا عطف به فاکتور فروش (یا ترکیبی)، فعلاً بدون سند حسابداری خودکار، گردش وضعیت
// ساده‌ی ثبت/تایید. نگاه کنید به یادداشت‌های backend/src/routes/receipts.ts.
//
// طبق Documents/ReceiptChanges.md: ارز و نرخ ارز از هدر به هر ردیف اقلام دریافت منتقل شد، و «موضوعات
// دریافت» به مدلی کامل‌تر تبدیل شد (نوع دریافت/طرف حساب/سند مبنا/ارز/نرخ/تسعیر مستقل هر ردیف). چون در
// ذخیره‌ی کامل (POST/PUT معمولی) همه‌ی ردیف‌های اقلام هر بار از نو ساخته می‌شوند، ردیف‌های موضوعات
// دریافت با یک کلید موقت سمت-کلاینت («قلم») به ردیف اقلام مرتبط ارجاع می‌دهند، نه با id واقعی — نگاه
// کنید به توضیح بالای backend/src/routes/receipts.ts برای قرارداد کامل clientKey/instrumentClientKey.

type InstrumentType = "CASH" | "BANK_TRANSFER" | "CHEQUE" | "POS";
type DocStatus = "DRAFT" | "APPROVED";
type ReceiptNature = "CUSTOMER_RECEIPT" | "ADVANCE_RECEIPT" | "SUPPLIER_RECEIPT" | "OTHER_RECEIPT" | "SALES_VAT" | "PURCHASE_VAT";
type ReceiptBasisType = "NONE" | "SALES_INVOICE" | "PURCHASE_INVOICE" | "SALES_ORDER" | "PROFORMA_INVOICE";

const TYPE_FA: Record<InstrumentType, string> = { CASH: "نقد", BANK_TRANSFER: "حواله/انتقال بانکی", CHEQUE: "چک", POS: "پوز/درگاه" };
const STATUS_FA: Record<DocStatus, string> = { DRAFT: "ثبت", APPROVED: "تایید" };

interface PartyOption { id: number; detailCode: string; category: "INDIVIDUAL" | "LEGAL"; isActive: boolean; firstName: string | null; lastName: string | null; name: string | null }
interface CurrencyOption { id: number; code: string; title: string; isBase: boolean; baseVolume: number; rateDirection: "TO_BASE" | "FROM_BASE" | null; decimalPlaces: number }
interface CashBoxOption { id: number; title: string }
interface BankAccountOption { id: number; accountNumber: string; detailCode: string; bankBranch: { title: string }; currencyId: number | null; currency: { title: string } | null }
interface BankBranchOption { id: number; title: string }
interface ChequeTypeOption { id: number; code: number; title: string }
interface ReceiptTypeOption { id: number; title: string; nature: ReceiptNature; basisType: ReceiptBasisType; isActive: boolean }
interface BasisCandidate { id: number; number: number; date: string; currencyId: number; currencyTitle: string; fxRate: number; total: number; applied: number; remaining: number }
interface PickableInvoice extends BasisCandidate { salesInvoiceId: number }

// تبدیل ارز/گرد کردن اعشار: از lib/currencyConversion.ts (تنها محل مشترک این فرمول‌ها در فرانت‌اند،
// هم‌الگوی PurchaseInvoices.tsx/SalesInvoices.tsx/...) ایمپورت می‌شود، نه پیاده‌سازی محلی جدا.

interface ListRow {
  id: number;
  number: number;
  date: string;
  partyId: number;
  partyDisplay: string;
  fiscalPeriodTitle: string;
  description: string | null;
  status: DocStatus;
  journalEntryReferenceNumber: number | null;
  totalBaseAmount: number;
}

interface DetailInstrumentLine {
  id: number;
  type: InstrumentType;
  amount: number;
  currencyId: number;
  currencyTitle: string;
  fxRate: number;
  cashBoxId: number | null;
  bankAccountId: number | null;
  referenceNumber: string | null;
  chequeNumber: string | null;
  chequeDueDate: string | null;
  chequeBankBranchId: number | null;
  chequeTypeId: number | null;
  chequeItemId: number | null;
  // برای تشخیص ردیف «قفل» (فاز ۲.۲ — سند نیمه‌باز): اگر chequeStep با chequeItemStep برابر نباشد،
  // یعنی از زمان این سند، اتفاق دیگری (واگذاری/وصول/...) برای این چک افتاده و این ردیف دیگر
  // قابل ویرایش/حذف از «ویرایش سند تایید‌شده» نیست. نگاه کنید به backend/src/routes/receipts.ts.
  chequeStep: number | null;
  chequeItemStep: number | null;
  posTerminal: string | null;
  description: string | null;
}
interface DetailSettlementLine {
  id: number;
  instrumentLineId: number;
  receiptTypeId: number;
  receiptTypeTitle: string;
  partyId: number;
  partyDisplay: string;
  salesInvoiceId: number | null;
  salesInvoiceNumber?: number;
  purchaseInvoiceId: number | null;
  purchaseInvoiceNumber?: number;
  salesOrderId: number | null;
  salesOrderNumber?: number;
  salesQuoteId: number | null;
  salesQuoteNumber?: number;
  currencyId: number;
  currencyTitle: string;
  fxRate: number;
  amount: number;
  exchangeGainLoss: number;
  description: string | null;
}
interface Detail {
  id: number;
  number: number;
  date: string;
  partyId: number;
  partyDisplay: string;
  fiscalPeriodTitle: string;
  description: string | null;
  status: DocStatus;
  journalEntryId: number | null;
  journalEntryReferenceNumber: number | null;
  instrumentLines: DetailInstrumentLine[];
  settlementLines: DetailSettlementLine[];
}

function infoText() {
  return (
    "ثبت دریافت وجه از یک طرف حساب از طریق نقد، حواله/انتقال بانکی، چک یا پوز. هر ردیف موضوعات دریافت " +
    "به یک نوع دریافت، طرف حساب، و در صورت نیاز یک سند مبنا (فاکتور فروش/خرید، سفارش فروش، پیش‌فاکتور) وصل " +
    "می‌شود؛ هر ردیف اقلام دریافت باید دقیقاً توسط ردیف‌های موضوعات دریافتِ مرتبط با آن تسویه شود. فعلاً هیچ " +
    "سند حسابداری خودکاری برای این سند صادر نمی‌شود."
  );
}

export default function Receipts() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <ReceiptForm />;
  if (isEdit) return <ReceiptForm editId={Number(id)} />;
  return <ReceiptList />;
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

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ReceiptList() {
  const cacheKey = "/receipts";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    try {
      setItems(await api.get("/receipts"));
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
      await api.del(`/receipts/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={infoText()} title="دریافت" />
          <NewRecordButton path="/receipts/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "طرف حساب", render: (r) => r.partyDisplay, filterType: "string", filterValue: (r) => r.partyDisplay },
          { header: "شرح", render: (r) => r.description || "—", filterType: "string", filterValue: (r) => r.description || "" },
          { header: "جمع (ارز پایه)", render: (r) => formatAmountFa(r.totalBaseAmount), filterType: "number", filterValue: (r) => r.totalBaseAmount, decimal: true },
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
          { header: "سند حسابداری", render: (r) => (r.journalEntryReferenceNumber ? toFaDigits(String(r.journalEntryReferenceNumber)) : "—"), width: "110px", filterType: "number", filterValue: (r) => r.journalEntryReferenceNumber ?? undefined },
        ]}
        rows={items}
        edit={{ path: (r) => `/receipts/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

interface InstrumentRowState {
  id?: number;
  // کلید موقت داخلی برای ارجاع «قلم» از ردیف‌های موضوعات دریافت — برای ردیف‌های موجود همیشه
  // String(id) است؛ برای ردیف‌های تازه یک رشته‌ی یکتای تولیدشده در فرانت.
  clientKey: string;
  type: InstrumentType;
  amount: string;
  currencyId: string;
  fxRate: string;
  cashBoxId: string;
  bankAccountId: string;
  referenceNumber: string;
  chequeNumber: string;
  chequeDueDate: string;
  chequeBankBranchId: string;
  chequeTypeId: string;
  posTerminal: string;
  description: string;
  // فقط برای ردیف‌های موجود (id دار) که از سرور آمده‌اند؛ برای تشخیص «قفل» بودن ردیف در سند
  // «تایید»شده استفاده می‌شود (نگاه کنید به DetailInstrumentLine).
  chequeItemId?: number | null;
  chequeStep?: number | null;
  chequeItemStep?: number | null;
}
let clientKeySeq = 0;
function nextClientKey() {
  clientKeySeq += 1;
  return `new-${Date.now()}-${clientKeySeq}`;
}
function emptyInstrumentRow(): InstrumentRowState {
  return { clientKey: nextClientKey(), type: "CASH", amount: "", currencyId: "", fxRate: "", cashBoxId: "", bankAccountId: "", referenceNumber: "", chequeNumber: "", chequeDueDate: "", chequeBankBranchId: "", chequeTypeId: "", posTerminal: "", description: "" };
}
// ردیف از سند «تایید»شده «قفل» است اگر یک چک به آن وصل باشد و step آن چک دیگر با chequeStep همین
// ردیف برابر نباشد — یعنی اتفاق دیگری (واگذاری/وصول/...) بعد از این سند برای آن چک افتاده است.
function isRowLocked(row: InstrumentRowState, semiOpen: boolean) {
  return semiOpen && !!row.id && !!row.chequeItemId && row.chequeStep !== row.chequeItemStep;
}

const BASIS_FIELD: Record<Exclude<ReceiptBasisType, "NONE">, "salesInvoiceId" | "purchaseInvoiceId" | "salesOrderId" | "salesQuoteId"> = {
  SALES_INVOICE: "salesInvoiceId",
  PURCHASE_INVOICE: "purchaseInvoiceId",
  SALES_ORDER: "salesOrderId",
  PROFORMA_INVOICE: "salesQuoteId",
};

interface SettlementRowState {
  instrumentClientKey: string;
  instrumentLabel: string;
  receiptTypeId: string;
  partyId: string;
  partyDisplay: string;
  salesInvoiceId: string;
  purchaseInvoiceId: string;
  salesOrderId: string;
  salesQuoteId: string;
  basisDisplay: string;
  currencyId: string;
  fxRate: string;
  amount: string;
  description: string;
  // طبق «مستندات تغییرات رسید دریافت.md» بند ۴: تسعیر باید فقط در یک نقطه (تایید مودال ارزی، یا صفر
  // برای مبنای ارز پایه) محاسبه و اینجا ذخیره شود — هرگز به‌صورت مشتق‌شده‌ی زنده در JSX از amount/fxRate
  // بازمحاسبه نشود. (قفل‌بودن نرخ/مبلغ در گرید نیازی به فیلد جدا ندارد — از روی «ارز غیرپایه + مبنا
  // ست‌شده» مشتق می‌شود، نگاه کنید به isForeignLocked در SettlementRowFields.)
  exchangeGainLoss: number;
}
// طبق بند ۲ سند: ارز به‌صورت پیش‌فرض از ارز قلم دریافت مقداردهی شود.
function emptySettlementRow(instrumentClientKey: string, instrumentLabel: string, instrumentCurrencyId: string): SettlementRowState {
  return {
    instrumentClientKey, instrumentLabel, receiptTypeId: "", partyId: "", partyDisplay: "",
    salesInvoiceId: "", purchaseInvoiceId: "", salesOrderId: "", salesQuoteId: "", basisDisplay: "",
    currencyId: instrumentCurrencyId, fxRate: "", amount: "", description: "",
    exchangeGainLoss: 0,
  };
}

function ReceiptForm({ editId }: { editId?: number }) {
  const { openTab } = useTabs();
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [cashBoxes, setCashBoxes] = useState<CashBoxOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [bankBranches, setBankBranches] = useState<BankBranchOption[]>([]);
  const [chequeTypes, setChequeTypes] = useState<ChequeTypeOption[]>([]);
  const [receiptTypes, setReceiptTypes] = useState<ReceiptTypeOption[]>([]);
  const [customerPartyIds, setCustomerPartyIds] = useState<Set<number>>(new Set());
  const [supplierPartyIds, setSupplierPartyIds] = useState<Set<number>>(new Set());
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", partyId: "", partyDisplay: "", description: "" });
  const [instrumentRows, setInstrumentRows] = usePersistedState<InstrumentRowState[]>(`${cacheKey}:instrumentRows`, []);
  const [settlementRows, setSettlementRows] = usePersistedState<SettlementRowState[]>(`${cacheKey}:settlementRows`, []);
  const [meta, setMeta] = usePersistedState<{ number: number; status: DocStatus; fiscalPeriodTitle: string; journalEntryId: number | null; journalEntryReferenceNumber: number | null } | null>(`${cacheKey}:meta`, null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fiscalPeriod, setFiscalPeriod] = useState<FiscalPeriodRange | null>(null);
  const { flash } = useSavedFlash();

  const baseCurrency = currencies.find((c) => c.isBase);

  function applyDetail(d: Detail) {
    setMeta({ number: d.number, status: d.status, fiscalPeriodTitle: d.fiscalPeriodTitle, journalEntryId: d.journalEntryId ?? null, journalEntryReferenceNumber: d.journalEntryReferenceNumber ?? null });
    setHeader({ date: d.date.slice(0, 10), partyId: String(d.partyId), partyDisplay: d.partyDisplay, description: d.description || "" });
    setInstrumentRows(
      d.instrumentLines.map((l) => ({
        id: l.id,
        clientKey: String(l.id),
        type: l.type,
        amount: String(l.amount),
        currencyId: String(l.currencyId),
        fxRate: String(l.fxRate),
        cashBoxId: l.cashBoxId ? String(l.cashBoxId) : "",
        bankAccountId: l.bankAccountId ? String(l.bankAccountId) : "",
        referenceNumber: l.referenceNumber || "",
        chequeNumber: l.chequeNumber || "",
        chequeDueDate: l.chequeDueDate ? l.chequeDueDate.slice(0, 10) : "",
        chequeBankBranchId: l.chequeBankBranchId ? String(l.chequeBankBranchId) : "",
        chequeTypeId: l.chequeTypeId ? String(l.chequeTypeId) : "",
        posTerminal: l.posTerminal || "",
        description: l.description || "",
        chequeItemId: l.chequeItemId,
        chequeStep: l.chequeStep,
        chequeItemStep: l.chequeItemStep,
      }))
    );
    const instrumentIndexById = new Map(d.instrumentLines.map((l, i) => [l.id, i]));
    setSettlementRows(
      d.settlementLines.map((l) => ({
        instrumentClientKey: String(l.instrumentLineId),
        instrumentLabel: instrumentIndexById.has(l.instrumentLineId)
          ? `ردیف ${toFaDigits(String(instrumentIndexById.get(l.instrumentLineId)! + 1))} - ${TYPE_FA[d.instrumentLines[instrumentIndexById.get(l.instrumentLineId)!].type]}`
          : "",
        receiptTypeId: String(l.receiptTypeId),
        partyId: String(l.partyId),
        partyDisplay: l.partyDisplay,
        salesInvoiceId: l.salesInvoiceId ? String(l.salesInvoiceId) : "",
        purchaseInvoiceId: l.purchaseInvoiceId ? String(l.purchaseInvoiceId) : "",
        salesOrderId: l.salesOrderId ? String(l.salesOrderId) : "",
        salesQuoteId: l.salesQuoteId ? String(l.salesQuoteId) : "",
        basisDisplay: toFaDigits(String(l.salesInvoiceNumber ?? l.purchaseInvoiceNumber ?? l.salesOrderNumber ?? l.salesQuoteNumber ?? "")),
        currencyId: String(l.currencyId),
        fxRate: String(l.fxRate),
        amount: String(l.amount),
        description: l.description || "",
        exchangeGainLoss: l.exchangeGainLoss,
      }))
    );
  }

  useEffect(() => {
    async function init() {
      const [ps, cs, cbs, bas, bbs, rts, customers, suppliers, fp, cts]: [
        PartyOption[], CurrencyOption[], CashBoxOption[], BankAccountOption[], BankBranchOption[],
        ReceiptTypeOption[], { partyId: number }[], { partyId: number }[], FiscalPeriodRange | null, ChequeTypeOption[]
      ] = await Promise.all([
        api.get("/parties"),
        api.get("/currencies"),
        api.get("/cash-boxes"),
        api.get("/banking/accounts"),
        api.get("/banking/branches"),
        api.get("/receipt-types"),
        api.get("/customers"),
        api.get("/suppliers"),
        fetchSelectedFiscalPeriod(),
        api.get("/receivable-cheque-types"),
      ]);
      setChequeTypes(cts);
      setParties(ps);
      setCurrencies(cs);
      setCashBoxes(cbs);
      setBankAccounts(bas);
      setBankBranches(bbs);
      setReceiptTypes(rts.filter((t) => t.isActive));
      setCustomerPartyIds(new Set(customers.map((c) => c.partyId)));
      setSupplierPartyIds(new Set(suppliers.map((s) => s.partyId)));
      setFiscalPeriod(fp);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        // این تب می‌تواند مدت‌ها باز مانده باشد (سوییچ بین تب‌ها مقدار کش‌شده را حفظ می‌کند —
        // نگاه کنید به usePersistedState) و در همین فاصله چک یکی از ردیف‌ها از طریق سند دیگری
        // (واگذاری به بانک/برگشت/نتیجه‌ی وصول) جابه‌جا شده باشد. بدون این بازخوانی، chequeItemStep
        // کش‌شده قدیمی می‌ماند و isRowLocked ردیف را اشتباهاً «قفل‌نشده» تشخیص می‌دهد. فقط وضعیت
        // سند و step ردیف‌های چکی را از سرور تازه می‌کنیم؛ بقیه‌ی ورودی‌های کاربر دست‌نخورده می‌ماند.
        if (editId) {
          try {
            const d: Detail = await api.get(`/receipts/${editId}`);
            setMeta((prev) => (prev ? { ...prev, status: d.status, journalEntryId: d.journalEntryId ?? null, journalEntryReferenceNumber: d.journalEntryReferenceNumber ?? null } : prev));
            const stepById = new Map(d.instrumentLines.map((l) => [l.id, { chequeStep: l.chequeStep, chequeItemStep: l.chequeItemStep }]));
            setInstrumentRows((prev) => prev.map((r) => (r.id && stepById.has(r.id) ? { ...r, ...stepById.get(r.id)! } : r)));
          } catch {
            // اگر واکشی ناموفق شد، به مقادیر کش‌شده بسنده می‌شود؛ ذخیره‌سازی همچنان توسط سرور اعتبارسنجی می‌شود
          }
        }
        return;
      }

      if (editId) {
        const d: Detail = await api.get(`/receipts/${editId}`);
        applyDetail(d);
      } else {
        setHeader({ date: defaultDocumentDate(fp), partyId: "", partyDisplay: "", description: "" });
        setInstrumentRows([emptyInstrumentRow()]);
        setSettlementRows([]);
        setMeta(null);
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const status: DocStatus = meta?.status || "DRAFT";
  // فقط فیلدهای هدر (تاریخ/طرف حساب) با این معیار قفل می‌شوند — این‌ها هرگز از طریق
  // «ویرایش سند تایید‌شده» قابل تغییر نیستند (فقط شرح، ردیف‌های ابزار قفل‌نشده، و ردیف‌های تسویه).
  const coreDisabled = !!editId && status !== "DRAFT";
  // فاز ۲.۲ — سند نیمه‌باز: در وضعیت «تایید»، سند دیگر کاملاً قفل نیست؛ ردیف‌های ابزار قفل‌نشده و
  // همه‌ی ردیف‌های تسویه قابل ویرایش/افزودن/حذف‌اند و ذخیره از طریق PUT /receipts/:id/edit-approved
  // انجام می‌شود، نه PUT /receipts/:id معمولی.
  const isApprovedSemiOpen = !!editId && status === "APPROVED";
  // بعد از صدور سند حسابداری، سند دریافت کاملاً قفل است (هم‌الگوی فاکتور فروش) تا سند حسابداری با آن هم‌خوان بماند
  const jeLocked = !!meta?.journalEntryId;

  function instrumentLabel(row: InstrumentRowState, idx: number) {
    return `ردیف ${toFaDigits(String(idx + 1))} - ${TYPE_FA[row.type]}`;
  }

  // طبق تصمیم صریح کاربر: تا وقتی فیلدهای الزامی سرصفحه (تاریخ/طرف حساب) کامل نشده، افزودن ردیف مجاز
  // نیست — اولین تلاش باید با پیام خطا رد شود، نه این‌که فقط بی‌صدا غیرفعال باشد (هم‌الگوی
  // guardRowEntry در فرم‌های مبنادار دیگر، مثل PurchaseInvoices.tsx).
  function guardHeaderComplete(): boolean {
    if (!header.date) {
      setError("تاریخ سند الزامی است");
      return false;
    }
    if (!header.partyId) {
      setError("طرف حساب الزامی است");
      return false;
    }
    return true;
  }

  function updateInstrumentRow(idx: number, patch: Partial<InstrumentRowState>) {
    setInstrumentRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addInstrumentRow() {
    if (!guardHeaderComplete()) return;
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
  function removeSettlementRow(idx: number) {
    setSettlementRows((prev) => prev.filter((_, i) => i !== idx));
  }
  // طبق «مستندات تغییرات رسید دریافت.md» بند ۳ (حالت ارز پایه): انتخاب چندگانه‌ی سند مبنا در یک ردیف،
  // این ردیف را با اولین مورد پر می‌کند و به‌ازای هر مورد اضافه، یک ردیف تازه‌ی هم‌شکل بلافاصله بعد از
  // آن درج می‌کند — هم‌الگوی «بارگذاری از اقلام دریافت».
  function onApplyBasisSelection(idx: number, thisRowPatch: Partial<SettlementRowState>, additionalRows: SettlementRowState[]) {
    setSettlementRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...thisRowPatch };
      if (additionalRows.length) next.splice(idx + 1, 0, ...additionalRows);
      return next;
    });
  }

  // «بارگذاری از اقلام دریافت»: انتخاب چندگانه‌ی ردیف‌های اقلام دریافت جاری، و افزودن یک ردیف
  // موضوعات دریافت خالی به‌ازای هر ردیف انتخاب‌شده (طبق تصمیم کاربر برای این بخش سند)
  function loadFromInstruments(rows: (InstrumentRowState & { idx: number })[]) {
    setSettlementRows((prev) => [
      ...prev,
      ...rows.map((r) => emptySettlementRow(r.clientKey, instrumentLabel(r, r.idx), r.currencyId)),
    ]);
  }

  const hasChequeRow = instrumentRows.some((r) => r.type === "CHEQUE");
  const instrumentBaseTotal = !baseCurrency
    ? 0
    : roundToCurrencyDecimals(
        instrumentRows.reduce((s, r) => {
          const currency = currencies.find((c) => String(c.id) === r.currencyId);
          if (!currency || !r.amount || !r.fxRate) return s;
          return s + toBaseCurrencyAmount(Number(r.amount) || 0, Number(r.fxRate) || 1, currency, baseCurrency);
        }, 0),
        baseCurrency.decimalPlaces
      );
  const settlementBaseTotal = !baseCurrency
    ? 0
    : roundToCurrencyDecimals(
        settlementRows.reduce((s, r) => {
          const currency = currencies.find((c) => String(c.id) === r.currencyId);
          if (!currency || !r.amount || !r.fxRate) return s;
          return s + toBaseCurrencyAmount(Number(r.amount) || 0, Number(r.fxRate) || 1, currency, baseCurrency);
        }, 0),
        baseCurrency.decimalPlaces
      );

  function buildInstrumentLinesPayload() {
    return instrumentRows
      .filter((r) => Number(r.amount) > 0)
      .map((r) => ({
        clientKey: r.clientKey,
        type: r.type,
        amount: Number(r.amount) || 0,
        currencyId: r.currencyId ? Number(r.currencyId) : undefined,
        fxRate: r.fxRate ? Number(r.fxRate) : undefined,
        cashBoxId: r.cashBoxId ? Number(r.cashBoxId) : null,
        bankAccountId: r.bankAccountId ? Number(r.bankAccountId) : null,
        referenceNumber: r.referenceNumber || null,
        chequeNumber: r.chequeNumber || null,
        chequeDueDate: r.chequeDueDate || null,
        chequeBankBranchId: r.chequeBankBranchId ? Number(r.chequeBankBranchId) : null,
        chequeTypeId: r.type === "CHEQUE" && r.chequeTypeId ? Number(r.chequeTypeId) : null,
        posTerminal: r.posTerminal || null,
        description: r.description || null,
      }));
  }
  function buildSettlementLinesPayload() {
    return settlementRows
      .filter((r) => Number(r.amount) > 0)
      .map((r) => ({
        receiptTypeId: Number(r.receiptTypeId),
        instrumentClientKey: r.instrumentClientKey,
        partyId: Number(r.partyId),
        salesInvoiceId: r.salesInvoiceId ? Number(r.salesInvoiceId) : null,
        purchaseInvoiceId: r.purchaseInvoiceId ? Number(r.purchaseInvoiceId) : null,
        salesOrderId: r.salesOrderId ? Number(r.salesOrderId) : null,
        salesQuoteId: r.salesQuoteId ? Number(r.salesQuoteId) : null,
        currencyId: r.currencyId ? Number(r.currencyId) : undefined,
        fxRate: r.fxRate ? Number(r.fxRate) : undefined,
        amount: Number(r.amount) || 0,
        description: r.description || null,
      }));
  }

  function buildBody() {
    return { date: header.date, partyId: Number(header.partyId), description: header.description, instrumentLines: buildInstrumentLinesPayload(), settlementLines: buildSettlementLinesPayload() };
  }

  // بدنه‌ی درخواست PUT /receipts/:id/edit-approved (سند نیمه‌باز): فقط شرح، ردیف‌های ابزار
  // «قفل‌نشده» (موجود یا تازه)، و کل ردیف‌های تسویه ارسال می‌شود. ردیف‌های قفل‌شده اصلاً نباید در
  // درخواست حاضر باشند — سرور خودش آن‌ها را حفظ می‌کند (نگاه کنید به توضیح بالای فایل بک‌اند).
  function buildApprovedEditBody() {
    return {
      description: header.description,
      instrumentLines: instrumentRows
        .filter((r) => !isRowLocked(r, isApprovedSemiOpen))
        .filter((r) => Number(r.amount) > 0)
        .map((r) => ({ ...buildInstrumentLinesPayload().find((x) => x.clientKey === r.clientKey)!, id: r.id })),
      settlementLines: buildSettlementLinesPayload(),
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const missingChequeType = instrumentRows.some((r) => r.type === "CHEQUE" && Number(r.amount) > 0 && !r.chequeTypeId && !isRowLocked(r, isApprovedSemiOpen));
    if (missingChequeType) return setError("نوع چک در همه‌ی ردیف‌های چک الزامی است");

    if (isApprovedSemiOpen) {
      const body = buildApprovedEditBody();
      if (body.settlementLines.length === 0) return setError("حداقل یک ردیف موضوعات دریافت الزامی است");
      if (Math.abs(instrumentBaseTotal - settlementBaseTotal) > 0.001) return setError("مجموع ردیف‌های موضوعات دریافت (به ارز پایه) باید با مجموع ردیف‌های ابزار پرداخت برابر باشد");
      try {
        await api.put(`/receipts/${editId}/edit-approved`, body);
        const d: Detail = await api.get(`/receipts/${editId}`);
        applyDetail(d);
        flash();
      } catch (err) {
        setError((err as ApiError).message);
      }
      return;
    }

    if (!header.date) return setError("تاریخ الزامی است");
    if (!header.partyId) return setError("طرف حساب الزامی است");
    const dateErr = validateDocumentDate(header.date, fiscalPeriod);
    if (dateErr) return setError(dateErr);
    const body = buildBody();
    if (body.instrumentLines.length === 0) return setError("حداقل یک ردیف ابزار پرداخت الزامی است");
    if (body.settlementLines.length === 0) return setError("حداقل یک ردیف موضوعات دریافت الزامی است");
    if (Math.abs(instrumentBaseTotal - settlementBaseTotal) > 0.001) return setError("مجموع ردیف‌های موضوعات دریافت (به ارز پایه) باید با مجموع ردیف‌های ابزار پرداخت برابر باشد");
    try {
      if (editId) {
        await api.put(`/receipts/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/receipts", body);
        flash();
        navigate(`/receipts/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/receipts/${editId}`);
      navigate("/receipts");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  async function handleApprove() {
    if (!editId) return;
    try {
      await api.post(`/receipts/${editId}/approve`, {});
      const d: Detail = await api.get(`/receipts/${editId}`);
      applyDetail(d);
      flash();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  async function handleUnapprove() {
    if (!editId) return;
    try {
      await api.post(`/receipts/${editId}/unapprove`, {});
      const d: Detail = await api.get(`/receipts/${editId}`);
      applyDetail(d);
      flash();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  async function runJournalAction(method: "post" | "del") {
    if (!editId) return;
    try {
      if (method === "post") {
        const result: { message?: string } = await api.post(`/receipts/${editId}/issue-journal-entry`, {});
        const d: Detail = await api.get(`/receipts/${editId}`);
        applyDetail(d);
        flash(result?.message);
      } else {
        if (!window.confirm("سند حسابداری صادرشده حذف می‌شود. ادامه می‌دهید؟")) return;
        await api.del(`/receipts/${editId}/journal-entry`);
        const d: Detail = await api.get(`/receipts/${editId}`);
        applyDetail(d);
        flash();
      }
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded || !baseCurrency) return null;

  // مانده‌ی واقعی هر ردیف اقلام دریافت در انتخابگر «بارگذاری از اقلام دریافت»: مبلغ کامل قلم منهای
  // مجموع (به ارز پایه) آنچه از قبل به همان قلم در ردیف‌های موضوعات دریافت فعلیِ فرم تخصیص یافته —
  // همان منطق instrumentRemainingBaseCapacity، اما بدون استثنای هیچ ردیفی (اینجا برای انتخابِ ردیفِ
  // تازه است، نه ویرایش ردیف موجود).
  const instrumentPickerRows = instrumentRows
    .map((r, idx) => ({ ...r, idx }))
    .filter((r) => Number(r.amount) > 0)
    .map((r) => {
      const currency = currencies.find((c) => String(c.id) === r.currencyId);
      if (!currency) return { ...r, remainingAmount: Number(r.amount) || 0 };
      const fullBase = toBaseCurrencyAmount(Number(r.amount) || 0, Number(r.fxRate) || 1, currency, baseCurrency);
      const allocatedBase = settlementRows.reduce((sum, sr) => {
        if (sr.instrumentClientKey !== r.clientKey) return sum;
        const srAmount = Number(sr.amount) || 0;
        if (!srAmount) return sum;
        const srCurrency = currencies.find((c) => String(c.id) === sr.currencyId);
        if (!srCurrency) return sum;
        return sum + toBaseCurrencyAmount(srAmount, Number(sr.fxRate) || 1, srCurrency, baseCurrency);
      }, 0);
      const remainingBase = Math.max(0, roundToCurrencyDecimals(fullBase - allocatedBase, baseCurrency.decimalPlaces));
      const remainingAmount = roundToCurrencyDecimals(
        fromBaseCurrencyAmount(remainingBase, Number(r.fxRate) || 1, currency),
        currency.decimalPlaces
      );
      return { ...r, remainingAmount };
    });

  return (
    <FormPage
      title={editId ? "ویرایش سند دریافت" : "سند دریافت جدید"}
      description={jeLocked ? "برای این سند دریافت سند حسابداری صادر شده است؛ برای هر تغییری ابتدا سند حسابداری را حذف کنید." : status === "APPROVED" ? "این سند «تایید» شده؛ تاریخ/طرف حساب دیگر قابل تغییر نیستند، اما شرح، ردیف‌های ابزار قفل‌نشده و ردیف‌های موضوعات دریافت مستقیماً قابل ویرایش‌اند. این سند «تایید» شده است. ردیف‌های ابزار قفل‌نشده (چک‌هایی که هنوز واگذار/وصول نشده‌اند، یا ردیف‌های غیرچک) و کل ردیف‌های موضوعات دریافت مستقیماً قابل ویرایش/افزودن/حذف‌اند، بدون نیاز به «برگشت از تایید». ردیف‌های قفل‌شده (علامت‌خورده با «قفل») فقط قابل مشاهده‌اند." : undefined}
      formId="receipt-form"
      closePath="/receipts"
      newPath="/receipts/new"
      onDelete={!editId || status === "DRAFT" ? handleDelete : undefined}
      saveDisabled={jeLocked}
      extraActions={
        meta
          ? [
              ...(status === "DRAFT" ? [{ label: "تایید", icon: <CheckIcon />, onClick: handleApprove }] : []),
              ...(status === "APPROVED" && !jeLocked ? [{ label: "برگشت از تایید", icon: <UndoIcon />, onClick: handleUnapprove }] : []),
              ...(status === "APPROVED" && !jeLocked ? [{ label: "صدور سند حسابداری", icon: <PlusIcon />, onClick: () => runJournalAction("post") }] : []),
              ...(jeLocked
                ? [
                    { label: "مشاهده سند حسابداری", icon: <EyeIcon />, onClick: () => openTab(`/journal-entries/${meta?.journalEntryId}/edit`) },
                    { label: "حذف سند حسابداری", icon: <UndoIcon />, onClick: () => runJournalAction("del") },
                  ]
                : []),
            ]
          : []
      }
      wide
    >
      <form id="receipt-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}

        {/* بعد از صدور سند حسابداری، همه‌ی اطلاعات سند (هدر، ردیف‌های ابزار، موضوعات دریافت، شرح) قفل است */}
        <fieldset disabled={jeLocked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>

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
            {meta?.journalEntryReferenceNumber && (
              <div className="form-field">
                <label>سند حسابداری</label>
                <input dir="ltr" value={toFaDigits(String(meta.journalEntryReferenceNumber))} disabled />
              </div>
            )}
            <div className="form-field">
              <label>تاریخ سند<RequiredMark /></label>
              <JalaliDatePicker value={header.date} onChange={(v) => setHeader({ ...header, date: v })} />
            </div>
            <div className="form-field">
              <label>طرف حساب<RequiredMark /></label>
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
          </div>
        </fieldset>

        {/* شرح، برخلاف بقیه‌ی فیلدهای هدر، حتی در سند «تایید»شده هم قابل ویرایش است (بخشی از
            PUT /receipts/:id/edit-approved) — به همین دلیل بیرون از fieldset قفل‌شونده قرار دارد. */}
        <div className="je-header-grid" style={{ marginBottom: 16, maxWidth: 900 }}>
          <div className="form-field full">
            <label>شرح</label>
            <input value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} />
          </div>
        </div>


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
                  {hasChequeRow && <th>نوع چک<RequiredMark /></th>}
                  <th>مبلغ</th>
                  <th>ارز</th>
                  <th>نرخ ارز</th>
                  <th>جزئیات</th>
                  <th>شرح</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {instrumentRows.map((row, idx) => {
                  const locked = isRowLocked(row, isApprovedSemiOpen);
                  // نوع ابزار یک ردیف موجود، حتی اگر قفل نباشد، در «ویرایش سند تایید‌شده» قابل تغییر
                  // نیست (طبق قرارداد بک‌اند)؛ فقط ردیف‌های تازه (بدون id) نوعشان آزاد است.
                  const typeDisabled = locked || (isApprovedSemiOpen && !!row.id);
                  const bankAccount = bankAccounts.find((a) => String(a.id) === row.bankAccountId);
                  const isBaseCurrencyRow = !row.currencyId || Number(row.currencyId) === baseCurrency.id;
                  return (
                    <tr key={row.clientKey} style={locked ? { opacity: 0.65 } : undefined}>
                      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                      <td style={{ minWidth: 140 }}>
                        <select
                          value={row.type}
                          onChange={(e) => {
                            const type = e.target.value as InstrumentType;
                            // طبق سند: چک همیشه با ارز پایه؛ حواله/پوز از ارز حساب بانکی (تا انتخاب حساب، خالی)
                            const currencyId = type === "CHEQUE" ? String(baseCurrency.id) : type === "CASH" ? row.currencyId : "";
                            updateInstrumentRow(idx, { type, currencyId, fxRate: type === "CHEQUE" ? "1" : row.fxRate });
                          }}
                          disabled={typeDisabled}
                        >
                          {(Object.keys(TYPE_FA) as InstrumentType[]).map((t) => (
                            <option key={t} value={t}>{TYPE_FA[t]}</option>
                          ))}
                        </select>
                      </td>
                      {hasChequeRow && (
                        <td style={{ minWidth: 150 }}>
                          {row.type === "CHEQUE" && (
                            <select value={row.chequeTypeId} onChange={(e) => updateInstrumentRow(idx, { chequeTypeId: e.target.value })} disabled={locked}>
                              <option value="">انتخاب نوع چک</option>
                              {chequeTypes.map((t) => (
                                <option key={t.id} value={t.id}>{t.title}</option>
                              ))}
                            </select>
                          )}
                        </td>
                      )}
                      <td style={{ minWidth: 130 }}>
                        <AmountInput value={row.amount} onChange={(v) => updateInstrumentRow(idx, { amount: v })} allowDecimal placeholder="۰" disabled={locked} />
                      </td>
                      <td style={{ minWidth: 130 }}>
                        {row.type === "CASH" && (
                          <select value={row.currencyId} onChange={(e) => updateInstrumentRow(idx, { currencyId: e.target.value, fxRate: Number(e.target.value) === baseCurrency.id ? "1" : row.fxRate })} disabled={locked}>
                            <option value="">انتخاب ارز</option>
                            {currencies.map((c) => (
                              <option key={c.id} value={c.id}>{c.title}</option>
                            ))}
                          </select>
                        )}
                        {row.type === "CHEQUE" && <span>{baseCurrency.title}</span>}
                        {(row.type === "BANK_TRANSFER" || row.type === "POS") && <span>{bankAccount?.currency?.title || "—"}</span>}
                      </td>
                      <td style={{ minWidth: 100 }}>
                        {isBaseCurrencyRow ? (
                          <input dir="ltr" value={toFaDigits("1")} disabled />
                        ) : (
                          <AmountInput value={row.fxRate} onChange={(v) => updateInstrumentRow(idx, { fxRate: v })} allowDecimal placeholder="نرخ ارز" disabled={locked} />
                        )}
                      </td>
                      <td style={{ minWidth: 320 }}>
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
                            <select
                              value={row.bankAccountId}
                              onChange={(e) => {
                                const acc = bankAccounts.find((a) => String(a.id) === e.target.value);
                                const currencyId = acc?.currencyId ? String(acc.currencyId) : "";
                                updateInstrumentRow(idx, { bankAccountId: e.target.value, currencyId, fxRate: acc?.currencyId === baseCurrency.id ? "1" : row.fxRate });
                              }}
                              disabled={locked}
                              style={{ flex: 1 }}
                            >
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
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <input placeholder="شماره چک" value={row.chequeNumber} onChange={(e) => updateInstrumentRow(idx, { chequeNumber: e.target.value })} disabled={locked} style={{ width: 110 }} />
                            <div style={{ width: 140 }}>
                              <JalaliDatePicker value={row.chequeDueDate} onChange={(v) => updateInstrumentRow(idx, { chequeDueDate: v })} />
                            </div>
                            <select value={row.chequeBankBranchId} onChange={(e) => updateInstrumentRow(idx, { chequeBankBranchId: e.target.value })} disabled={locked} style={{ flex: 1 }}>
                              <option value="">شعبه بانک (اختیاری)</option>
                              {bankBranches.map((b) => (
                                <option key={b.id} value={b.id}>{b.title}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </td>
                      <td style={{ minWidth: 140 }}>
                        <input value={row.description} onChange={(e) => updateInstrumentRow(idx, { description: e.target.value })} disabled={locked} />
                      </td>
                      <td>
                        {locked ? (
                          <span className="badge" title="این چک از زمان این سند تغییر کرده (واگذار/وصول/...) و فقط از همان سند مربوطه قابل اصلاح است">قفل</span>
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
            <span className="je-lines-totals">جمع ابزار پرداخت (ارز پایه): {formatAmountFa(instrumentBaseTotal)}</span>
          </div>
        </div>

        <div className="je-lines-toolbar" style={{ marginTop: 16 }}>
          <span className="je-lines-title">ردیف‌های موضوعات دریافت</span>
          <RecordPickerField
            title="انتخاب ردیف‌های ابزار پرداخت برای بارگذاری"
            displayValue=""
            placeholder="بارگذاری از اقلام دریافت"
            rows={instrumentPickerRows}
            multiSelect
            columns={[
              { header: "ردیف", render: (r: any) => toFaDigits(String(r.idx + 1)), filterValue: (r: any) => String(r.idx + 1), width: "60px" },
              { header: "نوع", render: (r: any) => TYPE_FA[r.type as InstrumentType], filterValue: (r: any) => TYPE_FA[r.type as InstrumentType] },
              { header: "مبلغ", render: (r: any) => formatAmountFa(Number(r.remainingAmount)), filterValue: (r: any) => r.remainingAmount },
            ]}
            onOpen={guardHeaderComplete}
            onSelectMultiple={(rows) => loadFromInstruments(rows as any)}
          />
        </div>
        <div className="grid-wrap je-lines-wrap">
          <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>قلم</th>
                  <th>نوع دریافت</th>
                  <th>طرف حساب</th>
                  <th>ارز</th>
                  <th>مبنا</th>
                  <th>نرخ ارز</th>
                  <th>مبلغ</th>
                  <th>تسعیر</th>
                  <th>شرح</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {settlementRows.map((row, idx) => (
                  <SettlementRowFields
                    key={idx}
                    idx={idx}
                    row={row}
                    onChange={(patch) => updateSettlementRow(idx, patch)}
                    onRemove={() => removeSettlementRow(idx)}
                    receiptTypes={receiptTypes}
                    parties={parties}
                    customerPartyIds={customerPartyIds}
                    supplierPartyIds={supplierPartyIds}
                    currencies={currencies}
                    baseCurrency={baseCurrency}
                    instrumentRows={instrumentRows}
                    editId={editId}
                    headerPartyId={header.partyId}
                    headerPartyDisplay={header.partyDisplay}
                    headerDate={header.date}
                    allSettlementRows={settlementRows}
                    onApplyBasisSelection={onApplyBasisSelection}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid-footer je-lines-footer">
            <span className="grid-footer-info">{settlementRows.length === 0 ? "بدون ردیف" : `${toFaDigits(String(settlementRows.length))} ردیف`}</span>
            <span className="je-lines-totals">
              جمع موضوعات دریافت (ارز پایه): {formatAmountFa(settlementBaseTotal)}
              {Math.abs(instrumentBaseTotal - settlementBaseTotal) > 0.001 && <span style={{ color: "var(--danger, #c0392b)" }}> — با جمع ابزار پرداخت برابر نیست</span>}
            </span>
          </div>
        </div>
        </fieldset>
      </form>
    </FormPage>
  );
}

function SettlementRowFields({
  idx, row, onChange, onRemove, receiptTypes, parties, customerPartyIds, supplierPartyIds, currencies, baseCurrency, instrumentRows, editId, headerPartyId, headerPartyDisplay, headerDate, allSettlementRows, onApplyBasisSelection,
}: {
  idx: number;
  row: SettlementRowState;
  onChange: (patch: Partial<SettlementRowState>) => void;
  onRemove: () => void;
  receiptTypes: ReceiptTypeOption[];
  parties: PartyOption[];
  customerPartyIds: Set<number>;
  supplierPartyIds: Set<number>;
  currencies: CurrencyOption[];
  baseCurrency: CurrencyOption;
  instrumentRows: InstrumentRowState[];
  editId?: number;
  headerPartyId: string;
  headerPartyDisplay: string;
  headerDate: string;
  allSettlementRows: SettlementRowState[];
  onApplyBasisSelection: (idx: number, thisRowPatch: Partial<SettlementRowState>, additionalRows: SettlementRowState[]) => void;
}) {
  const [fxModalOpen, setFxModalOpen] = useState(false);
  const [basisCandidates, setBasisCandidates] = useState<BasisCandidate[]>([]);
  const receiptType = receiptTypes.find((t) => String(t.id) === row.receiptTypeId);
  const basisType = receiptType?.basisType;
  const instrumentRow = instrumentRows.find((r) => r.clientKey === row.instrumentClientKey);

  useEffect(() => {
    if (!basisType || basisType === "NONE" || !row.partyId) {
      setBasisCandidates([]);
      return;
    }
    const excl = editId ? `&excludeReceiptId=${editId}` : "";
    api
      .get(`/receipts/pickable-basis-documents?basisType=${basisType}&partyId=${row.partyId}${excl}`)
      .then((rows: BasisCandidate[]) => setBasisCandidates(rows))
      .catch(() => setBasisCandidates([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basisType, row.partyId, editId]);

  // مانده‌ی واقعاً قابل تسویه‌ی یک سند مبنا برای این ردیف: مانده‌ی گزارش‌شده توسط سرور، منهای مبلغ
  // ردیف‌های خواهرِ همین فرم (هنوز ذخیره‌نشده) که به همان سند مبنا ارجاع می‌دهند — وگرنه انتخاب یک
  // فاکتور در دو ردیف هم‌زمان، هر دو را تا سقف کامل مانده‌ی سرور مجاز نشان می‌داد. تبدیل ارز فقط برای
  // برآورد پیش‌فرض/نمایشی است؛ اعتبارسنجی واقعی همیشه توسط سرور انجام می‌شود.
  function effectiveRemaining(candidate: BasisCandidate): number {
    if (!basisType || basisType === "NONE") return candidate.remaining;
    const field = BASIS_FIELD[basisType];
    const basisCurrency = currencies.find((c) => c.id === candidate.currencyId);
    const allocatedByOthers = allSettlementRows.reduce((sum, r, i) => {
      if (i === idx) return sum;
      const rBasisId = (r as any)[field];
      if (!rBasisId || Number(rBasisId) !== candidate.id) return sum;
      const rAmount = Number(r.amount) || 0;
      if (!rAmount) return sum;
      if (!basisCurrency) return sum + rAmount;
      const rCurrency = currencies.find((c) => String(c.id) === r.currencyId);
      if (!rCurrency) return sum + rAmount;
      if (rCurrency.id === basisCurrency.id) return sum + rAmount;
      const rBase = toBaseCurrencyAmount(rAmount, Number(r.fxRate) || 1, rCurrency, baseCurrency);
      return sum + fromBaseCurrencyAmount(rBase, candidate.fxRate, basisCurrency);
    }, 0);
    const remaining = candidate.remaining - allocatedByOthers;
    return basisCurrency ? roundToCurrencyDecimals(remaining, basisCurrency.decimalPlaces) : remaining;
  }

  const eligibleParties =
    !receiptType ? []
    : receiptType.nature === "CUSTOMER_RECEIPT" || receiptType.nature === "ADVANCE_RECEIPT" ? parties.filter((p) => customerPartyIds.has(p.id))
    : receiptType.nature === "SUPPLIER_RECEIPT" ? parties.filter((p) => supplierPartyIds.has(p.id))
    : parties;

  const rowCurrency = currencies.find((c) => String(c.id) === row.currencyId);
  const isBaseCurrencyRow = !row.currencyId || Number(row.currencyId) === baseCurrency.id;

  const currentBasisId = row.salesInvoiceId || row.purchaseInvoiceId || row.salesOrderId || row.salesQuoteId;

  // مانده‌ی واقعاً باقی‌مانده‌ی خودِ ردیف اقلام دریافت (قلم) برای این ردیف موضوع دریافت: baseAmount قلم
  // منهای مبلغ (به ارز پایه) ردیف‌های خواهرِ همین فرم که به همان قلم ارجاع می‌دهند (به‌جز خودِ این ردیف).
  // طبق «مستندات تغییرات رسید دریافت.md» بند ۳ (حالت ارز غیرپایه): کنترل تایید مودال دقیقاً روی همین مقدار.
  function instrumentRemainingBaseCapacity(): number {
    if (!instrumentRow) return 0;
    const instrumentCurrency = currencies.find((c) => String(c.id) === instrumentRow.currencyId);
    if (!instrumentCurrency) return 0;
    const instrumentBase = toBaseCurrencyAmount(Number(instrumentRow.amount) || 0, Number(instrumentRow.fxRate) || 1, instrumentCurrency, baseCurrency);
    const allocatedByOthers = allSettlementRows.reduce((sum, r, i) => {
      if (i === idx || r.instrumentClientKey !== row.instrumentClientKey) return sum;
      const rAmount = Number(r.amount) || 0;
      if (!rAmount) return sum;
      const rCurrency = currencies.find((c) => String(c.id) === r.currencyId);
      if (!rCurrency) return sum;
      return sum + toBaseCurrencyAmount(rAmount, Number(r.fxRate) || 1, rCurrency, baseCurrency);
    }, 0);
    return roundToCurrencyDecimals(instrumentBase - allocatedByOthers, baseCurrency.decimalPlaces);
  }

  // طبق سند: پیش‌فرض طرف حساب هر ردیف، طرف حساب هدر است — فقط اگر با شرط نوع دریافت سازگار باشد
  // (مشتری/تامین‌کننده بودن طرف حساب هدر)؛ برای «سایر»/وی‌ای‌تی بدون شرط همیشه ست می‌شود.
  function onReceiptTypeChange(receiptTypeId: string) {
    const rt = receiptTypes.find((t) => String(t.id) === receiptTypeId);
    let partyId = row.partyId;
    let partyDisplay = row.partyDisplay;
    if (rt && !partyId && headerPartyId) {
      const headerPartyIdNum = Number(headerPartyId);
      const qualifies =
        rt.nature === "CUSTOMER_RECEIPT" || rt.nature === "ADVANCE_RECEIPT" ? customerPartyIds.has(headerPartyIdNum)
        : rt.nature === "SUPPLIER_RECEIPT" ? supplierPartyIds.has(headerPartyIdNum)
        : true;
      if (qualifies) {
        partyId = headerPartyId;
        partyDisplay = headerPartyDisplay;
      }
    }
    onChange({
      receiptTypeId,
      partyId, partyDisplay,
      salesInvoiceId: "", purchaseInvoiceId: "", salesOrderId: "", salesQuoteId: "", basisDisplay: "",
    });
  }

  // فقط برای حالت ارز پایه استفاده می‌شود (نگاه کنید به onBasisMultiSelect) — نرخ همیشه «۱» و تسعیر
  // همیشه صفر است (طبق بند ۴ سند: «فراخوانی محاسبه تسعیر برای موضوعات با ارز پایه انجام نشود»).
  // extraConsumedBase: مبلغِ (به ارز پایه) از همین قلم که در همین درخواستِ انتخاب چندگانه، به ردیف‌های
  // قبلی این دسته (نه ردیف‌های خواهرِ از قبل موجود — آن‌ها را instrumentRemainingBaseCapacity خودش حساب
  // می‌کند) اختصاص یافته؛ چون چند ردیف تازه در یک عمل ساخته می‌شوند و هنوز در allSettlementRows نیستند.
  function computeBasisPatch(basis: BasisCandidate, extraConsumedBase: number): Partial<SettlementRowState> {
    if (!basisType || basisType === "NONE") return {};
    const field = BASIS_FIELD[basisType];
    const currency = currencies.find((c) => c.id === basis.currencyId);
    if (!currency) return {};
    let amount = "";
    if (instrumentRow) {
      const remaining = effectiveRemaining(basis);
      // طبق گزارش کاربر: وقتی ارز ردیف با ارز قلم یکسان است، مبلغ پیش‌فرض باید مانده‌ی واقعی قلم باشد
      // (مبلغ کامل منهای آنچه به ردیف‌های خواهر همین قلم تخصیص یافته)، نه مبلغ کامل قلم — قبلاً همیشه
      // مبلغ کامل قلم استفاده می‌شد که در ردیف دوم/بعدیِ همان قلم، پیش‌فرض را اشتباهاً بزرگ نشان می‌داد.
      if (instrumentRow.currencyId === String(currency.id)) {
        const instrumentRemainingBase = Math.max(0, instrumentRemainingBaseCapacity() - extraConsumedBase);
        const instrumentRemainingInRowCurrency = fromBaseCurrencyAmount(instrumentRemainingBase, 1, currency);
        amount = String(roundToCurrencyDecimals(Math.max(0, Math.min(remaining, instrumentRemainingInRowCurrency)), currency.decimalPlaces));
      } else {
        const instrumentCurrency = currencies.find((c) => String(c.id) === instrumentRow!.currencyId);
        if (instrumentCurrency) {
          const instrumentBase = toBaseCurrencyAmount(Number(instrumentRow.amount) || 0, Number(instrumentRow.fxRate) || 1, instrumentCurrency, baseCurrency);
          const instrumentInRowCurrency = fromBaseCurrencyAmount(instrumentBase, 1, currency);
          amount = String(roundToCurrencyDecimals(Math.max(0, Math.min(remaining, instrumentInRowCurrency)), currency.decimalPlaces));
        }
      }
    }
    return {
      [field]: String(basis.id),
      basisDisplay: toFaDigits(String(basis.number)),
      fxRate: "1",
      amount,
      exchangeGainLoss: 0,
    } as Partial<SettlementRowState>;
  }

  // طبق «مستندات تغییرات رسید دریافت.md» بند ۳ (حالت ارز پایه): انتخاب چندگانه؛ اولین مورد همین ردیف را
  // پر می‌کند، بقیه به ردیف‌های تازه‌ی هم‌شکل تبدیل و بلافاصله بعد از این ردیف درج می‌شوند. مبلغ هر مورد
  // بعدی، مصرفِ موردهای قبلیِ همین دسته را هم در نظر می‌گیرد (نگاه کنید به توضیح بالای computeBasisPatch).
  function onBasisMultiSelect(selected: BasisCandidate[]) {
    if (selected.length === 0) return;
    let consumedBase = 0;
    function applyAndTrack(basis: BasisCandidate): Partial<SettlementRowState> {
      const patch = computeBasisPatch(basis, consumedBase);
      const amountNum = Number(patch.amount) || 0;
      if (amountNum > 0 && instrumentRow && instrumentRow.currencyId === String(basis.currencyId)) {
        const currency = currencies.find((c) => c.id === basis.currencyId);
        if (currency) consumedBase += toBaseCurrencyAmount(amountNum, 1, currency, baseCurrency);
      }
      return patch;
    }
    const [first, ...rest] = selected;
    const thisRowPatch = applyAndTrack(first);
    const additionalRows: SettlementRowState[] = rest.map((basis) => ({ ...row, ...applyAndTrack(basis) }));
    onApplyBasisSelection(idx, thisRowPatch, additionalRows);
  }

  return (
    <tr>
      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
      <td style={{ minWidth: 120 }}>
        <span>{row.instrumentLabel || `#${row.instrumentClientKey}`}</span>
      </td>
      <td style={{ minWidth: 160 }}>
        <select value={row.receiptTypeId} onChange={(e) => onReceiptTypeChange(e.target.value)}>
          <option value="">انتخاب کنید</option>
          {receiptTypes.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
      </td>
      <td style={{ minWidth: 180 }}>
        <RecordPickerField
          title="انتخاب طرف حساب"
          disabled={!receiptType}
          displayValue={row.partyDisplay}
          rows={eligibleParties}
          columns={[
            { header: "کد", render: (p) => toFaDigits(p.detailCode), filterValue: (p) => p.detailCode, width: "100px" },
            { header: "نام", render: (p) => partyDisplayName(p), filterValue: (p) => partyDisplayName(p) },
          ]}
          onSelect={(p) => onChange({ partyId: String(p.id), partyDisplay: partyDisplayName(p), salesInvoiceId: "", purchaseInvoiceId: "", salesOrderId: "", salesQuoteId: "", basisDisplay: "" })}
        />
      </td>
      <td style={{ minWidth: 110 }}>
        <select
          value={row.currencyId}
          onChange={(e) => {
            const newCurrencyId = Number(e.target.value);
            const hasBasisSet = !!currentBasisId;
            // طبق «مستندات تغییرات رسید دریافت.md» بند ۶: تغییر ارز یک ردیف که مبنا/مبالغش قبلاً ست
            // شده، باید با هشدار تایید شود؛ در صورت انصراف، هیچ تغییری اعمال نمی‌شود.
            if (hasBasisSet && !window.confirm("با تغییر ارز، اطلاعات مبنا و مبالغ این ردیف حذف خواهد شد. ادامه می‌دهید؟")) {
              return;
            }
            // طبق بند ۵ سند ReceiptChanges: نرخ فقط برای ارز پایه (=۱) یا ارز هم‌سان با قلم دریافتی
            // (=نرخ همان قلم) خودکار پر می‌شود؛ در غیر این‌صورت برای ورود دستی خالی می‌ماند.
            const fxRate =
              newCurrencyId === baseCurrency.id ? "1"
              : instrumentRow && String(newCurrencyId) === instrumentRow.currencyId ? instrumentRow.fxRate
              : "";
            onChange({
              currencyId: e.target.value,
              fxRate,
              ...(hasBasisSet
                ? { salesInvoiceId: "", purchaseInvoiceId: "", salesOrderId: "", salesQuoteId: "", basisDisplay: "", amount: "", exchangeGainLoss: 0 }
                : {}),
            });
          }}
        >
          <option value="">انتخاب ارز</option>
          {currencies.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </td>
      <td style={{ minWidth: 160 }}>
        {basisType && basisType !== "NONE" ? (
          isBaseCurrencyRow ? (
            // طبق بند ۳ (حالت ارز پایه): گرید انتخاب مستقیم، محدود به فاکتورهای هم‌ارز با ردیف، با
            // امکان انتخاب چندگانه برای ورود سریع چند ردیف مبنا.
            <RecordPickerField
              title="انتخاب سند مبنا"
              disabled={!row.partyId}
              displayValue={row.basisDisplay}
              placeholder="انتخاب سند مبنا"
              multiSelect
              rows={basisCandidates.filter((c) => c.currencyId === baseCurrency.id && (effectiveRemaining(c) > 0.001 || String(c.id) === currentBasisId))}
              columns={[
                { header: "شماره", render: (c) => toFaDigits(String(c.number)), filterValue: (c) => String(c.number), width: "70px" },
                { header: "تاریخ", render: (c) => formatJalaliDate(c.date), filterValue: (c) => c.date.slice(0, 10), width: "100px" },
                { header: "مانده", render: (c) => formatAmountFa(effectiveRemaining(c)), filterValue: (c) => String(effectiveRemaining(c)), width: "110px" },
              ]}
              onSelectMultiple={onBasisMultiSelect}
            />
          ) : rowCurrency ? (
            // طبق بند ۳ (حالت ارز غیرپایه): ورود از طریق مودال، نه گرید مستقیم.
            <>
              <button type="button" className="picker-field" disabled={!row.partyId} onClick={() => setFxModalOpen(true)}>
                <span>{row.basisDisplay ? toFaDigits(row.basisDisplay) : <span className="picker-placeholder">انتخاب سند مبنا (ارزی)</span>}</span>
              </button>
              {fxModalOpen && (
                <ReceiptForeignBasisModal
                  candidates={basisCandidates.filter(
                    (c) => c.currencyId === rowCurrency.id && c.date.slice(0, 10) <= headerDate && (effectiveRemaining(c) > 0.001 || String(c.id) === currentBasisId)
                  )}
                  instrumentRow={instrumentRow}
                  rowCurrency={rowCurrency}
                  baseCurrency={baseCurrency}
                  remainingBaseCapacity={instrumentRemainingBaseCapacity()}
                  initialBasisId={currentBasisId}
                  initialFxRate={row.fxRate}
                  initialAmount={row.amount}
                  onClose={() => setFxModalOpen(false)}
                  onConfirm={(basis, fxRate, amount) => {
                    if (!basisType) return;
                    const field = BASIS_FIELD[basisType as Exclude<ReceiptBasisType, "NONE">];
                    // طبق بند ۴ سند: تسعیر فقط همین‌جا، یک‌بار، بعد از تایید مودال محاسبه می‌شود.
                    const exchangeGainLoss =
                      basisType === "SALES_INVOICE" || basisType === "PURCHASE_INVOICE"
                        ? calculateExchangeGainLoss("RECEIPT", Number(amount) || 0, Number(fxRate) || 1, basis.fxRate, rowCurrency, baseCurrency)
                        : 0;
                    onChange({
                      [field]: String(basis.id),
                      basisDisplay: toFaDigits(String(basis.number)),
                      fxRate,
                      amount,
                      exchangeGainLoss,
                    } as Partial<SettlementRowState>);
                    setFxModalOpen(false);
                  }}
                />
              )}
            </>
          ) : (
            <span style={{ color: "var(--ink-soft)" }}>ابتدا ارز را انتخاب کنید</span>
          )
        ) : (
          <span style={{ color: "var(--ink-soft)" }}>بدون مبنا</span>
        )}
      </td>
      <td style={{ minWidth: 100 }}>
        {isBaseCurrencyRow ? (
          <input dir="ltr" value={toFaDigits("1")} disabled />
        ) : (
          <input dir="ltr" value={row.fxRate ? formatAmountFa(row.fxRate) : "—"} disabled />
        )}
      </td>
      <td style={{ minWidth: 130 }}>
        {isBaseCurrencyRow ? (
          <AmountInput value={row.amount} onChange={(v) => onChange({ amount: v })} allowDecimal placeholder="۰" />
        ) : (
          <input dir="ltr" value={row.amount ? formatAmountFa(row.amount) : "—"} disabled />
        )}
      </td>
      <td style={{ minWidth: 110, color: row.exchangeGainLoss > 0 ? "var(--success, #2e7d32)" : row.exchangeGainLoss < 0 ? "var(--danger, #c0392b)" : undefined }}>
        {formatAmountFa(row.exchangeGainLoss)}
      </td>
      <td style={{ minWidth: 140 }}>
        <input value={row.description} onChange={(e) => onChange({ description: e.target.value })} />
      </td>
      <td>
        <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={onRemove}>
          حذف
        </button>
      </td>
    </tr>
  );
}

// طبق «مستندات تغییرات رسید دریافت.md» بند ۳ (حالت ارز غیرپایه) و ۴: تنها نقطه‌ی ورود اطلاعات موضوع
// دریافتِ ارزی. مودال فقط وظیفه‌ی ورود اطلاعات و اعتبارسنجی اولیه (بند ۷) را دارد — هیچ محاسبه‌ی
// تسعیری داخل آن انجام نمی‌شود؛ محاسبه‌ی تسعیر فقط در onConfirm فراخوانی‌کننده (SettlementRowFields)
// انجام می‌شود، دقیقاً یک‌بار، بعد از تایید. الگوی «نرخ + مبلغ ارزی وارد می‌شود، معادل ارز پایه محاسبه و
// نمایش داده می‌شود» دقیقاً هم‌شکل components/FxAmountDialog.tsx است.
function ReceiptForeignBasisModal({
  candidates, instrumentRow, rowCurrency, baseCurrency, remainingBaseCapacity, initialBasisId, initialFxRate, initialAmount, onConfirm, onClose,
}: {
  candidates: BasisCandidate[];
  instrumentRow: InstrumentRowState | undefined;
  rowCurrency: CurrencyOption;
  baseCurrency: CurrencyOption;
  remainingBaseCapacity: number;
  initialBasisId: string;
  initialFxRate: string;
  initialAmount: string;
  onConfirm: (basis: BasisCandidate, fxRate: string, amount: string) => void;
  onClose: () => void;
}) {
  const [basisId, setBasisId] = useState(initialBasisId);
  const [fxRate, setFxRate] = useState(initialFxRate);
  const [amount, setAmount] = useState(initialAmount);
  const [error, setError] = useState<string | null>(null);

  const selected = candidates.find((c) => String(c.id) === basisId);

  // طبق بند ۳: اگر ارز فاکتور انتخاب‌شده با ارز قلم دریافت یکسان باشد، نرخ از همان قلم پیش‌فرض می‌شود
  // (قابل ویرایش)؛ در غیر این‌صورت کاربر باید دستی وارد کند — دقیقاً هم‌قاعده‌ی بند ۵ سند ReceiptChanges.
  function selectBasis(basis: BasisCandidate) {
    setBasisId(String(basis.id));
    setError(null);
    const matchesInstrumentCurrency = !!instrumentRow && String(basis.currencyId) === instrumentRow.currencyId;
    setFxRate(matchesInstrumentCurrency ? instrumentRow!.fxRate : "");
    if (matchesInstrumentCurrency) {
      // طبق گزارش کاربر: وقتی ارز فاکتور با ارز قلم یکسان است، مبلغ پیش‌فرض باید مانده‌ی واقعی قلم
      // باشد (نه مبلغ کامل قلم)، اگر آن مانده از مانده‌ی خودِ فاکتور کمتر باشد.
      const instrumentRate = Number(instrumentRow!.fxRate) || 1;
      const instrumentRemainingInRowCurrency = fromBaseCurrencyAmount(Math.max(0, remainingBaseCapacity), instrumentRate, rowCurrency);
      setAmount(String(roundToCurrencyDecimals(Math.max(0, Math.min(basis.remaining, instrumentRemainingInRowCurrency)), rowCurrency.decimalPlaces)));
    } else {
      setAmount(String(basis.remaining));
    }
  }

  const baseEquivalent = Number(fxRate) > 0 && Number(amount) > 0 ? toBaseCurrencyAmount(Number(amount), Number(fxRate), rowCurrency, baseCurrency) : 0;

  function confirm() {
    if (!selected) return setError("انتخاب سند مبنا الزامی است");
    const amountNum = Number(amount) || 0;
    const fxRateNum = Number(fxRate) || 0;
    if (!(amountNum > 0)) return setError("مبلغ تسویه الزامی است");
    if (!(fxRateNum > 0)) return setError("نرخ ارز باید مقداری معتبر و مثبت داشته باشد");
    if (amountNum > selected.remaining + 0.001) {
      return setError(`مبلغ تسویه از مانده‌ی قابل تسویه‌ی سند مبنا (${formatAmountFa(selected.remaining)}) بیشتر است`);
    }
    const baseAmount = toBaseCurrencyAmount(amountNum, fxRateNum, rowCurrency, baseCurrency);
    if (baseAmount > remainingBaseCapacity + 0.001) {
      return setError("مبلغ به ارز پایه نمی‌تواند از مبلغ باقیمانده قلم انتخاب‌شده بیشتر باشد");
    }
    onConfirm(selected, fxRate, amount);
  }

  return (
    <Modal title={`ورود اطلاعات ارزی موضوع دریافت (${rowCurrency.title})`} onClose={onClose}>
      {error && <div className="alert error">{error}</div>}
      <div className="form-grid">
        <div className="form-field full">
          <label>فاکتور مبنا<RequiredMark /></label>
          <RecordPickerField
            title="انتخاب فاکتور مبنا"
            displayValue={selected ? toFaDigits(String(selected.number)) : ""}
            placeholder="انتخاب فاکتور مبنا"
            rows={candidates}
            columns={[
              { header: "شماره", render: (c) => toFaDigits(String(c.number)), filterValue: (c) => String(c.number), width: "70px" },
              { header: "تاریخ", render: (c) => formatJalaliDate(c.date), filterValue: (c) => c.date.slice(0, 10), width: "100px" },
              { header: "مانده", render: (c) => formatAmountFa(c.remaining), filterValue: (c) => String(c.remaining), width: "110px" },
            ]}
            onSelect={selectBasis}
          />
        </div>
        <div className="form-field">
          <label>نرخ ارز<RequiredMark /></label>
          <AmountInput value={fxRate} onChange={(v) => { setFxRate(v); setError(null); }} allowDecimal placeholder="نرخ ارز" />
        </div>
        <div className="form-field">
          <label>مبلغ تسویه ({rowCurrency.title})<RequiredMark /></label>
          <AmountInput value={amount} onChange={(v) => { setAmount(v); setError(null); }} allowDecimal placeholder="۰" />
        </div>
        <div className="form-field">
          <label>مبلغ به ارز پایه ({baseCurrency.title})</label>
          <div className="fx-computed">{formatAmountFa(baseEquivalent)}</div>
        </div>
      </div>
      <div className="actions">
        <button type="button" className="btn" onClick={confirm}>تایید</button>
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
      </div>
    </Modal>
  );
}
