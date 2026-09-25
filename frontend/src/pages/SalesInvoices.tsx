import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError, showToast } from "../lib/toast";
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
import { SalesType } from "./SalesTypes";
import { SalesCenter } from "./SalesCenters";
import { FiscalPeriodRange, fetchSelectedFiscalPeriod, defaultDocumentDate, validateDocumentDate } from "../lib/fiscalYearDefaultDate";
import { resolveVatRatePercent, computeLineVat } from "../lib/vatCalculation";
import { useVatRates, vatRateForDate } from "../lib/useVatRates";
import { toBaseCurrencyAmount } from "../lib/currencyConversion";
import { Modal } from "../components/Modal";

// «فاکتور فروش نهایی» — آخرین سند زنجیره فروش. مبنا: بدون مبنا / حواله فروش. برخلاف فاکتور خرید
// (که هر ردیف رسید انبار خرید را دقیقاً یک‌بار و کامل مصرف می‌کرد)، اینجا طبق تصمیم صریح کاربر رابطه
// «مانده‌ای» است (مشتری ممکن است طی چند حواله یک فاکتور بگیرد). فقط ثبت در این فاز — بدون اکشن تایید
// (رجوع کنید به یادداشت بالای backend/src/routes/salesInvoices.ts).
//
// طبق تصمیم صریح کاربر (۱۴۰۵/۰۶/۱۷): نوع فروش/نرخ ارز/ارزش‌افزوده دقیقاً هم‌معماری فاکتور خرید پیاده
// شده‌اند (نگاه کنید به PurchaseInvoices.tsx) — هدر «نوع فروش» + fxRate (فقط وقتی ارز فاکتور غیر از ارز
// مبنا باشد نمایش داده می‌شود)، هر ردیف تخفیف/ارزش‌افزوده (که همیشه به ارز مبنا محاسبه می‌شود).
//
// طبق Documents/SaleInvoiceVoucher.md و تصمیم صریح کاربر (۱۴۰۵/۰۶/۱۸): چون این سند اصلاً وضعیت «تایید»
// ندارد، «صدور سند حسابداری» مستقیماً از همان وضعیت «ثبت» انجام می‌شود (نه پس از یک تایید جدا، برخلاف
// فاکتور خرید/فاکتور خرید خدمات) — با صدور سند، فرم قفل می‌شود.

type Basis = "NO_BASIS" | "SALES_DELIVERY";

interface CustomerOption { id: number; code: number; party: { category: "INDIVIDUAL" | "LEGAL"; firstName: string | null; lastName: string | null; name: string | null } }
interface CurrencyOption { id: number; code: string; title: string; isBase: boolean; decimalPlaces: number; baseVolume: number; rateDirection: "TO_BASE" | "FROM_BASE" | null }
interface GoodsItemRow { id: number; fullCode: string; title: string; mainUnitId: number; mainUnit?: { title: string }; isActive: boolean; isSpecial: boolean; taxRate: number | string | null }
interface PickableLine { id: number; sourceInventoryLineId: number; salesDeliveryId: number; number: number; date: string; goodsItemId: number; goodsItemCode: string; goodsItemTitle: string; unitId: number; unitTitle: string; quantity: number; done: number; remaining: number }

function customerTitle(c: CustomerOption): string {
  return c.party.category === "LEGAL" ? c.party.name || "" : `${c.party.firstName || ""} ${c.party.lastName || ""}`.trim();
}

interface ListRow { id: number; number: number; date: string; basis: Basis; customerId: number; customerTitle: string; salesTypeId: number; salesTypeTitle: string | null; salesCenterId: number; salesCenterTitle: string | null; currencyTitle: string; status: "DRAFT"; journalEntryReferenceNumber: number | null; lineCount: number; totalAmount: number }
interface DetailLine { id: number; sourceInventoryLineId: number | null; goodsItemId: number; goodsItemCode: string; goodsItemTitle: string; unitId: number; unitTitle: string; quantity: number; unitPrice: number; amount: number; discount: number; vatAmount: number; description: string | null }
interface Detail extends ListRow { currencyId: number; fxRate: number; description: string | null; journalEntryId: number | null; journalEntryReferenceNumber: number | null; lines: DetailLine[] }

const BASIS_FA: Record<Basis, string> = { NO_BASIS: "بدون مبنا", SALES_DELIVERY: "حواله فروش" };
const INFO_TEXT = "ثبت فاکتور فروش نهایی برای مشتری — بدون مبنا یا بر اساس یک یا چند حواله فروش «قطعی»‌شده. در این فاز فقط ثبت می‌شود (بدون اکشن تایید).";

export default function SalesInvoices() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <SalesInvoiceForm />;
  if (isEdit) return <SalesInvoiceForm editId={Number(id)} />;
  return <SalesInvoiceList />;
}

function PlusIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}
function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M7 8H4V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 8A8 8 0 1 1 4 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

function SalesInvoiceList() {
  const cacheKey = "/sales-invoices";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    try {
      setItems(await api.get("/sales-invoices"));
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
      await api.del(`/sales-invoices/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="فاکتور فروش" />
          <NewRecordButton path="/sales-invoices/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "مبنا", render: (r) => BASIS_FA[r.basis], filterType: "string", filterValue: (r) => BASIS_FA[r.basis] },
          { header: "مشتری", render: (r) => r.customerTitle, filterType: "string", filterValue: (r) => r.customerTitle },
          { header: "نوع فروش", render: (r) => r.salesTypeTitle || "—", filterType: "string", filterValue: (r) => r.salesTypeTitle || "" },
          { header: "مرکز فروش", render: (r) => r.salesCenterTitle || "—", filterType: "string", filterValue: (r) => r.salesCenterTitle || "" },
          { header: "مبلغ کل", render: (r) => formatAmountFa(r.totalAmount), filterType: "number", filterValue: (r) => r.totalAmount, decimal: true },
        ]}
        rows={items}
        edit={{ path: (r) => `/sales-invoices/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

interface RowState { sourceInventoryLineId: string; goodsItemId: string; goodsItemCode: string; goodsItemTitle: string; unitId: string; unitTitle: string; quantity: string; unitPrice: string; amount: string; discount: string; vatAmount: string; description: string }

function emptyRow(): RowState {
  return { sourceInventoryLineId: "", goodsItemId: "", goodsItemCode: "", goodsItemTitle: "", unitId: "", unitTitle: "", quantity: "", unitPrice: "", amount: "", discount: "", vatAmount: "", description: "" };
}

function SalesInvoiceForm({ editId }: { editId?: number }) {
  const vatRates = useVatRates();
  // «تخصیص پیش‌دریافت»: عملیات مستقل از ثبت/ویرایش فاکتور (Documents/تخصیص پیش دریافت.md)
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advance, setAdvance] = useState<{ total: number; allocatedTotal: number; payable: number } | null>(null);
  async function loadAdvance() {
    if (!editId) return setAdvance(null);
    try {
      const s: AdvanceState = await api.get(`/sales-invoices/${editId}/advance-allocations`);
      setAdvance({ total: s.invoice.total, allocatedTotal: s.allocatedTotal, payable: s.payable });
    } catch {
      setAdvance(null);
    }
  }
  useEffect(() => {
    loadAdvance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);
  const navigate = useNavigate();
  const { openTab } = useTabs();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [salesTypes, setSalesTypes] = useState<SalesType[]>([]);
  const [salesCenters, setSalesCenters] = useState<SalesCenter[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [goodsItems, setGoodsItems] = useState<GoodsItemRow[]>([]);
  const [pickableLines, setPickableLines] = useState<PickableLine[]>([]);
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", basis: "NO_BASIS" as Basis, customerId: "", salesTypeId: "", salesCenterId: "", currencyId: "", fxRate: "", description: "" });
  const [rows, setRows] = usePersistedState<RowState[]>(`${cacheKey}:rows`, []);
  const [meta, setMeta] = usePersistedState<{ number: number; journalEntryId: number | null; journalEntryReferenceNumber: number | null } | null>(
    `${cacheKey}:meta`,
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fiscalPeriod, setFiscalPeriod] = useState<FiscalPeriodRange | null>(null);
  const { flash } = useSavedFlash();

  useEffect(() => {
    async function init() {
      const [cu, st, sc, c, g, fp] = await Promise.all([
        api.get("/customers"),
        api.get("/sales-types"),
        api.get("/sales-centers"),
        api.get("/currencies"),
        api.get("/goods-items?kind=GOODS"),
        fetchSelectedFiscalPeriod(),
      ]);
      setCustomers((cu as any[]).filter((x) => x.isActive));
      setSalesTypes(st);
      setSalesCenters((sc as any[]).filter((x) => x.isActive));
      setCurrencies(c);
      setGoodsItems(g);
      setFiscalPeriod(fp);

      if (hasPersistedState(`${cacheKey}:header`)) {
        setLoaded(true);
        return;
      }
      if (editId) {
        const d: Detail = await api.get(`/sales-invoices/${editId}`);
        setMeta({ number: d.number, journalEntryId: d.journalEntryId, journalEntryReferenceNumber: d.journalEntryReferenceNumber });
        setHeader({
          date: d.date.slice(0, 10),
          basis: d.basis,
          customerId: String(d.customerId),
          salesTypeId: String(d.salesTypeId),
          salesCenterId: String(d.salesCenterId),
          currencyId: String(d.currencyId),
          fxRate: String(d.fxRate),
          description: d.description || "",
        });
        setRows(
          d.lines.map((l) => ({
            sourceInventoryLineId: l.sourceInventoryLineId ? String(l.sourceInventoryLineId) : "",
            goodsItemId: String(l.goodsItemId),
            goodsItemCode: l.goodsItemCode,
            goodsItemTitle: l.goodsItemTitle,
            unitId: String(l.unitId),
            unitTitle: l.unitTitle,
            quantity: String(l.quantity),
            unitPrice: String(l.unitPrice),
            amount: String(l.amount),
            discount: String(l.discount || 0),
            vatAmount: String(l.vatAmount || 0),
            description: l.description || "",
          }))
        );
      } else {
        setHeader({ date: defaultDocumentDate(fp), basis: "NO_BASIS", customerId: "", salesTypeId: "", salesCenterId: "", currencyId: "", fxRate: "", description: "" });
        setRows([emptyRow()]);
        setMeta(null);
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  useEffect(() => {
    if (header.basis !== "SALES_DELIVERY") {
      setPickableLines([]);
      return;
    }
    const params = new URLSearchParams();
    if (header.date) params.set("destDate", header.date);
    if (editId) params.set("excludeInvoiceId", String(editId));
    api.get(`/sales-invoices/pickable-sales-delivery-lines?${params.toString()}`).then(setPickableLines).catch(() => setPickableLines([]));
  }, [header.basis, header.date, editId]);

  // با صدور سند حسابداری، کل فرم (سرصفحه + ردیف‌ها) قفل می‌شود — دقیقاً هم‌الگوی PurchaseInvoices.tsx
  // (آن‌جا شرط قفل «تایید+صدور سند» بود، اینجا چون تاییدی وجود ندارد، فقط «صدور سند»).
  const locked = !!meta?.journalEntryId;
  const hasAnyLine = rows.some((r) => r.goodsItemId || r.sourceInventoryLineId);
  // طبق تصمیم صریح کاربر: به‌محض این‌که یک ردیف انتخاب/وارد شده باشد، کل سرصفحه (از جمله تاریخ) قفل
  // می‌شود — چون ردیف‌ها بر اساس سرصفحه (مشتری/تاریخ) انتخاب و ثبت شده‌اند و تغییر بعدی سرصفحه
  // ناسازگاری ایجاد می‌کند.
  const headerDisabled = locked || hasAnyLine;
  const selectedCurrency = currencies.find((c) => String(c.id) === header.currencyId);
  const baseCurrency = currencies.find((c) => c.isBase);
  // ارز فاکتور غیر از ارز مبنا باشد → نرخ ارز الزامی و به کاربر نمایش داده می‌شود؛ اگر ارز مبنا باشد،
  // فیلد نرخ اصلاً نمایش داده نمی‌شود ولی همیشه ۱ به سرور فرستاده می‌شود — دقیقاً هم‌الگوی
  // PurchaseInvoices.tsx.
  const needsFxRate = !!selectedCurrency && !selectedCurrency.isBase;
  // مبلغ/تخفیف ردیف را به ارز مبنا تبدیل می‌کند — دقیقاً همان فرمول سرور (lib/currencyConversion.ts) —
  // فقط برای پیش‌نمایش زنده‌ی ارزش‌افزوده در فرم؛ مقدار به‌ارز‌مبنای واقعی صرفاً در بک‌اند محاسبه و
  // ذخیره می‌شود.
  function toBaseAmount(amount: number): number {
    if (!selectedCurrency || selectedCurrency.isBase) return amount;
    if (!baseCurrency) return 0;
    const fxRate = Number(header.fxRate) || 0;
    if (!(fxRate > 0)) return 0;
    return toBaseCurrencyAmount(amount, fxRate, selectedCurrency, baseCurrency);
  }

  // طبق تصمیم صریح کاربر: تا وقتی فیلدهای الزامی سرصفحه (تاریخ/مشتری/نوع فروش/ارز/نرخ ارز) کامل نشده،
  // ورود اطلاعات ردیف مجاز نیست — اولین تلاش برای باز کردن انتخابگر کالا/ردیف مبنا باید با پیام خطا رد شود.
  function guardRowEntry(): boolean {
    if (!header.date) {
      setError("تاریخ الزامی است");
      return false;
    }
    if (!header.customerId) {
      setError("مشتری الزامی است");
      return false;
    }
    if (!header.salesTypeId) {
      setError("نوع فروش الزامی است");
      return false;
    }
    if (!header.salesCenterId) {
      setError("مرکز فروش الزامی است");
      return false;
    }
    if (!header.currencyId) {
      setError("ارز الزامی است");
      return false;
    }
    if (needsFxRate && !(Number(header.fxRate) > 0)) {
      setError("نرخ ارز الزامی است");
      return false;
    }
    setError(null);
    return true;
  }

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  // مقدار پیشنهادی مالیات بر ارزش افزوده — طبق تصمیم صریح کاربر، همیشه به ارز مبنا محاسبه می‌شود (نه
  // ارز فاکتور)؛ این فقط پیش‌فرض اولیه است؛ کاربر بعد از محاسبه می‌تواند خودش مقدار مالیات را مستقیماً
  // ویرایش کند — دقیقاً هم‌الگوی PurchaseInvoices.tsx.
  function computeSuggestedVat(amount: number, discount: number, goodsItemId: string): string {
    const item = goodsItems.find((g) => g.id === Number(goodsItemId));
    return String(computeLineVat(toBaseAmount(amount), toBaseAmount(discount), resolveVatRatePercent(item, vatRateForDate(vatRates, header.date))));
  }
  function onSourceLineChange(idx: number, sourceInventoryLineId: string) {
    const src = pickableLines.find((l) => String(l.sourceInventoryLineId) === sourceInventoryLineId);
    if (!src) return;
    updateRow(idx, {
      sourceInventoryLineId,
      goodsItemId: String(src.goodsItemId),
      goodsItemCode: src.goodsItemCode,
      goodsItemTitle: src.goodsItemTitle,
      unitId: String(src.unitId),
      unitTitle: src.unitTitle,
      quantity: String(src.remaining),
    });
  }
  function onQuantityChange(idx: number, quantity: string) {
    const row = rows[idx];
    if (row.unitPrice) {
      const amount = Math.round(Number(row.unitPrice) * (Number(quantity) || 0) * 100) / 100;
      updateRow(idx, { quantity, amount: String(amount), vatAmount: computeSuggestedVat(amount, Number(row.discount) || 0, row.goodsItemId) });
    } else {
      updateRow(idx, { quantity });
    }
  }
  function onUnitPriceChange(idx: number, unitPrice: string) {
    const row = rows[idx];
    const amount = Math.round(Number(unitPrice) * (Number(row.quantity) || 0) * 100) / 100;
    updateRow(idx, { unitPrice, amount: String(amount), vatAmount: computeSuggestedVat(amount, Number(row.discount) || 0, row.goodsItemId) });
  }
  function onAmountChange(idx: number, amount: string) {
    const row = rows[idx];
    const qty = Number(row.quantity) || 0;
    const unitPrice = qty > 0 ? Math.round((Number(amount) / qty) * 10000) / 10000 : 0;
    updateRow(idx, { amount, unitPrice: String(unitPrice), vatAmount: computeSuggestedVat(Number(amount) || 0, Number(row.discount) || 0, row.goodsItemId) });
  }
  function onDiscountChange(idx: number, discount: string) {
    const row = rows[idx];
    updateRow(idx, { discount, vatAmount: computeSuggestedVat(Number(row.amount) || 0, Number(discount) || 0, row.goodsItemId) });
  }
  function onGoodsItemChange(idx: number, goodsItemId: string) {
    const item = goodsItems.find((g) => g.id === Number(goodsItemId));
    updateRow(idx, { goodsItemId, unitId: item ? String(item.mainUnitId) : "" });
  }
  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }
  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  const totalAmount = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalDiscount = rows.reduce((s, r) => s + (Number(r.discount) || 0), 0);
  const totalVat = rows.reduce((s, r) => s + (Number(r.vatAmount) || 0), 0);

  function buildBody() {
    const nonEmptyRows = rows.filter((r) => r.goodsItemId || r.sourceInventoryLineId);
    return {
      date: header.date,
      basis: header.basis,
      customerId: Number(header.customerId),
      salesTypeId: Number(header.salesTypeId),
      salesCenterId: Number(header.salesCenterId),
      currencyId: Number(header.currencyId),
      fxRate: needsFxRate ? Number(header.fxRate) : 1,
      description: header.description,
      lines: nonEmptyRows.map((r) => ({
        sourceInventoryLineId: r.sourceInventoryLineId ? Number(r.sourceInventoryLineId) : null,
        goodsItemId: r.goodsItemId ? Number(r.goodsItemId) : undefined,
        unitId: Number(r.unitId),
        quantity: Number(r.quantity) || 0,
        unitPrice: Number(r.unitPrice) || 0,
        amount: Number(r.amount) || 0,
        discount: Number(r.discount) || 0,
        vatAmount: Number(r.vatAmount) || 0,
        description: r.description || null,
      })),
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!header.date || !header.customerId || !header.salesTypeId || !header.salesCenterId || !header.currencyId) return setError("تاریخ، مشتری، نوع فروش، مرکز فروش و ارز الزامی است");
    if (needsFxRate && !(Number(header.fxRate) > 0)) return setError("نرخ ارز الزامی است");
    const dateErr = validateDocumentDate(header.date, fiscalPeriod);
    if (dateErr) return setError(dateErr);
    const body = buildBody();
    if (body.lines.length === 0) return setError("فاکتور فروش باید حداقل یک ردیف کالا داشته باشد");
    for (const [i, l] of body.lines.entries()) {
      if (header.basis === "SALES_DELIVERY" && !l.sourceInventoryLineId) return setError(`ردیف ${i + 1}: انتخاب ردیف حواله فروش الزامی است`);
      if (header.basis === "NO_BASIS" && !l.goodsItemId) return setError(`کالا برای ردیف ${i + 1} الزامی است`);
      if (!(l.quantity > 0)) return setError(`مقدار ردیف ${i + 1} باید عددی مثبت باشد`);
      if (!(l.unitPrice >= 0)) return setError(`فی ردیف ${i + 1} نامعتبر است`);
    }
    try {
      if (editId) {
        await api.put(`/sales-invoices/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/sales-invoices", body);
        flash();
        navigate(`/sales-invoices/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/sales-invoices/${editId}`);
      navigate("/sales-invoices");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function reloadMeta() {
    if (!editId) return;
    const d: Detail = await api.get(`/sales-invoices/${editId}`);
    setMeta({ number: d.number, journalEntryId: d.journalEntryId, journalEntryReferenceNumber: d.journalEntryReferenceNumber });
  }

  async function runAction(action: string) {
    if (!editId) return;
    try {
      const result: { message?: string } = await api.post(`/sales-invoices/${editId}/${action}`, {});
      await reloadMeta();
      flash(result?.message);
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function runDeleteAction(path: string, confirmMsg?: string) {
    if (!editId) return;
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    try {
      await api.del(`/sales-invoices/${editId}/${path}`);
      await reloadMeta();
      flash();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  const extraActions: { label: string; icon: JSX.Element; onClick: () => void }[] = [];
  if (editId && meta) {
    if (!meta.journalEntryId) {
      extraActions.push({ label: "صدور سند حسابداری", icon: <PlusIcon />, onClick: () => runAction("issue-journal-entry") });
    } else {
      extraActions.push({
        label: "مشاهده سند حسابداری",
        icon: <EyeIcon />,
        onClick: () => openTab(`/journal-entries/${meta.journalEntryId}/edit`),
      });
      extraActions.push({
        label: "حذف سند حسابداری",
        icon: <UndoIcon />,
        onClick: () => runDeleteAction("journal-entry", "سند حسابداری صادرشده حذف می‌شود. ادامه می‌دهید؟"),
      });
    }
  }

  if (editId) extraActions.push({ label: "تخصیص پیش‌دریافت", icon: <PlusIcon />, onClick: () => setAdvanceOpen(true) });

  return (
    <FormPage
      title={editId ? "ویرایش فاکتور فروش" : "فاکتور فروش جدید"}
      description={locked ? "برای این فاکتور سند حسابداری صادر شده است؛ دیگر قابل ویرایش نیست." : "در این فاز فاکتور فروش فقط ثبت می‌شود و اکشن تایید ندارد."}
      formId="sales-invoice-form"
      closePath="/sales-invoices"
      newPath="/sales-invoices/new"
      onDelete={editId && !locked ? handleDelete : undefined}
      saveDisabled={locked}
      extraActions={extraActions}
      wide
    >
      <form id="sales-invoice-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="je-header-grid" style={{ marginBottom: 16, maxWidth: 900 }}>
          <div className="form-field">
            <label>شماره</label>
            <input dir="ltr" value={meta ? toFaDigits(String(meta.number)) : "خودکار پس از ذخیره"} disabled />
          </div>
          {meta?.journalEntryReferenceNumber && (
            <div className="form-field">
              <label>سند حسابداری</label>
              <input dir="ltr" value={toFaDigits(String(meta.journalEntryReferenceNumber))} disabled />
            </div>
          )}
          {editId && advance && (
            <>
              <div className="form-field">
                <label>مبلغ فاکتور</label>
                <input dir="ltr" value={formatAmountFa(advance.total)} disabled />
              </div>
              <div className="form-field">
                <label>پیش‌دریافت تخصیص‌یافته</label>
                <input dir="ltr" value={formatAmountFa(advance.allocatedTotal)} disabled />
              </div>
              <div className="form-field">
                <label>مانده قابل پرداخت</label>
                <input dir="ltr" value={formatAmountFa(advance.payable)} disabled />
              </div>
            </>
          )}
          <div className="form-field">
            <label>تاریخ<RequiredMark /></label>
            <JalaliDatePicker fiscalYear value={header.date} onChange={(v) => setHeader({ ...header, date: v })} disabled={headerDisabled} />
          </div>
          <div className="form-field">
            <label>مبنا<RequiredMark /></label>
            <select value={header.basis} onChange={(e) => setHeader({ ...header, basis: e.target.value as Basis })} disabled={headerDisabled}>
              <option value="NO_BASIS">{BASIS_FA.NO_BASIS}</option>
              <option value="SALES_DELIVERY">{BASIS_FA.SALES_DELIVERY}</option>
            </select>
          </div>
          <div className="form-field">
            <label>مشتری<RequiredMark /></label>
            <RecordPickerField
              title="انتخاب مشتری"
              disabled={headerDisabled}
              displayValue={(() => {
                const c = customers.find((x) => String(x.id) === header.customerId);
                return c ? `${toFaDigits(String(c.code))} — ${customerTitle(c)}` : "";
              })()}
              rows={customers}
              columns={[
                { header: "کد", render: (x) => toFaDigits(String(x.code)), filterValue: (x) => String(x.code), width: "80px" },
                { header: "عنوان", render: (x) => customerTitle(x), filterValue: (x) => customerTitle(x) },
              ]}
              onSelect={(x) => setHeader({ ...header, customerId: String(x.id) })}
            />
          </div>
          <div className="form-field">
            <label>نوع فروش<RequiredMark /></label>
            <select value={header.salesTypeId} onChange={(e) => setHeader({ ...header, salesTypeId: e.target.value })} disabled={headerDisabled}>
              <option value="">انتخاب کنید</option>
              {salesTypes.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>مرکز فروش<RequiredMark /></label>
            <select value={header.salesCenterId} onChange={(e) => setHeader({ ...header, salesCenterId: e.target.value })} disabled={headerDisabled}>
              <option value="">انتخاب کنید</option>
              {salesCenters.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>ارز<RequiredMark /></label>
            <select value={header.currencyId} onChange={(e) => setHeader({ ...header, currencyId: e.target.value, fxRate: "" })} disabled={headerDisabled}>
              <option value="">انتخاب کنید</option>
              {currencies.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          {needsFxRate && (
            <div className="form-field">
              <label>نرخ ارز<RequiredMark /></label>
              <AmountInput value={header.fxRate} onChange={(v) => setHeader({ ...header, fxRate: v })} allowDecimal disabled={headerDisabled} />
            </div>
          )}
          <div className="form-field full">
            <label>شرح</label>
            <input value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} disabled={headerDisabled} />
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
                  {header.basis === "SALES_DELIVERY" && <th>حواله فروش مبدا</th>}
                  <th>کالا</th>
                  <th>واحد</th>
                  <th>مقدار</th>
                  <th>فی</th>
                  <th>مبلغ</th>
                  <th>تخفیف</th>
                  <th>مالیات بر ارزش افزوده</th>
                  <th>شرح</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const item = goodsItems.find((g) => g.id === Number(row.goodsItemId));
                  const pickerRows = item && !item.isActive ? goodsItems : goodsItems.filter((g) => g.isActive);
                  const src = pickableLines.find((l) => String(l.sourceInventoryLineId) === row.sourceInventoryLineId);
                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                      {header.basis === "SALES_DELIVERY" && (
                        <td style={{ minWidth: 90 }}>
                          <RecordPickerField
                            title="انتخاب ردیف حواله فروش"
                            displayValue={src ? `${toFaDigits(String(src.number))}` : ""}
                            rows={pickableLines}
                            columns={[
                              { header: "شماره", render: (l) => toFaDigits(String(l.number)), filterValue: (l) => String(l.number), width: "70px" },
                              { header: "کالا", render: (l) => l.goodsItemTitle, filterValue: (l) => l.goodsItemTitle },
                              { header: "مانده", render: (l) => formatAmountFa(l.remaining), filterValue: (l) => String(l.remaining), width: "90px" },
                            ]}
                            onOpen={guardRowEntry}
                            onSelect={(l) => onSourceLineChange(idx, String(l.sourceInventoryLineId))}
                          />
                        </td>
                      )}
                      <td style={{ minWidth: 320 }}>
                        {header.basis === "SALES_DELIVERY" ? (
                          <span>{row.goodsItemTitle ? `${toFaDigits(row.goodsItemCode)} — ${row.goodsItemTitle}` : "—"}</span>
                        ) : (
                          <RecordPickerField
                            title="انتخاب کالا"
                            displayValue={item ? `${toFaDigits(item.fullCode)} — ${item.title}` : ""}
                            rows={pickerRows}
                            columns={[
                              { header: "کد", render: (g) => toFaDigits(g.fullCode), filterValue: (g) => g.fullCode, width: "110px" },
                              { header: "عنوان", render: (g) => g.title, filterValue: (g) => g.title },
                            ]}
                            onOpen={guardRowEntry}
                            onSelect={(g) => onGoodsItemChange(idx, String(g.id))}
                          />
                        )}
                      </td>
                      <td style={{ minWidth: 90, color: "var(--ink-soft)" }}>{item?.mainUnit?.title || row.unitTitle || "—"}</td>
                      <td style={{ minWidth: 120 }}>
                        <AmountInput value={row.quantity} onChange={(v) => onQuantityChange(idx, v)} allowDecimal />
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <AmountInput value={row.unitPrice} onChange={(v) => onUnitPriceChange(idx, v)} allowDecimal />
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <AmountInput value={row.amount} onChange={(v) => onAmountChange(idx, v)} allowDecimal />
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <AmountInput value={row.discount} onChange={(v) => onDiscountChange(idx, v)} allowDecimal placeholder="۰" />
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <AmountInput value={row.vatAmount} onChange={(v) => updateRow(idx, { vatAmount: v })} allowDecimal placeholder="۰" />
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
            <span className="je-lines-totals">
              جمع مبلغ اقلام: {formatAmountFa(totalAmount)} — جمع تخفیف: {formatAmountFa(totalDiscount)} — جمع مالیات بر ارزش افزوده: {formatAmountFa(totalVat)}
            </span>
          </div>
        </div>
        </fieldset>
      </form>
      {advanceOpen && editId && (
        <AdvanceAllocationDialog
          invoiceId={editId}
          onClose={() => setAdvanceOpen(false)}
          onSaved={() => {
            setAdvanceOpen(false);
            loadAdvance();
          }}
        />
      )}
    </FormPage>
  );
}

interface AdvanceCandidate {
  receiptSettlementLineId: number;
  receiptNumber: number;
  receiptDate: string;
  currencyTitle: string;
  fxRate: number;
  originalAmount: number;
  allocatedAmount: number;
  allocatableAmount: number;
  allocatedToThis: number;
}
interface AdvanceState {
  invoice: { id: number; number: number; currencyTitle: string; total: number };
  allocatedTotal: number;
  payable: number;
  lockReasons: string[];
  candidates: AdvanceCandidate[];
}

// «تخصیص پیش‌دریافت» به فاکتور فروش (Documents/تخصیص پیش دریافت.md): فهرست پیش‌دریافت‌های قابل تخصیص همین فاکتور (طرف حساب/ارز یکسان، رسید تاییدشده،
// تاریخ دریافت ≤ تاریخ فاکتور) و ورود مبلغ تخصیص برای هر کدام. همه‌ی کنترل‌ها (از جمله قفل بر اساس گردش فاکتور) در بک‌اند انجام می‌شود؛ اینجا فقط نمایش
// و راهنمای زنده است. مبلغ‌ها به ارز فاکتورند و تفاوت نرخ ارز روی آن‌ها اثری ندارد (اثر تسعیر فقط هنگام صدور سند حسابداری فاکتور).
function AdvanceAllocationDialog({ invoiceId, onClose, onSaved }: { invoiceId: number; onClose: () => void; onSaved: () => void }) {
  const [state, setState] = useState<AdvanceState | null>(null);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get(`/sales-invoices/${invoiceId}/advance-allocations`)
      .then((s: AdvanceState) => {
        setState(s);
        const initial: Record<number, string> = {};
        s.candidates.forEach((c) => {
          if (c.allocatedToThis > 0) initial[c.receiptSettlementLineId] = String(c.allocatedToThis);
        });
        setAmounts(initial);
      })
      .catch((e) => setLoadError((e as ApiError).message));
  }, [invoiceId]);

  const locked = !!state && state.lockReasons.length > 0;
  const sum = Object.values(amounts).reduce((s, v) => s + (Number(v) || 0), 0);
  const overInvoice = !!state && sum > state.invoice.total + 0.005;
  const overLine = (c: AdvanceCandidate) => (Number(amounts[c.receiptSettlementLineId]) || 0) > c.allocatableAmount + 0.005;
  const anyOverLine = !!state && state.candidates.some(overLine);

  async function save() {
    if (!state) return;
    try {
      const allocations = state.candidates
        .map((c) => ({ receiptSettlementLineId: c.receiptSettlementLineId, amount: Number(amounts[c.receiptSettlementLineId]) || 0 }))
        .filter((a) => a.amount > 0);
      await api.put(`/sales-invoices/${invoiceId}/advance-allocations`, { allocations });
      showToast("تخصیص پیش‌دریافت ذخیره شد");
      onSaved();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <Modal title="تخصیص پیش‌دریافت" onClose={onClose}>
      {loadError && <div style={{ color: "var(--danger)", marginBottom: 8 }}>{loadError}</div>}
      {!state && !loadError && <div>در حال بارگذاری...</div>}
      {state && (
        <>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 10, fontSize: 13 }}>
            <span>فاکتور شماره {toFaDigits(String(state.invoice.number))} — ارز: {state.invoice.currencyTitle}</span>
            <span>مبلغ فاکتور: <b>{formatAmountFa(state.invoice.total)}</b></span>
            <span>مجموع تخصیص: <b style={{ color: overInvoice ? "var(--danger)" : undefined }}>{formatAmountFa(sum)}</b></span>
            <span>مانده قابل پرداخت: <b>{formatAmountFa(state.invoice.total - sum)}</b></span>
          </div>
          {locked && (
            <div style={{ background: "var(--primary-soft)", padding: "8px 10px", borderRadius: 8, marginBottom: 10, fontSize: 12.5, whiteSpace: "pre-line" }}>
              {state.lockReasons.join("\n")}
            </div>
          )}
          <div className="picker-table-wrap">
            <table className="picker-table">
              <thead>
                <tr>
                  <th>شماره پیش‌دریافت</th>
                  <th>تاریخ دریافت</th>
                  <th>ارز</th>
                  <th>مبلغ اولیه</th>
                  <th>مبلغ تخصیص‌یافته</th>
                  <th>مبلغ قابل تخصیص</th>
                  <th style={{ width: 160 }}>مبلغ تخصیص به این فاکتور</th>
                </tr>
              </thead>
              <tbody>
                {state.candidates.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-state" style={{ border: "none" }}>پیش‌دریافت قابل تخصیصی برای این فاکتور وجود ندارد</td>
                  </tr>
                )}
                {state.candidates.map((c) => (
                  <tr key={c.receiptSettlementLineId}>
                    <td>{toFaDigits(String(c.receiptNumber))}</td>
                    <td>{formatJalaliDate(c.receiptDate)}</td>
                    <td>{c.currencyTitle}</td>
                    <td>{formatAmountFa(c.originalAmount)}</td>
                    <td>{formatAmountFa(c.allocatedAmount)}</td>
                    <td>{formatAmountFa(c.allocatableAmount)}</td>
                    <td>
                      <AmountInput
                        value={amounts[c.receiptSettlementLineId] ?? ""}
                        onChange={(v) => setAmounts((prev) => ({ ...prev, [c.receiptSettlementLineId]: v }))}
                        allowDecimal
                        placeholder="۰"
                        disabled={locked}
                      />
                      {overLine(c) && <span style={{ color: "var(--danger)", fontSize: 11 }}>بیشتر از مبلغ قابل تخصیص</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="actions">
            <button type="button" className="btn" disabled={locked || overInvoice || anyOverLine || state.candidates.length === 0} onClick={save}>
              ذخیره تخصیص
            </button>
            <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
          </div>
        </>
      )}
    </Modal>
  );
}
