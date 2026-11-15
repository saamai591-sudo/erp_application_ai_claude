import { FormEvent, useEffect, useState } from "react";
import { TypePickerField } from "../components/TypePickerFields";
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
import { useTabs } from "../lib/TabsContext";
import { api, ApiError } from "../lib/api";

import { FiscalPeriodRange, fetchSelectedFiscalPeriod, defaultDocumentDate, validateDocumentDate } from "../lib/fiscalYearDefaultDate";
import { toBaseCurrencyAmount, fromBaseCurrencyAmount, calculateExchangeGainLoss, roundToCurrencyDecimals } from "../lib/currencyConversion";
import { DescriptionField } from "../components/DescriptionField";
import { TreasuryAccountingPanel } from "../components/TreasuryAccountingPanel";
import { PaymentBasisPicker, usePaymentBasisCandidates, BasisCandidate as PayBasis, basisKeyOf, rowBasisKey, basisFieldPatch, basisDisplayOf } from "../components/PaymentBasisPicker";
import { usePermissions } from "../lib/usePermissions";
import { CheckIcon, UndoIcon, PlusIcon, EyeIcon } from "../components/icons";
import { partyDisplayName } from "../lib/partyDisplay";

// «اعلامیه بدهکار بستانکار» (مدیریت خزانه › دریافت): تسویه بین طرف‌حساب‌ها بدون ابزار — مثلاً مشتری وجه فاکتور خود را از طرف ما به حساب تامین‌کننده می‌ریزد.
// بالا «موضوعات دریافت» (بستانکار)، پایین «موضوعات پرداخت» (بدهکار) که هرکدام از یک ردیف دریافت «لود» می‌شوند؛ جمع ریالی ردیف‌های پرداختِ هر ردیف دریافت
// باید دقیقاً برابر مبلغ ریالی همان ردیف باشد. قواعد در backend/src/services/partySettlementService.ts (فرانت فقط نمایش و کمک‌محاسبه است).

type AccountingStatus = "NONE" | "APPROVED";
type RecvBasis = "NONE" | "SALES_INVOICE" | "PURCHASE_INVOICE" | "SALES_ORDER" | "PROFORMA_INVOICE";

interface PartyOption { id: number; detailCode: string; category: "INDIVIDUAL" | "LEGAL"; isActive: boolean; firstName: string | null; lastName: string | null; name: string | null }
interface CurrencyOption { id: number; code: string; title: string; isBase: boolean; baseVolume: number; rateDirection: "TO_BASE" | "FROM_BASE" | null; decimalPlaces: number }
interface RecvTypeOption { id: number; title: string; nature: string; basisType: RecvBasis; isActive: boolean }
interface PayTypeOption { id: number; title: string; nature: string; basisType: string; isActive: boolean }
interface RecvBasisCandidate { id: number; number: number; date: string; currencyId: number; currencyTitle: string; fxRate: number; total: number; applied: number; remaining: number }

const RECV_BASIS_FIELD: Record<Exclude<RecvBasis, "NONE">, "salesInvoiceId" | "purchaseInvoiceId" | "salesOrderId" | "salesQuoteId"> = {
  SALES_INVOICE: "salesInvoiceId",
  PURCHASE_INVOICE: "purchaseInvoiceId",
  SALES_ORDER: "salesOrderId",
  PROFORMA_INVOICE: "salesQuoteId",
};
// ماهیت‌های پرداختی که مقصد نقد دارند و در این فرم (بدون ابزار) مجاز نیستند
const BLOCKED_PAY_NATURES = ["TO_BANK", "TO_CASH_BOX", "TO_PETTY_CASH"];
const isRecvVat = (n?: string) => n === "ADVANCE_VAT_RECEIPT" || n === "SALES_VAT";
const isPayVat = (n?: string) => n === "PURCHASE_VAT";

interface ListRow {
  id: number;
  number: number;
  date: string;
  description: string | null;
  fiscalPeriodTitle: string;
  accountingStatus: AccountingStatus;
  journalEntryReferenceNumber: number | null;
  receiptRowCount: number;
  paymentRowCount: number;
  totalBaseAmount: number;
}

interface RecvRow {
  id?: number;
  clientKey: string;
  receiptTypeId: string;
  partyId: string;
  partyDisplay: string;
  salesInvoiceId: string;
  purchaseInvoiceId: string;
  salesOrderId: string;
  salesQuoteId: string;
  basisDisplay: string;
  /** نرخ ارز سند مبنا برای محاسبه‌ی زنده‌ی تسعیر (فقط نمایشی؛ تسعیر نهایی را سرور حساب می‌کند) */
  basisFxRate?: number | null;
  currencyId: string;
  fxRate: string;
  amount: string;
  description: string;
  exchangeGainLoss: number;
}
interface PayRow {
  id?: number;
  sourceClientKey: string;
  paymentTypeId: string;
  partyId: string;
  partyDisplay: string;
  salesInvoiceId: string;
  purchaseInvoiceId: string;
  servicePurchaseInvoiceId: string;
  purchaseOrderId: string;
  basisDisplay: string;
  basisFxRate?: number | null;
  currencyId: string;
  fxRate: string;
  amount: string;
  description: string;
  exchangeGainLoss: number;
}

interface Meta {
  number: number;
  fiscalPeriodTitle: string;
  accountingStatus: AccountingStatus;
  journalEntryId: number | null;
  journalEntryReferenceNumber: number | null;
}

let seq = 0;
const nextKey = () => `new-${Date.now()}-${++seq}`;

function statusLabel(accountingStatus?: AccountingStatus, hasJournal?: boolean) {
  if (hasJournal) return "سند صادر شده";
  if (accountingStatus === "APPROVED") return "تایید حسابداری";
  return "ثبت";
}

const INFO =
  "تسویه بین طرف‌حساب‌ها بدون ابزار پرداخت؛ مثلاً مشتری وجه فاکتور خود را از طرف ما به حساب تامین‌کننده می‌ریزد. در بخش بالا «موضوعات دریافت» (بستانکار: مشتری و فاکتورش) و در بخش پایین «موضوعات پرداخت» (بدهکار: گیرنده و فاکتورش) ثبت می‌شود؛ " +
  "هر ردیف پرداخت از یک ردیف دریافت «لود» می‌شود و جمع ریالی ردیف‌های پرداختِ هر ردیف دریافت باید دقیقاً با مبلغ همان ردیف برابر باشد. هر بار «بارگذاری از ردیف‌های دریافت» مانده‌ی هر ردیف دریافت را به‌صورت ردیف پرداخت می‌آورد و کاربر نوع پرداخت و مقصد (مثلاً فاکتور تامین‌کننده یا پیش‌پرداخت) را خودش انتخاب می‌کند؛ مانده‌ی ردیف دریافت تا تخصیص کامل قرمز می‌ماند. " +
  "سند حسابداری یکی است: بدهکار موضوعات پرداخت، بستانکار موضوعات دریافت.";

export default function PartySettlements() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <SettlementForm />;
  if (location.pathname.endsWith("/edit")) return <SettlementForm editId={Number(id)} />;
  return <SettlementList />;
}

function SettlementList() {
  const cacheKey = "/party-settlements";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      setItems(await api.get("/party-settlements"));
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
      await api.del(`/party-settlements/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO} title="اعلامیه بدهکار بستانکار" />
          <NewRecordButton path="/party-settlements/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "شرح", render: (r) => r.description || "—", filterType: "string", filterValue: (r) => r.description || "" },
          { header: "ردیف دریافت", render: (r) => toFaDigits(String(r.receiptRowCount)), width: "90px", filterType: "number", filterValue: (r) => r.receiptRowCount },
          { header: "ردیف پرداخت", render: (r) => toFaDigits(String(r.paymentRowCount)), width: "90px", filterType: "number", filterValue: (r) => r.paymentRowCount },
          { header: "مبلغ (ارز پایه)", render: (r) => formatAmountFa(r.totalBaseAmount), filterType: "number", filterValue: (r) => r.totalBaseAmount, decimal: true },
          { header: "وضعیت", render: (r) => <span className="badge">{statusLabel(r.accountingStatus, !!r.journalEntryReferenceNumber)}</span>, filterType: "string", filterValue: (r) => statusLabel(r.accountingStatus, !!r.journalEntryReferenceNumber) },
        ]}
        rows={items}
        edit={{ path: (r) => `/party-settlements/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function SettlementForm({ editId }: { editId?: number }) {
  const { hasPermission: perm } = usePermissions();
  const { openTab } = useTabs();
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [recvTypes, setRecvTypes] = useState<RecvTypeOption[]>([]);
  const [payTypes, setPayTypes] = useState<PayTypeOption[]>([]);
  const [customerPartyIds, setCustomerPartyIds] = useState<Set<number>>(new Set());
  const [supplierPartyIds, setSupplierPartyIds] = useState<Set<number>>(new Set());
  const [docUpdatedAt, setDocUpdatedAt] = usePersistedState<string>(`${cacheKey}:updatedAt`, "");
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", description: "" });
  const [recvRows, setRecvRows] = usePersistedState<RecvRow[]>(`${cacheKey}:recvRows`, []);
  const [payRows, setPayRows] = usePersistedState<PayRow[]>(`${cacheKey}:payRows`, []);
  const [meta, setMeta] = usePersistedState<Meta | null>(`${cacheKey}:meta`, null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fiscalPeriod, setFiscalPeriod] = useState<FiscalPeriodRange | null>(null);
  const { flash } = useSavedFlash();

  const baseCurrency = currencies.find((c) => c.isBase);

  function applyDetail(d: any) {
    setDocUpdatedAt(d.updatedAt ?? "");
    setMeta({ number: d.number, fiscalPeriodTitle: d.fiscalPeriodTitle, accountingStatus: d.accountingStatus ?? "NONE", journalEntryId: d.journalEntryId ?? null, journalEntryReferenceNumber: d.journalEntryReferenceNumber ?? null });
    setHeader({ date: d.date.slice(0, 10), description: d.description || "" });
    setRecvRows(
      d.receiptRows.map((l: any) => ({
        id: l.id,
        clientKey: String(l.id),
        receiptTypeId: String(l.receiptTypeId),
        partyId: String(l.partyId),
        partyDisplay: l.partyDisplay,
        salesInvoiceId: l.salesInvoiceId ? String(l.salesInvoiceId) : "",
        purchaseInvoiceId: l.purchaseInvoiceId ? String(l.purchaseInvoiceId) : "",
        salesOrderId: l.salesOrderId ? String(l.salesOrderId) : "",
        salesQuoteId: l.salesQuoteId ? String(l.salesQuoteId) : "",
        basisDisplay: toFaDigits(String(l.salesInvoiceNumber ?? l.purchaseInvoiceNumber ?? l.salesOrderNumber ?? l.salesQuoteNumber ?? "")),
        basisFxRate: l.basisFxRate ?? null,
        currencyId: String(l.currencyId),
        fxRate: String(l.fxRate),
        amount: String(l.amount),
        description: l.description || "",
        exchangeGainLoss: l.exchangeGainLoss,
      }))
    );
    setPayRows(
      d.paymentRows.map((l: any) => ({
        id: l.id,
        sourceClientKey: String(l.sourceReceiptRowId),
        paymentTypeId: String(l.paymentTypeId),
        partyId: l.partyId ? String(l.partyId) : "",
        partyDisplay: l.partyDisplay,
        salesInvoiceId: l.salesInvoiceId ? String(l.salesInvoiceId) : "",
        purchaseInvoiceId: l.purchaseInvoiceId ? String(l.purchaseInvoiceId) : "",
        servicePurchaseInvoiceId: l.servicePurchaseInvoiceId ? String(l.servicePurchaseInvoiceId) : "",
        purchaseOrderId: l.purchaseOrderId ? String(l.purchaseOrderId) : "",
        basisDisplay: toFaDigits(String(l.salesInvoiceNumber ?? l.purchaseInvoiceNumber ?? l.servicePurchaseInvoiceNumber ?? l.purchaseOrderNumber ?? "")) + (l.servicePurchaseInvoiceId ? " (خدمات)" : ""),
        basisFxRate: l.basisFxRate ?? null,
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
      const [ps, cs, rts, pts, customers, suppliers, fp]: [PartyOption[], CurrencyOption[], RecvTypeOption[], PayTypeOption[], { partyId: number }[], { partyId: number }[], FiscalPeriodRange | null] = await Promise.all([
        api.get("/parties"),
        api.get("/currencies"),
        api.get("/receipt-types"),
        api.get("/payment-types"),
        api.get("/customers"),
        api.get("/suppliers"),
        fetchSelectedFiscalPeriod(),
      ]);
      setParties(ps);
      setCurrencies(cs);
      setRecvTypes(rts);
      setPayTypes(pts);
      setCustomerPartyIds(new Set(customers.map((c) => c.partyId)));
      setSupplierPartyIds(new Set(suppliers.map((s) => s.partyId)));
      setFiscalPeriod(fp);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        // تب می‌تواند مدت‌ها باز مانده باشد؛ فقط وضعیت اعلامیه از سرور تازه می‌شود (ورودی‌های کاربر دست‌نخورده)
        if (editId) {
          try {
            const d = await api.get(`/party-settlements/${editId}`);
            setMeta((prev) => (prev ? { ...prev, accountingStatus: d.accountingStatus ?? "NONE", journalEntryId: d.journalEntryId ?? null, journalEntryReferenceNumber: d.journalEntryReferenceNumber ?? null } : prev));
          } catch {
            // به مقادیر کش‌شده بسنده می‌شود؛ ذخیره‌سازی همچنان در سرور اعتبارسنجی می‌شود
          }
        }
        return;
      }
      if (editId) {
        applyDetail(await api.get(`/party-settlements/${editId}`));
      } else {
        setHeader({ date: defaultDocumentDate(fp), description: "" });
        setRecvRows([]);
        setPayRows([]);
        setMeta(null);
      }
      setLoaded(true);
    }
    init().catch((e) => showError((e as ApiError).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const accountingApproved = meta?.accountingStatus === "APPROVED";
  const jeLocked = !!meta?.journalEntryId;
  const formLocked = jeLocked || accountingApproved;

  // ---------- محاسبات نمایشی (ارز پایه) ----------
  const curOf = (id: string) => currencies.find((c) => String(c.id) === id);
  function baseOfRow(r: { amount: string; currencyId: string; fxRate: string }): number {
    const c = curOf(r.currencyId);
    const a = Number(r.amount) || 0;
    if (!c || !baseCurrency || !a) return 0;
    return toBaseCurrencyAmount(a, c.isBase ? 1 : Number(r.fxRate) || 1, c, baseCurrency);
  }
  const recvBase = new Map<string, number>(recvRows.map((r) => [r.clientKey, baseOfRow(r)]));
  const allocBase = new Map<string, number>();
  payRows.forEach((r) => allocBase.set(r.sourceClientKey, (allocBase.get(r.sourceClientKey) || 0) + baseOfRow(r)));
  const dec = baseCurrency?.decimalPlaces ?? 0;
  const remainingBase = (key: string) => roundToCurrencyDecimals((recvBase.get(key) || 0) - (allocBase.get(key) || 0), dec);
  const recvTotal = recvRows.reduce((s, r) => s + baseOfRow(r), 0);
  const payTotal = payRows.reduce((s, r) => s + baseOfRow(r), 0);

  // ---------- ردیف‌ها ----------
  function newRecvRow(): RecvRow {
    return { clientKey: nextKey(), receiptTypeId: "", partyId: "", partyDisplay: "", salesInvoiceId: "", purchaseInvoiceId: "", salesOrderId: "", salesQuoteId: "", basisDisplay: "", currencyId: baseCurrency ? String(baseCurrency.id) : "", fxRate: baseCurrency ? "1" : "", amount: "", description: header.description, exchangeGainLoss: 0 };
  }
  function newPayRow(sourceKey: string, init?: Partial<PayRow>): PayRow {
    return { sourceClientKey: sourceKey, paymentTypeId: "", partyId: "", partyDisplay: "", salesInvoiceId: "", purchaseInvoiceId: "", servicePurchaseInvoiceId: "", purchaseOrderId: "", basisDisplay: "", currencyId: baseCurrency ? String(baseCurrency.id) : "", fxRate: baseCurrency ? "1" : "", amount: "", description: header.description, exchangeGainLoss: 0, ...init };
  }
  // تسعیر زنده (فقط نمایشی؛ مقدار نهایی را سرور حساب می‌کند): فقط وقتی سند مبنای دارای نرخ ارز انتخاب شده
  function withFx(row: any, kind: "RECEIPT" | "PAYMENT"): any {
    const c = curOf(row.currencyId);
    const amount = Number(row.amount) || 0;
    if (!c || !baseCurrency || !row.basisFxRate || !amount) return row.basisFxRate ? { ...row, exchangeGainLoss: 0 } : row;
    return { ...row, exchangeGainLoss: calculateExchangeGainLoss(kind, amount, c.isBase ? 1 : Number(row.fxRate) || 1, row.basisFxRate, c, baseCurrency) };
  }
  const updateRecv = (idx: number, patch: Partial<RecvRow>) => setRecvRows((prev) => prev.map((r, i) => (i === idx ? withFx({ ...r, ...patch }, "RECEIPT") : r)));
  const updatePay = (idx: number, patch: Partial<PayRow>) => setPayRows((prev) => prev.map((r, i) => (i === idx ? withFx({ ...r, ...patch }, "PAYMENT") : r)));
  function removeRecv(idx: number) {
    const key = recvRows[idx].clientKey;
    if (payRows.some((p) => p.sourceClientKey === key) && !window.confirm("ردیف‌های پرداختِ لودشده از این ردیف دریافت هم حذف می‌شوند. ادامه می‌دهید؟")) return;
    setRecvRows((prev) => prev.filter((_, i) => i !== idx));
    setPayRows((prev) => prev.filter((p) => p.sourceClientKey !== key));
  }
  const removePay = (idx: number) => setPayRows((prev) => prev.filter((_, i) => i !== idx));

  function guardHeader(): boolean {
    if (!header.date) {
      setError("تاریخ سند الزامی است");
      return false;
    }
    return true;
  }
  function addRecvRow() {
    if (!guardHeader()) return;
    setRecvRows((prev) => [...prev, newRecvRow()]);
  }

  // مانده‌ی تخصیص‌نیافته‌ی هر ردیف دریافت (به ارز خودِ ردیف)
  function remainingInRowCurrency(r: RecvRow): number {
    const c = curOf(r.currencyId);
    if (!c || !baseCurrency) return 0;
    const rem = Math.max(0, remainingBase(r.clientKey));
    return roundToCurrencyDecimals(fromBaseCurrencyAmount(rem, c.isBase ? 1 : Number(r.fxRate) || 1, c), c.decimalPlaces);
  }
  const loadable = recvRows
    .map((r, idx) => ({ ...r, idx, id: r.clientKey, remainingAmount: remainingInRowCurrency(r) }))
    .filter((r) => Number(r.amount) > 0 && r.remainingAmount > 0);

  function loadFromReceipts(selected: any[]) {
    if (!guardHeader()) return;
    setPayRows((prev) => [
      ...prev,
      ...selected.map((s) => newPayRow(s.clientKey, { currencyId: s.currencyId, fxRate: s.fxRate, amount: String(s.remainingAmount), description: s.description || header.description })),
    ]);
  }

  // ---------- ذخیره ----------
  function buildBody() {
    return {
      date: header.date,
      description: header.description,
      updatedAt: editId ? docUpdatedAt : undefined,
      receiptRows: recvRows
        .filter((r) => Number(r.amount) > 0)
        .map((r) => ({
          id: r.id,
          clientKey: r.clientKey,
          receiptTypeId: Number(r.receiptTypeId),
          partyId: Number(r.partyId),
          salesInvoiceId: r.salesInvoiceId ? Number(r.salesInvoiceId) : null,
          purchaseInvoiceId: r.purchaseInvoiceId ? Number(r.purchaseInvoiceId) : null,
          salesOrderId: r.salesOrderId ? Number(r.salesOrderId) : null,
          salesQuoteId: r.salesQuoteId ? Number(r.salesQuoteId) : null,
          currencyId: r.currencyId ? Number(r.currencyId) : undefined,
          fxRate: r.fxRate ? Number(r.fxRate) : undefined,
          amount: Number(r.amount) || 0,
          description: r.description || null,
        })),
      paymentRows: payRows
        .filter((r) => Number(r.amount) > 0)
        .map((r) => ({
          id: r.id,
          sourceClientKey: r.sourceClientKey,
          paymentTypeId: Number(r.paymentTypeId),
          partyId: r.partyId ? Number(r.partyId) : null,
          salesInvoiceId: r.salesInvoiceId ? Number(r.salesInvoiceId) : null,
          purchaseInvoiceId: r.purchaseInvoiceId ? Number(r.purchaseInvoiceId) : null,
          servicePurchaseInvoiceId: r.servicePurchaseInvoiceId ? Number(r.servicePurchaseInvoiceId) : null,
          purchaseOrderId: r.purchaseOrderId ? Number(r.purchaseOrderId) : null,
          currencyId: r.currencyId ? Number(r.currencyId) : undefined,
          fxRate: r.fxRate ? Number(r.fxRate) : undefined,
          amount: Number(r.amount) || 0,
          description: r.description || null,
        })),
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!header.date) return setError("تاریخ الزامی است");
    const dateErr = validateDocumentDate(header.date, fiscalPeriod);
    if (dateErr) return setError(dateErr);
    const body = buildBody();
    if (body.receiptRows.length === 0) return setError("حداقل یک ردیف موضوعات دریافت الزامی است");
    if (body.paymentRows.length === 0) return setError("حداقل یک ردیف موضوعات پرداخت الزامی است");
    const unbalanced = recvRows.findIndex((r) => Number(r.amount) > 0 && Math.abs(remainingBase(r.clientKey)) > 0.001);
    if (unbalanced >= 0) return setError(`جمع ردیف‌های پرداختِ لودشده از ردیف دریافت ${toFaDigits(String(unbalanced + 1))} باید دقیقاً برابر مبلغ همان ردیف باشد`);
    try {
      if (editId) {
        await api.put(`/party-settlements/${editId}`, body);
        flash();
        applyDetail(await api.get(`/party-settlements/${editId}`));
      } else {
        const created = await api.post("/party-settlements", body);
        flash();
        navigate(`/party-settlements/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/party-settlements/${editId}`);
      navigate("/party-settlements");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function reloadDetail(message?: string) {
    applyDetail(await api.get(`/party-settlements/${editId}`));
    flash(message);
  }
  async function act(fn: () => Promise<any>, okMessage?: string) {
    if (!editId) return;
    try {
      await fn();
      await reloadDetail(okMessage);
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded || !baseCurrency) return null;

  const accountingActions: { label: string; icon: JSX.Element; onClick: () => void }[] =
    meta
      ? [
          ...(!accountingApproved && !jeLocked && perm("treasury.receipt-ops.party-settlements.accountingApprove")
            ? [{ label: "تایید حسابداری", icon: <CheckIcon />, onClick: () => act(() => api.post(`/party-settlements/${editId}/accounting-approve`, {}), "تایید حسابداری انجام شد؛ تفصیل‌ها را کنترل و ذخیره کنید") }]
            : []),
          ...(accountingApproved && !jeLocked && perm("treasury.receipt-ops.party-settlements.accountingUnapprove")
            ? [{ label: "لغو تایید حسابداری", icon: <UndoIcon />, onClick: () => act(() => api.post(`/party-settlements/${editId}/accounting-unapprove`, {})) }]
            : []),
          ...(!accountingApproved && !jeLocked && perm("treasury.receipt-ops.party-settlements.deleteAccountingInfo")
            ? [{ label: "حذف اطلاعات حسابداری", icon: <UndoIcon />, onClick: () => { if (window.confirm("اطلاعات حسابداری (معین و تفصیل‌های ردیف‌های حسابداری) این اعلامیه حذف می‌شود. ادامه می‌دهید؟")) void act(() => api.post(`/party-settlements/${editId}/delete-accounting-info`, {})); } }]
            : []),
          ...(accountingApproved && !jeLocked && perm("treasury.receipt-ops.party-settlements.issueJournalEntry")
            ? [{ label: "صدور سند حسابداری", icon: <PlusIcon />, onClick: () => act(async () => (await api.post(`/party-settlements/${editId}/issue-journal-entry`, {}))?.message) }]
            : []),
          ...(jeLocked
            ? [
                { label: "مشاهده سند حسابداری", icon: <EyeIcon />, onClick: () => openTab(`/journal-entries/${meta.journalEntryId}/edit`) },
                ...(perm("treasury.receipt-ops.party-settlements.revertJournalEntry")
                  ? [{ label: "حذف سند حسابداری", icon: <UndoIcon />, onClick: () => { if (window.confirm("سند حسابداری صادرشده حذف می‌شود. ادامه می‌دهید؟")) void act(() => api.del(`/party-settlements/${editId}/journal-entry`)); } }]
                  : []),
              ]
            : []),
        ]
      : [];

  return (
    <FormPage
      title={editId ? "ویرایش اعلامیه بدهکار بستانکار" : "اعلامیه بدهکار بستانکار جدید"}
      description={jeLocked ? "برای این اعلامیه سند حسابداری صادر شده است؛ برای هر تغییری ابتدا سند حسابداری را حذف کنید." : accountingApproved ? "این اعلامیه «تایید حسابداری» شده است؛ برای تغییر ابتدا «لغو تایید حسابداری» را بزنید. فقط تفصیل‌های بخش «اطلاعات حسابداری» قابل ویرایش‌اند." : undefined}
      formId="party-settlement-form"
      closePath="/party-settlements"
      newPath="/party-settlements/new"
      onDelete={!accountingApproved && !jeLocked ? handleDelete : undefined}
      saveDisabled={formLocked}
      extraActions={accountingActions}
      wide
    >
      <form id="party-settlement-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <fieldset disabled={formLocked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className="je-header-grid cols-3" style={{ marginBottom: 6, maxWidth: 900 }}>
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
              <div><span className="badge">{statusLabel(meta?.accountingStatus, jeLocked)}</span></div>
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
          </div>
          <div className="je-header-grid cols-3" style={{ marginBottom: 6, maxWidth: 900 }}>
            <div className="form-field full">
              <DescriptionField value={header.description} onChange={(next) => setHeader({ ...header, description: next })} />
            </div>
          </div>

          {/* ---------- بالا: موضوعات دریافت (بستانکار) ---------- */}
          <div className="je-lines-toolbar" style={{ marginTop: 16 }}>
            <span className="je-lines-title">بستانکار — موضوعات دریافت</span>
            <button type="button" className="btn je-add-row-btn mobile-fab" onClick={addRecvRow} title="افزودن ردیف دریافت">
              <PlusIcon />
            </button>
          </div>
          <div className="grid-wrap je-lines-wrap">
            <div className="je-lines-scroll grid-scroll-area grid-fit" style={{ overflowX: "auto", overflowY: "auto" }}>
              <table className="je-lines-table">
                <thead>
                  <tr>
                    <th>ردیف</th>
                    <th>نوع دریافت</th>
                    <th>طرف حساب</th>
                    <th className="fx-only">ارز</th>
                    <th>مبنا</th>
                    <th className="fx-only">نرخ ارز</th>
                    <th>مبلغ</th>
                    <th className="fx-only">تسعیر</th>
                    <th>مانده‌ی تخصیص (ارز پایه)</th>
                    <th>شرح</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {recvRows.map((row, idx) => (
                    <RecvRowFields
                      key={row.clientKey}
                      idx={idx}
                      row={row}
                      onChange={(p) => updateRecv(idx, p)}
                      onRemove={() => removeRecv(idx)}
                      receiptTypes={recvTypes}
                      parties={parties}
                      customerPartyIds={customerPartyIds}
                      supplierPartyIds={supplierPartyIds}
                      currencies={currencies}
                      baseCurrency={baseCurrency}
                      excludeSettlementId={editId}
                      headerDate={header.date}
                      allRows={recvRows}
                      remainingBase={remainingBase(row.clientKey)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid-footer je-lines-footer">
              <span className="grid-footer-info">{recvRows.length === 0 ? "بدون ردیف" : `${toFaDigits(String(recvRows.length))} ردیف`}</span>
              <span className="je-lines-totals">جمع موضوعات دریافت (ارز پایه): {formatAmountFa(recvTotal)}</span>
            </div>
          </div>

          {/* ---------- پایین: موضوعات پرداخت (بدهکار) ---------- */}
          <div className="je-lines-toolbar" style={{ marginTop: 16 }}>
            <span className="je-lines-title">بدهکار — موضوعات پرداخت</span>
            <RecordPickerField
              title="انتخاب ردیف‌های دریافت برای بارگذاری"
              displayValue=""
              placeholder="بارگذاری از ردیف‌های دریافت"
              rows={loadable}
              multiSelect
              columns={[
                { header: "ردیف", render: (r: any) => toFaDigits(String(r.idx + 1)), filterValue: (r: any) => String(r.idx + 1), width: "60px" },
                { header: "طرف حساب", render: (r: any) => r.partyDisplay, filterValue: (r: any) => r.partyDisplay },
                { header: "مانده", render: (r: any) => formatAmountFa(Number(r.remainingAmount)), filterValue: (r: any) => r.remainingAmount },
              ]}
              onOpen={guardHeader}
              onSelectMultiple={(rows) => loadFromReceipts(rows as any)}
            />
          </div>
          <div className="grid-wrap je-lines-wrap">
            <div className="je-lines-scroll grid-scroll-area grid-fit" style={{ overflowX: "auto", overflowY: "auto" }}>
              <table className="je-lines-table">
                <thead>
                  <tr>
                    <th>ردیف</th>
                    <th>ردیف دریافت</th>
                    <th>نوع پرداخت</th>
                    <th>طرف حساب</th>
                    <th className="fx-only">ارز</th>
                    <th>مبنا</th>
                    <th className="fx-only">نرخ ارز</th>
                    <th>مبلغ</th>
                    <th className="fx-only">تسعیر</th>
                    <th>شرح</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {payRows.map((row, idx) => (
                    <PayRowFields
                      key={idx}
                      idx={idx}
                      row={row}
                      onChange={(p) => updatePay(idx, p)}
                      onRemove={() => removePay(idx)}
                      paymentTypes={payTypes}
                      parties={parties}
                      customerPartyIds={customerPartyIds}
                      supplierPartyIds={supplierPartyIds}
                      currencies={currencies}
                      baseCurrency={baseCurrency}
                      excludeSettlementId={editId}
                      headerDate={header.date}
                      allRows={payRows}
                      recvRows={recvRows}
                      remainingInRowCurrency={remainingInRowCurrency}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid-footer je-lines-footer">
              <span className="grid-footer-info">{payRows.length === 0 ? "بدون ردیف" : `${toFaDigits(String(payRows.length))} ردیف`}</span>
              <span className="je-lines-totals">
                جمع موضوعات پرداخت (ارز پایه): {formatAmountFa(payTotal)}
                {Math.abs(recvTotal - payTotal) > 0.001 && <span style={{ color: "var(--danger, #c0392b)" }}> — با جمع موضوعات دریافت برابر نیست (اختلاف {formatAmountFa(recvTotal - payTotal)})</span>}
              </span>
            </div>
          </div>
        </fieldset>
      </form>
      {editId && (accountingApproved || jeLocked) && (
        <>
          <TreasuryAccountingPanel basePath="/party-settlements" side="PAYMENT" title="اطلاعات حسابداری — بدهکار (موضوعات پرداخت)" docId={editId} editable={accountingApproved && !jeLocked} reloadKey={`${meta?.accountingStatus}-${meta?.journalEntryId ?? ""}`} />
          <TreasuryAccountingPanel basePath="/party-settlements" side="RECEIPT" title="اطلاعات حسابداری — بستانکار (موضوعات دریافت)" docId={editId} editable={accountingApproved && !jeLocked} reloadKey={`${meta?.accountingStatus}-${meta?.journalEntryId ?? ""}`} />
        </>
      )}
    </FormPage>
  );
}

// ======================================================================================
// ردیف دریافت (بالا)
// ======================================================================================
function RecvRowFields({
  idx, row, onChange, onRemove, receiptTypes, parties, customerPartyIds, supplierPartyIds, currencies, baseCurrency, excludeSettlementId, headerDate, allRows, remainingBase,
}: {
  idx: number;
  row: RecvRow;
  onChange: (patch: Partial<RecvRow>) => void;
  onRemove: () => void;
  receiptTypes: RecvTypeOption[];
  parties: PartyOption[];
  customerPartyIds: Set<number>;
  supplierPartyIds: Set<number>;
  currencies: CurrencyOption[];
  baseCurrency: CurrencyOption;
  excludeSettlementId?: number;
  headerDate: string;
  allRows: RecvRow[];
  remainingBase: number;
}) {
  const [candidates, setCandidates] = useState<RecvBasisCandidate[]>([]);
  const receiptType = receiptTypes.find((t) => String(t.id) === row.receiptTypeId);
  const basisType = receiptType?.basisType;
  const rowCurrency = currencies.find((c) => String(c.id) === row.currencyId);
  const isBaseRow = !row.currencyId || Number(row.currencyId) === baseCurrency.id;
  const currentBasisId = row.salesInvoiceId || row.purchaseInvoiceId || row.salesOrderId || row.salesQuoteId;

  useEffect(() => {
    if (!basisType || basisType === "NONE" || !row.partyId || !headerDate) {
      setCandidates([]);
      return;
    }
    let stale = false;
    setCandidates([]);
    api
      .get(`/party-settlements/pickable-receipt-basis?basisType=${basisType}&partyId=${row.partyId}${excludeSettlementId ? `&excludeSettlementId=${excludeSettlementId}` : ""}&nature=${receiptType?.nature ?? ""}&date=${headerDate}`)
      .then((rows: RecvBasisCandidate[]) => { if (!stale) setCandidates(rows.filter((r) => r.date.slice(0, 10) <= headerDate)); })
      .catch(() => { if (!stale) setCandidates([]); });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basisType, row.partyId, excludeSettlementId, receiptType?.nature, headerDate]);

  // مانده‌ی قابل تسویه‌ی یک سند مبنا برای این ردیف: مانده‌ی سرور منهای ردیف‌های دیگرِ همین فرم که به همان سند (و همان گروه مانده) ارجاع می‌دهند
  function effectiveRemaining(c: RecvBasisCandidate): number {
    if (!basisType || basisType === "NONE") return c.remaining;
    const field = RECV_BASIS_FIELD[basisType];
    const basisCurrency = currencies.find((x) => x.id === c.currencyId);
    const others = allRows.reduce((sum, r, i) => {
      if (i === idx) return sum;
      const n = receiptTypes.find((t) => String(t.id) === r.receiptTypeId)?.nature;
      if (isRecvVat(n) !== isRecvVat(receiptType?.nature)) return sum;
      if (!(r as any)[field] || Number((r as any)[field]) !== c.id) return sum;
      const a = Number(r.amount) || 0;
      if (!a || !basisCurrency) return sum + a;
      const rc = currencies.find((x) => String(x.id) === r.currencyId);
      if (!rc || rc.id === basisCurrency.id) return sum + a;
      return sum + fromBaseCurrencyAmount(toBaseCurrencyAmount(a, Number(r.fxRate) || 1, rc, baseCurrency), c.fxRate, basisCurrency);
    }, 0);
    const rem = c.remaining - others;
    return basisCurrency ? roundToCurrencyDecimals(rem, basisCurrency.decimalPlaces) : rem;
  }

  const eligibleParties =
    !receiptType ? []
    : receiptType.nature === "CUSTOMER_RECEIPT" || receiptType.nature === "ADVANCE_RECEIPT" || receiptType.nature === "ADVANCE_VAT_RECEIPT" ? parties.filter((p) => customerPartyIds.has(p.id))
    : receiptType.nature === "SUPPLIER_RECEIPT" ? parties.filter((p) => supplierPartyIds.has(p.id))
    : parties;

  const clearBasis = { salesInvoiceId: "", purchaseInvoiceId: "", salesOrderId: "", salesQuoteId: "", basisDisplay: "", basisFxRate: null, exchangeGainLoss: 0 };

  function onSelectBasis(c: RecvBasisCandidate) {
    if (!basisType || basisType === "NONE") return;
    const field = RECV_BASIS_FIELD[basisType];
    const cur = currencies.find((x) => x.id === c.currencyId);
    // ارز ردیف با ارز سند مبنا یکی می‌شود (نرخ پیش‌فرض = نرخ همان سند ⇒ تسعیر صفر)؛ مبلغ پیش‌فرض = مانده‌ی سند مبنا
    const remaining = effectiveRemaining(c);
    onChange({
      ...clearBasis,
      [field]: String(c.id),
      basisDisplay: toFaDigits(String(c.number)),
      basisFxRate: basisType === "SALES_INVOICE" || basisType === "PURCHASE_INVOICE" ? c.fxRate : null,
      currencyId: String(c.currencyId),
      fxRate: cur?.isBase ? "1" : String(c.fxRate),
      amount: row.amount && Number(row.amount) > 0 ? row.amount : String(cur ? roundToCurrencyDecimals(Math.max(0, remaining), cur.decimalPlaces) : Math.max(0, remaining)),
    } as Partial<RecvRow>);
  }

  return (
    <tr>
      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
      <td style={{ minWidth: 160 }}>
        <TypePickerField
          kind="receipt"
          types={receiptTypes}
          value={row.receiptTypeId}
          onChange={(id) => onChange({ receiptTypeId: id, partyId: "", partyDisplay: "", ...clearBasis })}
        />
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
          onSelect={(p) => onChange({ partyId: String(p.id), partyDisplay: partyDisplayName(p), ...clearBasis })}
        />
      </td>
      <td className="fx-only" style={{ minWidth: 110 }}>
        <select
          value={row.currencyId}
          onChange={(e) => {
            const c = currencies.find((x) => String(x.id) === e.target.value);
            if (currentBasisId && !window.confirm("با تغییر ارز، سند مبنا و مبلغ این ردیف حذف می‌شود. ادامه می‌دهید؟")) return;
            onChange({ currencyId: e.target.value, fxRate: c?.isBase ? "1" : "", ...(currentBasisId ? { ...clearBasis, amount: "" } : {}) });
          }}
        >
          <option value="">انتخاب ارز</option>
          {currencies.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </td>
      <td style={{ minWidth: 150 }}>
        {basisType && basisType !== "NONE" ? (
          <RecordPickerField
            title="انتخاب سند مبنا"
            disabled={!row.partyId}
            displayValue={row.basisDisplay}
            placeholder="انتخاب سند مبنا"
            rows={candidates.filter((c) => (!rowCurrency || c.currencyId === rowCurrency.id || !currentBasisId) && (effectiveRemaining(c) > 0.001 || String(c.id) === currentBasisId))}
            columns={[
              { header: "شماره", render: (c) => toFaDigits(String(c.number)), filterValue: (c) => String(c.number), width: "70px" },
              { header: "تاریخ", render: (c) => formatJalaliDate(c.date), filterValue: (c) => c.date.slice(0, 10), width: "100px" },
              { header: "ارز", render: (c) => c.currencyTitle, filterValue: (c) => c.currencyTitle, width: "80px" },
              { header: "مانده", render: (c) => formatAmountFa(effectiveRemaining(c)), filterValue: (c) => String(effectiveRemaining(c)), width: "110px" },
            ]}
            onSelect={onSelectBasis}
          />
        ) : (
          <span style={{ color: "var(--ink-soft)" }}>بدون مبنا</span>
        )}
      </td>
      <td className="fx-only" style={{ minWidth: 100 }}>
        {isBaseRow ? <input dir="ltr" value={toFaDigits("1")} disabled /> : <input dir="ltr" inputMode="decimal" value={row.fxRate} onChange={(e) => onChange({ fxRate: e.target.value.replace(/[^0-9.]/g, "") })} placeholder="نرخ" />}
      </td>
      <td style={{ minWidth: 130 }}>
        <AmountInput value={row.amount} onChange={(v) => onChange({ amount: v })} allowDecimal placeholder="۰" />
      </td>
      <td className="fx-only" style={{ minWidth: 110, color: row.exchangeGainLoss > 0 ? "var(--success, #2e7d32)" : row.exchangeGainLoss < 0 ? "var(--danger, #c0392b)" : undefined }}>
        {formatAmountFa(row.exchangeGainLoss)}
      </td>
      <td style={{ minWidth: 120, color: Math.abs(remainingBase) > 0.001 ? "var(--danger, #c0392b)" : "var(--success, #2e7d32)", fontWeight: 600 }}>
        {Number(row.amount) > 0 ? formatAmountFa(remainingBase) : "—"}
      </td>
      <td style={{ minWidth: 140 }}>
        <input value={row.description} onChange={(e) => onChange({ description: e.target.value })} />
      </td>
      <td>
        <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={onRemove}>حذف</button>
      </td>
    </tr>
  );
}

// ======================================================================================
// ردیف پرداخت (پایین)
// ======================================================================================
function PayRowFields({
  idx, row, onChange, onRemove, paymentTypes, parties, customerPartyIds, supplierPartyIds, currencies, baseCurrency, excludeSettlementId, headerDate, allRows, recvRows, remainingInRowCurrency,
}: {
  idx: number;
  row: PayRow;
  onChange: (patch: Partial<PayRow>) => void;
  onRemove: () => void;
  paymentTypes: PayTypeOption[];
  parties: PartyOption[];
  customerPartyIds: Set<number>;
  supplierPartyIds: Set<number>;
  currencies: CurrencyOption[];
  baseCurrency: CurrencyOption;
  excludeSettlementId?: number;
  headerDate: string;
  allRows: PayRow[];
  recvRows: RecvRow[];
  remainingInRowCurrency: (r: RecvRow) => number;
}) {
  // ماهیت‌های نقدی (به بانک/صندوق/تنخواه) در این فرم مجاز نیستند
  const selectableTypes = paymentTypes.filter((t) => !BLOCKED_PAY_NATURES.includes(t.nature));
  const paymentType = paymentTypes.find((t) => String(t.id) === row.paymentTypeId);
  const basisType = paymentType?.basisType;
  const rowCurrency = currencies.find((c) => String(c.id) === row.currencyId);
  const isBaseRow = !row.currencyId || Number(row.currencyId) === baseCurrency.id;
  const currentBasisKey = rowBasisKey(row);
  const candidates = usePaymentBasisCandidates({ source: "party-settlements", basisType, partyId: row.partyId, paymentTypeId: row.paymentTypeId, editId: excludeSettlementId, date: headerDate });
  const sourceRow = recvRows.find((r) => r.clientKey === row.sourceClientKey);

  function effectiveRemaining(c: PayBasis): number {
    const basisCurrency = currencies.find((x) => x.id === c.currencyId);
    const others = allRows.reduce((sum, r, i) => {
      if (i === idx) return sum;
      const n = paymentTypes.find((t) => String(t.id) === r.paymentTypeId)?.nature;
      if (isPayVat(n) !== isPayVat(paymentType?.nature)) return sum;
      if (rowBasisKey(r) !== basisKeyOf(c)) return sum;
      const a = Number(r.amount) || 0;
      if (!a || !basisCurrency) return sum + a;
      const rc = currencies.find((x) => String(x.id) === r.currencyId);
      if (!rc || rc.id === basisCurrency.id) return sum + a;
      return sum + fromBaseCurrencyAmount(toBaseCurrencyAmount(a, Number(r.fxRate) || 1, rc, baseCurrency), c.fxRate, basisCurrency);
    }, 0);
    const rem = c.remaining - others;
    return basisCurrency ? roundToCurrencyDecimals(rem, basisCurrency.decimalPlaces) : rem;
  }

  const eligibleParties =
    !paymentType ? []
    : paymentType.nature === "SUPPLIER_PAYMENT" || paymentType.nature === "ADVANCE_PAYMENT" || paymentType.nature === "ADVANCE_VAT_PAYMENT" ? parties.filter((p) => supplierPartyIds.has(p.id))
    : paymentType.nature === "CUSTOMER_PAYMENT" ? parties.filter((p) => customerPartyIds.has(p.id))
    : parties;

  const clearBasis = { salesInvoiceId: "", purchaseInvoiceId: "", servicePurchaseInvoiceId: "", purchaseOrderId: "", basisDisplay: "", basisFxRate: null, exchangeGainLoss: 0 };

  function onSelectBasis(c: PayBasis) {
    if (!basisType || basisType === "NONE") return;
    const cur = currencies.find((x) => x.id === c.currencyId);
    const remaining = effectiveRemaining(c);
    onChange({
      ...clearBasis,
      ...basisFieldPatch(basisType, c),
      basisDisplay: basisDisplayOf(c.number, c.kind),
      basisFxRate: basisType === "PURCHASE_INVOICE" || basisType === "SALES_INVOICE" ? c.fxRate : null,
      currencyId: String(c.currencyId),
      fxRate: cur?.isBase ? "1" : String(c.fxRate),
      amount: row.amount && Number(row.amount) > 0 ? row.amount : String(cur ? roundToCurrencyDecimals(Math.max(0, remaining), cur.decimalPlaces) : Math.max(0, remaining)),
    } as Partial<PayRow>);
  }

  function onSourceChange(key: string) {
    const src = recvRows.find((r) => r.clientKey === key);
    onChange({ sourceClientKey: key, ...(src && !row.amount ? { currencyId: src.currencyId, fxRate: src.fxRate, amount: String(remainingInRowCurrency(src)) } : {}) });
  }

  return (
    <tr>
      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
      <td style={{ minWidth: 190 }}>
        <select value={row.sourceClientKey} onChange={(e) => onSourceChange(e.target.value)}>
          <option value="">انتخاب ردیف دریافت</option>
          {recvRows.map((r, i) => (
            <option key={r.clientKey} value={r.clientKey}>{`ردیف ${toFaDigits(String(i + 1))} — ${r.partyDisplay || "بدون طرف حساب"}${r.amount ? ` — ${formatAmountFa(r.amount)}` : ""}`}</option>
          ))}
        </select>
        {sourceRow && row.sourceClientKey && !recvRows.some((r) => r.clientKey === row.sourceClientKey) && <span style={{ color: "var(--danger, #c0392b)" }}>ردیف دریافت حذف شده</span>}
      </td>
      <td style={{ minWidth: 160 }}>
        <TypePickerField
          kind="payment"
          types={selectableTypes}
          value={row.paymentTypeId}
          onChange={(id) => onChange({ paymentTypeId: id, partyId: "", partyDisplay: "", ...clearBasis })}
        />
      </td>
      <td style={{ minWidth: 180 }}>
        <RecordPickerField
          title="انتخاب طرف حساب"
          disabled={!paymentType}
          displayValue={row.partyDisplay}
          rows={eligibleParties}
          columns={[
            { header: "کد", render: (p) => toFaDigits(p.detailCode), filterValue: (p) => p.detailCode, width: "100px" },
            { header: "نام", render: (p) => partyDisplayName(p), filterValue: (p) => partyDisplayName(p) },
          ]}
          onSelect={(p) => onChange({ partyId: String(p.id), partyDisplay: partyDisplayName(p), ...clearBasis })}
        />
      </td>
      <td className="fx-only" style={{ minWidth: 110 }}>
        <select
          value={row.currencyId}
          onChange={(e) => {
            const c = currencies.find((x) => String(x.id) === e.target.value);
            if (currentBasisKey && !window.confirm("با تغییر ارز، سند مبنا و مبلغ این ردیف حذف می‌شود. ادامه می‌دهید؟")) return;
            onChange({ currencyId: e.target.value, fxRate: c?.isBase ? "1" : "", ...(currentBasisKey ? { ...clearBasis, amount: "" } : {}) });
          }}
        >
          <option value="">انتخاب ارز</option>
          {currencies.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </td>
      <td style={{ minWidth: 150 }}>
        {basisType && basisType !== "NONE" ? (
          <PaymentBasisPicker
            candidates={candidates}
            remainingOf={effectiveRemaining}
            filter={(c) => !rowCurrency || c.currencyId === rowCurrency.id || !currentBasisKey}
            currentBasisId={currentBasisKey}
            displayValue={row.basisDisplay}
            disabled={!row.partyId}
            onSelect={onSelectBasis}
          />
        ) : (
          <span style={{ color: "var(--ink-soft)" }}>بدون مبنا</span>
        )}
      </td>
      <td className="fx-only" style={{ minWidth: 100 }}>
        {isBaseRow ? <input dir="ltr" value={toFaDigits("1")} disabled /> : <input dir="ltr" inputMode="decimal" value={row.fxRate} onChange={(e) => onChange({ fxRate: e.target.value.replace(/[^0-9.]/g, "") })} placeholder="نرخ" />}
      </td>
      <td style={{ minWidth: 130 }}>
        <AmountInput value={row.amount} onChange={(v) => onChange({ amount: v })} allowDecimal placeholder="۰" />
      </td>
      <td className="fx-only" style={{ minWidth: 110, color: row.exchangeGainLoss > 0 ? "var(--success, #2e7d32)" : row.exchangeGainLoss < 0 ? "var(--danger, #c0392b)" : undefined }}>
        {formatAmountFa(row.exchangeGainLoss)}
      </td>
      <td style={{ minWidth: 140 }}>
        <input value={row.description} onChange={(e) => onChange({ description: e.target.value })} />
      </td>
      <td>
        <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={onRemove}>حذف</button>
      </td>
    </tr>
  );
}
