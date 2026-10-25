import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
import { AmountInput } from "../components/AmountInput";
import { localTodayIso } from "../lib/formatDate";

// فروش فروشگاهی › عملیات › «فروش فروشگاهی»: اول تاریخ و ایستگاه انتخاب می‌شود؛ ردیف‌ها با بارکدخوان (فیلد بارکد کالا) یا جست‌وجو اضافه می‌شوند، مقدار پیش‌فرض ۱ و قابل‌تغییر است.
// فی از «اعلامیه قیمت فروش» با حوزه‌ی همان ایستگاه خوانده می‌شود (پله‌ی مقدار هم)؛ کالای بدون فی در آن اعلامیه اصلاً قابل انتخاب نیست. فی فقط با مجوز «تغییر فی» قابل تغییر است.
// سند حسابداری و حواله انبار ندارد؛ تا وقتی «تحویل‌نشده» است تعدادش از موجودی گزارش‌ها کم می‌شود. قواعد نهایی در سرور (services/storeSaleService.ts).

interface StationOpt {
  id: number;
  code: number;
  title: string;
  offering: string;
  customerId: number;
  customerCode: number | null;
  customerTitle: string;
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
interface ListRow {
  id: number;
  number: number;
  date: string;
  stationTitle: string;
  customerTitle: string;
  lineCount: number;
  totalAmount: number;
  totalVat: number;
  payable: number;
  deliveryStatus: "NOT_DELIVERED" | "DELIVERED";
  paid: number;
  remaining: number;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
}
interface ReceiptRow {
  id: number;
  number: number;
  date: string;
  amount: number;
  description: string;
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
          { header: "مشتری", ...s((r) => r.customerTitle) },
          { header: "ردیف", ...n((r) => r.lineCount), width: "70px", decimal: false },
          { header: "مبلغ", ...n((r) => r.totalAmount), width: "120px" },
          { header: "ارزش افزوده", ...n((r) => r.totalVat), width: "120px" },
          { header: "مبلغ قابل پرداخت", ...n((r) => r.payable), width: "140px" },
          { header: "دریافت‌شده", ...n((r) => r.paid), width: "120px" },
          { header: "باقی‌مانده", ...n((r) => r.remaining), width: "120px" },
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
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", stationId: "", customerId: "", description: "" });
  const [rows, setRows] = usePersistedState<Row[]>(`${cacheKey}:rows`, []);
  const [meta, setMeta] = useState<{ number: number; deliveryStatus: "NOT_DELIVERED" | "DELIVERED"; updatedAt?: string } | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [payInfo, setPayInfo] = useState<{ payable: number; paid: number; remaining: number; status: "UNPAID" | "PARTIAL" | "PAID" }>({ payable: 0, paid: 0, remaining: 0, status: "UNPAID" });
  const [newRec, setNewRec] = useState({ date: localTodayIso(), amount: "", description: "" });
  const { hasPermission } = usePermissions();
  const { openTab } = useTabs();
  const [stations, setStations] = useState<StationOpt[]>([]);
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
      const [st, cu, fp] = await Promise.all([api.get("/sales-stations?activeOnly=true"), api.get("/customers"), fetchSelectedFiscalPeriod()]);
      setStations(st);
      setCustomers((cu as CustomerOpt[]).filter((c) => c.isActive !== false));
      if (editId) {
        const d: Detail = await api.get(`/store-sales/${editId}`);
        setMeta({ number: d.number, deliveryStatus: d.deliveryStatus, updatedAt: d.updatedAt });
        setReceipts(d.receipts ?? []);
        setPayInfo({ payable: d.payable, paid: d.paid, remaining: d.remaining, status: d.paymentStatus });
        setNewRec((x) => ({ ...x, date: localTodayIso() < d.date ? d.date : x.date, amount: d.remaining > 0 ? String(d.remaining) : "" }));
        if (!hasPersistedState(`${cacheKey}:header`)) {
          setHeader({ date: d.date, stationId: String(d.stationId), customerId: String(d.customerId), description: d.description });
          setRows(d.lines.map((l) => ({ goodsItemId: l.goodsItemId, code: l.goodsItemCode, title: l.goodsItemTitle, unitTitle: l.unitTitle, quantity: String(l.quantity), priceOverride: "", stored: { unitPrice: l.unitPrice, vatAmount: l.vatAmount }, description: l.description })));
        }
      } else if (!hasPersistedState(`${cacheKey}:header`)) {
        setHeader({ date: defaultDocumentDate(fp), stationId: "", customerId: "", description: "" });
        setRows([]);
      }
      setLoaded(true);
    }
    init().catch((e) => setError((e as ApiError).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // ── اقلام قابل‌فروشِ (ایستگاه، تاریخ) ──
  const ready = !!header.date && !!header.stationId;
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
    for (const i of sell?.items ?? []) if (i.barcode) m.set(i.barcode.trim(), i);
    return m;
  }, [sell]);
  const dp = sell?.decimalPlaces ?? 0;
  const station = stations.find((s) => String(s.id) === header.stationId);
  const customer = customers.find((c) => String(c.id) === header.customerId);
  const delivered = !!editId && meta?.deliveryStatus === "DELIVERED";
  const hasReceipts = !!editId && receipts.length > 0;
  const locked = delivered || hasReceipts;
  const canReceive = !!editId && hasPermission("store-sales.operations.store-receipts.create");
  const canDeleteReceipt = hasPermission("store-sales.operations.store-receipts.delete");
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
    const it = byBarcode.get(code);
    if (!it) {
      showToast(`بارکد «${code}» یافت نشد یا کالا در اعلامیه‌ی قیمت این ایستگاه فی ندارد`, "error");
    } else addItem(it);
    setBarcode("");
    barcodeRef.current?.focus();
  }
  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!header.date) return setError("تاریخ فروش را انتخاب کنید");
    if (!header.stationId) return setError("ایستگاه فروش را انتخاب کنید");
    if (rows.length === 0) return setError("حداقل یک ردیف اضافه کنید");
    for (const [i, r] of rows.entries()) if (!(qtyOf(r) > 0)) return setError(`مقدار ردیف ${toFaDigits(String(i + 1))} باید عددی بزرگ‌تر از صفر باشد`);
    const body = {
      date: header.date,
      stationId: Number(header.stationId),
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
        setPayInfo({ payable: d.payable, paid: d.paid, remaining: d.remaining, status: d.paymentStatus });
        setNewRec((x) => ({ ...x, date: localTodayIso() < d.date ? d.date : x.date, amount: d.remaining > 0 ? String(d.remaining) : "" }));
      } else {
        const created = await api.post("/store-sales", body);
        flash();
        navigate(`/store-sales/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function reloadSale() {
    const d: Detail = await api.get(`/store-sales/${editId}`);
    setMeta({ number: d.number, deliveryStatus: d.deliveryStatus, updatedAt: d.updatedAt });
    setReceipts(d.receipts ?? []);
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
  async function removeReceipt(r: ReceiptRow) {
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
  const linesLocked = locked || !sell || !sell.priceListId;
  return (
    <FormPage title={editId ? `فروش فروشگاهی شماره ${toFaDigits(String(meta?.number ?? ""))}` : "فروش فروشگاهی جدید"} formId="store-sale-form" closePath="/store-sales" newPath="/store-sales/new" onDelete={editId && !locked ? handleDelete : undefined} saveDisabled={locked}>
      <form id="store-sale-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {delivered && <div className="alert warn">این فروش تحویل شده است و قابل ویرایش یا حذف نیست.</div>}
        {!delivered && hasReceipts && <div className="alert warn">برای این فروش دریافت ثبت شده است؛ برای ویرایش یا حذف فروش ابتدا دریافت‌ها را حذف کنید.</div>}
        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid">
            <div className="form-field">
              <label>تاریخ<RequiredMark /></label>
              <JalaliDatePicker fiscalYear value={header.date} onChange={(v) => setHeader({ ...header, date: v })} />
            </div>
            <div className="form-field">
              <label>ایستگاه فروش<RequiredMark /> <FieldHint label="ایستگاه فروش" text="اول تاریخ و ایستگاه را انتخاب کنید؛ فی و اقلام قابل‌فروش از اعلامیه‌ی قیمتِ همین ایستگاه می‌آید. بعد از ثبت، ایستگاه قابل تغییر نیست." /></label>
              <RecordPickerField<StationOpt>
                title="انتخاب ایستگاه فروش"
                disabled={!!editId || (rows.length > 0 && !editId)}
                displayValue={station ? `${toFaDigits(String(station.code))} — ${station.title}` : ""}
                rows={stations}
                columns={[
                  { header: "کد", render: (x) => toFaDigits(String(x.code)), filterValue: (x) => String(x.code), width: "80px" },
                  { header: "عنوان", render: (x) => x.title, filterValue: (x) => x.title },
                ]}
                onSelect={(x) => setHeader({ ...header, stationId: String(x.id), customerId: String(x.customerId) })}
              />
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
                <label style={{ fontWeight: 600 }}>بارکد</label>
                <input
                  ref={barcodeRef}
                  dir="ltr"
                  autoFocus={!editId}
                  style={{ width: 220, textAlign: "center" }}
                  placeholder="بارکد را اسکن کنید و Enter بزنید"
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

            <div className="grid-wrap je-lines-wrap">
              <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
                <table className="je-lines-table mobile-cards">
                  <thead>
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
                  </thead>
                  <tbody>
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
                  </tbody>
                </table>
              </div>
              <div className="grid-footer je-lines-footer">
                <span className="grid-footer-info">{rows.length === 0 ? "بدون ردیف" : `${toFaDigits(String(rows.length))} ردیف`}</span>
                <span className="je-lines-totals">
                  جمع مبلغ: {formatAmountFa(totalAmount)} — ارزش افزوده: {formatAmountFa(totalVat)} — <b>قابل پرداخت: {formatAmountFa(totalAmount + totalVat)}</b>
                </span>
              </div>
            </div>
          </>
        )}
        {editId && (
          <div className="card" style={{ marginTop: 16, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>دریافت (نقد)</h4>
              {hasPermission("store-sales.operations.store-receipts.create") && payInfo.remaining > 0 && (
                <button type="button" className="link-btn" onClick={() => openTab(`/store-receipts/new?saleId=${editId}`)}>دریافت جدید در فرم کامل ←</button>
              )}
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 13 }}>
              قابل پرداخت: <b>{formatAmountFa(payInfo.payable)}</b> — دریافت‌شده: <b>{formatAmountFa(payInfo.paid)}</b> — باقی‌مانده: <b>{formatAmountFa(payInfo.remaining)}</b> — وضعیت: <span className="badge">{PAYMENT_FA[payInfo.status]}</span>
            </p>
            <table className="je-lines-table">
              <thead>
                <tr><th>شماره</th><th>تاریخ</th><th>مبلغ</th><th>شرح</th><th></th></tr>
              </thead>
              <tbody>
                {receipts.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", opacity: 0.7 }}>دریافتی ثبت نشده است</td></tr>}
                {receipts.map((r) => (
                  <tr key={r.id}>
                    <td>{hasPermission("store-sales.operations.store-receipts.view") ? <button type="button" className="link-btn" onClick={() => openTab(`/store-receipts/${r.id}/edit`)}>{toFaDigits(String(r.number))}</button> : toFaDigits(String(r.number))}</td>
                    <td>{formatJalaliDate(r.date)}</td>
                    <td>{formatAmountFa(r.amount)}</td>
                    <td>{r.description}</td>
                    <td>{canDeleteReceipt && <button type="button" className="btn danger" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => removeReceipt(r)}>حذف</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {canReceive && payInfo.remaining > 0 && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginTop: 10 }}>
                <div className="form-field-inline"><label>تاریخ</label><JalaliDatePicker fiscalYear value={newRec.date} onChange={(v) => setNewRec({ ...newRec, date: v })} /></div>
                <div className="form-field-inline"><label>مبلغ</label><div style={{ width: 150 }}><AmountInput value={newRec.amount} onChange={(v) => setNewRec({ ...newRec, amount: v })} allowDecimal /></div></div>
                <div className="form-field-inline"><label>شرح</label><input value={newRec.description} onChange={(e) => setNewRec({ ...newRec, description: e.target.value })} /></div>
                <button type="button" className="btn" onClick={addReceipt}>ثبت دریافت</button>
              </div>
            )}
          </div>
        )}
      </form>
    </FormPage>
  );
}
