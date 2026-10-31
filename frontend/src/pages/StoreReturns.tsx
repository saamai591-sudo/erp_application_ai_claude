import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
import { DescriptionField } from "../components/DescriptionField";
import { ScrollGridWithTotals } from "../components/ScrollGridWithTotals";
import { StorePaymentDialog } from "../components/StorePaymentDialog";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate, localTodayIso } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { showError, showToast } from "../lib/toast";
import { fetchSelectedFiscalPeriod, defaultDocumentDate } from "../lib/fiscalYearDefaultDate";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePermissions } from "../lib/usePermissions";
import { useTabs } from "../lib/TabsContext";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// فروش فروشگاهی › عملیات › «برگشت فروش»: سند مستقل با شیفت + تاریخ (مثل فروش)؛ «فروش مبنا» اختیاری است — با مبنا ردیف‌ها از همان فروش می‌آیند و مقدار برگشتی هر ردیف از «مانده‌ی قابل برگشت» بیشتر نمی‌شود؛ بدون مبنا (مثلاً فروشِ قبل از راه‌اندازی سیستم) کالا با بارکد/جست‌وجو اضافه می‌شود و فی از اعلامیه‌ی قیمت ایستگاه است.
// اثر انبار و حسابداری فقط با «تحویل فروش» بعدی ایستگاه می‌آید (ردیف نوع «برگشت فروش»)؛ بازپرداخت پول با «پرداخت فروشگاهی» (آیکن پرداخت همین فرم). قواعد در سرور (services/storeReturnService.ts).

/** ارقام فارسی/عربی → لاتین (بارکدخوان و تایپ دستی یکسان جست‌وجو شوند) */
const normDigits = (v: string) => v.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

interface RetRow {
  id: number;
  number: number;
  date: string;
  saleId: number | null;
  saleNumber: number | null;
  stationId: number;
  stationTitle: string;
  shiftId: number | null;
  shiftTitle: string;
  shiftDate: string | null;
  customerId: number;
  customerTitle: string;
  description: string;
  amount: number;
  vat: number;
  payable: number;
  paid: number;
  remaining: number;
  deliveryId: number | null;
  deliveryNumber: number | null;
  updatedAt?: string;
  lines?: { saleLineId: number | null; goodsItemId: number; goodsItemCode: string; goodsItemTitle: string; unitTitle: string; quantity: number; unitPrice: number; listPrice: number | null; vatAmount: number }[];
}
interface SaleOpt {
  id: number;
  number: number;
  date: string;
  stationId: number;
  stationTitle: string;
  customerId: number;
  shiftId: number | null;
  shiftDate: string | null;
  customerTitle: string;
  remaining: number;
}
interface LineOpt {
  saleLineId: number;
  goodsItemId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitTitle: string;
  sold: number;
  returned: number;
  remaining: number;
  unitPrice: number;
  amount: number;
  vatAmount: number;
  returnedAmount: number;
  returnedVat: number;
}
interface FreeRow {
  goodsItemId: number;
  code: string;
  title: string;
  unitTitle: string;
  quantity: string;
  /** فیِ دستی (فقط با مجوز تغییر فی)؛ خالی = فی اعلامیه */
  priceOverride: string;
  stored?: { unitPrice: number; vatAmount: number };
}
interface StationOpt {
  id: number;
  code: number;
  title: string;
  customerId: number;
  customerCode: number | null;
  customerTitle: string;
}
interface ShiftOpt {
  id: number;
  title: string;
  stationId: number;
  stationTitle: string;
  startTime: string;
  endTime: string;
}
interface CustomerOpt {
  id: number;
  code: number;
  isActive: boolean;
  party: { detailTitle?: string; name?: string; firstName?: string; lastName?: string; category?: string };
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
  tiers: { minQuantity: number; price: number }[];
  vatRatePercent: number;
}
interface SellableResponse {
  priceListId: number | null;
  priceListNumber: number | null;
  decimalPlaces: number;
  items: Sellable[];
  canChangePrice: boolean;
}
const customerTitleOf = (c: CustomerOpt) => c.party.detailTitle || (c.party.category === "LEGAL" ? c.party.name || "" : `${c.party.firstName || ""} ${c.party.lastName || ""}`.trim());

export default function StoreReturns() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <ReturnForm />;
  if (location.pathname.endsWith("/edit")) return <ReturnForm editId={Number(id)} />;
  return <ReturnList />;
}

function ReturnList() {
  const cacheKey = "/store-returns";
  const [items, setItems] = usePersistedState<RetRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/store-returns").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: RetRow) {
    try {
      await api.del(`/store-returns/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: RetRow) => string, extra: object = {}) => ({ render: (r: RetRow) => f(r), filterType: "string" as const, filterValue: (r: RetRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="برگشت فروش فروشگاهی" text="برگشت کالا/مبلغِ یک فروش فروشگاهی. اثر انبار (ورود کالا) و حسابداری با «تحویل فروش» بعدی ایستگاه می‌آید؛ بازپرداخت پول به مشتری با «پرداخت فروشگاهی» ثبت می‌شود." />
          <NewRecordButton path="/store-returns/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", ...s((r) => toFaDigits(String(r.number))), width: "80px", filterType: "number", filterValue: (r: RetRow) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10), width: "110px" },
          { header: "ایستگاه", ...s((r) => r.stationTitle) },
          { header: "شیفت", ...s((r) => r.shiftTitle), width: "110px" },
          { header: "فروش مبنا", ...s((r) => (r.saleNumber != null ? toFaDigits(String(r.saleNumber)) : "بدون مبنا")), width: "110px" },
          { header: "مشتری", ...s((r) => r.customerTitle) },
          { header: "مبلغ قابل پرداخت", render: (r) => formatAmountFa(r.payable), filterType: "number", filterValue: (r) => r.payable, decimal: true, width: "130px" },
          { header: "پرداخت‌شده", render: (r) => formatAmountFa(r.paid), filterType: "number", filterValue: (r) => r.paid, decimal: true, width: "120px" },
          { header: "باقی‌مانده", render: (r) => formatAmountFa(r.remaining), filterType: "number", filterValue: (r) => r.remaining, decimal: true, width: "120px" },
          { header: "تحویل فروش", ...s((r) => (r.deliveryNumber != null ? toFaDigits(String(r.deliveryNumber)) : "")), width: "100px" },
          { header: "شرح", ...s((r) => r.description) },
        ]}
        rows={items}
        edit={{ path: (r: RetRow) => `/store-returns/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function ReturnForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [qs] = useSearchParams();
  const { hasPermission } = usePermissions();
  const { closeTab, activeTabId } = useTabs();
  const cacheKey = `form:${location.pathname}`;
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", shiftId: "", shiftDate: "", stationId: "", customerId: "", saleId: "", description: "" });
  /** ردیف‌های برگشتِ بدون مبنا (کالا با بارکد/جست‌وجو) */
  const [rows, setRows] = usePersistedState<FreeRow[]>(`${cacheKey}:rows`, []);
  /** مقدار برگشتیِ هر ردیف فروش در برگشتِ دارای مبنا (کلید = saleLineId) */
  const [qty, setQty] = usePersistedState<Record<string, string>>(`${cacheKey}:qty`, {});
  const [meta, setMeta] = useState<{ number: number | null; updatedAt?: string; deliveryId: number | null; deliveryNumber: number | null }>({ number: null, deliveryId: null, deliveryNumber: null });
  const [stations, setStations] = useState<StationOpt[]>([]);
  const [shifts, setShifts] = useState<ShiftOpt[]>([]);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [sales, setSales] = useState<SaleOpt[]>([]);
  const [lines, setLines] = useState<LineOpt[]>([]);
  const [sell, setSell] = useState<SellableResponse | null>(null);
  const [sellError, setSellError] = useState<string | null>(null);
  const [barcode, setBarcode] = useState("");
  const [saleDate, setSaleDate] = useState("");
  const [payTotals, setPayTotals] = useState<{ payable: number; paid: number }>({ payable: 0, paid: 0 });
  const [payOpen, setPayOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { flash } = useSavedFlash();
  const barcodeRef = useRef<HTMLInputElement>(null);
  const locked = !!meta.deliveryId;
  const hasBasis = !!header.saleId;

  // ── بارگذاری اولیه ──
  useEffect(() => {
    async function init() {
      const [st, cu, fp, sh] = await Promise.all([api.get("/sales-stations?activeOnly=true"), api.get("/customers"), fetchSelectedFiscalPeriod(), api.get("/sales-shifts?activeOnly=true")]);
      setStations(st);
      setShifts(sh);
      setCustomers((cu as CustomerOpt[]).filter((c) => c.isActive !== false));
      if (editId) {
        await loadExisting();
      } else if (!hasPersistedState(`${cacheKey}:header`)) {
        const saleId = qs.get("saleId");
        let h = { date: defaultDocumentDate(fp), shiftId: "", shiftDate: "", stationId: "", customerId: "", saleId: "", description: "" };
        if (saleId) {
          // «ثبت برگشت» از فرم فروش: شیفت/ایستگاه/مشتری از خودِ فروش می‌آید
          const rows2: SaleOpt[] = await api.get("/store-returns/returnable-sales");
          const pre = rows2.find((x) => String(x.id) === saleId);
          if (pre) h = { ...h, saleId: String(pre.id), stationId: String(pre.stationId), shiftId: pre.shiftId ? String(pre.shiftId) : "", shiftDate: pre.shiftDate ?? "", customerId: String(pre.customerId), date: h.date < pre.date ? pre.date : h.date };
        }
        setHeader(h);
        setRows([]);
        setQty({});
      }
      setLoaded(true);
    }
    init().catch((e) => setError((e as ApiError).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function loadExisting() {
    const r: RetRow = await api.get(`/store-returns/${editId}`);
    setMeta({ number: r.number, updatedAt: r.updatedAt, deliveryId: r.deliveryId, deliveryNumber: r.deliveryNumber });
    setPayTotals({ payable: r.payable, paid: r.paid });
    if (!hasPersistedState(`${cacheKey}:header`)) {
      setHeader({ date: r.date, shiftId: r.shiftId ? String(r.shiftId) : "", shiftDate: r.shiftDate ?? "", stationId: String(r.stationId), customerId: String(r.customerId), saleId: r.saleId ? String(r.saleId) : "", description: r.description });
      if (r.saleId) {
        setQty(Object.fromEntries((r.lines ?? []).filter((l) => l.saleLineId).map((l) => [String(l.saleLineId), String(l.quantity)])));
        setRows([]);
      } else {
        setQty({});
        setRows((r.lines ?? []).map((l) => ({ goodsItemId: l.goodsItemId, code: l.goodsItemCode, title: l.goodsItemTitle, unitTitle: l.unitTitle, quantity: String(l.quantity), priceOverride: l.listPrice !== null && Math.abs(l.listPrice - l.unitPrice) > 1e-9 ? String(l.unitPrice) : "", stored: { unitPrice: l.unitPrice, vatAmount: l.vatAmount } })));
      }
    }
  }

  const ready = !!header.date && !!header.shiftId && !!header.shiftDate && !!header.stationId;

  // ── فروش‌های قابل‌انتخاب به‌عنوان مبنا (همان ایستگاه) ──
  useEffect(() => {
    if (!header.stationId) { setSales([]); return; }
    api.get(`/store-returns/returnable-sales?stationId=${header.stationId}${editId && header.saleId ? `&saleId=${header.saleId}` : ""}`).then(setSales).catch(() => {});
  }, [header.stationId, editId, header.saleId]);

  // ── ردیف‌های قابل‌برگشتِ فروشِ مبنا ──
  useEffect(() => {
    if (!header.saleId) { setLines([]); return; }
    api.get(`/store-returns/returnable-lines?saleId=${header.saleId}${editId ? `&excludeReturnId=${editId}` : ""}`)
      .then((r: { saleDate: string; lines: LineOpt[] }) => { setLines(r.lines); setSaleDate(r.saleDate); })
      .catch((e) => setError(e.message));
  }, [header.saleId, editId]);

  // ── اقلام قابل‌برگشتِ (ایستگاه، تاریخ) برای بارکد/جست‌وجو و فی ──
  useEffect(() => {
    setSell(null);
    setSellError(null);
    if (!ready) return;
    let dead = false;
    api.get(`/store-returns/sellable-items?stationId=${header.stationId}&date=${header.date}`)
      .then((r: SellableResponse) => {
        if (dead) return;
        setSell(r);
        if (!r.priceListId && !hasBasis) setSellError("برای این ایستگاه در این تاریخ اعلامیه‌ی قیمتی تعریف نشده است؛ برگشتِ بدون مبنا فی را از اعلامیه‌ی قیمت می‌گیرد.");
      })
      .catch((e) => { if (!dead) setSellError((e as ApiError).message); });
    return () => { dead = true; };
  }, [header.stationId, header.date, ready, hasBasis]);

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
  const canChangePrice = !!sell?.canChangePrice;
  const station = stations.find((s) => String(s.id) === header.stationId);
  const shift = shifts.find((x) => String(x.id) === header.shiftId);
  const customer = customers.find((c) => String(c.id) === header.customerId);
  const sale = sales.find((x) => String(x.id) === header.saleId);

  // ── محاسبه‌ی نمایشیِ بدون مبنا (همان فرمول فروش؛ سرور مرجع است) ──
  const qtyOf = (r: FreeRow) => Number(r.quantity) || 0;
  function priceOf(r: FreeRow): number {
    if (r.priceOverride !== "" && canChangePrice) return Number(r.priceOverride) || 0;
    const it = itemMap.get(r.goodsItemId);
    if (!it) return r.stored?.unitPrice ?? 0;
    let price = it.basePrice;
    let best = -1;
    for (const t of it.tiers) if (t.minQuantity <= qtyOf(r) && t.minQuantity > best) { best = t.minQuantity; price = t.price; }
    return price;
  }
  const roundDp = (v: number) => Math.round(v * 10 ** dp) / 10 ** dp;
  const amountOf = (r: FreeRow) => roundDp(qtyOf(r) * priceOf(r));
  function vatOf(r: FreeRow): number {
    const it = itemMap.get(r.goodsItemId);
    if (!it) return r.stored ? r.stored.vatAmount : 0;
    return roundDp((amountOf(r) * it.vatRatePercent) / 100);
  }

  // ── محاسبه‌ی نمایشیِ با مبنا (برگشتِ کامل ردیف = باقیمانده‌ی دقیق، وگرنه متناسب با مقدار) ──
  function calc(l: LineOpt) {
    const q = Number(qty[String(l.saleLineId)] || 0);
    if (!q) return { amount: 0, vat: 0 };
    const full = Math.abs(l.returned + q - l.sold) < 1e-6;
    return full ? { amount: l.amount - l.returnedAmount, vat: l.vatAmount - l.returnedVat } : { amount: (l.amount * q) / l.sold, vat: (l.vatAmount * q) / l.sold };
  }
  const totalAmount = hasBasis ? lines.reduce((n, l) => n + calc(l).amount, 0) : rows.reduce((n, r) => n + amountOf(r), 0);
  const totalVat = hasBasis ? lines.reduce((n, l) => n + calc(l).vat, 0) : rows.reduce((n, r) => n + vatOf(r), 0);

  function addItem(it: Sellable) {
    if (hasBasis) {
      const l = lines.find((x) => x.goodsItemId === it.id);
      if (!l) return showToast(`«${it.title}» در فروشِ مبنا نیست؛ برای کالای خارج از آن فروش، مبنا را خالی کنید`, "error");
      const cur = Number(qty[String(l.saleLineId)] || 0);
      if (cur + 1 > l.remaining + 1e-6) return showToast(`مقدار برگشتیِ «${it.title}» از مانده‌ی قابل برگشت (${l.remaining}) بیشتر می‌شود`, "error");
      setQty((q) => ({ ...q, [String(l.saleLineId)]: String(cur + 1) }));
      return;
    }
    setRows((prev) => {
      const i = prev.findIndex((r) => r.goodsItemId === it.id);
      if (i >= 0) return prev.map((r, k) => (k === i ? { ...r, quantity: String(qtyOf(r) + 1) } : r));
      return [...prev, { goodsItemId: it.id, code: it.fullCode, title: it.title, unitTitle: it.unitTitle, quantity: "1", priceOverride: "" }];
    });
  }
  function onBarcodeEnter() {
    const code = barcode.trim();
    if (!code) return;
    const key = normDigits(code);
    const it = byBarcode.get(key) ?? byCode.get(key);
    if (!it) showToast(`بارکد/کد «${code}» یافت نشد یا کالا در اعلامیه‌ی قیمت این ایستگاه فی ندارد`, "error");
    else addItem(it);
    setBarcode("");
    barcodeRef.current?.focus();
  }
  function update(i: number, patch: Partial<FreeRow>) {
    setRows((prev) => prev.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  }

  function pickSale(x: SaleOpt) {
    setHeader({ ...header, saleId: String(x.id), customerId: String(x.customerId), date: header.date < x.date ? x.date : header.date });
    setQty({});
  }
  function clearSale() {
    setHeader({ ...header, saleId: "" });
    setQty({});
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!header.date) return setError("تاریخ برگشت را انتخاب کنید");
    if (!header.shiftId) return setError("شیفت را انتخاب کنید");
    if (!header.shiftDate) return setError("تاریخ شروع شیفت را وارد کنید");
    if (header.date < header.shiftDate) return setError("تاریخ برگشت نمی‌تواند قبل از تاریخ شروع شیفت باشد");
    const common = { date: header.date, shiftId: Number(header.shiftId), shiftDate: header.shiftDate, description: header.description, updatedAt: meta.updatedAt };
    let body: object;
    if (hasBasis) {
      const bl = lines.map((l) => ({ saleLineId: l.saleLineId, quantity: Number(qty[String(l.saleLineId)] || 0) })).filter((l) => l.quantity > 0);
      if (bl.length === 0) return setError("حداقل یک ردیف با مقدار برگشتی وارد کنید");
      body = { ...common, saleId: Number(header.saleId), lines: bl };
    } else {
      if (rows.length === 0) return setError("حداقل یک ردیف اضافه کنید");
      for (const [i, r] of rows.entries()) if (!(qtyOf(r) > 0)) return setError(`مقدار ردیف ${toFaDigits(String(i + 1))} باید عددی بزرگ‌تر از صفر باشد`);
      body = {
        ...common,
        saleId: null,
        customerId: header.customerId ? Number(header.customerId) : undefined,
        lines: rows.map((r) => ({ goodsItemId: r.goodsItemId, quantity: qtyOf(r), unitPrice: r.priceOverride !== "" && canChangePrice ? Number(r.priceOverride) : undefined })),
      };
    }
    try {
      if (editId) {
        await api.put(`/store-returns/${editId}`, body);
        flash();
        await loadExisting();
      } else {
        const created = await api.post("/store-returns", body);
        flash();
        navigate(`/store-returns/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/store-returns/${editId}`);
      navigate("/store-returns");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  const needShift = !header.shiftId && !locked;
  return (
    <FormPage
      title={editId ? `برگشت فروش فروشگاهی شماره ${toFaDigits(String(meta.number ?? ""))}` : "برگشت فروش فروشگاهی جدید"}
      formId="store-return-form"
      closePath="/store-returns"
      newPath="/store-returns/new"
      onDelete={editId && !locked ? handleDelete : undefined}
      saveDisabled={locked}
      wide
    >
      {needShift && (
        <ShiftPromptDialog
          shifts={header.stationId ? shifts.filter((x) => String(x.stationId) === header.stationId) : shifts}
          defaultDate={header.date}
          onCancel={() => { if (activeTabId) closeTab(activeTabId, { preferPath: "/store-returns" }); }}
          onConfirm={(x, shiftDate) => {
            const st = stations.find((q) => q.id === x.stationId);
            setHeader({ ...header, shiftId: String(x.id), stationId: String(x.stationId), shiftDate, customerId: header.customerId || (st ? String(st.customerId) : "") });
          }}
        />
      )}
      <ShowcaseLayout stationId={header.stationId} sellable={itemMap} onPick={addItem} disabled={locked} visible={ready && !hasBasis && !!sell?.priceListId && !locked}>
      <form id="store-return-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {locked && <div className="alert warn" style={{ marginBottom: 8 }}>این برگشت در تحویل فروش شماره {toFaDigits(String(meta.deliveryNumber ?? ""))} بسته شده و قابل ویرایش یا حذف نیست.</div>}
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
              <label>مشتری <FieldHint label="مشتری" text="پیش‌فرض از ایستگاه می‌آید و قابل تغییر است؛ در برگشتِ دارای مبنا همان مشتری فروش است." /></label>
              <RecordPickerField<CustomerOpt>
                title="انتخاب مشتری"
                disabled={!ready || hasBasis}
                displayValue={customer ? `${toFaDigits(String(customer.code))} — ${customerTitleOf(customer)}` : station ? `${toFaDigits(String(station.customerCode ?? ""))} — ${station.customerTitle}` : ""}
                rows={customers}
                columns={[
                  { header: "کد", render: (x) => toFaDigits(String(x.code)), filterValue: (x) => String(x.code), width: "80px" },
                  { header: "عنوان", render: (x) => customerTitleOf(x), filterValue: (x) => customerTitleOf(x) },
                ]}
                onSelect={(x) => setHeader({ ...header, customerId: String(x.id) })}
              />
            </div>
            <div className="form-field">
              <label>فروش مبنا <FieldHint label="فروش مبنا" text="اختیاری. با انتخاب فروش، ردیف‌ها از همان فروش می‌آیند و مقدار برگشتی از مانده‌ی قابل برگشت بیشتر نمی‌شود. بدون مبنا (مثلاً فروشِ قبل از راه‌اندازی سیستم) کالا با بارکد/جست‌وجو اضافه می‌شود و فی از اعلامیه‌ی قیمتِ ایستگاه می‌آید. مبنا بعد از ثبت قابل تغییر نیست." /></label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <RecordPickerField<SaleOpt>
                    title="انتخاب فروش مبنا"
                    disabled={!!editId || !ready}
                    placeholder="بدون مبنا"
                    displayValue={sale ? `${toFaDigits(String(sale.number))} — ${sale.customerTitle}` : header.saleId ? `فروش ${toFaDigits(header.saleId)}` : ""}
                    rows={sales}
                    columns={[
                      { header: "شماره", render: (x) => toFaDigits(String(x.number)), filterValue: (x) => String(x.number), width: "80px" },
                      { header: "تاریخ", render: (x) => formatJalaliDate(x.date), filterValue: (x) => x.date, width: "100px" },
                      { header: "مشتری", render: (x) => x.customerTitle, filterValue: (x) => x.customerTitle },
                      { header: "مقدار قابل برگشت", render: (x) => formatAmountFa(x.remaining), filterValue: (x) => String(x.remaining), width: "120px" },
                    ]}
                    onSelect={pickSale}
                  />
                </div>
                {!editId && hasBasis && <button type="button" className="btn secondary" onClick={clearSale}>بدون مبنا</button>}
              </div>
            </div>
            <DescriptionField value={header.description} onChange={(v) => setHeader({ ...header, description: v })} />
          </div>
        </fieldset>

        {!ready && <p style={{ opacity: 0.75, margin: "14px 0" }}>ابتدا تاریخ و شیفت را انتخاب کنید.</p>}
        {ready && sellError && !hasBasis && <div className="alert warn" style={{ marginTop: 10 }}>{sellError}</div>}

        {ready && (hasBasis || (sell && sell.priceListId)) && (
          <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: "12px 0 6px" }}>
            {sell && sell.priceListId && (
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
            )}
          </fieldset>
        )}

        {ready && hasBasis && (
          <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
            <ScrollGridWithTotals
              tableClassName="je-lines-table"
              head={<tr>{["کد کالا", "کالا", "واحد", "فروخته‌شده", "قبلاً برگشتی", "قابل برگشت", "مقدار برگشتی", "فی", "مبلغ", "ارزش افزوده"].map((c) => <th key={c}>{c}</th>)}</tr>}
              totals={lines.length === 0 ? [] : [{ cells: ["جمع", null, null, null, null, null, formatAmountFa(lines.reduce((n, l) => n + Number(qty[String(l.saleLineId)] || 0), 0)), null, formatAmountFa(Math.round(totalAmount)), formatAmountFa(Math.round(totalVat))] }]}
            >
              {lines.length === 0 && <tr><td colSpan={10} style={{ textAlign: "center", opacity: 0.7 }}>این فروش ردیفی ندارد</td></tr>}
              {lines.map((l) => {
                const c = calc(l);
                return (
                  <tr key={l.saleLineId}>
                    <td>{toFaDigits(l.goodsItemCode)}</td>
                    <td>{l.goodsItemTitle}</td>
                    <td>{l.unitTitle}</td>
                    <td>{formatAmountFa(l.sold)}</td>
                    <td>{formatAmountFa(l.returned)}</td>
                    <td>{formatAmountFa(l.remaining)}</td>
                    <td style={{ minWidth: 110 }}>
                      <input
                        type="number"
                        step="any"
                        min={0}
                        max={l.remaining}
                        value={qty[String(l.saleLineId)] ?? ""}
                        disabled={l.remaining <= 0}
                        onChange={(e) => setQty({ ...qty, [String(l.saleLineId)]: e.target.value })}
                      />
                    </td>
                    <td>{formatAmountFa(l.unitPrice)}</td>
                    <td>{formatAmountFa(Math.round(c.amount))}</td>
                    <td>{formatAmountFa(Math.round(c.vat))}</td>
                  </tr>
                );
              })}
            </ScrollGridWithTotals>
            {saleDate && <p style={{ fontSize: 12, opacity: 0.7, margin: "6px 0 0" }}>تاریخ فروش: {formatJalaliDate(saleDate)} — تاریخ برگشت نمی‌تواند قبل از آن باشد.</p>}
          </fieldset>
        )}

        {ready && !hasBasis && sell && sell.priceListId && (
          <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
            <ScrollGridWithTotals
              tableClassName="je-lines-table mobile-cards"
              maxHeight="calc(100vh - 560px)"
              head={<tr>{["ردیف", "کالا", "واحد", "مقدار", "فی", "مبلغ", "ارزش افزوده", ""].map((c, i) => <th key={i}>{c}</th>)}</tr>}
              totals={[{ cells: [null, rows.length === 0 ? "بدون ردیف" : `جمع (${toFaDigits(String(rows.length))} ردیف)`, null, null, null, formatAmountFa(totalAmount), formatAmountFa(totalVat), `قابل پرداخت: ${formatAmountFa(totalAmount + totalVat)}`] }]}
            >
              {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", opacity: 0.7 }}>با بارکدخوان یا جست‌وجو کالا اضافه کنید</td></tr>}
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
                      <input dir="ltr" inputMode="decimal" style={{ width: 90, textAlign: "center" }} value={r.quantity} onChange={(e) => update(i, { quantity: e.target.value.replace(/[^\d.]/g, "") })} />
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
                    <td data-label="" className="mc-actions">
                      <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} disabled={locked} onClick={() => setRows((prev) => prev.filter((_, k) => k !== i))}>حذف</button>
                    </td>
                  </tr>
                );
              })}
            </ScrollGridWithTotals>
          </fieldset>
        )}

        {editId && (
          <>
            {hasPermission("store-sales.operations.store-payments.view") && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, margin: "16px 0 8px" }}>
                <button type="button" onClick={() => setPayOpen(true)} style={{ minHeight: 110, borderRadius: 16, border: "2px solid var(--success, #1f9d55)", background: "var(--success-soft, #e6f6ec)", color: "var(--success, #17803f)", cursor: "pointer", fontFamily: "inherit", padding: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, touchAction: "manipulation" }}>
                  <span style={{ fontSize: 24, fontWeight: 800 }}>پرداخت به مشتری</span>
                  <span style={{ fontSize: 15, opacity: 0.85 }}>جمع پرداخت‌شده</span>
                  <span style={{ fontSize: 20, fontWeight: 700 }}>{formatAmountFa(payTotals.paid)}</span>
                </button>
              </div>
            )}
            <p style={{ fontSize: 13, margin: "8px 0 0" }}>
              قابل پرداخت به مشتری: <b>{formatAmountFa(payTotals.payable)}</b> — پرداخت‌شده: <b>{formatAmountFa(payTotals.paid)}</b> — باقی‌مانده: <b>{formatAmountFa(Math.max(0, payTotals.payable - payTotals.paid))}</b>
            </p>
          </>
        )}
      </form>
      </ShowcaseLayout>
      {payOpen && editId && (
        <StorePaymentDialog
          returnId={editId}
          remaining={Math.max(0, payTotals.payable - payTotals.paid)}
          minDate={header.date}
          onClose={() => { setPayOpen(false); loadExisting(); }}
        />
      )}
    </FormPage>
  );
}
