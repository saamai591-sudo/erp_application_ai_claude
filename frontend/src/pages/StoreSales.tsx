import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ScrollGridWithTotals } from "../components/ScrollGridWithTotals";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { RecordPickerField } from "../components/RecordPicker";
import { ShiftPromptDialog } from "../components/ShiftPromptDialog";
import { ShowcaseLayout } from "../components/ShowcaseSidebar";
import { StoreVoucherDialog } from "../components/StoreVoucherDialog";
import { useModuleEnabled } from "../lib/useEntitlements";
import { DescriptionField } from "../components/DescriptionField";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { fetchSelectedFiscalPeriod, defaultDocumentDate } from "../lib/fiscalYearDefaultDate";
import { api, ApiError } from "../lib/api";
import { showError, showToast } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { usePermissions } from "../lib/usePermissions";
import { useTabs } from "../lib/TabsContext";
import { Modal } from "../components/Modal";
import { AmountInput } from "../components/AmountInput";
import { localTodayIso } from "../lib/formatDate";
import { isTabDirty, currentTabPath } from "../lib/unsavedChanges";
import { stageFormPrefill, takeFormPrefill } from "../lib/formPrefill";
import { StoreCardReceiptDialog, ExistingReceiptsTable, ExistingReceipt, ReceiptPayee } from "../components/StoreCardReceiptDialog";

// فروش فروشگاهی › عملیات › «فروش فروشگاهی»: اول تاریخ و ایستگاه انتخاب می‌شود؛ ردیف‌ها با بارکدخوان (فیلد بارکد کالا) یا جست‌وجو اضافه می‌شوند، مقدار پیش‌فرض ۱ و قابل‌تغییر است.
// فی از «اعلامیه قیمت فروش» با حوزه‌ی همان ایستگاه خوانده می‌شود (پله‌ی مقدار هم)؛ کالای بدون فی در آن اعلامیه اصلاً قابل انتخاب نیست. فی فقط با مجوز «تغییر فی» قابل تغییر است.
// سند حسابداری و حواله انبار ندارد؛ تا وقتی «تحویل‌نشده» است تعدادش از موجودی گزارش‌ها کم می‌شود. قواعد نهایی در سرور (services/storeSaleService.ts).

/** ارقام فارسی/عربی → لاتین (بارکدخوان و تایپ دستی یکسان جست‌وجو شوند) */
const normDigits = (v: string) => v.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

interface StationCardReader {
  id: number;
  code: number;
  title: string;
  terminalNumber: string;
  merchantNumber: string;
  bankAccountId: number;
  bankAccountCode: string;
  bankAccountTitle: string;
}
interface StationBank {
  id: number;
  detailCode: string;
  detailTitle: string;
}
interface StationOpt {
  id: number;
  code: number;
  title: string;
  offering: string;
  customerId: number;
  customerCode: number | null;
  customerTitle: string;
  cardReaders?: StationCardReader[];
  bankAccounts?: StationBank[];
}
interface CustomerOpt {
  id: number;
  code: number;
  isActive: boolean;
  party: { detailTitle?: string; name?: string; firstName?: string; lastName?: string; category?: string };
}
interface Tier {
  minQuantity: number;
  price: number;
}
interface Sellable {
  id: number;
  fullCode: string;
  title: string;
  barcode: string;
  kind: "GOODS" | "SERVICE";
  unitId: number;
  unitTitle: string;
  basePrice: number;
  tiers: Tier[];
  vatRatePercent: number;
}
interface SellableResponse {
  priceListId: number | null;
  priceListNumber: number | null;
  decimalPlaces: number;
  items: Sellable[];
  canChangePrice: boolean;
}
interface ShiftOpt {
  id: number;
  code: number;
  title: string;
  stationId: number;
  stationTitle: string;
  startTime: string;
  endTime: string;
}
interface ListRow {
  id: number;
  number: number;
  date: string;
  stationTitle: string;
  shiftId?: number | null;
  shiftTitle?: string;
  shiftDate?: string | null;
  customerTitle: string;
  lineCount: number;
  totalAmount: number;
  totalVat: number;
  payable: number;
  deliveryStatus: "NOT_DELIVERED" | "DELIVERED";
  paid: number;
  remaining: number;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  creditDeclared?: boolean;
  creditNote?: string;
  settled?: boolean;
}
interface ReceiptRow {
  id: number;
  number: number;
  date: string;
  amount: number;
  description: string;
  updatedAt?: string;
  method?: "CASH" | "CARD" | "TRANSFER" | "VOUCHER";
  voucherSerial?: string;
  cardReaderTitle?: string;
  bankAccountTitle?: string;
  referenceNumber?: string;
}
interface DetailLine {
  goodsItemId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitTitle: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  vatAmount: number;
  listPrice: number | null;
  description: string;
}
interface Detail extends ListRow {
  receipts: ReceiptRow[];
  stationId: number;
  customerId: number;
  description: string;
  updatedAt?: string;
  lines: DetailLine[];
}
interface Row {
  goodsItemId: number;
  code: string;
  title: string;
  unitTitle: string;
  quantity: string;
  /** فیِ دستی (فقط با مجوز تغییر فی)؛ خالی = فی اعلامیه */
  priceOverride: string;
  /** مقدار ذخیره‌شده‌ی فی/مبلغ/مالیات (برای نمایش ردیفی که دیگر در اعلامیه‌ی فعلی نیست) */
  stored?: { unitPrice: number; vatAmount: number };
  description: string;
}

const DELIVERY_FA = { NOT_DELIVERED: "تحویل‌نشده", DELIVERED: "تحویل‌شده" } as const;
const PAYMENT_FA = { UNPAID: "پرداخت‌نشده", PARTIAL: "جزئی", PAID: "تسویه" } as const;
const customerTitleOf = (c: CustomerOpt) => c.party.detailTitle || (c.party.category === "LEGAL" ? c.party.name || "" : `${c.party.firstName || ""} ${c.party.lastName || ""}`.trim());
const roundTo = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;
const qtyOf = (r: Row) => Number(r.quantity) || 0;

export default function StoreSales() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <SaleForm />;
  if (location.pathname.endsWith("/edit")) return <SaleForm editId={Number(id)} />;
  return <SaleList />;
}

function SaleList() {
  const cacheKey = "/store-sales";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/store-sales").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: ListRow) {
    try {
      await api.del(`/store-sales/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: ListRow) => string, extra: object = {}) => ({ render: (r: ListRow) => f(r), filterType: "string" as const, filterValue: (r: ListRow) => f(r), ...extra });
  const n = (f: (r: ListRow) => number, extra: object = {}) => ({ render: (r: ListRow) => formatAmountFa(f(r)), filterType: "number" as const, filterValue: (r: ListRow) => f(r), decimal: true, ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="فروش فروشگاهی" text="فروش سریع یک ایستگاه فروش با بارکدخوان؛ فی از اعلامیه‌ی قیمتِ ایستگاه می‌آید. این سند سند حسابداری و حواله انبار ندارد؛ تا قبل از «تحویل»، تعدادش از موجودی گزارش‌ها کم می‌شود." />
          <NewRecordButton path="/store-sales/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", ...s((r) => toFaDigits(String(r.number))), width: "80px", filterType: "number", filterValue: (r: ListRow) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10), width: "110px" },
          { header: "ایستگاه", ...s((r) => r.stationTitle) },
          { header: "شیفت", ...s((r) => r.shiftTitle || "—"), width: "120px" },
          { header: "تاریخ شروع شیفت", render: (r) => (r.shiftDate ? formatJalaliDate(r.shiftDate) : "—"), filterType: "date", filterValue: (r) => (r.shiftDate ?? "").slice(0, 10), width: "130px" },
          { header: "مشتری", ...s((r) => r.customerTitle) },
          { header: "ردیف", ...n((r) => r.lineCount), width: "70px", decimal: false },
          { header: "مبلغ", ...n((r) => r.totalAmount), width: "120px" },
          { header: "ارزش افزوده", ...n((r) => r.totalVat), width: "120px" },
          { header: "مبلغ قابل پرداخت", ...n((r) => r.payable), width: "140px" },
          { header: "دریافت‌شده", ...n((r) => r.paid), width: "120px" },
          { header: "باقی‌مانده", ...n((r) => r.remaining), width: "120px" },
          { header: "نسیه", render: (r: ListRow) => (r.creditDeclared ? "نسیه" : r.settled === false ? "تسویه‌نشده" : ""), filterType: "string" as const, filterValue: (r: ListRow) => (r.creditDeclared ? "نسیه" : r.settled === false ? "تسویه‌نشده" : ""), width: "110px" },
          { header: "وضعیت پرداخت", ...s((r) => PAYMENT_FA[r.paymentStatus]), width: "110px" },
          { header: "وضعیت تحویل", ...s((r) => DELIVERY_FA[r.deliveryStatus]), width: "110px" },
        ]}
        rows={items}
        edit={{ path: (r: ListRow) => `/store-sales/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function SaleForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", stationId: "", shiftId: "", shiftDate: "", customerId: "", description: "" });
  const [rows, setRows] = usePersistedState<Row[]>(`${cacheKey}:rows`, []);
  const [meta, setMeta] = useState<{ number: number; deliveryStatus: "NOT_DELIVERED" | "DELIVERED"; updatedAt?: string } | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [payInfo, setPayInfo] = useState<{ payable: number; paid: number; remaining: number; status: "UNPAID" | "PARTIAL" | "PAID" }>({ payable: 0, paid: 0, remaining: 0, status: "UNPAID" });
  const [newRec, setNewRec] = useState({ date: localTodayIso(), amount: "", description: "" });
  const { hasPermission } = usePermissions();
  const { openTab, closeTab, activeTabId } = useTabs();
  const [cashDialog, setCashDialog] = useState(false);
  const [credit, setCredit] = useState<{ declared: boolean; note: string }>({ declared: false, note: "" });
  const [creditDialog, setCreditDialog] = useState(false);
  const [creditNote, setCreditNote] = useState("");
  const [paying, setPaying] = useState(false);
  const [cardDialog, setCardDialog] = useState(false);
  const [transferDialog, setTransferDialog] = useState(false);
  const [voucherDialog, setVoucherDialog] = useState(false);
  const clubEnabled = useModuleEnabled("customer-club");
  const [stations, setStations] = useState<StationOpt[]>([]);
  const [shifts, setShifts] = useState<ShiftOpt[]>([]);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [sell, setSell] = useState<SellableResponse | null>(null);
  const [sellError, setSellError] = useState<string | null>(null);
  const [barcode, setBarcode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId ? false : false);
  const { flash } = useSavedFlash();
  const barcodeRef = useRef<HTMLInputElement>(null);

  // ── بارگذاری اولیه ──
  useEffect(() => {
    async function init() {
      const [st, cu, fp, sh] = await Promise.all([api.get("/sales-stations?activeOnly=true"), api.get("/customers"), fetchSelectedFiscalPeriod(), api.get("/sales-shifts?activeOnly=true")]);
      setStations(st);
      setShifts(sh);
      setCustomers((cu as CustomerOpt[]).filter((c) => c.isActive !== false));
      if (editId) {
        const d: Detail = await api.get(`/store-sales/${editId}`);
        setMeta({ number: d.number, deliveryStatus: d.deliveryStatus, updatedAt: d.updatedAt });
        setReceipts(d.receipts ?? []);
        setCredit({ declared: !!d.creditDeclared, note: d.creditNote ?? "" });
        setPayInfo({ payable: d.payable, paid: d.paid, remaining: d.remaining, status: d.paymentStatus });
        setNewRec((x) => ({ ...x, date: localTodayIso() < d.date ? d.date : x.date, amount: d.remaining > 0 ? String(d.remaining) : "" }));
        if (!hasPersistedState(`${cacheKey}:header`)) {
          setHeader({ date: d.date, stationId: String(d.stationId), shiftId: d.shiftId ? String(d.shiftId) : "", shiftDate: d.shiftDate ?? "", customerId: String(d.customerId), description: d.description });
          setRows(d.lines.map((l) => ({ goodsItemId: l.goodsItemId, code: l.goodsItemCode, title: l.goodsItemTitle, unitTitle: l.unitTitle, quantity: String(l.quantity), priceOverride: "", stored: { unitPrice: l.unitPrice, vatAmount: l.vatAmount }, description: l.description })));
        }
      } else if (!hasPersistedState(`${cacheKey}:header`)) {
        // «فاکتور جدید» از یک فروش دیگر: همان ایستگاه و تاریخ (و مشتری پیش‌فرض ایستگاه)
        const pre = takeFormPrefill<{ stationId: string; shiftId: string; shiftDate: string; customerId: string }>(location.pathname);
        setHeader({ date: defaultDocumentDate(fp), stationId: pre?.stationId ?? "", shiftId: pre?.shiftId ?? "", shiftDate: pre?.shiftDate ?? "", customerId: pre?.customerId ?? "", description: "" });
        setRows([]);
      }
      setLoaded(true);
    }
    init().catch((e) => setError((e as ApiError).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // ── اقلام قابل‌فروشِ (ایستگاه، تاریخ) ──
  const ready = !!header.date && !!header.stationId && !!header.shiftId && !!header.shiftDate;
  useEffect(() => {
    setSell(null);
    setSellError(null);
    if (!ready) return;
    let dead = false;
    api.get(`/store-sales/sellable-items?stationId=${header.stationId}&date=${header.date}`)
      .then((r: SellableResponse) => {
        if (dead) return;
        setSell(r);
        if (!r.priceListId) setSellError("برای این ایستگاه در این تاریخ اعلامیه‌ی قیمتی تعریف نشده است؛ ابتدا در «اعلامیه قیمت فروش» ایستگاه را به حوزه‌ی یک اعلامیه اضافه کنید.");
      })
      .catch((e) => { if (!dead) setSellError((e as ApiError).message); });
    return () => { dead = true; };
  }, [header.stationId, header.date, ready]);

  const itemMap = useMemo(() => new Map((sell?.items ?? []).map((i) => [i.id, i])), [sell]);
  const byBarcode = useMemo(() => {
    const m = new Map<string, Sellable>();
    for (const i of sell?.items ?? []) if (i.barcode) m.set(normDigits(i.barcode.trim()), i);
    return m;
  }, [sell]);
  /** جست‌وجوی «بارکد» هم کد کالا را می‌پذیرد (بارکد اولویت دارد) */
  const byCode = useMemo(() => {
    const m = new Map<string, Sellable>();
    for (const i of sell?.items ?? []) if (i.fullCode) m.set(normDigits(i.fullCode.trim()), i);
    return m;
  }, [sell]);
  const dp = sell?.decimalPlaces ?? 0;
  const station = stations.find((s) => String(s.id) === header.stationId);
  const shift = shifts.find((x) => String(x.id) === header.shiftId);
  const customer = customers.find((c) => String(c.id) === header.customerId);
  const delivered = !!editId && meta?.deliveryStatus === "DELIVERED";
  const hasReceipts = !!editId && receipts.length > 0;
  const locked = delivered || hasReceipts || credit.declared;
  const canDeclareCredit = !!editId && !delivered && hasPermission("store-sales.operations.store-sales.declareCredit");
  const canReceive = !!editId && hasPermission("store-sales.operations.store-receipts.create");
  const canDeleteReceipt = hasPermission("store-sales.operations.store-receipts.delete");
  const canEditReceipt = hasPermission("store-sales.operations.store-receipts.edit");
  /** تسویه‌شده (باقیمانده صفر) یا نسیه‌ی عامدانه */
  const settledNow = credit.declared || payInfo.remaining <= 1e-6;
  const cashReceipts = receipts.filter((r) => (r.method ?? "CASH") === "CASH");
  const toExisting = (rs: ReceiptRow[]): ExistingReceipt[] => rs.map((r) => ({ id: r.id, number: r.number, date: r.date, amount: r.amount, description: r.description, payeeTitle: r.method === "CARD" ? r.cardReaderTitle : r.method === "VOUCHER" ? r.voucherSerial : r.bankAccountTitle, referenceNumber: r.referenceNumber, updatedAt: r.updatedAt }));
  const cardReceipts = receipts.filter((r) => r.method === "CARD");
  const transferReceipts = receipts.filter((r) => r.method === "TRANSFER");
  const voucherReceipts = receipts.filter((r) => r.method === "VOUCHER");
  const cardPayees: ReceiptPayee[] = (station?.cardReaders ?? []).map((c) => ({ id: c.id, label: `${toFaDigits(String(c.code))} — ${c.title}`, terminal: c.terminalNumber, account: `${toFaDigits(c.bankAccountCode)} - ${toFaDigits(c.bankAccountTitle)}` }));
  const transferPayees: ReceiptPayee[] = (station?.bankAccounts ?? []).map((b) => ({ id: b.id, label: `${toFaDigits(b.detailCode)} - ${toFaDigits(b.detailTitle)}` }));
  const canChangePrice = !!sell?.canChangePrice;

  /** فی ردیف: دستی (اگر مجاز و وارد شده) وگرنه فی اعلامیه با پله‌ی مقدار (آینه‌ی سرور؛ مرجع نهایی سرور است) */
  function priceOf(r: Row): number {
    if (r.priceOverride !== "" && canChangePrice) return Number(r.priceOverride) || 0;
    const it = itemMap.get(r.goodsItemId);
    if (!it) return r.stored?.unitPrice ?? 0;
    let price = it.basePrice;
    let best = -1;
    for (const t of it.tiers) if (t.minQuantity <= qtyOf(r) && t.minQuantity > best) { best = t.minQuantity; price = t.price; }
    return price;
  }
  const amountOf = (r: Row) => roundTo(qtyOf(r) * priceOf(r), dp);
  function vatOf(r: Row): number {
    const it = itemMap.get(r.goodsItemId);
    if (!it) return r.stored ? r.stored.vatAmount : 0;
    return roundTo((amountOf(r) * it.vatRatePercent) / 100, dp);
  }
  const totalAmount = rows.reduce((s, r) => s + amountOf(r), 0);
  const totalVat = rows.reduce((s, r) => s + vatOf(r), 0);

  function addItem(it: Sellable) {
    setRows((prev) => {
      const i = prev.findIndex((r) => r.goodsItemId === it.id);
      if (i >= 0) return prev.map((r, k) => (k === i ? { ...r, quantity: String(qtyOf(r) + 1) } : r));
      return [...prev, { goodsItemId: it.id, code: it.fullCode, title: it.title, unitTitle: it.unitTitle, quantity: "1", priceOverride: "", description: "" }];
    });
  }
  function onBarcodeEnter() {
    const code = barcode.trim();
    if (!code) return;
    const key = normDigits(code);
    const it = byBarcode.get(key) ?? byCode.get(key);
    if (!it) {
      showToast(`بارکد/کد «${code}» یافت نشد یا کالا در اعلامیه‌ی قیمت این ایستگاه فی ندارد`, "error");
    } else addItem(it);
    setBarcode("");
    barcodeRef.current?.focus();
  }
  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await save();
  }

  /** ذخیره‌ی فروش؛ true = ذخیره شد (یا خطایی نبود). کارت‌ها قبل از بازشدن، تغییرات ذخیره‌نشده را با همین تابع ذخیره می‌کنند. */
  async function save(): Promise<boolean> {
    setError(null);
    if (!header.date) { setError("تاریخ فروش را انتخاب کنید"); return false; }
    if (!header.shiftId) { setError("شیفت را انتخاب کنید"); return false; }
    if (!header.shiftDate) { setError("تاریخ شروع شیفت را وارد کنید"); return false; }
    if (header.date < header.shiftDate) { setError("تاریخ فاکتور نمی‌تواند قبل از تاریخ شروع شیفت باشد"); return false; }
    if (rows.length === 0) { setError("حداقل یک ردیف اضافه کنید"); return false; }
    for (const [i, r] of rows.entries()) if (!(qtyOf(r) > 0)) { setError(`مقدار ردیف ${toFaDigits(String(i + 1))} باید عددی بزرگ‌تر از صفر باشد`); return false; }
    const body = {
      date: header.date,
      shiftId: Number(header.shiftId),
      shiftDate: header.shiftDate,
      customerId: header.customerId ? Number(header.customerId) : undefined,
      description: header.description,
      lines: rows.map((r) => ({ goodsItemId: r.goodsItemId, quantity: qtyOf(r), unitPrice: r.priceOverride !== "" && canChangePrice ? Number(r.priceOverride) : undefined, description: r.description })),
      updatedAt: meta?.updatedAt,
    };
    try {
      if (editId) {
        await api.put(`/store-sales/${editId}`, body);
        flash();
        const d: Detail = await api.get(`/store-sales/${editId}`);
        setMeta({ number: d.number, deliveryStatus: d.deliveryStatus, updatedAt: d.updatedAt });
        setReceipts(d.receipts ?? []);
        setCredit({ declared: !!d.creditDeclared, note: d.creditNote ?? "" });
        setPayInfo({ payable: d.payable, paid: d.paid, remaining: d.remaining, status: d.paymentStatus });
        setNewRec((x) => ({ ...x, date: localTodayIso() < d.date ? d.date : x.date, amount: d.remaining > 0 ? String(d.remaining) : "" }));
      } else {
        const created = await api.post("/store-sales", body);
        flash();
        navigate(`/store-sales/${created.id}/edit`);
        return false; // فرم به رکورد تازه می‌رود؛ کارت‌ها فقط روی فروش ذخیره‌شده فعال‌اند
      }
      return true;
    } catch (err) {
      setError((err as ApiError).message);
      return false;
    }
  }

  /** کلیک روی هر کارت: اگر تغییر ذخیره‌نشده هست اول ذخیره می‌شود و فقط در صورت موفقیت کارت باز می‌شود */
  async function openCard(action: () => void) {
    if (!locked && isTabDirty(currentTabPath())) {
      if (!(await save())) return;
    }
    action();
  }

  async function reloadSale() {
    const d: Detail = await api.get(`/store-sales/${editId}`);
    setMeta({ number: d.number, deliveryStatus: d.deliveryStatus, updatedAt: d.updatedAt });
    setReceipts(d.receipts ?? []);
        setCredit({ declared: !!d.creditDeclared, note: d.creditNote ?? "" });
    setPayInfo({ payable: d.payable, paid: d.paid, remaining: d.remaining, status: d.paymentStatus });
    setNewRec((x) => ({ ...x, amount: d.remaining > 0 ? String(d.remaining) : "" }));
  }
  async function addReceipt() {
    setError(null);
    if (!(Number(newRec.amount) > 0)) return setError("مبلغ دریافت باید عددی بزرگ‌تر از صفر باشد");
    try {
      await api.post("/store-receipts", { saleId: editId, date: newRec.date, amount: Number(newRec.amount), description: newRec.description });
      setNewRec((x) => ({ ...x, description: "" }));
      await reloadSale();
    } catch (err) {
      setError((err as ApiError).message);
    }
  }
  /** دریافت کارتی از چند کارتخوان در یک تراکنش (همه‌یا‌هیچ) — مبلغ‌ها از دیالوگ می‌آید؛ سرور سقف جمعِ (نقد + کارتی) را دوباره کنترل می‌کند */
  async function payBatch(kind: "CARD" | "TRANSFER", items: { id: number; amount: number; referenceNumber: string }[]) {
    if (!editId || paying) return;
    setPaying(true);
    setError(null);
    try {
      const today = localTodayIso();
      const body = items.map((x) => (kind === "CARD" ? { cardReaderId: x.id, amount: x.amount, referenceNumber: x.referenceNumber } : { bankAccountId: x.id, amount: x.amount, referenceNumber: x.referenceNumber }));
      await api.post("/store-receipts/batch", { saleId: editId, date: today < header.date ? header.date : today, items: body, description: "" });
      setCardDialog(false);
      setTransferDialog(false);
      await reloadSale();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setPaying(false);
    }
  }
  async function payVouchers(serials: string[]) {
    if (!editId || paying) return;
    setPaying(true);
    setError(null);
    try {
      const today = localTodayIso();
      await api.post("/store-receipts/batch", { saleId: editId, date: today < header.date ? header.date : today, items: serials.map((voucherSerial) => ({ voucherSerial })), description: "" });
      setVoucherDialog(false);
      await reloadSale();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setPaying(false);
    }
  }
  async function declareCredit() {
    setError(null);
    try {
      await api.post(`/store-sales/${editId}/declare-credit`, { note: creditNote });
      setCreditDialog(false);
      await reloadSale();
    } catch (err) {
      setCreditDialog(false);
      setError((err as ApiError).message);
    }
  }
  async function revokeCredit() {
    try {
      await api.post(`/store-sales/${editId}/revoke-credit`, {});
      await reloadSale();
    } catch (err) {
      showError((err as ApiError).message);
    }
  }
  async function saveReceipt(r: { id: number; date: string; updatedAt?: string }, v: { amount: number; description: string; referenceNumber?: string }) {
    setError(null);
    try {
      await api.put(`/store-receipts/${r.id}`, { date: r.date, amount: v.amount, description: v.description, referenceNumber: v.referenceNumber, updatedAt: r.updatedAt });
      await reloadSale();
    } catch (err) {
      showError((err as ApiError).message);
      await reloadSale();
    }
  }
  async function removeReceipt(r: { id: number }) {
    try {
      await api.del(`/store-receipts/${r.id}`);
      await reloadSale();
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/store-sales/${editId}`);
      navigate("/store-sales");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  const needShift = !header.shiftId && !locked;
  const linesLocked = locked || !sell || !sell.priceListId;
  return (
    <FormPage title={editId ? `فروش فروشگاهی شماره ${toFaDigits(String(meta?.number ?? ""))}` : "فروش فروشگاهی جدید"} formId="store-sale-form" closePath="/store-sales" newPath="/store-sales/new" onDelete={editId && !locked ? handleDelete : undefined} saveDisabled={locked}>
      {needShift && (
        <ShiftPromptDialog
          shifts={header.stationId ? shifts.filter((x) => String(x.stationId) === header.stationId) : shifts}
          defaultDate={header.date}
          onCancel={() => { if (activeTabId) closeTab(activeTabId, { preferPath: "/store-sales" }); }}
          onConfirm={(x, shiftDate) => {
            const st = stations.find((q) => q.id === x.stationId);
            setHeader({ ...header, shiftId: String(x.id), stationId: String(x.stationId), shiftDate, customerId: header.customerId || (st ? String(st.customerId) : "") });
          }}
        />
      )}
      <ShowcaseLayout stationId={header.stationId} sellable={itemMap} onPick={addItem} disabled={linesLocked} visible={ready && !!sell?.priceListId && !locked}>
      <form id="store-sale-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {delivered && <div className="alert warn">این فروش تحویل شده است و قابل ویرایش یا حذف نیست.</div>}
        {!delivered && credit.declared && (
          <div className="alert warn" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span>باقیمانده‌ی این فروش به‌صورت <b>نسیه</b> ثبت شده است{credit.note ? ` — ${credit.note}` : ""}؛ ویرایش یا حذف فروش ممکن نیست.</span>
            {canDeclareCredit && <button type="button" className="btn secondary" onClick={revokeCredit}>لغو نسیه</button>}
          </div>
        )}
        {!delivered && !credit.declared && payInfo.remaining > 0 && <div className="alert warn">این فروش تسویه نشده است. یا دریافت را ثبت کنید یا باقیمانده را عامدانه «نسیه» کنید؛ فروشِ تسویه‌نشده‌ای که نسیه نشده باشد قابل تحویل نیست.</div>}
        {!delivered && hasReceipts && <div className="alert warn">برای این فروش دریافت ثبت شده است؛ برای ویرایش یا حذف فروش ابتدا دریافت‌ها را حذف کنید.</div>}
        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid store-compact">
            <div className="form-field">
              <label>تاریخ<RequiredMark /></label>
              <JalaliDatePicker fiscalYear value={header.date} onChange={(v) => setHeader({ ...header, date: v })} />
            </div>
            <div className="form-field span-2">
              <label>شیفت</label>
              <div className="store-label" title="شیفت و تاریخ شروع شیفت هنگام باز کردن فرم جدید گرفته می‌شود و در فرم قابل ویرایش نیست">
                {shift ? <><b>{shift.title}</b> — {shift.stationTitle}</> : <span style={{ opacity: 0.6 }}>—</span>}
                <span style={{ opacity: 0.7 }}> | شروع شیفت: </span>
                <b>{header.shiftDate ? formatJalaliDate(header.shiftDate) : "—"}</b>
              </div>
            </div>
            <div className="form-field">
              <label>مشتری <FieldHint label="مشتری" text="پیش‌فرض از ایستگاه می‌آید و قابل تغییر است." /></label>
              <RecordPickerField<CustomerOpt>
                title="انتخاب مشتری"
                disabled={!ready}
                displayValue={customer ? `${toFaDigits(String(customer.code))} — ${customerTitleOf(customer)}` : station ? `${toFaDigits(String(station.customerCode ?? ""))} — ${station.customerTitle}` : ""}
                rows={customers}
                columns={[
                  { header: "کد", render: (x) => toFaDigits(String(x.code)), filterValue: (x) => String(x.code), width: "80px" },
                  { header: "عنوان", render: (x) => customerTitleOf(x), filterValue: (x) => customerTitleOf(x) },
                ]}
                onSelect={(x) => setHeader({ ...header, customerId: String(x.id) })}
              />
            </div>
            <DescriptionField value={header.description} onChange={(v) => setHeader({ ...header, description: v })} />
          </div>
        </fieldset>

        {!ready && <p style={{ opacity: 0.75, margin: "14px 0" }}>ابتدا تاریخ و ایستگاه فروش را انتخاب کنید.</p>}
        {ready && sellError && <div className="alert warn" style={{ marginTop: 10 }}>{sellError}</div>}

        {ready && sell && sell.priceListId && (
          <>
            <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: "12px 0 6px" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ fontWeight: 600 }}>بارکد / کد کالا</label>
                <input
                  ref={barcodeRef}
                  dir="ltr"
                  autoFocus={!editId}
                  style={{ width: 220, textAlign: "center" }}
                  placeholder="بارکد یا کد کالا را وارد کنید و Enter بزنید"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onBarcodeEnter();
                    }
                  }}
                />
                <span style={{ opacity: 0.6 }}>یا</span>
                <div style={{ minWidth: 260 }}>
                  <RecordPickerField<Sellable>
                    title="افزودن کالا"
                    displayValue=""
                    placeholder="جست‌وجوی کالا…"
                    rows={sell.items}
                    columns={[
                      { header: "کد", render: (g) => toFaDigits(g.fullCode), filterValue: (g) => g.fullCode, width: "110px" },
                      { header: "عنوان", render: (g) => g.title, filterValue: (g) => g.title },
                      { header: "بارکد", render: (g) => g.barcode || "—", filterValue: (g) => g.barcode },
                      { header: "فی", render: (g) => formatAmountFa(g.basePrice), filterValue: (g) => String(g.basePrice), width: "110px" },
                    ]}
                    onSelect={(g) => addItem(g)}
                  />
                </div>
                <span style={{ opacity: 0.6, fontSize: 12 }}>اعلامیه‌ی قیمت شماره {toFaDigits(String(sell.priceListNumber ?? ""))}</span>
              </div>
            </fieldset>

            <ScrollGridWithTotals
              tableClassName="je-lines-table mobile-cards"
              maxHeight="calc(100vh - 560px)"
              head={
                <tr>
                  <th>ردیف</th>
                  <th>کالا</th>
                  <th>واحد</th>
                  <th>مقدار</th>
                  <th>فی</th>
                  <th>مبلغ</th>
                  <th>ارزش افزوده</th>
                  <th>شرح</th>
                  <th></th>
                </tr>
              }
              totals={[
                {
                  cells: [
                    null,
                    rows.length === 0 ? "بدون ردیف" : `جمع (${toFaDigits(String(rows.length))} ردیف)`,
                    null, null, null,
                    formatAmountFa(totalAmount),
                    formatAmountFa(totalVat),
                    `قابل پرداخت: ${formatAmountFa(totalAmount + totalVat)}`,
                    null,
                  ],
                },
              ]}
            >
                    {rows.length === 0 && (
                      <tr><td colSpan={9} style={{ textAlign: "center", opacity: 0.7 }}>با بارکدخوان یا جست‌وجو کالا اضافه کنید</td></tr>
                    )}
                    {rows.map((r, i) => {
                      const missing = !itemMap.has(r.goodsItemId);
                      return (
                        <tr key={r.goodsItemId + ":" + i}>
                          <td data-label="ردیف" style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(i + 1))}</td>
                          <td data-label="کالا" style={{ minWidth: 200 }}>
                            {toFaDigits(r.code)} — {r.title}
                            {missing && !locked && <div style={{ color: "var(--danger, #c0392b)", fontSize: 11 }}>در اعلامیه‌ی فعلی ایستگاه فی ندارد؛ ذخیره رد می‌شود</div>}
                          </td>
                          <td data-label="واحد" style={{ color: "var(--ink-soft)" }}>{r.unitTitle}</td>
                          <td data-label="مقدار" style={{ minWidth: 110 }}>
                            <input dir="ltr" inputMode="decimal" style={{ width: 90, textAlign: "center" }} value={r.quantity} disabled={linesLocked} onChange={(e) => update(i, { quantity: e.target.value.replace(/[^\d.]/g, "") })} />
                          </td>
                          <td data-label="فی" style={{ minWidth: 120 }}>
                            {canChangePrice && !locked ? (
                              <input dir="ltr" inputMode="decimal" style={{ width: 110, textAlign: "center" }} value={r.priceOverride !== "" ? r.priceOverride : String(priceOf(r))} onChange={(e) => update(i, { priceOverride: e.target.value.replace(/[^\d.]/g, "") })} title="فی اعلامیه؛ با مجوز «تغییر فی» قابل تغییر است" />
                            ) : (
                              <span title="فی از اعلامیه‌ی قیمت ایستگاه (قفل)">{formatAmountFa(priceOf(r))}</span>
                            )}
                          </td>
                          <td data-label="مبلغ">{formatAmountFa(amountOf(r))}</td>
                          <td data-label="ارزش افزوده">{formatAmountFa(vatOf(r))}</td>
                          <td data-label="شرح" style={{ minWidth: 120 }}>
                            <input value={r.description} disabled={locked} onChange={(e) => update(i, { description: e.target.value })} />
                          </td>
                          <td data-label="" className="mc-actions">
                            <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} disabled={locked} onClick={() => setRows((prev) => prev.filter((_, k) => k !== i))}>حذف</button>
                          </td>
                        </tr>
                      );
                    })}
            </ScrollGridWithTotals>
          </>
        )}
        {editId && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, margin: "16px 0 8px" }}>
              <button
                type="button"
                disabled={!settledNow}
                title={settledNow ? undefined : "تا وقتی فروش تسویه نشده (یا باقیمانده نسیه نشده) فاکتور جدید ممکن نیست"}
                onClick={() => openCard(() => {
                  stageFormPrefill("/store-sales/new", { stationId: header.stationId, shiftId: header.shiftId, shiftDate: header.shiftDate, customerId: station ? String(station.customerId) : "", date: header.date });
                  openTab("/store-sales/new");
                })}
                style={{ minHeight: 110, borderRadius: 16, border: "2px solid var(--accent, #3b6ea8)", background: "var(--surface, #fff)", color: "var(--accent, #3b6ea8)", opacity: settledNow ? 1 : 0.45, cursor: settledNow ? "pointer" : "not-allowed", fontFamily: "inherit", padding: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, touchAction: "manipulation" }}
              >
                <span style={{ fontSize: 24, fontWeight: 800 }}>فاکتور جدید</span>
                <span style={{ fontSize: 15, opacity: 0.85 }}>{settledNow ? "همان شیفت و تاریخ شروع" : "ابتدا فروش را تسویه یا نسیه کنید"}</span>
              </button>
              <button type="button" onClick={() => openCard(() => setCashDialog(true))} style={{ minHeight: 110, borderRadius: 16, border: "2px solid var(--success, #1f9d55)", background: "var(--success-soft, #e6f6ec)", color: "var(--success, #17803f)", cursor: "pointer", fontFamily: "inherit", padding: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, touchAction: "manipulation" }}>
                <span style={{ fontSize: 24, fontWeight: 800 }}>دریافت نقد</span>
                <span style={{ fontSize: 15, opacity: 0.85 }}>جمع دریافت‌شده</span>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{formatAmountFa(cashReceipts.reduce((n, r) => n + r.amount, 0))}</span>
              </button>
              <button type="button" onClick={() => openCard(() => setCardDialog(true))} style={{ minHeight: 110, borderRadius: 16, border: "2px solid var(--warning, #c27a12)", background: "var(--warning-soft, #fdf3e3)", color: "var(--warning, #a8650c)", cursor: "pointer", fontFamily: "inherit", padding: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, touchAction: "manipulation" }}>
                <span style={{ fontSize: 24, fontWeight: 800 }}>دریافت با کارتخوان</span>
                <span style={{ fontSize: 15, opacity: 0.85 }}>جمع دریافت‌شده</span>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{formatAmountFa(cardReceipts.reduce((n, r) => n + r.amount, 0))}</span>
              </button>
              <button type="button" onClick={() => openCard(() => setTransferDialog(true))} style={{ minHeight: 110, borderRadius: 16, border: "2px solid var(--accent, #3b6ea8)", background: "var(--surface, #fff)", color: "var(--accent, #3b6ea8)", cursor: "pointer", fontFamily: "inherit", padding: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, touchAction: "manipulation" }}>
                <span style={{ fontSize: 24, fontWeight: 800 }}>دریافت با حواله</span>
                <span style={{ fontSize: 15, opacity: 0.85 }}>جمع دریافت‌شده</span>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{formatAmountFa(transferReceipts.reduce((n, r) => n + r.amount, 0))}</span>
              </button>
              {clubEnabled && (
                <button type="button" onClick={() => openCard(() => setVoucherDialog(true))} style={{ minHeight: 110, borderRadius: 16, border: "2px solid #a855f7", background: "var(--surface, #fff)", color: "#9333ea", cursor: "pointer", fontFamily: "inherit", padding: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, touchAction: "manipulation" }}>
                  <span style={{ fontSize: 24, fontWeight: 800 }}>دریافت با بن‌کارت</span>
                  <span style={{ fontSize: 15, opacity: 0.85 }}>جمع دریافت‌شده</span>
                  <span style={{ fontSize: 20, fontWeight: 700 }}>{formatAmountFa(voucherReceipts.reduce((n, r) => n + r.amount, 0))}</span>
                </button>
              )}
              <button type="button" onClick={() => openCard(() => setCreditDialog(true))} style={{ minHeight: 110, borderRadius: 16, border: "2px solid var(--danger, #b03a2e)", background: "var(--danger-soft, #fbeae8)", color: "var(--danger, #a32d22)", cursor: "pointer", fontFamily: "inherit", padding: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, touchAction: "manipulation" }}>
                <span style={{ fontSize: 24, fontWeight: 800 }}>نسیه</span>
                <span style={{ fontSize: 15, opacity: 0.85 }}>{credit.declared ? "مبلغ نسیه" : "ثبت باقیمانده به‌عنوان نسیه"}</span>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{formatAmountFa(credit.declared ? payInfo.remaining : 0)}</span>
              </button>
              {hasPermission("store-sales.operations.store-returns.create") && (
                <button type="button" onClick={() => openCard(() => openTab(`/store-returns/new?saleId=${editId}`))} style={{ minHeight: 110, borderRadius: 16, border: "2px solid var(--danger, #b03a2e)", background: "var(--surface, #fff)", color: "var(--danger, #a32d22)", cursor: "pointer", fontFamily: "inherit", padding: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, touchAction: "manipulation" }}>
                  <span style={{ fontSize: 24, fontWeight: 800 }}>برگشت فروش</span>
                  <span style={{ fontSize: 15, opacity: 0.85 }}>ثبت برگشت برای این فروش</span>
                </button>
              )}
              {/* کارکرد کارت چاپ بعداً تعریف می‌شود؛ فعلاً فقط کارت است */}
              <button type="button" style={{ minHeight: 110, borderRadius: 16, border: "2px solid var(--ink-soft, #6b7280)", background: "var(--surface, #fff)", color: "var(--ink-soft, #4b5563)", cursor: "pointer", fontFamily: "inherit", padding: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, touchAction: "manipulation" }}>
                <span style={{ fontSize: 24, fontWeight: 800 }}>چاپ</span>
              </button>
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 13 }}>
              قابل پرداخت: <b>{formatAmountFa(payInfo.payable)}</b> — دریافت‌شده: <b>{formatAmountFa(payInfo.paid)}</b> — باقی‌مانده: <b>{formatAmountFa(payInfo.remaining)}</b> — وضعیت: <span className="badge">{PAYMENT_FA[payInfo.status]}</span>
            </p>
            {creditDialog && (
              <Modal title="نسیه" onClose={() => setCreditDialog(false)}>
                {credit.declared ? (
                  <>
                    <p style={{ fontSize: 16, margin: "8px 0 12px" }}>
                      مبلغ <b>{formatAmountFa(payInfo.remaining)}</b> به‌صورت نسیه ثبت شده است{credit.note ? ` — ${credit.note}` : ""}. تا وقتی نسیه ثبت است ویرایش و حذف فروش بسته است.
                    </p>
                    <div className="actions" style={{ gap: 12, marginTop: 10 }}>
                      {canDeclareCredit && <button type="button" className="btn" onClick={async () => { await revokeCredit(); setCreditDialog(false); }}>لغو نسیه</button>}
                      <button type="button" className="btn secondary" onClick={() => setCreditDialog(false)}>بستن</button>
                    </div>
                  </>
                ) : payInfo.remaining <= 0 ? (
                  <p style={{ fontSize: 16, margin: "8px 0 12px" }}>این فروش باقیمانده‌ای ندارد؛ نسیه‌ای برای ثبت نیست.</p>
                ) : !canDeclareCredit ? (
                  <p style={{ fontSize: 16, margin: "8px 0 12px" }}>شما مجوز «ثبت نسیه» ندارید.</p>
                ) : (
                  <>
                    <p style={{ fontSize: 16, margin: "8px 0 12px" }}>
                      مبلغ <b>{formatAmountFa(payInfo.remaining)}</b> به‌صورت نسیه ثبت شود؟ بعد از آن ویرایش و حذف فروش بسته می‌شود (با «لغو نسیه» باز می‌شود).
                    </p>
                    <div className="form-field"><label>توضیح (اختیاری)</label><input value={creditNote} onChange={(e) => setCreditNote(e.target.value)} /></div>
                    <div className="actions" style={{ gap: 12, marginTop: 10 }}>
                      <button type="button" className="btn" onClick={declareCredit}>بله، نسیه ثبت شود</button>
                      <button type="button" className="btn secondary" onClick={() => setCreditDialog(false)}>انصراف</button>
                    </div>
                  </>
                )}
              </Modal>
            )}
            {cardDialog && (
              <StoreCardReceiptDialog
                mode="CARD"
                payees={cardPayees}
                remaining={payInfo.remaining}
                decimalPlaces={dp}
                busy={paying}
                existing={toExisting(cardReceipts)}
                canEdit={canEditReceipt}
                canDelete={canDeleteReceipt}
                canAdd={canReceive}
                onSaveExisting={saveReceipt}
                onDeleteExisting={removeReceipt}
                onClose={() => setCardDialog(false)}
                onSubmit={(items) => payBatch("CARD", items)}
              />
            )}
            {voucherDialog && (
              <StoreVoucherDialog
                remaining={payInfo.remaining}
                date={localTodayIso() < header.date ? header.date : localTodayIso()}
                busy={paying}
                existing={toExisting(voucherReceipts)}
                canDelete={canDeleteReceipt}
                canAdd={canReceive}
                onDeleteExisting={removeReceipt}
                onClose={() => setVoucherDialog(false)}
                onSubmit={payVouchers}
              />
            )}
            {transferDialog && (
              <StoreCardReceiptDialog
                mode="TRANSFER"
                payees={transferPayees}
                remaining={payInfo.remaining}
                decimalPlaces={dp}
                busy={paying}
                existing={toExisting(transferReceipts)}
                canEdit={canEditReceipt}
                canDelete={canDeleteReceipt}
                canAdd={canReceive}
                onSaveExisting={saveReceipt}
                onDeleteExisting={removeReceipt}
                onClose={() => setTransferDialog(false)}
                onSubmit={(items) => payBatch("TRANSFER", items)}
              />
            )}
            {cashDialog && (
              <Modal title="دریافت نقد" onClose={() => setCashDialog(false)} wide>
                <h4 style={{ margin: "0 0 6px" }}>دریافت‌های نقدیِ ثبت‌شده</h4>
                <ExistingReceiptsTable receipts={toExisting(cashReceipts)} canEdit={canEditReceipt} canDelete={canDeleteReceipt} onSave={saveReceipt} onDelete={removeReceipt} />
                {canReceive && payInfo.remaining > 0 && (
                  <>
                    <h4 style={{ margin: "16px 0 6px" }}>دریافت نقد جدید</h4>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                      <div className="form-field-inline"><label>تاریخ</label><JalaliDatePicker fiscalYear value={newRec.date} onChange={(v) => setNewRec({ ...newRec, date: v })} /></div>
                      <div className="form-field-inline"><label>مبلغ</label><div style={{ width: 150 }}><AmountInput value={newRec.amount} onChange={(v) => setNewRec({ ...newRec, amount: v })} allowDecimal /></div></div>
                      <div className="form-field-inline"><label>شرح</label><input value={newRec.description} onChange={(e) => setNewRec({ ...newRec, description: e.target.value })} /></div>
                      <button type="button" className="btn" onClick={addReceipt}>ثبت دریافت</button>
                    </div>
                  </>
                )}
              </Modal>
            )}
          </>
        )}
      </form>
      </ShowcaseLayout>
    </FormPage>
  );
}
