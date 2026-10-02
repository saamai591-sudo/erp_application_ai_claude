import { FormEvent, Fragment, useEffect, useState } from "react";
import { selectableTypes, typeLabel } from "../lib/typeOptions";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { AmountInput } from "../components/AmountInput";
import { PaymentBasisPicker, usePaymentBasisCandidates, BasisCandidate } from "../components/PaymentBasisPicker";
import { RecordPickerField } from "../components/RecordPicker";
import { Modal } from "../components/Modal";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState, clearPersistedStateFamily } from "../lib/usePersistedState";
import { useTabs } from "../lib/TabsContext";
import { api, ApiError } from "../lib/api";
import { BankAccountPicker, bankAccountLabel } from "../components/BankAccountPicker";
import { partyDisplayName } from "./Users";
import { FiscalPeriodRange, fetchSelectedFiscalPeriod, defaultDocumentDate, validateDocumentDate } from "../lib/fiscalYearDefaultDate";
import { toBaseCurrencyAmount, fromBaseCurrencyAmount, calculateExchangeGainLoss, roundToCurrencyDecimals } from "../lib/currencyConversion";
import { DescriptionField } from "../components/DescriptionField";

// ماژول «خزانه‌داری» > پرداخت / اعلامیه پرداخت — هم‌الگوی Receipts.tsx (نگاه کنید به یادداشت‌های آن فایل و
// backend/src/routes/payments.ts): چهار ابزار (نقد/حواله بانکی/چک/چک انتقالی) با ارز و نرخ ارز مستقل هر ردیف،
// «موضوعات پرداخت» (نوع پرداخت/طرف حساب/سند مبنا/ارز/نرخ/تسعیر مستقل هر ردیف) که با یک کلید موقت سمت-کلاینت
// («قلم») به ردیف ابزار ارجاع می‌دهند، و سند حسابداری با اکشن دستی. تفاوت اصلی با سند دریافت: طبق درخواست کاربر،
// «چک» و «چک انتقالی» دو نوع کاملاً جدا در انتخابگرِ نوع‌اند (نه یک نوع با دو حالت داخلی) — چک همیشه یعنی صدور
// یک چک پرداختنی تازه (با نوع چک پرداختی)، چک انتقالی همیشه یعنی «خرج‌کردن» یک چک دریافتنی موجود (که قبلاً از
// یک سند دریافت وارد سیستم شده). پوز/درگاه دیگر در سند پرداخت ارائه نمی‌شود.

type InstrumentType = "CASH" | "BANK_TRANSFER" | "CHEQUE" | "CHEQUE_TRANSFER";
type DocStatus = "DRAFT" | "APPROVED";
type PaymentNature = "SUPPLIER_PAYMENT" | "ADVANCE_PAYMENT" | "ADVANCE_VAT_PAYMENT" | "CUSTOMER_PAYMENT" | "OTHER_PAYMENT" | "PURCHASE_VAT" | "SALES_VAT" | "TO_BANK" | "TO_CASH_BOX" | "TO_PETTY_CASH";
// انتخابگرِ «طرف حساب / حساب» ردیف موضوعات پرداخت: برای ماهیت «به بانک» فقط حساب‌های بانکی، «به صندوق» فقط صندوق‌ها، «به تنخواه» فقط تنخواه‌دارها؛ در بقیه‌ی ماهیت‌ها طرف حساب
function selectorKind(nature?: PaymentNature): "BANK" | "CASH" | "CUSTODIAN" | "PARTY" {
  return nature === "TO_BANK" ? "BANK" : nature === "TO_CASH_BOX" ? "CASH" : nature === "TO_PETTY_CASH" ? "CUSTODIAN" : "PARTY";
}
type PaymentBasisType = "NONE" | "PURCHASE_INVOICE" | "SALES_INVOICE" | "PURCHASE_ORDER";

const TYPE_FA: Record<InstrumentType, string> = { CASH: "نقد", BANK_TRANSFER: "حواله/انتقال بانکی", CHEQUE: "چک", CHEQUE_TRANSFER: "چک انتقالی" };
const STATUS_FA: Record<DocStatus, string> = { DRAFT: "ثبت", APPROVED: "تایید" };

interface PartyOption { id: number; detailCode: string; category: "INDIVIDUAL" | "LEGAL"; isActive: boolean; firstName: string | null; lastName: string | null; name: string | null }
interface CurrencyOption { id: number; code: string; title: string; isBase: boolean; baseVolume: number; rateDirection: "TO_BASE" | "FROM_BASE" | null; decimalPlaces: number }
interface CashBoxOption { id: number; title: string }
interface BankAccountOption { id: number; accountNumber: string; detailCode: string; detailTitle: string; bankBranch: { title: string }; currencyId: number | null; currency: { title: string } | null; accountType: { hasChequeBook: boolean } }
interface ChequeTypeOption { id: number; code: number; title: string; isSameDay?: boolean }
interface CustodianOption { id: number; detailCode: string; isActive: boolean; pettyCash: { id: number; title: string; isActive: boolean }; party: { id: number; detailCode: string; category: "INDIVIDUAL" | "LEGAL"; firstName: string | null; lastName: string | null; name: string | null; isActive: boolean } }
function custodianLabel(c: CustodianOption) {
  return `${toFaDigits(c.detailCode)} — ${c.pettyCash.title} (${partyDisplayName(c.party)})`;
}
interface PaymentTypeOption { id: number; title: string; nature: PaymentNature; basisType: PaymentBasisType; isActive: boolean }
interface PickableCheque { id: number; number: string; dueDate: string; amount: number; partyDisplay: string; currencyTitle: string }
// برگه‌ی «خام» دسته چک (Documents/دسته چک.md) — برای ردیف «صدور چک تازه» وقتی حساب بانکی صادرکننده از
// نوعِ «دارای دسته چک» باشد؛ نگاه کنید به backend/src/routes/chequeBookLeaves.ts و routes/payments.ts.
interface PickableChequeBookLeaf { id: number; bankAccountId: number; series: string; number: string }
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
  feeAmount?: number;
  chequeNumber: string | null;
  chequeDueDate: string | null;
  chequeBankBranchId: number | null;
  payableChequeTypeId: number | null;
  bankAccountHasChequeBook: boolean;
  chequeBookLeafId: number | null;
  chequeBookLeafDisplay: string | null;
  chequeItemId: number | null;
  chequeItemNumber?: string;
  description: string | null;
}
interface DetailSettlementLine {
  id: number;
  instrumentLineId: number;
  paymentTypeId: number;
  paymentTypeTitle: string;
  partyId: number | null;
  partyDisplay: string;
  bankAccountId: number | null;
  cashBoxId: number | null;
  custodianId: number | null;
  custodianDisplay: string;
  accountDisplay: string;
  salesInvoiceId: number | null;
  salesInvoiceNumber?: number;
  purchaseInvoiceId: number | null;
  purchaseInvoiceNumber?: number;
  purchaseOrderId: number | null;
  purchaseOrderNumber?: number;
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
  updatedAt?: string;
  ownLeaves?: PickableChequeBookLeaf[];
}

function infoText() {
  return (
    "ثبت پرداخت وجه به یک طرف حساب از طریق نقد، حواله/انتقال بانکی، چک یا چک انتقالی. ردیف «چک» یعنی صدور یک چک " +
    "پرداختنی تازه (با نوع چک)؛ ردیف «چک انتقالی» یعنی خرج‌کردن یک چک دریافتنی موجود. هر ردیف موضوعات پرداخت به یک " +
    "نوع پرداخت، طرف حساب، و در صورت نیاز یک سند مبنا (فاکتور خرید/فروش، سفارش خرید) وصل می‌شود؛ هر ردیف ابزار پرداخت " +
    "باید دقیقاً توسط ردیف‌های موضوعات پرداختِ مرتبط با آن تسویه شود. سند حسابداری با اکشن «صدور سند حسابداری» صادر می‌شود."
  );
}

// پیام «تایید»: هم بعد از تایید اولیه به‌صورت toast و هم در دیالوگ راهنما (هنگام ویرایش) نمایش داده می‌شود
const APPROVED_NOTICE = "این سند «تایید» شده است و از مسیر «ویرایش» قابل تغییر نیست؛ برای اصلاح آیتم‌های فاقد گردش از «ویرایش مجدد» استفاده کنید، یا برای تغییر کامل ابتدا آن را «برگشت از تایید» کنید.";

export default function Payments() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  const isReEdit = location.pathname.endsWith("/re-edit");
  if (isNew) return <PaymentForm />;
  if (isEdit) return <PaymentForm editId={Number(id)} />;
  if (isReEdit) return <PaymentForm editId={Number(id)} reEdit />;
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

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function PaymentList() {
  const cacheKey = "/payments";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
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
      showError("فقط اسناد در وضعیت «ثبت» قابل حذف هستند؛ ابتدا از «تایید» برگردانید");
      return;
    }
    try {
      await api.del(`/payments/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={infoText()} title="پرداخت" />
          <NewRecordButton path="/payments/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "طرف حساب", render: (r) => r.partyDisplay, filterType: "string", filterValue: (r) => r.partyDisplay },
          { header: "شرح", render: (r) => r.description || "—", filterType: "string", filterValue: (r) => r.description || "" },
          { header: "جمع (ارز پایه)", render: (r) => formatAmountFa(r.totalBaseAmount), filterType: "number", filterValue: (r) => r.totalBaseAmount, decimal: true },
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
        ]}
        rows={items}
        edit={{ path: (r) => `/payments/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

interface InstrumentRowState {
  id?: number;
  // کلید موقت داخلی برای ارجاع «قلم» از ردیف‌های موضوعات پرداخت — برای ردیف‌های موجود همیشه
  // String(id) است؛ برای ردیف‌های تازه یک رشته‌ی یکتای تولیدشده در فرانت.
  clientKey: string;
  type: InstrumentType;
  amount: string;
  currencyId: string;
  fxRate: string;
  cashBoxId: string;
  bankAccountId: string;
  referenceNumber: string;
  /** کارمزد پرداخت (فقط ردیف حواله/انتقال بانکی) */
  feeAmount: string;
  chequeNumber: string;
  chequeDueDate: string;
  chequeBankBranchId: string;
  payableChequeTypeId: string;
  // برگه‌ی دسته چکِ انتخاب‌شده — فقط وقتی حساب بانکیِ ردیف «دارای دسته چک» باشد (نگاه کنید به
  // Documents/دسته چک.md)؛ در آن حالت شماره چک آزادانه تایپ نمی‌شود، از این برگه می‌آید.
  chequeBookLeafId: string;
  chequeBookLeafDisplay: string;
  chequeItemId: string;
  chequeItemDisplay: string;
  description: string;
}
let clientKeySeq = 0;
function nextClientKey() {
  clientKeySeq += 1;
  return `new-${Date.now()}-${clientKeySeq}`;
}
function emptyInstrumentRow(): InstrumentRowState {
  return { clientKey: nextClientKey(), type: "CASH", amount: "", currencyId: "", fxRate: "", cashBoxId: "", bankAccountId: "", referenceNumber: "", feeAmount: "", chequeNumber: "", chequeDueDate: "", chequeBankBranchId: "", payableChequeTypeId: "", chequeBookLeafId: "", chequeBookLeafDisplay: "", chequeItemId: "", chequeItemDisplay: "", description: "" };
}
const BASIS_FIELD: Record<Exclude<PaymentBasisType, "NONE">, "purchaseInvoiceId" | "salesInvoiceId" | "purchaseOrderId"> = {
  PURCHASE_INVOICE: "purchaseInvoiceId",
  SALES_INVOICE: "salesInvoiceId",
  PURCHASE_ORDER: "purchaseOrderId",
};

interface SettlementRowState {
  instrumentClientKey: string;
  instrumentLabel: string;
  paymentTypeId: string;
  partyId: string;
  partyDisplay: string;
  bankAccountId: string;
  cashBoxId: string;
  custodianId: string;
  salesInvoiceId: string;
  purchaseInvoiceId: string;
  purchaseOrderId: string;
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
// طبق بند ۲ سند: ارز به‌صورت پیش‌فرض از ارز قلم پرداخت مقداردهی شود.
function emptySettlementRow(instrumentClientKey: string, instrumentLabel: string, instrumentCurrencyId: string): SettlementRowState {
  return {
    instrumentClientKey, instrumentLabel, paymentTypeId: "", partyId: "", partyDisplay: "", bankAccountId: "", cashBoxId: "", custodianId: "",
    salesInvoiceId: "", purchaseInvoiceId: "", purchaseOrderId: "", basisDisplay: "",
    currencyId: instrumentCurrencyId, fxRate: "", amount: "", description: "",
    exchangeGainLoss: 0,
  };
}

function PaymentForm({ editId, reEdit }: { editId?: number; reEdit?: boolean }) {
  const { openTab } = useTabs();
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [cashBoxes, setCashBoxes] = useState<CashBoxOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [custodians, setCustodians] = useState<CustodianOption[]>([]);
  const [chequeTypes, setChequeTypes] = useState<ChequeTypeOption[]>([]);
  const [pickableCheques, setPickableCheques] = useState<PickableCheque[]>([]);
  const [pickableChequeBookLeaves, setPickableChequeBookLeaves] = useState<PickableChequeBookLeaf[]>([]);
  // «ویرایش مجدد»: برگه‌ی دسته چکِ فعلیِ ردیف‌های قابل ویرایش (ISSUED است و در فهرست برگه‌های «خام» نمی‌آید) و updatedAt سند
  const [ownLeaves, setOwnLeaves] = usePersistedState<PickableChequeBookLeaf[]>(`${cacheKey}:ownLeaves`, []);
  const [docUpdatedAt, setDocUpdatedAt] = usePersistedState<string>(`${cacheKey}:updatedAt`, "");
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeOption[]>([]);
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

  // قاعده‌ی پایه: ارز پیش‌فرض ردیف‌های نقدِ سند جدید «ارز پایه» است (کاربر می‌تواند تغییرش دهد)
  useEffect(() => {
    if (editId || !baseCurrency) return;
    if (instrumentRows.some((r) => r.type === "CASH" && !r.currencyId)) {
      setInstrumentRows((prev) => prev.map((r) => (r.type === "CASH" && !r.currencyId ? { ...r, currencyId: String(baseCurrency.id), fxRate: "1" } : r)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrumentRows, baseCurrency?.id, editId]);

  // «چک روز»: چک همان روزِ سند است و مدت‌دار نیست؛ تاریخ سررسید غیرفعال و همیشه برابر تاریخ سند است
  const isSameDayType = (typeId: string) => !!chequeTypes.find((t) => String(t.id) === typeId)?.isSameDay;
  useEffect(() => {
    setInstrumentRows((prev) => {
      let changed = false;
      const next = prev.map((r) => {
        if (r.type === "CHEQUE" && header.date && isSameDayType(r.payableChequeTypeId) && r.chequeDueDate !== header.date) {
          changed = true;
          return { ...r, chequeDueDate: header.date };
        }
        return r;
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [header.date, chequeTypes]);

  function applyDetail(d: Detail) {
    setOwnLeaves(d.ownLeaves ?? []);
    setDocUpdatedAt(d.updatedAt ?? "");
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
        feeAmount: l.feeAmount ? String(l.feeAmount) : "",
        chequeNumber: l.chequeNumber || "",
        chequeDueDate: l.chequeDueDate ? l.chequeDueDate.slice(0, 10) : "",
        chequeBankBranchId: l.chequeBankBranchId ? String(l.chequeBankBranchId) : "",
        payableChequeTypeId: l.payableChequeTypeId ? String(l.payableChequeTypeId) : "",
        chequeBookLeafId: l.chequeBookLeafId ? String(l.chequeBookLeafId) : "",
        chequeBookLeafDisplay: l.chequeBookLeafDisplay ? toFaDigits(l.chequeBookLeafDisplay) : "",
        chequeItemId: l.chequeItemId ? String(l.chequeItemId) : "",
        chequeItemDisplay: l.chequeItemNumber ? toFaDigits(l.chequeItemNumber) : "",
        description: l.description || "",
      }))
    );
    const instrumentIndexById = new Map(d.instrumentLines.map((l, i) => [l.id, i]));
    setSettlementRows(
      d.settlementLines.map((l) => ({
        instrumentClientKey: String(l.instrumentLineId),
        instrumentLabel: instrumentIndexById.has(l.instrumentLineId)
          ? `ردیف ${toFaDigits(String(instrumentIndexById.get(l.instrumentLineId)! + 1))} - ${TYPE_FA[d.instrumentLines[instrumentIndexById.get(l.instrumentLineId)!].type]}`
          : "",
        paymentTypeId: String(l.paymentTypeId),
        partyId: l.partyId ? String(l.partyId) : "",
        bankAccountId: l.bankAccountId ? String(l.bankAccountId) : "",
        cashBoxId: l.cashBoxId ? String(l.cashBoxId) : "",
        custodianId: l.custodianId ? String(l.custodianId) : "",
        partyDisplay: l.accountDisplay || l.partyDisplay,
        salesInvoiceId: l.salesInvoiceId ? String(l.salesInvoiceId) : "",
        purchaseInvoiceId: l.purchaseInvoiceId ? String(l.purchaseInvoiceId) : "",
        purchaseOrderId: l.purchaseOrderId ? String(l.purchaseOrderId) : "",
        basisDisplay: toFaDigits(String(l.salesInvoiceNumber ?? l.purchaseInvoiceNumber ?? l.purchaseOrderNumber ?? "")),
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
      const [ps, cs, cbs, bas, rts, customers, suppliers, fp, cts, pcs, pbl, cus]: [
        PartyOption[], CurrencyOption[], CashBoxOption[], BankAccountOption[],
        PaymentTypeOption[], { partyId: number }[], { partyId: number }[], FiscalPeriodRange | null, ChequeTypeOption[], PickableCheque[], PickableChequeBookLeaf[], CustodianOption[]
      ] = await Promise.all([
        api.get("/parties"),
        api.get("/currencies"),
        api.get("/cash-boxes"),
        api.get("/banking/accounts"),
        api.get("/payment-types"),
        api.get("/customers"),
        api.get("/suppliers"),
        fetchSelectedFiscalPeriod(),
        api.get("/payable-cheque-types"),
        api.get("/cheques/pickable-receivable"),
        api.get("/cheque-book-leaves/pickable"),
        api.get("/petty-cash-custodians?activeOnly=true"),
      ]);
      setChequeTypes(cts);
      setPickableCheques(pcs);
      setPickableChequeBookLeaves(pbl);
      setParties(ps);
      setCurrencies(cs);
      setCashBoxes(cbs);
      setBankAccounts(bas);
      setCustodians(cus);
      // فهرست کامل نگه داشته می‌شود تا سند موجودِ دارای نوع غیرفعال درست نمایش داده شود؛ گزینه‌های انتخاب با selectableTypes فقط فعال‌ها (+ نوع فعلی همان ردیف) هستند
      setPaymentTypes(rts);
      setCustomerPartyIds(new Set(customers.map((c) => c.partyId)));
      setSupplierPartyIds(new Set(suppliers.map((s) => s.partyId)));
      setFiscalPeriod(fp);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        // این تب می‌تواند مدت‌ها باز مانده باشد؛ فقط وضعیت سند را از سرور تازه می‌کنیم (بقیه‌ی ورودی‌های کاربر دست‌نخورده می‌ماند).
        if (editId) {
          try {
            const d: Detail = await api.get(`/payments/${editId}`);
            setMeta((prev) => (prev ? { ...prev, status: d.status, journalEntryId: d.journalEntryId ?? null, journalEntryReferenceNumber: d.journalEntryReferenceNumber ?? null } : prev));
          } catch {
            // اگر واکشی ناموفق شد، به مقادیر کش‌شده بسنده می‌شود؛ ذخیره‌سازی همچنان توسط سرور اعتبارسنجی می‌شود
          }
        }
        return;
      }

      if (editId) {
        try {
          const d: Detail = await api.get(reEdit ? `/payments/${editId}/re-edit` : `/payments/${editId}`);
          applyDetail(d);
        } catch (e) {
          if (!reEdit) throw e;
          showError((e as ApiError).message);
          navigate(`/payments/${editId}/edit`);
          return;
        }
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
  // بعد از صدور سند حسابداری، سند پرداخت کاملاً قفل است (هم‌الگوی فاکتور فروش) تا سند حسابداری با آن هم‌خوان بماند
  const jeLocked = !!meta?.journalEntryId;
  // سند «تایید»شده کاملاً قفل است: برای هر تغییری ابتدا باید از تایید برگردانده شود (طبق درخواست کاربر)
  const formLocked = jeLocked || (status === "APPROVED" && !reEdit);

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
    // شرح هدر (اگر وارد شده باشد) شرح پیش‌فرض ردیف تازه‌ی ابزار است
    setInstrumentRows((prev) => [...prev, { ...emptyInstrumentRow(), description: header.description }]);
  }
  function removeInstrumentRow(idx: number) {
    setInstrumentRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateSettlementRow(idx: number, patch: Partial<SettlementRowState>) {
    setSettlementRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function removeSettlementRow(idx: number) {
    setSettlementRows((prev) => prev.filter((_, i) => i !== idx));
  }
  // اگر حساب بانکیِ مبدأ یک قلم به حسابِ مقصدِ یکی از ردیف‌های موضوعاتِ همان قلم تغییر کند، آن مقصد (که دیگر مجاز نیست) پاک می‌شود
  function dropSettlementTargetsEqualTo(instrumentKey: string, bankAccountId: string) {
    setSettlementRows((prev) => prev.map((r) => (r.instrumentClientKey === instrumentKey && r.bankAccountId === bankAccountId ? { ...r, bankAccountId: "", partyDisplay: "" } : r)));
  }
  // طبق «مستندات تغییرات رسید دریافت.md» بند ۳ (حالت ارز پایه): انتخاب چندگانه‌ی سند مبنا در یک ردیف،
  // این ردیف را با اولین مورد پر می‌کند و به‌ازای هر مورد اضافه، یک ردیف تازه‌ی هم‌شکل بلافاصله بعد از
  // آن درج می‌کند — هم‌الگوی «بارگذاری از ابزار پرداخت».
  function onApplyBasisSelection(idx: number, thisRowPatch: Partial<SettlementRowState>, additionalRows: SettlementRowState[]) {
    setSettlementRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...thisRowPatch };
      if (additionalRows.length) next.splice(idx + 1, 0, ...additionalRows);
      return next;
    });
  }

  // «بارگذاری از ابزار پرداخت»: انتخاب چندگانه‌ی ردیف‌های ابزار پرداخت جاری، و افزودن یک ردیف
  // موضوعات پرداخت خالی به‌ازای هر ردیف انتخاب‌شده (طبق تصمیم کاربر برای این بخش سند)
  function loadFromInstruments(rows: (InstrumentRowState & { idx: number })[]) {
    setSettlementRows((prev) => [
      ...prev,
      // شرح ردیف ابزارِ انتخاب‌شده، شرح پیش‌فرض ردیف موضوعات است
      ...rows.map((r) => ({ ...emptySettlementRow(r.clientKey, instrumentLabel(r, r.idx), r.currencyId), description: r.description })),
    ]);
  }

  // ستون «نوع چک» فقط وقتی لازم است که حداقل یک ردیف «صدور چک جدید» وجود داشته باشد (چک خرج‌شده نوع خودش را دارد)
  const hasChequeRow = instrumentRows.some((r) => r.type === "CHEQUE");
  const hasBankTransferRow = instrumentRows.some((r) => r.type === "BANK_TRANSFER");
  const instrumentBaseTotal = !baseCurrency
    ? 0
    : roundToCurrencyDecimals(
        instrumentRows.reduce((s, r) => {
          const currency = currencies.find((c) => String(c.id) === r.currencyId);
          if (!currency || !r.amount) return s;
          // نرخِ خالی برای ارز پایه همان «۱» است (در گرید نمایش داده می‌شود ولی در state خالی می‌ماند)؛ برای ارز غیرپایه بدون نرخ، ردیف شمرده نمی‌شود
          const rate = r.fxRate ? Number(r.fxRate) : currency.id === baseCurrency.id ? 1 : 0;
          if (!rate) return s;
          return s + toBaseCurrencyAmount(Number(r.amount) || 0, rate, currency, baseCurrency);
        }, 0),
        baseCurrency.decimalPlaces
      );
  const settlementBaseTotal = !baseCurrency
    ? 0
    : roundToCurrencyDecimals(
        settlementRows.reduce((s, r) => {
          const currency = currencies.find((c) => String(c.id) === r.currencyId);
          if (!currency || !r.amount) return s;
          // نرخِ خالی برای ارز پایه همان «۱» است (در گرید نمایش داده می‌شود ولی در state خالی می‌ماند)؛ برای ارز غیرپایه بدون نرخ، ردیف شمرده نمی‌شود
          const rate = r.fxRate ? Number(r.fxRate) : currency.id === baseCurrency.id ? 1 : 0;
          if (!rate) return s;
          return s + toBaseCurrencyAmount(Number(r.amount) || 0, rate, currency, baseCurrency);
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
        bankAccountId: r.type === "CHEQUE" && r.bankAccountId ? Number(r.bankAccountId) : r.type === "BANK_TRANSFER" && r.bankAccountId ? Number(r.bankAccountId) : null,
        referenceNumber: r.referenceNumber || null,
        feeAmount: r.type === "BANK_TRANSFER" ? Number(r.feeAmount) || 0 : 0,
        chequeItemId: r.type === "CHEQUE_TRANSFER" && r.chequeItemId ? Number(r.chequeItemId) : null,
        chequeNumber: r.type === "CHEQUE" ? r.chequeNumber || null : null,
        chequeDueDate: r.type === "CHEQUE" ? r.chequeDueDate || null : null,
        chequeBankBranchId: r.type === "CHEQUE" && r.chequeBankBranchId ? Number(r.chequeBankBranchId) : null,
        payableChequeTypeId: r.type === "CHEQUE" && r.payableChequeTypeId ? Number(r.payableChequeTypeId) : null,
        chequeBookLeafId: r.type === "CHEQUE" && r.chequeBookLeafId ? Number(r.chequeBookLeafId) : null,
        description: r.description || null,
      }));
  }
  function buildSettlementLinesPayload() {
    return settlementRows
      .filter((r) => Number(r.amount) > 0)
      .map((r) => ({
        paymentTypeId: Number(r.paymentTypeId),
        instrumentClientKey: r.instrumentClientKey,
        partyId: r.partyId ? Number(r.partyId) : null,
        bankAccountId: r.bankAccountId ? Number(r.bankAccountId) : null,
        cashBoxId: r.cashBoxId ? Number(r.cashBoxId) : null,
        custodianId: r.custodianId ? Number(r.custodianId) : null,
        salesInvoiceId: r.salesInvoiceId ? Number(r.salesInvoiceId) : null,
        purchaseInvoiceId: r.purchaseInvoiceId ? Number(r.purchaseInvoiceId) : null,
        purchaseOrderId: r.purchaseOrderId ? Number(r.purchaseOrderId) : null,
        currencyId: r.currencyId ? Number(r.currencyId) : undefined,
        fxRate: r.fxRate ? Number(r.fxRate) : undefined,
        amount: Number(r.amount) || 0,
        description: r.description || null,
      }));
  }

  function buildBody() {
    return { date: header.date, partyId: Number(header.partyId), description: header.description, instrumentLines: buildInstrumentLinesPayload(), settlementLines: buildSettlementLinesPayload() };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const missingChequeType = instrumentRows.some((r) => r.type === "CHEQUE" && Number(r.amount) > 0 && !r.payableChequeTypeId);
    if (missingChequeType) return setError("نوع چک در همه‌ی ردیف‌های صدور چک الزامی است");
    const missingSpendCheque = instrumentRows.some((r) => r.type === "CHEQUE_TRANSFER" && !r.chequeItemId);
    if (missingSpendCheque) return setError("چک دریافتنی برای خرج‌کردن در ردیف‌های «چک انتقالی» انتخاب نشده است");
    // طبق درخواست کاربر: برای صدور چک جدید، ابتدا حساب بانکی (فقط از نوع دارای دسته چک) و سپس برگه‌ی
    // چک از همان دسته چک انتخاب می‌شود — شماره چک دیگر آزادانه تایپ نمی‌شود.
    const missingChequeBankAccount = instrumentRows.some((r) => r.type === "CHEQUE" && Number(r.amount) > 0 && !r.bankAccountId);
    if (missingChequeBankAccount) return setError("حساب بانکی صادرکننده در همه‌ی ردیف‌های صدور چک الزامی است");
    const missingChequeLeaf = instrumentRows.some((r) => r.type === "CHEQUE" && Number(r.amount) > 0 && !r.chequeBookLeafId);
    if (missingChequeLeaf) return setError("انتخاب برگه چک از دسته چک در همه‌ی ردیف‌های صدور چک الزامی است");

    if (reEdit) {
      if (instrumentRows.some((r) => !(Number(r.amount) > 0))) return setError("مبلغ همه‌ی ابزارهای پرداخت باید مثبت باشد؛ برای حذف یک ابزار، ردیف آن را حذف کنید");
      const body = { description: header.description, updatedAt: docUpdatedAt, instrumentLines: buildInstrumentLinesPayload().map((x) => ({ ...x, id: instrumentRows.find((r) => r.clientKey === x.clientKey)?.id })), settlementLines: buildSettlementLinesPayload() };
      if (Math.abs(instrumentBaseTotal - settlementBaseTotal) > 0.001) return setError("مجموع ردیف‌های موضوعات پرداخت (به ارز پایه) باید با مجموع ردیف‌های ابزار پرداخت برابر باشد");
      try {
        await api.put(`/payments/${editId}/re-edit`, body);
        flash();
        // حافظه‌ی فرم «ویرایش» و «ویرایش مجدد» کهنه شده است؛ پاک می‌شود تا فرم از سرور تازه بارگذاری شود
        clearPersistedStateFamily(`form:/payments/${editId}/edit`);
        clearPersistedStateFamily(`form:/payments/${editId}/re-edit`);
        navigate(`/payments/${editId}/edit`);
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
    if (body.settlementLines.length === 0) return setError("حداقل یک ردیف موضوعات پرداخت الزامی است");
    if (Math.abs(instrumentBaseTotal - settlementBaseTotal) > 0.001) return setError("مجموع ردیف‌های موضوعات پرداخت (به ارز پایه) باید با مجموع ردیف‌های ابزار پرداخت برابر باشد");
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
      showError((e as ApiError).message);
    }
  }

  async function handleApprove() {
    if (!editId) return;
    try {
      await api.post(`/payments/${editId}/approve`, {});
      const d: Detail = await api.get(`/payments/${editId}`);
      applyDetail(d);
      flash(APPROVED_NOTICE);
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  // «ویرایش مجدد»: نمایش Action فقط به وضعیت «تایید» وابسته است؛ امکان‌سنجی (وجود ابزار فاقد گردش) بعد از کلیک انجام می‌شود
  async function handleReEdit() {
    if (!editId) return;
    try {
      await api.get(`/payments/${editId}/re-edit`);
      openTab(`/payments/${editId}/re-edit`);
    } catch (e) {
      showError((e as ApiError).message);
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
      showError((e as ApiError).message);
    }
  }

  async function runJournalAction(method: "post" | "del") {
    if (!editId) return;
    try {
      if (method === "post") {
        const result: { message?: string } = await api.post(`/payments/${editId}/issue-journal-entry`, {});
        const d: Detail = await api.get(`/payments/${editId}`);
        applyDetail(d);
        flash(result?.message);
      } else {
        if (!window.confirm("سند حسابداری صادرشده حذف می‌شود. ادامه می‌دهید؟")) return;
        await api.del(`/payments/${editId}/journal-entry`);
        const d: Detail = await api.get(`/payments/${editId}`);
        applyDetail(d);
        flash();
      }
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded || !baseCurrency) return null;

  // مانده‌ی واقعی هر ردیف ابزار پرداخت در انتخابگر «بارگذاری از ابزار پرداخت»: مبلغ کامل قلم منهای
  // مجموع (به ارز پایه) آنچه از قبل به همان قلم در ردیف‌های موضوعات پرداخت فعلیِ فرم تخصیص یافته —
  // همان منطق instrumentRemainingBaseCapacity، اما بدون استثنای هیچ ردیفی (اینجا برای انتخابِ ردیفِ
  // تازه است، نه ویرایش ردیف موجود).
  const instrumentPickerRows = instrumentRows
    // id یکتا برای انتخابگر چندگانه: ردیف‌های تازه‌ی ذخیره‌نشده id ندارند و همه با کلید «undefined» یکی حساب می‌شدند (تیک‌زدن یک ردیف همه را تیک می‌زد)؛ clientKey برای هر ردیف یکتاست
    .map((r, idx) => ({ ...r, idx, id: r.clientKey }))
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
      title={reEdit ? "ویرایش مجدد سند پرداخت" : editId ? "ویرایش سند پرداخت" : "سند پرداخت جدید"}
      description={reEdit ? "حالت ویرایش مجدد: فقط آیتم‌های فاقد گردش قابل ویرایش هستند. ابزارهای پرداخت دارای گردش و موضوعات مرتبط با آن‌ها نمایش داده نمی‌شوند و بدون تغییر می‌مانند؛ افزودن ابزار پرداخت جدید مجاز نیست، اما برای هر ابزار می‌توانید موضوع پرداخت جدید اضافه کنید و جمع موضوعات هر ابزار باید با مبلغ همان ابزار برابر باشد." : jeLocked ? "برای این سند پرداخت سند حسابداری صادر شده است؛ برای هر تغییری ابتدا سند حسابداری را حذف کنید." : status === "APPROVED" ? APPROVED_NOTICE : undefined}
      formId="payment-form"
      closePath="/payments"
      newPath="/payments/new"
      onDelete={!reEdit && (!editId || status === "DRAFT") ? handleDelete : undefined}
      saveDisabled={formLocked}
      extraActions={
        meta && !reEdit
          ? [
              ...(status === "DRAFT" ? [{ label: "تایید", icon: <CheckIcon />, onClick: handleApprove }] : []),
              ...(status === "APPROVED" ? [{ label: "ویرایش مجدد", icon: <PlusIcon />, onClick: handleReEdit }] : []),
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
      <form id="payment-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />

        {/* بعد از صدور سند حسابداری، همه‌ی اطلاعات سند (هدر، ردیف‌های ابزار، موضوعات پرداخت، شرح) قفل است */}
        <fieldset disabled={formLocked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>

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
              <JalaliDatePicker fiscalYear value={header.date} onChange={(v) => setHeader({ ...header, date: v })} />
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

        {/* شرح داخل همین fieldset است: در سند «تایید»شده فقط از مسیر «ویرایش مجدد» قابل تغییر است */}
        <div className="je-header-grid" style={{ marginBottom: 16, maxWidth: 900 }}>
          <div className="form-field full">
            <DescriptionField
              value={header.description}
              onChange={(next) => {
                const prevDescription = header.description;
                setHeader({ ...header, description: next });
                // فقط هنگام ایجاد سند: ردیف‌های ابزاری که هنوز شرح دلخواه ندارند (خالی یا برابر شرح قبلیِ هدر) شرح هدر را به‌عنوان پیش‌فرض می‌گیرند
                if (!editId) setInstrumentRows((prev) => prev.map((r) => (r.description === "" || r.description === prevDescription ? { ...r, description: next } : r)));
              }}
            />
          </div>
        </div>


        <div className="je-lines-toolbar">
          <span className="je-lines-title">ردیف‌های ابزار پرداخت</span>
          {!reEdit && (
          <button type="button" className="toolbar-icon-btn primary" onClick={addInstrumentRow} title="ردیف جدید">
            <PlusIcon />
          </button>
          )}
        </div>

        <div className="grid-wrap je-lines-wrap">
          <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
            <table className="je-lines-table">
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>نوع</th>
                  {hasChequeRow && <th>نوع چک<RequiredMark /></th>}
                  <th>جزئیات</th>
                  <th>ارز</th>
                  <th>مبلغ</th>
                  {hasBankTransferRow && <th>کارمزد پرداخت</th>}
                  <th>نرخ ارز</th>
                  <th>شرح</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {instrumentRows.map((row, idx) => {
                  // در «ویرایش مجدد» نوع ابزار و چکِ خرج‌شده‌ی یک ردیف موجود قابل تغییر نیست (فقط حذف)
                  const typeDisabled = !!reEdit && !!row.id;
                  const spendPickerDisabled = !!reEdit && !!row.id;
                  const isSpendRow = row.type === "CHEQUE_TRANSFER";
                  const bankAccount = bankAccounts.find((a) => String(a.id) === row.bankAccountId);
                  const isBaseCurrencyRow = !row.currencyId || Number(row.currencyId) === baseCurrency.id;
                  // ابزاری که در ردیف‌های موضوعات استفاده شده قابل ویرایش/حذف نیست؛ ابتدا باید موضوعات مرتبط حذف شوند (بک‌اند هم کنترل می‌کند)
                  const instrumentUsed = settlementRows.some((sr) => sr.instrumentClientKey === row.clientKey);
                  return (
                    <Fragment key={row.clientKey}>
                    <tr className={instrumentUsed ? "instrument-row-locked" : undefined} {...(instrumentUsed ? ({ inert: "" } as any) : {})}>
                      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                      <td style={{ minWidth: 140 }}>
                        <select
                          value={row.type}
                          onChange={(e) => {
                            const type = e.target.value as InstrumentType;
                            // طبق سند: چک/چک انتقالی همیشه با ارز پایه؛ حواله از ارز حساب بانکی (تا انتخاب حساب، خالی)
                            const isCheque = type === "CHEQUE" || type === "CHEQUE_TRANSFER";
                            const currencyId = isCheque ? String(baseCurrency.id) : type === "CASH" ? row.currencyId : "";
                            updateInstrumentRow(idx, { type, currencyId, fxRate: isCheque ? "1" : row.fxRate });
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
                            <select value={row.payableChequeTypeId} onChange={(e) => updateInstrumentRow(idx, { payableChequeTypeId: e.target.value, ...(isSameDayType(e.target.value) ? { chequeDueDate: header.date } : {}) })}>
                              <option value="">انتخاب نوع چک</option>
                              {chequeTypes.map((t) => (
                                <option key={t.id} value={t.id}>{t.title}</option>
                              ))}
                            </select>
                          )}
                        </td>
                      )}
                      <td style={{ minWidth: 320 }}>
                        {row.type === "CASH" && (
                          <select value={row.cashBoxId} onChange={(e) => updateInstrumentRow(idx, { cashBoxId: e.target.value })}>
                            <option value="">انتخاب صندوق</option>
                            {cashBoxes.map((c) => (
                              <option key={c.id} value={c.id}>{c.title}</option>
                            ))}
                          </select>
                        )}
                        {row.type === "BANK_TRANSFER" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <div style={{ flex: 1 }}>
                              <BankAccountPicker
                                accounts={bankAccounts}
                                value={row.bankAccountId}
                                onChange={(id, acc) => {
                                  dropSettlementTargetsEqualTo(row.clientKey, id);
                                  const currencyId = acc.currencyId ? String(acc.currencyId) : "";
                                  updateInstrumentRow(idx, { bankAccountId: id, currencyId, fxRate: acc.currencyId === baseCurrency.id ? "1" : row.fxRate });
                                }}
                              />
                            </div>
                            <input
                              placeholder="شماره پیگیری"
                              value={row.referenceNumber}
                              onChange={(e) => updateInstrumentRow(idx, { referenceNumber: e.target.value })}
                             
                              style={{ flex: 1 }}
                            />
                          </div>
                        )}
                        {row.type === "CHEQUE" && (
                          // طبق درخواست کاربر: حساب بانکی همیشه اولین فیلد است (باید پیش از هر اطلاعات دیگر چک
                          // انتخاب شود)، فقط حساب‌های بانکیِ نوعِ «دارای دسته چک» نمایش داده می‌شوند، شماره چک
                          // همیشه از دسته چک انتخاب می‌شود (نه تایپ آزاد)، و شعبه بانک کاملاً حذف شده است.
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <div style={{ flex: "1 1 160px" }}>
                              <BankAccountPicker
                                accounts={bankAccounts}
                                filter={(a) => a.accountType.hasChequeBook}
                                placeholder="حساب بانکی صادرکننده"
                                value={row.bankAccountId}
                                onChange={(id) => {
                                  dropSettlementTargetsEqualTo(row.clientKey, id);
                                  updateInstrumentRow(idx, {
                                    bankAccountId: id,
                                    // با تغییر حساب بانکی صادرکننده، برگه‌ی دسته چک/شماره‌ی قبلی دیگر معتبر نیست
                                    chequeBookLeafId: "",
                                    chequeBookLeafDisplay: "",
                                    chequeNumber: "",
                                  });
                                }}
                              />
                            </div>
                            <div style={{ width: 160 }}>
                              <RecordPickerField
                                title="انتخاب برگه چک"
                                placeholder={row.bankAccountId ? "انتخاب برگه از دسته چک" : "ابتدا حساب بانکی را انتخاب کنید"}
                                disabled={!row.bankAccountId}
                                displayValue={row.chequeBookLeafDisplay}
                                rows={[...pickableChequeBookLeaves, ...ownLeaves].filter((l) => l.bankAccountId === Number(row.bankAccountId))}
                                columns={[
                                  { header: "سری", render: (l) => l.series, filterValue: (l) => l.series, width: "80px" },
                                  { header: "شماره", render: (l) => toFaDigits(l.number), filterValue: (l) => l.number },
                                ]}
                                onSelect={(l) =>
                                  updateInstrumentRow(idx, {
                                    chequeBookLeafId: String((l as PickableChequeBookLeaf).id),
                                    chequeBookLeafDisplay: `${(l as PickableChequeBookLeaf).series} - ${(l as PickableChequeBookLeaf).number}`,
                                    chequeNumber: (l as PickableChequeBookLeaf).number,
                                  })
                                }
                              />
                            </div>
                            <div style={{ width: 140 }}>
                              <JalaliDatePicker value={row.chequeDueDate} onChange={(v) => updateInstrumentRow(idx, { chequeDueDate: v })} disabled={isSameDayType(row.payableChequeTypeId)} />
                            </div>
                          </div>
                        )}
                        {row.type === "CHEQUE_TRANSFER" && (
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
                                currencyId: String(baseCurrency.id),
                                fxRate: "1",
                              })
                            }
                          />
                        )}
                      </td>
                      <td style={{ minWidth: 130 }}>
                        {row.type === "CASH" && (
                          <select value={row.currencyId} onChange={(e) => updateInstrumentRow(idx, { currencyId: e.target.value, fxRate: Number(e.target.value) === baseCurrency.id ? "1" : row.fxRate })}>
                            <option value="">انتخاب ارز</option>
                            {currencies.map((c) => (
                              <option key={c.id} value={c.id}>{c.title}</option>
                            ))}
                          </select>
                        )}
                        {(row.type === "CHEQUE" || row.type === "CHEQUE_TRANSFER") && <span>{baseCurrency.title}</span>}
                        {row.type === "BANK_TRANSFER" && <span>{bankAccount?.currency?.title || "—"}</span>}
                      </td>
                      <td style={{ minWidth: 130 }}>
                        <AmountInput value={row.amount} onChange={(v) => updateInstrumentRow(idx, { amount: v })} allowDecimal placeholder="۰" disabled={isSpendRow} />
                      </td>
                      {hasBankTransferRow && (
                        <td style={{ minWidth: 120 }}>
                          {row.type === "BANK_TRANSFER" && (
                            <AmountInput value={row.feeAmount} onChange={(v) => updateInstrumentRow(idx, { feeAmount: v })} allowDecimal placeholder="۰" />
                          )}
                        </td>
                      )}
                      <td style={{ minWidth: 100 }}>
                        {isBaseCurrencyRow ? (
                          <input dir="ltr" value={toFaDigits("1")} disabled />
                        ) : (
                          <AmountInput value={row.fxRate} onChange={(v) => updateInstrumentRow(idx, { fxRate: v })} allowDecimal placeholder="نرخ ارز" />
                        )}
                      </td>
                      <td style={{ minWidth: 140 }}>
                        <input value={row.description} onChange={(e) => updateInstrumentRow(idx, { description: e.target.value })} />
                      </td>
                      <td>
                        <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => removeInstrumentRow(idx)}>
                            حذف
                          </button>
                      </td>
                    </tr>
                    {instrumentUsed && (
                      <tr>
                        <td colSpan={14} style={{ fontSize: 11.5, color: "var(--ink-soft)", background: "var(--bg)" }}>
                          🔒 این ابزار در موضوعات استفاده شده و قابل ویرایش/حذف نیست؛ برای ویرایش، ابتدا ردیف‌های موضوعاتِ مرتبط را حذف کنید.
                        </td>
                      </tr>
                    )}
                    </Fragment>
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
          <span className="je-lines-title">ردیف‌های موضوعات پرداخت</span>
          <RecordPickerField
            title="انتخاب ردیف‌های ابزار پرداخت برای بارگذاری"
            displayValue=""
            placeholder="بارگذاری از ابزار پرداخت"
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
                  <th>نوع پرداخت</th>
                  <th>طرف حساب / حساب</th>
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
                    paymentTypes={paymentTypes}
                    parties={parties}
                    bankAccounts={bankAccounts}
                    cashBoxes={cashBoxes}
                    custodians={custodians}
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
              جمع موضوعات پرداخت (ارز پایه): {formatAmountFa(settlementBaseTotal)}
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
  idx, row, onChange, onRemove, paymentTypes, parties, bankAccounts, cashBoxes, custodians, customerPartyIds, supplierPartyIds, currencies, baseCurrency, instrumentRows, editId, headerPartyId, headerPartyDisplay, headerDate, allSettlementRows, onApplyBasisSelection,
}: {
  idx: number;
  row: SettlementRowState;
  onChange: (patch: Partial<SettlementRowState>) => void;
  onRemove: () => void;
  paymentTypes: PaymentTypeOption[];
  parties: PartyOption[];
  bankAccounts: BankAccountOption[];
  cashBoxes: CashBoxOption[];
  custodians: CustodianOption[];
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
  const paymentType = paymentTypes.find((t) => String(t.id) === row.paymentTypeId);
  const basisType = paymentType?.basisType;
  const basisCandidates = usePaymentBasisCandidates({ source: "payments", basisType, partyId: row.partyId, paymentTypeId: row.paymentTypeId, editId });
  const instrumentRow = instrumentRows.find((r) => r.clientKey === row.instrumentClientKey);
  // حساب بانکیِ مبدأ (ابزار حواله یا چکِ صادرشده) از انتخابگر مقصدِ «به بانک» حذف می‌شود؛ پرداخت از یک حساب به همان حساب مجاز نیست
  const sourceBankAccountId = instrumentRow && (instrumentRow.type === "BANK_TRANSFER" || instrumentRow.type === "CHEQUE") ? instrumentRow.bankAccountId : "";


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
    !paymentType ? []
    : paymentType.nature === "SUPPLIER_PAYMENT" || paymentType.nature === "ADVANCE_PAYMENT" || paymentType.nature === "ADVANCE_VAT_PAYMENT" ? parties.filter((p) => supplierPartyIds.has(p.id))
    : paymentType.nature === "CUSTOMER_PAYMENT" ? parties.filter((p) => customerPartyIds.has(p.id))
    : parties;

  const rowCurrency = currencies.find((c) => String(c.id) === row.currencyId);
  const isBaseCurrencyRow = !row.currencyId || Number(row.currencyId) === baseCurrency.id;

  const currentBasisId = row.salesInvoiceId || row.purchaseInvoiceId || row.purchaseOrderId;

  // مانده‌ی واقعاً باقی‌مانده‌ی خودِ ردیف ابزار پرداخت (قلم) برای این ردیف موضوع پرداخت: baseAmount قلم
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

  // طبق سند: پیش‌فرض طرف حساب هر ردیف، طرف حساب هدر است — فقط اگر با شرط نوع پرداخت سازگار باشد
  // (مشتری/تامین‌کننده بودن طرف حساب هدر)؛ برای «سایر»/وی‌ای‌تی بدون شرط همیشه ست می‌شود.
  function onPaymentTypeChange(paymentTypeId: string) {
    const rt = paymentTypes.find((t) => String(t.id) === paymentTypeId);
    // با تغییرِ نوعِ انتخابگر (طرف حساب ↔ حساب بانکی ↔ صندوق ↔ تنخواه‌دار) مقدار قبلی معتبر نیست و پاک می‌شود
    const kindChanged = selectorKind(rt?.nature) !== selectorKind(paymentType?.nature);
    let partyId = kindChanged ? "" : row.partyId;
    let partyDisplay = kindChanged ? "" : row.partyDisplay;
    const bankAccountId = kindChanged ? "" : row.bankAccountId;
    const cashBoxId = kindChanged ? "" : row.cashBoxId;
    const custodianId = kindChanged ? "" : row.custodianId;
    if (rt && selectorKind(rt.nature) === "PARTY" && !partyId && headerPartyId) {
      const headerPartyIdNum = Number(headerPartyId);
      const qualifies =
        rt.nature === "SUPPLIER_PAYMENT" || rt.nature === "ADVANCE_PAYMENT" || rt.nature === "ADVANCE_VAT_PAYMENT" ? supplierPartyIds.has(headerPartyIdNum)
        : rt.nature === "CUSTOMER_PAYMENT" ? customerPartyIds.has(headerPartyIdNum)
        : true;
      if (qualifies) {
        partyId = headerPartyId;
        partyDisplay = headerPartyDisplay;
      }
    }
    // نوع پرداختِ «بدون مبنا» (هر ماهیتی: سایر، به بانک، به صندوق، …): سند مبنایی وجود ندارد که مبلغ را تعیین کند؛ مبلغ ردیف خودکار برابر مانده‌ی
    // قلم (ردیف ابزار پرداخت) این ردیف می‌شود — وقتی مبلغ خالی است، یا انتخابگر عوض شده، یا نوع قبلیِ ردیف مبنادار بوده (مبلغِ آن سند مبنا کهنه است)
    let amountPatch: Partial<SettlementRowState> = {};
    const prevBasis = paymentType?.basisType;
    if (rt && rt.basisType === "NONE" && instrumentRow && (kindChanged || !row.amount || (prevBasis && prevBasis !== "NONE"))) {
      const remainingBase = instrumentRemainingBaseCapacity();
      const instrumentCurrency = currencies.find((c) => String(c.id) === instrumentRow.currencyId);
      if (remainingBase > 0) {
        if (isBaseCurrencyRow) {
          amountPatch = { amount: String(remainingBase), fxRate: "1", exchangeGainLoss: 0 };
        } else if (rowCurrency && instrumentCurrency && rowCurrency.id === instrumentCurrency.id) {
          const foreignAmount = roundToCurrencyDecimals(fromBaseCurrencyAmount(remainingBase, Number(instrumentRow.fxRate) || 1, rowCurrency), rowCurrency.decimalPlaces);
          amountPatch = { amount: String(foreignAmount), fxRate: instrumentRow.fxRate, exchangeGainLoss: 0 };
        }
      }
    }
    onChange({
      paymentTypeId,
      partyId, partyDisplay, bankAccountId, cashBoxId, custodianId,
      salesInvoiceId: "", purchaseInvoiceId: "", purchaseOrderId: "", basisDisplay: "",
      ...amountPatch,
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
        <select value={row.paymentTypeId} onChange={(e) => onPaymentTypeChange(e.target.value)}>
          <option value="">انتخاب کنید</option>
          {selectableTypes(paymentTypes, row.paymentTypeId).map((t) => (
            <option key={t.id} value={t.id}>{typeLabel(t)}</option>
          ))}
        </select>
      </td>
      <td style={{ minWidth: 180 }}>
        {selectorKind(paymentType?.nature) === "BANK" ? (
          <BankAccountPicker
            accounts={bankAccounts}
            filter={(a) => !sourceBankAccountId || String(a.id) !== sourceBankAccountId}
            value={row.bankAccountId}
            onChange={(id, b) => onChange({ bankAccountId: id, cashBoxId: "", custodianId: "", partyId: "", partyDisplay: bankAccountLabel(b) })}
          />
        ) : selectorKind(paymentType?.nature) === "CASH" ? (
          <RecordPickerField
            title="انتخاب صندوق"
            displayValue={row.partyDisplay}
            rows={cashBoxes}
            columns={[{ header: "عنوان", render: (c) => c.title, filterValue: (c) => c.title }]}
            onSelect={(c) => onChange({ cashBoxId: String(c.id), bankAccountId: "", custodianId: "", partyId: "", partyDisplay: c.title })}
          />
        ) : selectorKind(paymentType?.nature) === "CUSTODIAN" ? (
          <RecordPickerField
            title="انتخاب تنخواه‌دار"
            displayValue={row.partyDisplay}
            rows={custodians}
            columns={[
              { header: "کد", render: (c) => toFaDigits(c.detailCode), filterValue: (c) => c.detailCode, width: "100px" },
              { header: "تنخواه‌دار", render: (c) => custodianLabel(c), filterValue: (c) => custodianLabel(c) },
            ]}
            onSelect={(c) => onChange({ custodianId: String(c.id), bankAccountId: "", cashBoxId: "", partyId: "", partyDisplay: custodianLabel(c) })}
          />
        ) : (
        <RecordPickerField
          title="انتخاب طرف حساب"
          disabled={!paymentType}
          displayValue={row.partyDisplay}
          rows={eligibleParties}
          columns={[
            { header: "کد", render: (p) => toFaDigits(p.detailCode), filterValue: (p) => p.detailCode, width: "100px" },
            { header: "نام", render: (p) => partyDisplayName(p), filterValue: (p) => partyDisplayName(p) },
          ]}
          onSelect={(p) => onChange({ partyId: String(p.id), partyDisplay: partyDisplayName(p), salesInvoiceId: "", purchaseInvoiceId: "", purchaseOrderId: "", basisDisplay: "" })}
        />
        )}
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
            // طبق بند ۵ سند ReceiptChanges: نرخ فقط برای ارز پایه (=۱) یا ارز هم‌سان با قلم پرداختی
            // (=نرخ همان قلم) خودکار پر می‌شود؛ در غیر این‌صورت برای ورود دستی خالی می‌ماند.
            const fxRate =
              newCurrencyId === baseCurrency.id ? "1"
              : instrumentRow && String(newCurrencyId) === instrumentRow.currencyId ? instrumentRow.fxRate
              : "";
            onChange({
              currencyId: e.target.value,
              fxRate,
              ...(hasBasisSet
                ? { salesInvoiceId: "", purchaseInvoiceId: "", purchaseOrderId: "", basisDisplay: "", amount: "", exchangeGainLoss: 0 }
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
            <PaymentBasisPicker
              candidates={basisCandidates}
              remainingOf={effectiveRemaining}
              filter={(c) => c.currencyId === baseCurrency.id}
              currentBasisId={currentBasisId}
              disabled={!row.partyId}
              displayValue={row.basisDisplay}
              multiSelect
              onSelectMultiple={onBasisMultiSelect}
            />
          ) : rowCurrency ? (
            // طبق بند ۳ (حالت ارز غیرپایه): ورود از طریق مودال، نه گرید مستقیم.
            <>
              <button type="button" className="picker-field" disabled={!row.partyId} onClick={() => setFxModalOpen(true)}>
                <span>{row.basisDisplay ? toFaDigits(row.basisDisplay) : <span className="picker-placeholder">انتخاب سند مبنا (ارزی)</span>}</span>
              </button>
              {fxModalOpen && (
                <PaymentForeignBasisModal
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
                    const field = BASIS_FIELD[basisType as Exclude<PaymentBasisType, "NONE">];
                    // طبق بند ۴ سند: تسعیر فقط همین‌جا، یک‌بار، بعد از تایید مودال محاسبه می‌شود.
                    const exchangeGainLoss =
                      basisType === "SALES_INVOICE" || basisType === "PURCHASE_INVOICE"
                        ? calculateExchangeGainLoss("PAYMENT", Number(amount) || 0, Number(fxRate) || 1, basis.fxRate, rowCurrency, baseCurrency)
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
// پرداختِ ارزی. مودال فقط وظیفه‌ی ورود اطلاعات و اعتبارسنجی اولیه (بند ۷) را دارد — هیچ محاسبه‌ی
// تسعیری داخل آن انجام نمی‌شود؛ محاسبه‌ی تسعیر فقط در onConfirm فراخوانی‌کننده (SettlementRowFields)
// انجام می‌شود، دقیقاً یک‌بار، بعد از تایید. الگوی «نرخ + مبلغ ارزی وارد می‌شود، معادل ارز پایه محاسبه و
// نمایش داده می‌شود» دقیقاً هم‌شکل components/FxAmountDialog.tsx است.
function PaymentForeignBasisModal({
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

  // طبق بند ۳: اگر ارز فاکتور انتخاب‌شده با ارز قلم پرداخت یکسان باشد، نرخ از همان قلم پیش‌فرض می‌شود
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
    <Modal title={`ورود اطلاعات ارزی موضوع پرداخت (${rowCurrency.title})`} onClose={onClose}>
      <ErrorToast message={error} />
      <div className="form-grid">
        <div className="form-field full">
          <label>سند مبنا<RequiredMark /></label>
          <RecordPickerField
            title="انتخاب سند مبنا"
            displayValue={selected ? toFaDigits(String(selected.number)) : ""}
            placeholder="انتخاب سند مبنا"
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
