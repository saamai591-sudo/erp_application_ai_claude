import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { Modal } from "../components/Modal";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { AmountInput } from "../components/AmountInput";
import { RecordPickerField, RecordPickerDialog, type PickerColumn } from "../components/RecordPicker";
import { LineGridToolbar } from "../components/LineGridToolbar";
import type { ExportColumn } from "../lib/gridExport";
import { useLineGridBase } from "../lib/useLineGridBase";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { useTabs } from "../lib/TabsContext";
import { FiscalPeriodRange, fetchSelectedFiscalPeriod, defaultDocumentDate, validateDocumentDate } from "../lib/fiscalYearDefaultDate";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { partyDisplayName } from "./Users";

// «خلاصه تنخواه» (مدیریت خزانه › پرداخت): پرداخت‌های تنخواهِ ثبت‌شده‌ی یک تنخواه‌دار را به حساب‌های حسابداری وصل می‌کند.
// دو مرحله‌ای هم‌الگوی سند پرداخت: «تایید» سند را قفل و تسعیر ردیف‌های مبنادار را محاسبه می‌کند؛ «صدور سند حسابداری»
// جداگانه سند واقعی را می‌سازد. کل سند (هدر+ردیف‌ها) یک‌جا ذخیره می‌شود — «تغییر نوع پرداخت» فقط وضعیت محلی را
// عوض می‌کند و با ذخیره‌ی بعدی به سرور می‌رسد؛ در وضعیت «تایید»شده کل فرم غیرفعال است، پس شرط «فقط قبل از تایید» خودکار برقرار است.

type BasisType = "NONE" | "PURCHASE_INVOICE" | "SALES_INVOICE" | "PURCHASE_ORDER";
const BASIS_FIELD: Record<Exclude<BasisType, "NONE">, "purchaseInvoiceId" | "salesInvoiceId" | "purchaseOrderId"> = {
  PURCHASE_INVOICE: "purchaseInvoiceId",
  SALES_INVOICE: "salesInvoiceId",
  PURCHASE_ORDER: "purchaseOrderId",
};
const BASIS_TITLE_FA: Record<BasisType, string> = {
  NONE: "بدون مبنا",
  PURCHASE_INVOICE: "فاکتور خرید",
  SALES_INVOICE: "فاکتور فروش",
  PURCHASE_ORDER: "سفارش خرید",
};

interface CustodianOption {
  id: number;
  detailCode: string;
  isActive: boolean;
  pettyCash: { id: number; detailCode: string; title: string; isActive: boolean; currency: { id: number; title: string; isBase: boolean } };
  party: { id: number; detailCode: string; category: "INDIVIDUAL" | "LEGAL"; firstName: string | null; lastName: string | null; name: string | null; isActive: boolean };
}
interface PaymentTypeOption { id: number; title: string; nature: string; basisType: BasisType; isActive: boolean }
const PETTY_CASH_INELIGIBLE_NATURES = new Set(["TO_BANK", "TO_CASH_BOX", "TO_PETTY_CASH"]);

interface PickablePayment {
  id: number;
  date: string;
  amount: string;
  remaining: number;
  description: string | null;
  partyId: number;
  party: { id: number; detailCode: string; category: "INDIVIDUAL" | "LEGAL"; firstName: string | null; lastName: string | null; name: string | null; isActive: boolean };
  paymentTypeId: number;
  paymentType: PaymentTypeOption;
  purchaseInvoiceId: number | null;
  salesInvoiceId: number | null;
  purchaseOrderId: number | null;
}
interface BasisCandidate { id: number; number: number; date: string; currencyId: number; remaining: number }
interface ResolvedAccount { id: number; code: string; title: string; isCurrency: boolean; detailType1Id: number | null; detailType2Id: number | null; detailType3Id: number | null }
interface DetailOption { code: string; title: string }

interface Summary {
  id: number;
  number: number;
  date: string;
  custodianId: number;
  custodian: CustodianOption;
  fxRate: string;
  description: string | null;
  status: "DRAFT" | "APPROVED";
  journalEntryId: number | null;
  journalEntryReferenceNumber?: number | null;
  updatedAt: string;
  lines: SummaryLineDto[];
}
interface SummaryLineDto {
  id: number;
  pettyCashPaymentId: number;
  pettyCashPayment: { id: number; amount: string; description: string | null; date: string; party: PickablePayment["party"] };
  paymentTypeId: number;
  paymentType: PaymentTypeOption;
  purchaseInvoiceId: number | null;
  salesInvoiceId: number | null;
  purchaseOrderId: number | null;
  purchaseInvoice: { id: number; number: number; date: string } | null;
  salesInvoice: { id: number; number: number; date: string } | null;
  purchaseOrder: { id: number; number: number; date: string } | null;
  detail1Code: string | null;
  detail2Code: string | null;
  detail3Code: string | null;
  amount: string;
  exchangeGainLoss: string;
  description: string | null;
  resolvedAccount: ResolvedAccount | null;
  resolvedAccountError: string | null;
  partyDetail?: { detail1Code?: string; detail2Code?: string; detail3Code?: string };
}

export default function PettyCashSummaries() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <SummaryForm />;
  if (isEdit) return <SummaryForm editId={Number(id)} />;
  return <SummaryList />;
}

const STATUS_FA: Record<string, string> = { DRAFT: "ثبت", APPROVED: "تایید" };

function SummaryList() {
  const cacheKey = "/petty-cash-summaries";
  const [items, setItems] = usePersistedState<Summary[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    api.get("/petty-cash-summaries").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: Summary) {
    try {
      await api.del(`/petty-cash-summaries/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="خلاصه تنخواه — پرداخت‌های تنخواهِ ثبت‌شده‌ی یک تنخواه‌دار را به حساب‌های حسابداری وصل می‌کند" title="خلاصه تنخواه" />
          <NewRecordButton path="/petty-cash-summaries/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "تنخواه", render: (r) => r.custodian?.pettyCash?.title || "—", filterType: "string", filterValue: (r) => r.custodian?.pettyCash?.title || "" },
          { header: "تنخواه‌دار", render: (r) => partyDisplayName(r.custodian?.party), filterType: "string", filterValue: (r) => partyDisplayName(r.custodian?.party) },
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
        ]}
        rows={items.map((r: any) => ({ ...r, journalEntryReferenceNumber: r.journalEntry?.referenceNumber ?? null }))}
        edit={{ path: (r) => `/petty-cash-summaries/${r.id}/edit` }}
        onDelete={(r) => (r.status === "DRAFT" ? onDelete(r) : showError("فقط اسناد در وضعیت «ثبت» قابل حذف هستند"))}
      />
    </div>
  );
}

interface LineState {
  clientKey: string;
  pettyCashPaymentId: string;
  paymentAmount: number;
  paymentPartyId: number;
  paymentPartyDisplay: string;
  paymentPartyDetailCode: string;
  paymentDisplay: string;
  paymentTypeId: string;
  paymentTypeTitle: string;
  basisType: BasisType;
  purchaseInvoiceId: string;
  salesInvoiceId: string;
  purchaseOrderId: string;
  basisDisplay: string;
  account: ResolvedAccount | null;
  accountError: string;
  detail1Code: string;
  detail2Code: string;
  detail3Code: string;
  /** طبق تصمیم صریح کاربر: اگر معینِ ردیف در یکی از سطوح تفصیلش به نوع «طرف حساب» وصل باشد، همان سطح از
   * طرف‌حساب خودِ پرداخت تنخواه پر و غیرقابل‌ویرایش می‌شود — این فیلد می‌گوید کدام سطح قفل است */
  partyDetailLocked: "detail1Code" | "detail2Code" | "detail3Code" | null;
  amount: string;
  description: string;
  exchangeGainLoss: number;
}

let clientKeySeq = 0;
function nextClientKey() {
  clientKeySeq += 1;
  return `pcs-${Date.now()}-${clientKeySeq}`;
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M4 20h4l10.5-10.5a2.121 2.121 0 0 0-3-3L5 17v3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function paymentLabel(p: { id: number; date: string; amount: string | number }) {
  return `#${toFaDigits(String(p.id))} — ${formatJalaliDate(p.date)} — ${formatAmountFa(p.amount)}`;
}

function lineSearchableText(row: LineState): string {
  return [
    row.paymentDisplay,
    row.paymentPartyDisplay,
    row.paymentTypeTitle,
    BASIS_TITLE_FA[row.basisType],
    row.account ? `${row.account.code} ${row.account.title}` : "",
    row.description,
  ].join(" ");
}

const ADD_PICKER_COLUMNS: PickerColumn<PickablePayment & { remaining: number }>[] = [
  { header: "پرداخت", render: (p) => paymentLabel(p), filterValue: (p) => paymentLabel(p) },
  { header: "طرف حساب", render: (p) => partyDisplayName(p.party), filterValue: (p) => partyDisplayName(p.party) },
  { header: "نوع پرداخت", render: (p) => p.paymentType?.title || "", filterValue: (p) => p.paymentType?.title || "" },
  { header: "مانده", render: (p) => formatAmountFa(p.remaining), filterValue: (p) => String(p.remaining) },
];

const lineExportColumns: ExportColumn<LineState>[] = [
  { header: "موضوع پرداخت", render: (l) => l.paymentDisplay },
  { header: "طرف حساب", render: (l) => l.paymentPartyDisplay },
  { header: "نوع پرداخت", render: (l) => l.paymentTypeTitle },
  { header: "مبنا", render: (l) => BASIS_TITLE_FA[l.basisType] },
  { header: "حساب معین", render: (l) => (l.account ? `${l.account.code} — ${l.account.title}` : "") },
  { header: "تفصیل ۱", render: (l) => l.detail1Code },
  { header: "تفصیل ۲", render: (l) => l.detail2Code },
  { header: "تفصیل ۳", render: (l) => l.detail3Code },
  { header: "مبلغ", render: (l) => l.amount },
  { header: "تسعیر", render: (l) => l.exchangeGainLoss },
  { header: "شرح", render: (l) => l.description },
];

interface PartyDetail { detail1Code?: string; detail2Code?: string; detail3Code?: string }
function partyDetailLockedSlot(pd: PartyDetail | undefined): LineState["partyDetailLocked"] {
  if (!pd) return null;
  if (pd.detail1Code) return "detail1Code";
  if (pd.detail2Code) return "detail2Code";
  if (pd.detail3Code) return "detail3Code";
  return null;
}

async function resolveAccountFor(
  paymentTypeId: string,
  purchaseInvoiceId: string,
  salesInvoiceId: string,
  partyDetailCode?: string | null
): Promise<{ account: ResolvedAccount | null; error: string; partyDetail: PartyDetail }> {
  if (!paymentTypeId) return { account: null, error: "", partyDetail: {} };
  const params = new URLSearchParams({ paymentTypeId });
  if (purchaseInvoiceId) params.set("purchaseInvoiceId", purchaseInvoiceId);
  if (salesInvoiceId) params.set("salesInvoiceId", salesInvoiceId);
  if (partyDetailCode) params.set("partyDetailCode", partyDetailCode);
  try {
    const { partyDetail, ...account }: ResolvedAccount & { partyDetail: PartyDetail } = await api.get(`/petty-cash-summaries/resolve-account?${params.toString()}`);
    return { account, error: "", partyDetail: partyDetail || {} };
  } catch (e) {
    return { account: null, error: (e as ApiError).message, partyDetail: {} };
  }
}

function lineFromPayment(p: PickablePayment): Omit<LineState, "account" | "accountError"> {
  return {
    clientKey: nextClientKey(),
    pettyCashPaymentId: String(p.id),
    paymentAmount: Number(p.amount),
    paymentPartyId: p.partyId,
    paymentPartyDisplay: partyDisplayName(p.party),
    paymentPartyDetailCode: p.party.detailCode,
    paymentDisplay: paymentLabel(p),
    paymentTypeId: String(p.paymentTypeId),
    paymentTypeTitle: p.paymentType?.title || "",
    basisType: p.paymentType?.basisType || "NONE",
    purchaseInvoiceId: p.purchaseInvoiceId ? String(p.purchaseInvoiceId) : "",
    salesInvoiceId: p.salesInvoiceId ? String(p.salesInvoiceId) : "",
    purchaseOrderId: p.purchaseOrderId ? String(p.purchaseOrderId) : "",
    basisDisplay: "",
    detail1Code: "",
    detail2Code: "",
    detail3Code: "",
    partyDetailLocked: null,
    amount: String(p.remaining),
    description: p.description || "",
    exchangeGainLoss: 0,
  };
}

function lineFromDto(l: SummaryLineDto): LineState {
  const basisId = l.purchaseInvoiceId || l.salesInvoiceId || l.purchaseOrderId;
  const basisDoc = l.purchaseInvoice || l.salesInvoice || l.purchaseOrder;
  return {
    clientKey: nextClientKey(),
    pettyCashPaymentId: String(l.pettyCashPaymentId),
    paymentAmount: Number(l.pettyCashPayment.amount),
    paymentPartyId: l.pettyCashPayment.party.id,
    paymentPartyDisplay: partyDisplayName(l.pettyCashPayment.party),
    paymentPartyDetailCode: l.pettyCashPayment.party.detailCode,
    paymentDisplay: paymentLabel(l.pettyCashPayment),
    paymentTypeId: String(l.paymentTypeId),
    paymentTypeTitle: l.paymentType?.title || "",
    basisType: l.paymentType?.basisType || "NONE",
    purchaseInvoiceId: l.purchaseInvoiceId ? String(l.purchaseInvoiceId) : "",
    salesInvoiceId: l.salesInvoiceId ? String(l.salesInvoiceId) : "",
    purchaseOrderId: l.purchaseOrderId ? String(l.purchaseOrderId) : "",
    basisDisplay: basisId && basisDoc ? toFaDigits(String(basisDoc.number)) : "",
    account: l.resolvedAccount,
    accountError: l.resolvedAccountError || "",
    detail1Code: l.partyDetail?.detail1Code || l.detail1Code || "",
    detail2Code: l.partyDetail?.detail2Code || l.detail2Code || "",
    detail3Code: l.partyDetail?.detail3Code || l.detail3Code || "",
    partyDetailLocked: partyDetailLockedSlot(l.partyDetail),
    amount: String(Number(l.amount)),
    description: l.description || "",
    exchangeGainLoss: Number(l.exchangeGainLoss) || 0,
  };
}

const DEFAULT_HEADER = { date: "", custodianId: "", custodianDisplay: "", fxRate: "1", description: "" };

function SummaryForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { openTab } = useTabs();
  const cacheKey = `form:${location.pathname}`;
  const [custodians, setCustodians] = useState<CustodianOption[]>([]);
  const [fiscalPeriod, setFiscalPeriod] = useState<FiscalPeriodRange | null>(null);
  const [pickable, setPickable] = useState<PickablePayment[]>([]);
  const [detailOptions, setDetailOptions] = useState<Record<number, DetailOption[]>>({});
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, DEFAULT_HEADER);
  const [lines, setLines] = usePersistedState<LineState[]>(`${cacheKey}:lines`, []);
  const [meta, setMeta] = useState<{ number: number; status: "DRAFT" | "APPROVED"; journalEntryId: number | null; journalEntryReferenceNumber: number | null; updatedAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(`${cacheKey}:header`));
  const [modifyIdx, setModifyIdx] = useState<number | null>(null);
  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const grid = useLineGridBase(lines, setLines, lineSearchableText);
  const { flash } = useSavedFlash();

  const status = meta?.status || "DRAFT";
  const formLocked = status === "APPROVED";

  async function loadDetailOptions(detailTypeId: number) {
    if (detailOptions[detailTypeId]) return;
    const options = await api.get(`/detail-types/${detailTypeId}/options`);
    setDetailOptions((prev) => ({ ...prev, [detailTypeId]: options }));
  }
  function preloadDetailOptionsFor(account: ResolvedAccount | null) {
    if (!account) return;
    if (account.detailType1Id) loadDetailOptions(account.detailType1Id);
    if (account.detailType2Id) loadDetailOptions(account.detailType2Id);
    if (account.detailType3Id) loadDetailOptions(account.detailType3Id);
  }

  useEffect(() => {
    async function init() {
      const [cus, fp]: [CustodianOption[], FiscalPeriodRange | null] = await Promise.all([
        api.get("/petty-cash-custodians?activeOnly=true"),
        fetchSelectedFiscalPeriod(),
      ]);
      setCustodians(cus);
      setFiscalPeriod(fp);

      if (hasPersistedState(`${cacheKey}:header`)) {
        for (const l of lines) preloadDetailOptionsFor(l.account);
        if (editId) {
          try {
            const d: Summary = await api.get(`/petty-cash-summaries/${editId}`);
            setMeta({ number: d.number, status: d.status, journalEntryId: d.journalEntryId, journalEntryReferenceNumber: d.journalEntryReferenceNumber ?? null, updatedAt: d.updatedAt });
          } catch {
            /* اگر واکشی ناموفق شد، به مقادیر کش‌شده بسنده می‌شود */
          }
        }
        setLoaded(true);
        return;
      }
      if (editId) {
        const d: Summary = await api.get(`/petty-cash-summaries/${editId}`);
        setMeta({ number: d.number, status: d.status, journalEntryId: d.journalEntryId, journalEntryReferenceNumber: d.journalEntryReferenceNumber ?? null, updatedAt: d.updatedAt });
        setHeader({
          date: d.date.slice(0, 10),
          custodianId: String(d.custodianId),
          custodianDisplay: custodianLabel(d.custodian),
          fxRate: String(Number(d.fxRate)),
          description: d.description || "",
        });
        const ls = d.lines.map(lineFromDto);
        setLines(ls);
        for (const l of ls) preloadDetailOptionsFor(l.account);
      } else {
        setHeader({ ...DEFAULT_HEADER, date: defaultDocumentDate(fp) });
        setLines([]);
        setMeta(null);
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // مانده‌های پرداخت‌های تنخواهِ همین تنخواه‌دار (شامل همان‌هایی که در همین سند استفاده شده‌اند — مانده‌ی برگشتی، مصرفِ خودِ این سند را حساب نمی‌کند)
  // فقط پرداخت‌های تنخواه‌ای که تاریخشان از تاریخ سرصفحه‌ی همین خلاصه تنخواه کوچکتر است (طبق تصمیم صریح کاربر)
  useEffect(() => {
    if (!header.custodianId || !header.date) {
      setPickable([]);
      return;
    }
    const excl = editId ? `&excludeId=${editId}` : "";
    api
      .get(`/petty-cash-summaries/pickable-payments?custodianId=${header.custodianId}&beforeDate=${header.date}${excl}`)
      .then(setPickable)
      .catch(() => setPickable([]));
  }, [header.custodianId, header.date, editId]);

  const custodian = custodians.find((c) => String(c.id) === header.custodianId);

  // مانده‌ی زنده‌ی هر پرداخت تنخواه = مانده‌ی سرور (که مصرفِ خودِ این سند را حساب نمی‌کند) منهای مجموع ردیف‌های فعلی همین فرم برای همان پرداخت
  function liveRemaining(pettyCashPaymentId: string, excludeClientKey?: string): number {
    const p = pickable.find((x) => String(x.id) === pettyCashPaymentId);
    const serverRemaining = p ? p.remaining : lines.find((l) => l.pettyCashPaymentId === pettyCashPaymentId)?.paymentAmount ?? 0;
    const usedInForm = lines
      .filter((l) => l.pettyCashPaymentId === pettyCashPaymentId && l.clientKey !== excludeClientKey)
      .reduce((s, l) => s + (Number(l.amount) || 0), 0);
    return serverRemaining - usedInForm;
  }

  function updateLine(idx: number, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function removeLine(idx: number) {
    grid.removeAt(idx);
  }

  // پرداخت‌های تنخواهِ این تنخواه‌دار که هنوز مانده‌ی قابل‌تخصیص دارند (با احتساب ردیف‌های همین فرم) —
  // هم برای دکمه‌ی «بارگذاری» (همه‌شان یک‌جا) و هم برای آیکن «ردیف جدید» (انتخابگرِ تک‌موردی) استفاده می‌شود
  const addableCandidates: (PickablePayment & { remaining: number })[] = header.custodianId
    ? pickable
        .map((p) => ({ p, remaining: liveRemaining(String(p.id)) }))
        .filter(({ remaining }) => remaining > 0.001)
        .map(({ p, remaining }) => ({ ...p, remaining }))
    : [];

  async function onLoadPayments(selected: PickablePayment[]) {
    const newLines: LineState[] = [];
    for (const p of selected) {
      const base = lineFromPayment(p);
      // eslint-disable-next-line no-await-in-loop
      const { account, error: accErr, partyDetail } = await resolveAccountFor(base.paymentTypeId, base.purchaseInvoiceId, base.salesInvoiceId, p.party.detailCode);
      preloadDetailOptionsFor(account);
      newLines.push({
        ...base,
        account,
        accountError: accErr,
        detail1Code: partyDetail.detail1Code || base.detail1Code,
        detail2Code: partyDetail.detail2Code || base.detail2Code,
        detail3Code: partyDetail.detail3Code || base.detail3Code,
        partyDetailLocked: partyDetailLockedSlot(partyDetail),
      });
    }
    setLines((prev) => [...prev, ...newLines]);
  }

  // دکمه‌ی «بارگذاری»: به‌جای انتخابگر، همه‌ی پرداخت‌های تنخواهِ این تنخواه‌دار که هنوز مانده‌ی
  // قابل‌تخصیص دارند (با احتساب ردیف‌های همین فرم) به‌صورت خودکار به گرید اضافه می‌شوند
  function loadAllPending() {
    if (!header.custodianId) {
      showError("ابتدا تنخواه‌دار را انتخاب کنید");
      return;
    }
    if (addableCandidates.length === 0) {
      showError("پرداخت تنخواهِ قابل بارگذاری برای این تنخواه‌دار وجود ندارد");
      return;
    }
    onLoadPayments(addableCandidates);
  }

  // آیکن «ردیف جدید» نوار ابزار: برخلاف «بارگذاری» (همه‌ی موارد قابل‌بارگذاری یک‌جا)، این‌جا کاربر خودش
  // دقیقاً یک پرداخت تنخواه را از میان همان فهرست انتخاب می‌کند
  function addSelectedPayment(p: PickablePayment) {
    onLoadPayments([p]);
    setAddPickerOpen(false);
  }

  // جابه‌جایی/حذف از نوار ابزار روی «ردیف انتخاب‌شده» (با کلیک روی ردیف) عمل می‌کند
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!header.date) return setError("تاریخ الزامی است");
    const dateErr = validateDocumentDate(header.date, fiscalPeriod);
    if (dateErr) return setError(dateErr);
    if (!header.custodianId) return setError("تنخواه‌دار الزامی است");
    if (!header.fxRate || Number(header.fxRate) <= 0) return setError("نرخ ارز الزامی است و باید بزرگتر از صفر باشد");
    if (lines.length === 0) return setError("خلاصه تنخواه باید حداقل یک ردیف داشته باشد");

    const body = {
      date: header.date,
      custodianId: Number(header.custodianId),
      fxRate: Number(header.fxRate),
      description: header.description || null,
      lines: lines.map((l) => ({
        pettyCashPaymentId: Number(l.pettyCashPaymentId),
        paymentTypeId: Number(l.paymentTypeId),
        purchaseInvoiceId: l.purchaseInvoiceId ? Number(l.purchaseInvoiceId) : null,
        salesInvoiceId: l.salesInvoiceId ? Number(l.salesInvoiceId) : null,
        purchaseOrderId: l.purchaseOrderId ? Number(l.purchaseOrderId) : null,
        detail1Code: l.detail1Code || null,
        detail2Code: l.detail2Code || null,
        detail3Code: l.detail3Code || null,
        amount: Number(l.amount),
        description: l.description || null,
      })),
      updatedAt: meta?.updatedAt,
    };
    try {
      if (editId) {
        const d: Summary = await api.put(`/petty-cash-summaries/${editId}`, body);
        setMeta({ number: d.number, status: d.status, journalEntryId: d.journalEntryId, journalEntryReferenceNumber: d.journalEntryReferenceNumber ?? null, updatedAt: d.updatedAt });
        flash();
      } else {
        const created: Summary = await api.post("/petty-cash-summaries", body);
        flash();
        navigate(`/petty-cash-summaries/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/petty-cash-summaries/${editId}`);
      navigate("/petty-cash-summaries");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  async function refreshMeta() {
    if (!editId) return;
    const d: Summary = await api.get(`/petty-cash-summaries/${editId}`);
    setMeta({ number: d.number, status: d.status, journalEntryId: d.journalEntryId, journalEntryReferenceNumber: d.journalEntryReferenceNumber ?? null, updatedAt: d.updatedAt });
    setLines(d.lines.map(lineFromDto));
  }
  async function handleApprove() {
    if (!editId) return;
    try {
      await api.post(`/petty-cash-summaries/${editId}/approve`, {});
      await refreshMeta();
      flash("سند تایید شد و تسعیر ردیف‌های مبنادار محاسبه شد");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  async function handleUnapprove() {
    if (!editId) return;
    try {
      await api.post(`/petty-cash-summaries/${editId}/unapprove`, {});
      await refreshMeta();
      flash();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  async function runJournalAction(method: "post" | "del") {
    if (!editId) return;
    try {
      if (method === "post") {
        const result: { message?: string } = await api.post(`/petty-cash-summaries/${editId}/issue-journal-entry`, {});
        await refreshMeta();
        flash(result?.message);
      } else {
        if (!window.confirm("سند حسابداری صادرشده حذف می‌شود. ادامه می‌دهید؟")) return;
        await api.del(`/petty-cash-summaries/${editId}/journal-entry`);
        await refreshMeta();
        flash();
      }
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  const jeLocked = !!meta?.journalEntryId;
  const totalAmount = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  return (
    <FormPage
      title={editId ? "ویرایش خلاصه تنخواه" : "خلاصه تنخواه جدید"}
      description={jeLocked ? "برای این خلاصه تنخواه سند حسابداری صادر شده است؛ برای هر تغییری ابتدا سند حسابداری را حذف کنید." : status === "APPROVED" ? "این سند تایید شده و قابل ویرایش نیست." : undefined}
      formId="petty-cash-summary-form"
      closePath="/petty-cash-summaries"
      newPath="/petty-cash-summaries/new"
      onDelete={!editId || status === "DRAFT" ? handleDelete : undefined}
      saveDisabled={formLocked}
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
      <form id="petty-cash-summary-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <fieldset disabled={formLocked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className="form-grid" style={{ marginBottom: 16 }}>
            <div className="form-field">
              <label>تاریخ<RequiredMark /></label>
              {/* طبق تصمیم صریح کاربر: چون ردیف‌ها بر مبنای تاریخ/تنخواه‌دارِ سرصفحه بارگذاری می‌شوند، به‌محض افزودن
                  اولین ردیف این دو فیلد قفل می‌شوند (کاربر باید ابتدا همه‌ی ردیف‌ها را حذف کند تا بتواند عوضشان کند) */}
              <JalaliDatePicker fiscalYear value={header.date} onChange={(v) => setHeader({ ...header, date: v })} disabled={lines.length > 0} />
            </div>
            <div className="form-field">
              <label>تنخواه‌دار<RequiredMark /></label>
              <RecordPickerField
                title="انتخاب تنخواه‌دار"
                displayValue={header.custodianDisplay}
                rows={custodians}
                disabled={lines.length > 0}
                columns={[
                  { header: "کد", render: (c) => toFaDigits(c.detailCode), filterValue: (c) => c.detailCode, width: "90px" },
                  { header: "تنخواه", render: (c) => c.pettyCash.title, filterValue: (c) => c.pettyCash.title },
                  { header: "تنخواه‌دار", render: (c) => partyDisplayName(c.party), filterValue: (c) => partyDisplayName(c.party) },
                ]}
                onSelect={(c) => {
                  setHeader({ ...header, custodianId: String(c.id), custodianDisplay: custodianLabel(c) });
                  setLines([]);
                }}
              />
            </div>
            <div className="form-field">
              <label>ارز تنخواه</label>
              <input disabled dir="ltr" value={custodian?.pettyCash?.currency?.title || ""} />
            </div>
            <div className="form-field">
              <label>نرخ ارز<RequiredMark /></label>
              {/* ارز پایه همیشه نرخ ۱ دارد (هم‌الگوی سند حسابداری/فاکتور) — سرور هم هر مقدار دیگری را نادیده می‌گیرد */}
              <AmountInput
                value={custodian?.pettyCash?.currency?.isBase ? "1" : header.fxRate}
                onChange={(v) => setHeader({ ...header, fxRate: v })}
                allowDecimal
                disabled={!!custodian?.pettyCash?.currency?.isBase}
              />
            </div>
            <div className="form-field full">
              <label>شرح</label>
              <input value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} />
            </div>
          </div>

          <LineGridToolbar<LineState>
            title="ردیف‌های خلاصه تنخواه"
            show={{ load: true }}
            onAdd={() => setAddPickerOpen(true)}
            onLoad={loadAllPending}
            loadLabel="بارگذاری پرداخت‌های تنخواه"
            loadDisabled={!header.custodianId}
            onDelete={grid.deleteSelected}
            canDelete={grid.canDelete}
            onMoveUp={grid.moveUp}
            canMoveUp={grid.canMoveUp}
            onMoveDown={grid.moveDown}
            canMoveDown={grid.canMoveDown}
            filterValue={grid.filterText}
            onFilterChange={grid.setFilterText}
            exportColumns={lineExportColumns}
            exportRows={lines}
            exportFileName="Petty-cash-summary-lines"
          >
            <button
              type="button"
              className="toolbar-icon-btn"
              disabled={grid.selectedIndex === null}
              onClick={() => setModifyIdx(grid.selectedIndex)}
              title="تغییر نوع پرداخت"
            >
              <EditIcon />
            </button>
          </LineGridToolbar>
          <div className="grid-wrap je-lines-wrap">
            <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
              <table className="je-lines-table">
                <thead>
                  <tr>
                    <th>ردیف</th>
                    <th>موضوع پرداخت</th>
                    <th>نوع پرداخت</th>
                    <th>مبنا</th>
                    <th>حساب معین</th>
                    <th>تفصیل ۱</th>
                    <th>تفصیل ۲</th>
                    <th>تفصیل ۳</th>
                    <th>مبلغ</th>
                    <th>تسعیر</th>
                    <th>شرح</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {grid.visibleEntries.map(({ row, idx }) => {
                    const remaining = liveRemaining(row.pettyCashPaymentId, row.clientKey);
                    const detailOpts = (typeId: number | null) => (typeId ? detailOptions[typeId] || [] : []);
                    return (
                      <tr
                        key={row.clientKey}
                        className={idx === grid.selectedIndex ? "line-grid-row-selected" : undefined}
                        onClick={() => grid.select(idx)}
                      >
                        <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                        <td style={{ minWidth: 190 }}>
                          <div>{row.paymentDisplay}</div>
                          <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{row.paymentPartyDisplay}</div>
                        </td>
                        <td style={{ minWidth: 160 }}>
                          <div>{row.paymentTypeTitle}</div>
                        </td>
                        <td style={{ minWidth: 130 }}>
                          {BASIS_TITLE_FA[row.basisType]}
                          {row.basisDisplay && <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>سند: {row.basisDisplay}</div>}
                        </td>
                        <td style={{ minWidth: 160 }}>
                          {row.account ? `${toFaDigits(row.account.code)} — ${row.account.title}` : <span style={{ color: "var(--danger, #c0392b)" }}>{row.accountError || "—"}</span>}
                        </td>
                        {(["detail1Code", "detail2Code", "detail3Code"] as const).map((field, i) => {
                          const typeId = row.account ? (i === 0 ? row.account.detailType1Id : i === 1 ? row.account.detailType2Id : row.account.detailType3Id) : null;
                          return (
                            <td key={field} style={{ minWidth: 140 }}>
                              {row.partyDetailLocked === field ? (
                                <span title="قفل — از طرف‌حساب پرداخت تنخواه">{row[field] ? toFaDigits(row[field]) : "—"}</span>
                              ) : typeId ? (
                                <RecordPickerField
                                  title={`انتخاب تفصیل ${toFaDigits(String(i + 1))}`}
                                  displayValue={row[field] ? toFaDigits(row[field]) : ""}
                                  rows={detailOpts(typeId).map((o) => ({ id: o.code, ...o }))}
                                  columns={[
                                    { header: "کد", render: (o: any) => toFaDigits(o.code), filterValue: (o: any) => o.code, width: "90px" },
                                    { header: "عنوان", render: (o: any) => o.title, filterValue: (o: any) => o.title },
                                  ]}
                                  onSelect={(o: any) => updateLine(idx, { [field]: o.code } as any)}
                                  onClear={row[field] ? () => updateLine(idx, { [field]: "" } as any) : undefined}
                                />
                              ) : (
                                <span style={{ color: "var(--ink-soft)" }}>—</span>
                              )}
                            </td>
                          );
                        })}
                        <td style={{ minWidth: 130 }}>
                          <AmountInput value={row.amount} onChange={(v) => updateLine(idx, { amount: v })} allowDecimal />
                          {remaining < -0.001 && <div style={{ fontSize: 11, color: "var(--danger, #c0392b)" }}>بیش از مانده‌ی مجاز</div>}
                        </td>
                        <td style={{ minWidth: 100 }}>{row.exchangeGainLoss ? formatAmountFa(row.exchangeGainLoss) : "—"}</td>
                        <td style={{ minWidth: 140 }}>
                          <input value={row.description} onChange={(e) => updateLine(idx, { description: e.target.value })} />
                        </td>
                        <td>
                          <button type="button" className="btn danger" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => removeLine(idx)}>
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
              <span className="grid-footer-info">{lines.length === 0 ? "بدون ردیف" : `${toFaDigits(String(lines.length))} ردیف`}</span>
              <span className="je-lines-totals">جمع مبلغ: {formatAmountFa(totalAmount)}</span>
            </div>
          </div>
        </fieldset>
      </form>
      {modifyIdx !== null && (
        <ModifyPaymentTypeDialog
          row={lines[modifyIdx]}
          onClose={() => setModifyIdx(null)}
          onConfirm={async (patch) => {
            const { account, error: accErr, partyDetail } = await resolveAccountFor(
              patch.paymentTypeId,
              patch.purchaseInvoiceId,
              patch.salesInvoiceId,
              lines[modifyIdx].paymentPartyDetailCode
            );
            preloadDetailOptionsFor(account);
            updateLine(modifyIdx, {
              ...patch,
              account,
              accountError: accErr,
              detail1Code: partyDetail.detail1Code || "",
              detail2Code: partyDetail.detail2Code || "",
              detail3Code: partyDetail.detail3Code || "",
              partyDetailLocked: partyDetailLockedSlot(partyDetail),
            });
            setModifyIdx(null);
          }}
        />
      )}
      {addPickerOpen && (
        <RecordPickerDialog
          title="انتخاب پرداخت تنخواه"
          rows={addableCandidates}
          columns={ADD_PICKER_COLUMNS}
          onSelect={addSelectedPayment}
          onClose={() => setAddPickerOpen(false)}
        />
      )}
    </FormPage>
  );
}

function custodianLabel(c: CustodianOption) {
  return `${toFaDigits(c.detailCode)} — ${c.pettyCash.title} (${partyDisplayName(c.party)})`;
}

function ModifyPaymentTypeDialog({
  row,
  onClose,
  onConfirm,
}: {
  row: LineState;
  onClose: () => void;
  onConfirm: (patch: { paymentTypeId: string; basisType: BasisType; purchaseInvoiceId: string; salesInvoiceId: string; purchaseOrderId: string; basisDisplay: string; paymentTypeTitle: string }) => void;
}) {
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeOption[]>([]);
  const [paymentTypeId, setPaymentTypeId] = useState(row.paymentTypeId);
  const [basisId, setBasisId] = useState(row.purchaseInvoiceId || row.salesInvoiceId || row.purchaseOrderId);
  const [basisDisplay, setBasisDisplay] = useState(row.basisDisplay);
  const [candidates, setCandidates] = useState<BasisCandidate[]>([]);

  useEffect(() => {
    api.get("/payment-types").then((pts: PaymentTypeOption[]) => setPaymentTypes(pts.filter((t) => t.isActive && !PETTY_CASH_INELIGIBLE_NATURES.has(t.nature))));
  }, []);

  const paymentType = paymentTypes.find((t) => String(t.id) === paymentTypeId);
  const basisType = paymentType?.basisType || "NONE";

  useEffect(() => {
    if (basisType === "NONE") {
      setCandidates([]);
      return;
    }
    api
      .get(`/petty-cash-payments/basis/pickable-documents?basisType=${basisType}&partyId=${row.paymentPartyId}`)
      .then(setCandidates)
      .catch(() => setCandidates([]));
  }, [basisType, row.paymentPartyId]);

  function onPaymentTypeChange(id: string) {
    setPaymentTypeId(id);
    setBasisId("");
    setBasisDisplay("");
  }

  function confirm() {
    if (!paymentTypeId) return showError("نوع پرداخت الزامی است");
    if (basisType !== "NONE" && !basisId) return showError("انتخاب سند مبنا الزامی است");
    const field = basisType !== "NONE" ? BASIS_FIELD[basisType as Exclude<BasisType, "NONE">] : null;
    onConfirm({
      paymentTypeId,
      basisType,
      purchaseInvoiceId: field === "purchaseInvoiceId" ? basisId : "",
      salesInvoiceId: field === "salesInvoiceId" ? basisId : "",
      purchaseOrderId: field === "purchaseOrderId" ? basisId : "",
      basisDisplay,
      paymentTypeTitle: paymentType?.title || "",
    });
  }

  return (
    <Modal title="تغییر نوع پرداخت" onClose={onClose}>
      <div className="form-grid">
        <div className="form-field full">
          <label>نوع پرداخت<RequiredMark /></label>
          <select value={paymentTypeId} onChange={(e) => onPaymentTypeChange(e.target.value)}>
            <option value="">انتخاب کنید</option>
            {paymentTypes.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>
        {basisType !== "NONE" && (
          <div className="form-field full">
            <label>سند مبنا<RequiredMark /></label>
            <RecordPickerField
              title="انتخاب سند مبنا"
              displayValue={basisDisplay}
              rows={candidates}
              columns={[
                { header: "شماره", render: (c) => toFaDigits(String(c.number)), filterValue: (c) => String(c.number), width: "70px" },
                { header: "تاریخ", render: (c) => formatJalaliDate(c.date), filterValue: (c) => c.date.slice(0, 10), width: "100px" },
                { header: "مانده", render: (c) => formatAmountFa(c.remaining), filterValue: (c) => String(c.remaining), width: "110px" },
              ]}
              onSelect={(c) => { setBasisId(String(c.id)); setBasisDisplay(toFaDigits(String(c.number))); }}
            />
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <button type="button" className="btn" onClick={onClose}>انصراف</button>
        <button type="button" className="btn primary" onClick={confirm}>تایید</button>
      </div>
    </Modal>
  );
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
