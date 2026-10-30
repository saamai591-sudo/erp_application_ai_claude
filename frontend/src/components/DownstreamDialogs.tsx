import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { JalaliDatePicker } from "./JalaliDatePicker";
import { RecordPickerField } from "./RecordPicker";
import { AmountInput } from "./AmountInput";
import { RequiredMark } from "./RequiredMark";
import { api } from "../lib/api";
import { useTabs } from "../lib/TabsContext";
import { stageFormPrefill } from "../lib/formPrefill";
import { showError } from "../lib/toast";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { FiscalPeriodRange, fetchSelectedFiscalPeriod, defaultDocumentDate, validateDocumentDate } from "../lib/fiscalYearDefaultDate";
import { DownstreamAction } from "./DownstreamMenu";

// دیالوگ‌های «راهبری» (پیش‌فاکتور ← حواله فروش، حواله فروش ← فاکتور فروش، رسید انبار خرید ← فاکتور خرید). هر دیالوگ فقط اطلاعاتی را می‌گیرد که سند مبدأ ندارد، سپس داده‌ی پیش‌پر را
// stage می‌کند و تبِ «جدید» فرم مقصد را باز می‌کند؛ ردیف‌ها را خودِ فرم مقصد با همان انتخابگر مبنای خودش می‌گذارد (SalesDeliveries.tsx / SalesInvoices.tsx،
// مصرف takeFormPrefill) و ذخیره از همان POST معمولی می‌گذرد — پس صدور از راهبری و صدور مستقل نتیجه‌ی یکسان دارند.

export interface DeliveryFromQuotePrefill {
  /** یکی از این دو: مبنای پیش‌فاکتور یا سفارش فروش */
  quoteId?: number;
  orderId?: number;
  date: string;
  warehouseId: number;
  partyId: number;
}

export interface OrderFromQuotePrefill {
  quoteId: number;
  date: string;
  customerId: number;
  salesTypeId: number;
  salesCenterId: number;
  currencyId: number;
}

export interface InvoiceFromDeliveryPrefill {
  deliveryId: number;
  date: string;
  customerId: number;
  salesTypeId: number;
  salesCenterId: number;
  currencyId: number;
  fxRate: string;
}

export interface PurchaseInvoiceFromReceiptPrefill {
  receiptId: number;
  date: string;
  vendorInvoiceNumber: string;
  partyId: number;
  purchaseTypeId: number;
  currencyId: number;
  fxRate: string;
}

const NEW_DELIVERY_PATH = "/sales-deliveries/new";
const NEW_INVOICE_PATH = "/sales-invoices/new";
const NEW_ORDER_PATH = "/sales-orders/new";
const NEW_PURCHASE_INVOICE_PATH = "/purchase-invoices/new";

/** تاریخ پیش‌فرض: امروز (اگر در دوره مالی انتخاب‌شده است)، و حداقل تاریخ سند مبدأ */
function initialDate(fp: FiscalPeriodRange | null, sourceDate: string): string {
  const d = defaultDocumentDate(fp);
  const src = sourceDate.slice(0, 10);
  return d && d >= src ? d : src;
}

// ---------------------------------------------------------------------------------------------------------------------------
// پیش‌فاکتور ← حواله فروش
// ---------------------------------------------------------------------------------------------------------------------------

interface QuoteInfo {
  quoteId: number;
  number: number;
  date: string;
  status: string;
  partyId: number;
  partyTitle: string;
  lines: { id: number; goodsItemTitle: string; remaining: number }[];
  reason: string | null;
}
interface WarehouseOption { id: number; code: number; title: string; isActive: boolean }

function QuoteToDeliveryDialog({ sourceId, onClose }: { sourceId: number; onClose: () => void }) {
  const { openTab } = useTabs();
  const [info, setInfo] = useState<QuoteInfo | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [fp, setFp] = useState<FiscalPeriodRange | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([api.get(`/sales-deliveries/from-quote/${sourceId}`), api.get("/warehouses"), fetchSelectedFiscalPeriod()])
      .then(([q, w, period]: [QuoteInfo, WarehouseOption[], FiscalPeriodRange | null]) => {
        if (!alive) return;
        setInfo(q);
        setWarehouses(w.filter((x) => x.isActive));
        setFp(period);
        setDate(initialDate(period, q.date));
      })
      .catch((e) => {
        showError(e.message);
        onClose();
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  function confirm() {
    if (!info) return;
    if (info.reason) return showError(info.reason);
    if (!warehouseId) return showError("انبار الزامی است");
    if (!date) return showError("تاریخ الزامی است");
    if (date < info.date.slice(0, 10)) return showError("تاریخ حواله نمی‌تواند قبل از تاریخ پیش‌فاکتور باشد");
    const dateError = validateDocumentDate(date, fp);
    if (dateError) return showError(dateError);
    const prefill: DeliveryFromQuotePrefill = { quoteId: info.quoteId, date, warehouseId: Number(warehouseId), partyId: info.partyId };
    stageFormPrefill(NEW_DELIVERY_PATH, prefill);
    openTab(NEW_DELIVERY_PATH);
    onClose();
  }

  const warehouse = warehouses.find((w) => String(w.id) === warehouseId);

  return (
    <Modal title="صدور حواله فروش از پیش‌فاکتور" onClose={onClose}>
      {!info ? (
        <p style={{ color: "var(--ink-soft)" }}>در حال بارگذاری…</p>
      ) : (
        <>
          <p style={{ margin: "0 0 10px", fontSize: 13, lineHeight: 1.9 }}>
            پیش‌فاکتور شماره {toFaDigits(String(info.number))} — {info.partyTitle}
            <br />
            ردیف‌های کالای دارای مانده‌ی قابل‌تحویل: <b>{toFaDigits(String(info.lines.length))}</b>
          </p>
          {info.reason && <p style={{ color: "var(--danger, #c0392b)", fontSize: 13 }}>{info.reason}</p>}
          <div className="form-grid">
            <div className="form-field">
              <label>انبار<RequiredMark /></label>
              <RecordPickerField<WarehouseOption>
                title="انتخاب انبار"
                displayValue={warehouse ? `${toFaDigits(String(warehouse.code))} — ${warehouse.title}` : ""}
                rows={warehouses}
                columns={[
                  { header: "کد", render: (w) => toFaDigits(String(w.code)), filterValue: (w) => String(w.code), width: "90px" },
                  { header: "عنوان", render: (w) => w.title, filterValue: (w) => w.title },
                ]}
                onSelect={(w) => setWarehouseId(String(w.id))}
                disabled={!!info.reason}
              />
            </div>
            <div className="form-field">
              <label>تاریخ حواله<RequiredMark /></label>
              <JalaliDatePicker fiscalYear value={date} onChange={setDate} disabled={!!info.reason} />
            </div>
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "6px 0 0" }}>با تایید، فرم «حواله فروش جدید» با همین اطلاعات و ردیف‌های پیش‌فاکتور باز می‌شود؛ سند تا «ذخیره» ساخته نمی‌شود.</p>
          <div className="actions">
            <button type="button" className="btn" onClick={confirm} disabled={!!info.reason}>تایید</button>
            <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------
// پیش‌فاکتور ← سفارش فروش
// ---------------------------------------------------------------------------------------------------------------------------

function QuoteToOrderDialog({ sourceId, onClose }: { sourceId: number; onClose: () => void }) {
  const { openTab } = useTabs();
  const [quote, setQuote] = useState<{ number: number; date: string; status: string; customerId: number; salesTypeId: number; salesCenterId: number; currencyId: number } | null>(null);
  const [lineCount, setLineCount] = useState(0);
  const [fp, setFp] = useState<FiscalPeriodRange | null>(null);
  const [date, setDate] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [q, period] = await Promise.all([api.get(`/sales-quotes/${sourceId}`), fetchSelectedFiscalPeriod()]);
        const d = initialDate(period, q.date);
        const params = new URLSearchParams({ customerId: String(q.customerId), currencyId: String(q.currencyId), salesCenterId: String(q.salesCenterId), destDate: d });
        const lines: { salesQuoteId: number }[] = q.status === "APPROVED" ? await api.get(`/sales-orders/pickable-quote-lines?${params.toString()}`) : [];
        if (!alive) return;
        setQuote(q);
        setFp(period);
        setDate(d);
        setLineCount(lines.filter((l) => l.salesQuoteId === sourceId).length);
      } catch (e: any) {
        showError(e.message);
        onClose();
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  const reason = !quote ? null : quote.status !== "APPROVED" ? "پیش‌فاکتور تایید نشده است؛ ابتدا آن را تایید کنید" : lineCount === 0 ? "هیچ ردیف دارای مانده‌ای در این پیش‌فاکتور نیست" : null;

  function confirm() {
    if (!quote) return;
    if (reason) return showError(reason);
    if (!date) return showError("تاریخ الزامی است");
    if (date < quote.date.slice(0, 10)) return showError("تاریخ سفارش نمی‌تواند قبل از تاریخ پیش‌فاکتور باشد");
    const dateError = validateDocumentDate(date, fp);
    if (dateError) return showError(dateError);
    const prefill: OrderFromQuotePrefill = { quoteId: sourceId, date, customerId: quote.customerId, salesTypeId: quote.salesTypeId, salesCenterId: quote.salesCenterId, currencyId: quote.currencyId };
    stageFormPrefill(NEW_ORDER_PATH, prefill);
    openTab(NEW_ORDER_PATH);
    onClose();
  }

  return (
    <Modal title="صدور سفارش فروش از پیش‌فاکتور" onClose={onClose}>
      {!quote ? (
        <p style={{ color: "var(--ink-soft)" }}>در حال بارگذاری…</p>
      ) : (
        <>
          <p style={{ margin: "0 0 10px", fontSize: 13, lineHeight: 1.9 }}>
            پیش‌فاکتور شماره {toFaDigits(String(quote.number))}
            <br />
            ردیف‌های دارای مانده: <b>{toFaDigits(String(lineCount))}</b>
          </p>
          {reason && <p style={{ color: "var(--danger, #c0392b)", fontSize: 13 }}>{reason}</p>}
          <div className="form-grid">
            <div className="form-field">
              <label>تاریخ سفارش<RequiredMark /></label>
              <JalaliDatePicker fiscalYear value={date} onChange={setDate} disabled={!!reason} />
            </div>
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "6px 0 0" }}>با تایید، فرم «سفارش فروش جدید» با همین اطلاعات و ردیف‌های پیش‌فاکتور باز می‌شود؛ سند تا «ذخیره» ساخته نمی‌شود.</p>
          <div className="actions">
            <button type="button" className="btn" onClick={confirm} disabled={!!reason}>تایید</button>
            <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------
// سفارش فروش ← حواله فروش
// ---------------------------------------------------------------------------------------------------------------------------

interface OrderInfo {
  orderId: number;
  number: number;
  date: string;
  status: string;
  partyId: number;
  partyTitle: string;
  lines: { id: number }[];
  reason: string | null;
}

function OrderToDeliveryDialog({ sourceId, onClose }: { sourceId: number; onClose: () => void }) {
  const { openTab } = useTabs();
  const [info, setInfo] = useState<OrderInfo | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [fp, setFp] = useState<FiscalPeriodRange | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([api.get(`/sales-deliveries/from-order/${sourceId}`), api.get("/warehouses"), fetchSelectedFiscalPeriod()])
      .then(([o, w, period]: [OrderInfo, WarehouseOption[], FiscalPeriodRange | null]) => {
        if (!alive) return;
        setInfo(o);
        setWarehouses(w.filter((x) => x.isActive));
        setFp(period);
        setDate(initialDate(period, o.date));
      })
      .catch((e) => {
        showError(e.message);
        onClose();
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  function confirm() {
    if (!info) return;
    if (info.reason) return showError(info.reason);
    if (!warehouseId) return showError("انبار الزامی است");
    if (!date) return showError("تاریخ الزامی است");
    if (date < info.date.slice(0, 10)) return showError("تاریخ حواله نمی‌تواند قبل از تاریخ سفارش باشد");
    const dateError = validateDocumentDate(date, fp);
    if (dateError) return showError(dateError);
    const prefill: DeliveryFromQuotePrefill = { orderId: info.orderId, date, warehouseId: Number(warehouseId), partyId: info.partyId };
    stageFormPrefill(NEW_DELIVERY_PATH, prefill);
    openTab(NEW_DELIVERY_PATH);
    onClose();
  }

  const warehouse = warehouses.find((w) => String(w.id) === warehouseId);

  return (
    <Modal title="صدور حواله فروش از سفارش فروش" onClose={onClose}>
      {!info ? (
        <p style={{ color: "var(--ink-soft)" }}>در حال بارگذاری…</p>
      ) : (
        <>
          <p style={{ margin: "0 0 10px", fontSize: 13, lineHeight: 1.9 }}>
            سفارش فروش شماره {toFaDigits(String(info.number))} — {info.partyTitle}
            <br />
            ردیف‌های کالای دارای مانده‌ی قابل‌تحویل: <b>{toFaDigits(String(info.lines.length))}</b>
          </p>
          {info.reason && <p style={{ color: "var(--danger, #c0392b)", fontSize: 13 }}>{info.reason}</p>}
          <div className="form-grid">
            <div className="form-field">
              <label>انبار<RequiredMark /></label>
              <RecordPickerField<WarehouseOption>
                title="انتخاب انبار"
                displayValue={warehouse ? `${toFaDigits(String(warehouse.code))} — ${warehouse.title}` : ""}
                rows={warehouses}
                columns={[
                  { header: "کد", render: (w) => toFaDigits(String(w.code)), filterValue: (w) => String(w.code), width: "90px" },
                  { header: "عنوان", render: (w) => w.title, filterValue: (w) => w.title },
                ]}
                onSelect={(w) => setWarehouseId(String(w.id))}
                disabled={!!info.reason}
              />
            </div>
            <div className="form-field">
              <label>تاریخ حواله<RequiredMark /></label>
              <JalaliDatePicker fiscalYear value={date} onChange={setDate} disabled={!!info.reason} />
            </div>
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "6px 0 0" }}>با تایید، فرم «حواله فروش جدید» با همین اطلاعات و ردیف‌های سفارش باز می‌شود؛ سند تا «ذخیره» ساخته نمی‌شود.</p>
          <div className="actions">
            <button type="button" className="btn" onClick={confirm} disabled={!!info.reason}>تایید</button>
            <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------
// حواله فروش ← فاکتور فروش
// ---------------------------------------------------------------------------------------------------------------------------

interface DeliveryInfo {
  deliveryId: number;
  number: number;
  date: string;
  customerId: number | null;
  base: { salesTypeId: number; salesCenterId: number; currencyId: number } | null;
  remainingLineCount: number;
  reason: string | null;
}
interface TitledOption { id: number; code?: number | string; title: string; isActive?: boolean; isBase?: boolean }

function DeliveryToInvoiceDialog({ sourceId, onClose }: { sourceId: number; onClose: () => void }) {
  const { openTab } = useTabs();
  const [info, setInfo] = useState<DeliveryInfo | null>(null);
  const [salesTypes, setSalesTypes] = useState<TitledOption[]>([]);
  const [salesCenters, setSalesCenters] = useState<TitledOption[]>([]);
  const [currencies, setCurrencies] = useState<TitledOption[]>([]);
  const [fp, setFp] = useState<FiscalPeriodRange | null>(null);
  const [date, setDate] = useState("");
  const [salesTypeId, setSalesTypeId] = useState("");
  const [salesCenterId, setSalesCenterId] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [fxRate, setFxRate] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([api.get(`/sales-invoices/from-delivery/${sourceId}`), api.get("/sales-types"), api.get("/sales-centers"), api.get("/currencies"), fetchSelectedFiscalPeriod()])
      .then(([d, st, sc, cu, period]: [DeliveryInfo, TitledOption[], TitledOption[], TitledOption[], FiscalPeriodRange | null]) => {
        if (!alive) return;
        setInfo(d);
        setSalesTypes(st);
        setSalesCenters(sc.filter((x) => x.isActive !== false));
        setCurrencies(cu);
        setFp(period);
        setDate(initialDate(period, d.date));
        if (d.base) {
          // حواله‌ی بر مبنای سفارش/پیش‌فاکتور: نوع فروش، مرکز فروش و ارز از همان مبنا می‌آید و قابل تغییر نیست (فاکتور باید با مبنا یکی باشد)
          setSalesTypeId(String(d.base.salesTypeId));
          setSalesCenterId(String(d.base.salesCenterId));
          setCurrencyId(String(d.base.currencyId));
        } else {
          const base = cu.find((c) => c.isBase);
          if (base) setCurrencyId(String(base.id));
        }
      })
      .catch((e) => {
        showError(e.message);
        onClose();
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  const fromBase = !!info?.base;
  const currency = currencies.find((c) => String(c.id) === currencyId);
  const needsFxRate = !!currency && !currency.isBase;

  function confirm() {
    if (!info) return;
    if (info.reason) return showError(info.reason);
    if (!date) return showError("تاریخ الزامی است");
    if (date < info.date.slice(0, 10)) return showError("تاریخ فاکتور نمی‌تواند قبل از تاریخ حواله باشد");
    const dateError = validateDocumentDate(date, fp);
    if (dateError) return showError(dateError);
    if (!salesTypeId) return showError("نوع فروش الزامی است");
    if (!salesCenterId) return showError("مرکز فروش الزامی است");
    if (!currencyId) return showError("ارز الزامی است");
    if (needsFxRate && !(Number(fxRate) > 0)) return showError("نرخ ارز الزامی است");
    const prefill: InvoiceFromDeliveryPrefill = {
      deliveryId: info.deliveryId,
      date,
      customerId: info.customerId as number,
      salesTypeId: Number(salesTypeId),
      salesCenterId: Number(salesCenterId),
      currencyId: Number(currencyId),
      fxRate: needsFxRate ? fxRate : "",
    };
    stageFormPrefill(NEW_INVOICE_PATH, prefill);
    openTab(NEW_INVOICE_PATH);
    onClose();
  }

  const picker = (title: string, rows: TitledOption[], value: string, set: (v: string) => void) => {
    const cur = rows.find((r) => String(r.id) === value);
    return (
      <RecordPickerField<TitledOption>
        title={title}
        displayValue={cur ? cur.title : ""}
        rows={rows}
        columns={[
          ...(rows.some((r) => r.code != null) ? [{ header: "کد", render: (r: TitledOption) => toFaDigits(String(r.code ?? "")), filterValue: (r: TitledOption) => String(r.code ?? ""), width: "90px" }] : []),
          { header: "عنوان", render: (r) => r.title, filterValue: (r) => r.title },
        ]}
        onSelect={(r) => set(String(r.id))}
        disabled={!!info?.reason || fromBase}
      />
    );
  };

  return (
    <Modal title="صدور فاکتور فروش از حواله" onClose={onClose}>
      {!info ? (
        <p style={{ color: "var(--ink-soft)" }}>در حال بارگذاری…</p>
      ) : (
        <>
          <p style={{ margin: "0 0 10px", fontSize: 13, lineHeight: 1.9 }}>
            حواله فروش شماره {toFaDigits(String(info.number))} — {formatJalaliDate(info.date)}
            <br />
            ردیف‌های قابل‌صورتحساب: <b>{toFaDigits(String(info.remainingLineCount))}</b>
          </p>
          {info.reason && <p style={{ color: "var(--danger, #c0392b)", fontSize: 13 }}>{info.reason}</p>}
          <div className="form-grid">
            <div className="form-field">
              <label>تاریخ فاکتور<RequiredMark /></label>
              <JalaliDatePicker fiscalYear value={date} onChange={setDate} disabled={!!info.reason} />
            </div>
            <div className="form-field">
              <label>نوع فروش<RequiredMark /></label>
              {picker("انتخاب نوع فروش", salesTypes, salesTypeId, setSalesTypeId)}
            </div>
            <div className="form-field">
              <label>مرکز فروش<RequiredMark /></label>
              {picker("انتخاب مرکز فروش", salesCenters, salesCenterId, setSalesCenterId)}
            </div>
            <div className="form-field fx-only">
              <label>ارز<RequiredMark /></label>
              {picker("انتخاب ارز", currencies, currencyId, (v) => { setCurrencyId(v); setFxRate(""); })}
            </div>
            {needsFxRate && (
              <div className="form-field fx-only">
                <label>نرخ ارز<RequiredMark /></label>
                <AmountInput value={fxRate} onChange={setFxRate} allowDecimal disabled={!!info.reason} />
              </div>
            )}
          </div>
          {fromBase && <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "6px 0 0" }}>نوع فروش، مرکز فروش و ارز از سفارش/پیش‌فاکتورِ مبنای این حواله می‌آید و باید با فاکتور یکی باشد.</p>}
          <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "6px 0 0" }}>با تایید، فرم «فاکتور فروش جدید» با ردیف‌های همین حواله باز می‌شود؛ سند تا «ذخیره» ساخته نمی‌شود.</p>
          <div className="actions">
            <button type="button" className="btn" onClick={confirm} disabled={!!info.reason}>تایید</button>
            <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------
// رسید انبار خرید ← فاکتور خرید
// ---------------------------------------------------------------------------------------------------------------------------

interface ReceiptInfo {
  receiptId: number;
  number: number;
  date: string;
  warehouseTitle: string;
  partyId: number | null;
  partyTitle: string | null;
  remainingLineCount: number;
  reason: string | null;
}

function ReceiptToPurchaseInvoiceDialog({ sourceId, onClose }: { sourceId: number; onClose: () => void }) {
  const { openTab } = useTabs();
  const [info, setInfo] = useState<ReceiptInfo | null>(null);
  const [purchaseTypes, setPurchaseTypes] = useState<TitledOption[]>([]);
  const [currencies, setCurrencies] = useState<TitledOption[]>([]);
  const [fp, setFp] = useState<FiscalPeriodRange | null>(null);
  const [date, setDate] = useState("");
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState("");
  const [purchaseTypeId, setPurchaseTypeId] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [fxRate, setFxRate] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([api.get(`/purchase-invoices/from-receipt/${sourceId}`), api.get("/purchase-types"), api.get("/currencies"), fetchSelectedFiscalPeriod()])
      .then(([r, pt, cu, period]: [ReceiptInfo, TitledOption[], TitledOption[], FiscalPeriodRange | null]) => {
        if (!alive) return;
        setInfo(r);
        setPurchaseTypes(pt);
        setCurrencies(cu);
        setFp(period);
        setDate(initialDate(period, r.date));
        const base = cu.find((c) => c.isBase);
        if (base) setCurrencyId(String(base.id));
      })
      .catch((e) => {
        showError(e.message);
        onClose();
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  const currency = currencies.find((c) => String(c.id) === currencyId);
  const needsFxRate = !!currency && !currency.isBase;

  function confirm() {
    if (!info) return;
    if (info.reason) return showError(info.reason);
    if (!date) return showError("تاریخ الزامی است");
    if (date < info.date.slice(0, 10)) return showError("تاریخ فاکتور نمی‌تواند قبل از تاریخ رسید باشد");
    const dateError = validateDocumentDate(date, fp);
    if (dateError) return showError(dateError);
    if (!purchaseTypeId) return showError("نوع خرید الزامی است");
    if (!currencyId) return showError("ارز الزامی است");
    if (needsFxRate && !(Number(fxRate) > 0)) return showError("نرخ ارز الزامی است");
    const prefill: PurchaseInvoiceFromReceiptPrefill = {
      receiptId: info.receiptId,
      date,
      vendorInvoiceNumber: vendorInvoiceNumber.trim(),
      partyId: info.partyId as number,
      purchaseTypeId: Number(purchaseTypeId),
      currencyId: Number(currencyId),
      fxRate: needsFxRate ? fxRate : "",
    };
    stageFormPrefill(NEW_PURCHASE_INVOICE_PATH, prefill);
    openTab(NEW_PURCHASE_INVOICE_PATH);
    onClose();
  }

  const picker = (title: string, rows: TitledOption[], value: string, set: (v: string) => void) => {
    const cur = rows.find((r) => String(r.id) === value);
    return (
      <RecordPickerField<TitledOption>
        title={title}
        displayValue={cur ? cur.title : ""}
        rows={rows}
        columns={[
          ...(rows.some((r) => r.code != null) ? [{ header: "کد", render: (r: TitledOption) => toFaDigits(String(r.code ?? "")), filterValue: (r: TitledOption) => String(r.code ?? ""), width: "90px" }] : []),
          { header: "عنوان", render: (r) => r.title, filterValue: (r) => r.title },
        ]}
        onSelect={(r) => set(String(r.id))}
        disabled={!!info?.reason}
      />
    );
  };

  return (
    <Modal title="صدور فاکتور خرید از رسید انبار" onClose={onClose}>
      {!info ? (
        <p style={{ color: "var(--ink-soft)" }}>در حال بارگذاری…</p>
      ) : (
        <>
          <p style={{ margin: "0 0 10px", fontSize: 13, lineHeight: 1.9 }}>
            رسید انبار شماره {toFaDigits(String(info.number))} — {formatJalaliDate(info.date)}
            {info.warehouseTitle ? ` — ${info.warehouseTitle}` : ""}
            <br />
            طرف مقابل: <b>{info.partyTitle || "—"}</b>
            <br />
            ردیف‌های قابل‌فاکتور: <b>{toFaDigits(String(info.remainingLineCount))}</b>
          </p>
          {info.reason && <p style={{ color: "var(--danger, #c0392b)", fontSize: 13 }}>{info.reason}</p>}
          <div className="form-grid">
            <div className="form-field">
              <label>تاریخ فاکتور<RequiredMark /></label>
              <JalaliDatePicker fiscalYear value={date} onChange={setDate} disabled={!!info.reason} />
            </div>
            <div className="form-field">
              <label>شماره فاکتور فروشنده</label>
              <input value={vendorInvoiceNumber} onChange={(e) => setVendorInvoiceNumber(e.target.value)} disabled={!!info.reason} />
            </div>
            <div className="form-field">
              <label>نوع خرید<RequiredMark /></label>
              {picker("انتخاب نوع خرید", purchaseTypes, purchaseTypeId, setPurchaseTypeId)}
            </div>
            <div className="form-field fx-only">
              <label>ارز<RequiredMark /></label>
              {picker("انتخاب ارز", currencies, currencyId, (v) => { setCurrencyId(v); setFxRate(""); })}
            </div>
            {needsFxRate && (
              <div className="form-field fx-only">
                <label>نرخ ارز<RequiredMark /></label>
                <AmountInput value={fxRate} onChange={setFxRate} allowDecimal disabled={!!info.reason} />
              </div>
            )}
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "6px 0 0" }}>با تایید، فرم «فاکتور خرید جدید» با مبنای «رسید انبار خرید» و همه‌ی ردیف‌های قابل‌فاکتور همین رسید باز می‌شود؛ فی و مبلغ را در فاکتور وارد می‌کنید و سند تا «ذخیره» ساخته نمی‌شود.</p>
          <div className="actions">
            <button type="button" className="btn" onClick={confirm} disabled={!!info.reason}>تایید</button>
            <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------
// اقدام‌های هر فرم مبدأ (کلید مجوز = ایجاد فرم مقصد)
// ---------------------------------------------------------------------------------------------------------------------------

export const QUOTE_DOWNSTREAM_ACTIONS: DownstreamAction[] = [
  { key: "order", label: "صدور سفارش فروش", permission: "sales.operations.sales-orders.create", Dialog: QuoteToOrderDialog },
  { key: "delivery", label: "صدور حواله فروش", permission: "sales.operations.sales-deliveries.create", Dialog: QuoteToDeliveryDialog },
];

export const ORDER_DOWNSTREAM_ACTIONS: DownstreamAction[] = [
  { key: "delivery", label: "صدور حواله فروش", permission: "sales.operations.sales-deliveries.create", Dialog: OrderToDeliveryDialog },
];

export const DELIVERY_DOWNSTREAM_ACTIONS: DownstreamAction[] = [
  { key: "invoice", label: "صدور فاکتور فروش", permission: "sales.operations.sales-invoices.create", Dialog: DeliveryToInvoiceDialog },
];

export const RECEIPT_DOWNSTREAM_ACTIONS: DownstreamAction[] = [
  { key: "purchase-invoice", label: "صدور فاکتور خرید", permission: "supply-chain.operations.purchase-invoices.create", Dialog: ReceiptToPurchaseInvoiceDialog },
];
