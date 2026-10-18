import { FormEvent, useEffect, useState } from "react";
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
import { ExcelImportButton } from "../components/ExcelImport";
import { DownstreamMenu } from "../components/DownstreamMenu";
import { PrintButton } from "../components/PrintButton";
import { QUOTE_DOWNSTREAM_ACTIONS } from "../components/DownstreamDialogs";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { useDefaultBaseCurrency } from "../lib/useDefaultBaseCurrency";
import { api, ApiError } from "../lib/api";
import { fetchSalesLineItems } from "../lib/salesLineItems";
import { SalesType } from "./SalesTypes";
import { SalesCenter } from "./SalesCenters";
import { FiscalPeriodRange, fetchSelectedFiscalPeriod, defaultDocumentDate, validateDocumentDate } from "../lib/fiscalYearDefaultDate";
import { resolveVatRatePercent, computeLineVat } from "../lib/vatCalculation";
import { useVatRates, vatRateForDate } from "../lib/useVatRates";
import { DescriptionField } from "../components/DescriptionField";
import { stageFormPrefill, takeFormPrefill } from "../lib/formPrefill";
import { useTabs } from "../lib/TabsContext";
import { usePermissions } from "../lib/usePermissions";
import { CloseFollowUpDialog, FOLLOWUP_FA, FollowUpBanner, useQuoteFollowUp } from "../components/QuoteFollowUp";

// «پیش‌فاکتور» — بالاترین سند زنجیره فروش (پیش‌فاکتور > سفارش فروش > حواله فروش > فاکتور فروش)؛ این
// ماژول هیچ مستند تحلیل اختصاصی در پروژه ندارد (رجوع کنید به یادداشت بالای schema.prisma و
// backend/src/routes/salesOperations.ts). همیشه ردیف مستقیم دارد (مبنایی بالادستی ندارد).
//
// طبق تصمیم صریح کاربر (۱۴۰۵/۰۶/۲۰): هدر «نوع فروش» (الزامی) اضافه شد. مالیات بر ارزش‌افزوده هم به
// ردیف‌ها اضافه شد، ولی برخلاف فاکتور خرید/فاکتور فروش، همیشه به همان ارز هدر محاسبه می‌شود، نه ارز
// مبنا — چون این فرم اصلاً fxRate ندارد (سندی صرفاً اطلاعاتی، بدون اثر حسابداری، بدون نیاز به تبدیل ارز).

type Status = "DRAFT" | "APPROVED";

interface CustomerOption { id: number; code: number; party: { category: "INDIVIDUAL" | "LEGAL"; firstName: string | null; lastName: string | null; name: string | null; detailTitle?: string | null } }
interface CurrencyOption { id: number; code: string; title: string; decimalPlaces?: number }
interface GoodsItemRow { id: number; fullCode: string; title: string; mainUnitId: number; mainUnit?: { title: string }; isActive: boolean; isSpecial: boolean; taxRate: number | string | null }

function customerTitle(c: CustomerOption): string {
  if (c.party.detailTitle) return c.party.detailTitle;
  return c.party.category === "LEGAL" ? c.party.name || "" : `${c.party.firstName || ""} ${c.party.lastName || ""}`.trim();
}

interface ListRow { followUpState?: string | null; followUpReasonTitle?: string | null; closedRemainingAmount?: number | null; id: number; number: number; date: string; customerId: number; customerTitle: string; salesTypeId: number; salesTypeTitle: string | null; salesCenterId: number; salesCenterTitle: string | null; currencyTitle: string; status: Status; lineCount: number; totalAmount: number }
interface DetailLine { id: number; goodsItemId: number; goodsItemCode: string; goodsItemTitle: string; unitId: number; unitTitle: string; quantity: number; unitPrice: number; amount: number; discount: number; vatAmount: number; description: string | null; listPrice?: number | null }
interface Detail extends ListRow { currencyId: number; description: string | null; validUntil?: string | null; lines: DetailLine[] }

const STATUS_FA: Record<Status, string> = { DRAFT: "ثبت", APPROVED: "تایید" };
const INFO_TEXT = "ثبت پیش‌فاکتور/استعلام قیمت برای مشتری — بالاترین سند زنجیره فروش. پس از تایید، می‌توان از آن سفارش فروش ایجاد کرد.";

export default function SalesQuotes() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <SalesQuoteForm />;
  if (isEdit) return <SalesQuoteForm editId={Number(id)} />;
  return <SalesQuoteList />;
}

function CheckIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M7 8H4V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 8A8 8 0 1 1 4 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CloseCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function PlusIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function SalesQuoteList() {
  const cacheKey = "/sales-quotes";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    try {
      setItems(await api.get("/sales-quotes"));
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
      await api.del(`/sales-quotes/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="پیش‌فاکتور" />
          <NewRecordButton path="/sales-quotes/new" />
          <ExcelImportButton
            entityLabel="پیش‌فاکتور"
            templateFilename="قالب-پیش-فاکتور"
            backendEntityType="sales-quote"
            columns={[
              { key: "number", label: "شماره", required: true, hint: "شماره‌ی پیش‌فاکتور (مثلاً همان شماره در سیستم قبلی)؛ هم برای گروه‌بندی ردیف‌های یک پیش‌فاکتور (با تاریخ) و هم به‌عنوان شماره‌ی نهایی سند استفاده می‌شود — باید در این دوره مالی یکتا باشد" },
              { key: "date", label: "تاریخ", required: true, hint: "شمسی (مثلاً 1405/05/06) یا میلادی" },
              { key: "customerDetailCode", label: "کد تفصیل مشتری", required: true },
              { key: "salesTypeCode", label: "کد نوع فروش", required: true },
              { key: "salesCenterCode", label: "کد مرکز فروش", required: true },
              { key: "currencyCode", label: "کد ارز", hint: "خالی = ارز پایه" },
              { key: "description", label: "شرح سند" },
              { key: "goodsItemCode", label: "کد کالا/خدمت" },
              { key: "goodsItemOldCode", label: "کد کالا (سیستم قدیم)", hint: "برای مهاجرت از سیستم قبلی؛ دقیقاً یکی از این دو ستون باید در هر ردیف پر باشد" },
              { key: "quantity", label: "مقدار", required: true },
              { key: "unitPrice", label: "فی", required: true, hint: "به ارز سند؛ مبلغ = مقدار × فی و ارزش‌افزوده خودکار محاسبه می‌شود" },
              { key: "discount", label: "تخفیف", hint: "مبلغ تخفیف ردیف به ارز سند (اختیاری)" },
              { key: "lineDescription", label: "شرح ردیف" },
            ]}
            onDone={reload}
          />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", render: (r) => toFaDigits(String(r.number)), width: "70px", filterType: "number", filterValue: (r) => r.number },
          { header: "تاریخ", render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date.slice(0, 10) },
          { header: "مشتری", render: (r) => r.customerTitle, filterType: "string", filterValue: (r) => r.customerTitle },
          { header: "نوع فروش", render: (r) => r.salesTypeTitle || "—", filterType: "string", filterValue: (r) => r.salesTypeTitle || "" },
          { header: "مرکز فروش", render: (r) => r.salesCenterTitle || "—", filterType: "string", filterValue: (r) => r.salesCenterTitle || "" },
          { header: "مبلغ کل (پس از تخفیف)", render: (r) => formatAmountFa(r.totalAmount), filterType: "number", filterValue: (r) => r.totalAmount, decimal: true },
          { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
          { header: "وضعیت پیگیری", render: (r) => (r.followUpState ? FOLLOWUP_FA[r.followUpState] : "—"), filterType: "string", filterValue: (r) => (r.followUpState ? FOLLOWUP_FA[r.followUpState] : ""), width: "150px" },
          { header: "دلیل فروش‌نشدن", render: (r) => r.followUpReasonTitle || "—", filterType: "string", filterValue: (r) => r.followUpReasonTitle || "" },
          { header: "مبلغ بسته‌شده", render: (r) => (r.closedRemainingAmount ? formatAmountFa(r.closedRemainingAmount) : "—"), filterType: "number", filterValue: (r) => r.closedRemainingAmount ?? 0, decimal: true },
        ]}
        rows={items}
        edit={{ path: (r) => `/sales-quotes/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

/** listPrice = قیمتی که سیستم (اعلامیه قیمت) برای مقدار ردیف پیشنهاد داده؛ unitPrice فی نهایی است و کاربر می‌تواند عوضش کند */
interface RowState { goodsItemId: string; goodsItemCode: string; goodsItemTitle: string; unitId: string; unitTitle: string; quantity: string; unitPrice: string; amount: string; discount: string; vatAmount: string; description: string; listPrice: string }

/** فی پایه و پله‌های یک کالا از اعلامیه‌ی مؤثر (GET /sales-price-lists/resolve) */
interface PriceInfo { basePrice: number; tiers: { minQuantity: number; effect: string; value: number; price: number }[] }

/** آینه‌ی services/salesPriceService.ts#computePrice (فقط نمایش؛ مرجع نهایی سرور است): پله‌ی برنده = بزرگ‌ترین «از مقدار» ≤ مقدار ردیف */
function computeListPrice(info: PriceInfo, qty: number): number {
  let winner: PriceInfo["tiers"][number] | null = null;
  for (const t of info.tiers) if (t.minQuantity <= qty && (!winner || t.minQuantity > winner.minQuantity)) winner = t;
  return winner ? winner.price : info.basePrice;
}

/** داده‌ی «تکثیر پیش‌فاکتور» که فرم مبدأ در حافظه می‌گذارد و تبِ «جدید» برمی‌دارد (lib/formPrefill.ts) */
interface QuoteDuplicatePrefill {
  sourceDate: string;
  validDays: number | null;
  customerId: string;
  salesTypeId: string;
  salesCenterId: string;
  currencyId: string;
  description: string;
  rows: RowState[];
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function DuplicateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M5 15V6a2 2 0 012-2h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function emptyRow(): RowState {
  return { goodsItemId: "", goodsItemCode: "", goodsItemTitle: "", unitId: "", unitTitle: "", quantity: "", unitPrice: "", amount: "", discount: "", vatAmount: "", description: "", listPrice: "" };
}

function SalesQuoteForm({ editId }: { editId?: number }) {
  const vatRates = useVatRates();
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [salesTypes, setSalesTypes] = useState<SalesType[]>([]);
  const [salesCenters, setSalesCenters] = useState<SalesCenter[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [goodsItems, setGoodsItems] = useState<GoodsItemRow[]>([]);
  const [header, setHeader] = usePersistedState(`${cacheKey}:header`, { date: "", customerId: "", salesTypeId: "", salesCenterId: "", currencyId: "", description: "", validUntil: "" });
  const [rows, setRows] = usePersistedState<RowState[]>(`${cacheKey}:rows`, []);
  const [meta, setMeta] = usePersistedState<{ number: number; status: Status } | null>(`${cacheKey}:meta`, null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useDefaultBaseCurrency({ enabled: !editId && loaded, currencies, current: header.currencyId, apply: (id) => setHeader((h) => ({ ...h, currencyId: id })) });
  const [fiscalPeriod, setFiscalPeriod] = useState<FiscalPeriodRange | null>(null);
  const { flash } = useSavedFlash();
  const { openTab } = useTabs();
  const { hasPermission } = usePermissions();
  const [followUpDialog, setFollowUpDialog] = useState(false);
  const followUp = useQuoteFollowUp(editId, !!editId);
  const followUpClosed = followUp.info?.state === "CLOSED_PARTIAL" || followUp.info?.state === "CLOSED_NO_SALE";

  useEffect(() => {
    async function init() {
      const [cu, st, sc, c, g, fp] = await Promise.all([
        api.get("/customers"),
        api.get("/sales-types"),
        api.get("/sales-centers"),
        api.get("/currencies"),
        fetchSalesLineItems({ withWarehouseFilter: true }),
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
        const d: Detail = await api.get(`/sales-quotes/${editId}`);
        setMeta({ number: d.number, status: d.status });
        setHeader({ date: d.date.slice(0, 10), customerId: String(d.customerId), salesTypeId: String(d.salesTypeId), salesCenterId: String(d.salesCenterId), currencyId: String(d.currencyId), description: d.description || "", validUntil: d.validUntil ? String(d.validUntil).slice(0, 10) : "" });
        setRows(
          d.lines.map((l) => ({
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
            listPrice: l.listPrice === null || l.listPrice === undefined ? "" : String(l.listPrice),
          }))
        );
      } else {
        setHeader({ date: defaultDocumentDate(fp), customerId: "", salesTypeId: "", salesCenterId: "", currencyId: "", description: "", validUntil: "" });
        setRows([emptyRow()]);
        setMeta(null);
      }
      setLoaded(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // «تکثیر» (دکمه‌ی نوار ابزار پیش‌فاکتورِ ذخیره‌شده): تبِ «جدید» با همان مشتری/نوع و مرکز فروش/ارز/شرح و ردیف‌ها باز می‌شود، با تاریخ پیش‌فرض امروز، بدون شماره
  // و در وضعیت ثبت‌نشده؛ سندی ساخته نمی‌شود تا کاربر «ذخیره» بزند (POST معمولی با همه‌ی اعتبارسنجی‌های سرور). تاریخ اعتبار با همان فاصله‌ی قبلی از تاریخ سند
  // به تاریخ جدید منتقل می‌شود. اگر نرخ ارزش افزوده در تاریخ جدید با تاریخ سند مبدأ فرق داشته باشد، ارزش افزوده‌ی ردیف‌ها دوباره پیشنهاد می‌شود.
  useEffect(() => {
    if (!loaded || editId) return;
    const p = takeFormPrefill<QuoteDuplicatePrefill>(location.pathname);
    if (!p) return;
    setHeader((h) => ({
      ...h,
      customerId: p.customerId,
      salesTypeId: p.salesTypeId,
      salesCenterId: p.salesCenterId,
      currencyId: p.currencyId,
      description: p.description,
      validUntil: p.validDays !== null && h.date ? addDaysIso(h.date, p.validDays) : "",
    }));
    const rateChanged = vatRateForDate(vatRates, p.sourceDate) !== vatRateForDate(vatRates, header.date);
    const dec = currencies.find((c) => String(c.id) === p.currencyId)?.decimalPlaces ?? 2;
    setRows(
      p.rows.length === 0
        ? [emptyRow()]
        : p.rows.map((r) => {
            if (!rateChanged || !r.goodsItemId) return { ...r, listPrice: "" };
            const item = goodsItems.find((g) => g.id === Number(r.goodsItemId));
            const vat = computeLineVat(Number(r.amount) || 0, Number(r.discount) || 0, resolveVatRatePercent(item, vatRateForDate(vatRates, header.date)), dec);
            return { ...r, vatAmount: String(vat), listPrice: "" };
          })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  function duplicateQuote() {
    const validDays =
      header.validUntil && header.date
        ? Math.round((new Date(`${header.validUntil.slice(0, 10)}T00:00:00Z`).getTime() - new Date(`${header.date.slice(0, 10)}T00:00:00Z`).getTime()) / 86_400_000)
        : null;
    const payload: QuoteDuplicatePrefill = {
      sourceDate: header.date,
      validDays: validDays !== null && validDays >= 0 ? validDays : null,
      customerId: header.customerId,
      salesTypeId: header.salesTypeId,
      salesCenterId: header.salesCenterId,
      currencyId: header.currencyId,
      description: header.description,
      rows: rows.filter((r) => r.goodsItemId).map((r) => ({ ...r })),
    };
    stageFormPrefill("/sales-quotes/new", payload);
    openTab("/sales-quotes/new");
  }

  const status: Status = meta?.status || "DRAFT";
  // پیش‌فاکتور بسته‌شده (حتی در حالت ثبت) قابل ویرایش/تایید نیست تا پیگیری بازگشایی شود
  const locked = status !== "DRAFT" || followUpClosed;

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  // مقدار پیشنهادی مالیات بر ارزش افزوده — طبق تصمیم صریح کاربر، همیشه به همان ارز هدر محاسبه می‌شود
  // (نه ارز مبنا، چون این فرم fxRate ندارد)؛ فقط پیش‌فرض اولیه است، کاربر می‌تواند بعداً خودش مقدار را
  // ویرایش کند — دقیقاً هم‌الگوی PurchaseInvoices.tsx/SalesInvoices.tsx با این تفاوت که تبدیل ارزی در
  // کار نیست.
  function computeSuggestedVat(amount: number, discount: number, goodsItemId: string): string {
    const item = goodsItems.find((g) => g.id === Number(goodsItemId));
    return String(computeLineVat(amount, discount, resolveVatRatePercent(item, vatRateForDate(vatRates, header.date)), currencies.find((c) => String(c.id) === String(header.currencyId))?.decimalPlaces ?? 2));
  }
  // ── فراخوانی قیمت از اعلامیه (فی پایه + پله‌ها): کلید زمینه = مرکز/نوع/ارز/تاریخ؛ جدول پله‌ی هر کالا یک‌بار می‌آید و تغییر مقدار بدون درخواست شبکه محاسبه می‌شود
  const priceKey = header.salesCenterId && header.salesTypeId && header.currencyId && header.date ? `${header.salesCenterId}|${header.salesTypeId}|${header.currencyId}|${header.date}` : "";
  const [priceCache, setPriceCache] = useState<{ key: string; items: Record<string, PriceInfo | null> }>({ key: "", items: {} });
  const priceItems = priceCache.key === priceKey ? priceCache.items : {};

  async function ensurePricing(ids: string[], force = false): Promise<Record<string, PriceInfo | null>> {
    if (!priceKey) return {};
    const have = priceCache.key === priceKey && !force ? priceCache.items : {};
    const missing = [...new Set(ids.filter((id) => id && !(id in have)))];
    if (missing.length === 0) return have;
    try {
      const r = await api.get(
        `/sales-price-lists/resolve?salesCenterId=${header.salesCenterId}&salesTypeId=${header.salesTypeId}&currencyId=${header.currencyId}&date=${header.date}&goodsItemIds=${missing.join(",")}`
      );
      const merged: Record<string, PriceInfo | null> = { ...have };
      for (const id of missing) merged[id] = (r.items && r.items[id]) || null;
      setPriceCache({ key: priceKey, items: merged });
      return merged;
    } catch {
      return have; // خطای شبکه/دسترسی: فی دستی می‌ماند، مانع کار کاربر نشود
    }
  }

  // کش پله‌ها برای همه‌ی ردیف‌های دارای کالا پر می‌شود تا تغییر مقدار بدون درخواست شبکه با پله هماهنگ شود. در فرم جدید/تکثیر، قیمت سیستمِ ردیف‌هایی که
  // هنوز ندارند فقط نمایش داده می‌شود (فی نهایی دست‌نخورده)؛ در ویرایش، قیمت سیستمِ ذخیره‌شده‌ی ردیف (مرجع حسابرسی) عوض نمی‌شود.
  const rowItemIds = rows.map((r) => r.goodsItemId).filter(Boolean).join(",");
  useEffect(() => {
    if (!loaded || locked || !priceKey || !rowItemIds) return;
    let cancelled = false;
    ensurePricing(rowItemIds.split(",")).then((map) => {
      if (cancelled || editId) return;
      setRows((prev) =>
        prev.map((r) => {
          const info = r.goodsItemId ? map[r.goodsItemId] : null;
          return info && r.listPrice === "" ? { ...r, listPrice: String(computeListPrice(info, Number(r.quantity) || 0)) } : r;
        })
      );
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, priceKey, rowItemIds]);

  async function recallPrices() {
    const ids = rows.map((r) => r.goodsItemId).filter(Boolean);
    if (ids.length === 0) return;
    const map = await ensurePricing(ids, true);
    const manual = rows.filter((r) => r.goodsItemId && map[r.goodsItemId] && r.listPrice !== "" && Number(r.unitPrice) !== Number(r.listPrice)).length;
    if (manual > 0 && !window.confirm(`فی ${toFaDigits(String(manual))} ردیف به‌صورت دستی تغییر کرده است؛ با بازفراخوانی به قیمت اعلامیه برمی‌گردد. ادامه می‌دهید؟`)) return;
    setRows((prev) =>
      prev.map((r) => {
        const info = r.goodsItemId ? map[r.goodsItemId] : null;
        if (!info) return r;
        const qty = Number(r.quantity) || 0;
        const lp = computeListPrice(info, qty);
        const amount = Math.round(lp * qty * 100) / 100;
        return { ...r, listPrice: String(lp), unitPrice: String(lp), amount: String(amount), vatAmount: computeSuggestedVat(amount, Number(r.discount) || 0, r.goodsItemId) };
      })
    );
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
  function onQuantityChange(idx: number, quantity: string) {
    const row = rows[idx];
    const info = row.goodsItemId ? priceItems[row.goodsItemId] : null;
    if (info) {
      const qty = Number(quantity) || 0;
      const lp = computeListPrice(info, qty);
      const follows = row.unitPrice === "" || Number(row.unitPrice) === Number(row.listPrice);
      const unitPrice = follows ? String(lp) : row.unitPrice;
      const amount = Math.round(Number(unitPrice) * qty * 100) / 100;
      updateRow(idx, { quantity, listPrice: String(lp), unitPrice, amount: String(amount), vatAmount: computeSuggestedVat(amount, Number(row.discount) || 0, row.goodsItemId) });
      return;
    }
    if (row.unitPrice) {
      const amount = Math.round(Number(row.unitPrice) * (Number(quantity) || 0) * 100) / 100;
      updateRow(idx, { quantity, amount: String(amount), vatAmount: computeSuggestedVat(amount, Number(row.discount) || 0, row.goodsItemId) });
    } else {
      updateRow(idx, { quantity });
    }
  }
  async function onGoodsItemChange(idx: number, goodsItemId: string) {
    const item = goodsItems.find((g) => g.id === Number(goodsItemId));
    updateRow(idx, { goodsItemId, unitId: item ? String(item.mainUnitId) : "", listPrice: "" });
    if (!goodsItemId) return;
    const info = (await ensurePricing([goodsItemId]))[goodsItemId];
    if (!info) return;
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx || r.goodsItemId !== goodsItemId) return r;
        const qty = Number(r.quantity) || 0;
        const lp = computeListPrice(info, qty);
        const amount = Math.round(lp * qty * 100) / 100;
        return { ...r, listPrice: String(lp), unitPrice: String(lp), amount: String(amount), vatAmount: computeSuggestedVat(amount, Number(r.discount) || 0, goodsItemId) };
      })
    );
  }
  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
    // موبایل: کارت ردیف تازه به دید بیاید تا کاربر مستقیم پر کند (روی دسکتاپ گرید خودش اسکرول می‌شود)
    if (window.matchMedia("(max-width: 700px)").matches) {
      window.setTimeout(() => {
        document.querySelector(".je-lines-table.mobile-cards tbody tr:last-child")?.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 60);
    }
  }
  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  const totalAmount = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalDiscount = rows.reduce((s, r) => s + (Number(r.discount) || 0), 0);
  const totalVat = rows.reduce((s, r) => s + (Number(r.vatAmount) || 0), 0);

  function buildBody() {
    const nonEmptyRows = rows.filter((r) => r.goodsItemId);
    return {
      date: header.date,
      customerId: Number(header.customerId),
      salesTypeId: Number(header.salesTypeId),
      salesCenterId: Number(header.salesCenterId),
      currencyId: Number(header.currencyId),
      description: header.description,
      validUntil: header.validUntil || null,
      lines: nonEmptyRows.map((r) => ({
        goodsItemId: Number(r.goodsItemId),
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
    const dateErr = validateDocumentDate(header.date, fiscalPeriod);
    if (dateErr) return setError(dateErr);
    const body = buildBody();
    if (body.lines.length === 0) return setError("پیش‌فاکتور باید حداقل یک ردیف کالا داشته باشد");
    for (const [i, l] of body.lines.entries()) {
      if (!(l.quantity > 0)) return setError(`مقدار ردیف ${i + 1} باید عددی مثبت باشد`);
    }
    try {
      if (editId) {
        await api.put(`/sales-quotes/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/sales-quotes", body);
        flash();
        navigate(`/sales-quotes/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/sales-quotes/${editId}`);
      navigate("/sales-quotes");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  async function reopenFollowUp() {
    if (!editId || !window.confirm("پیگیری این پیش‌فاکتور دوباره باز شود؟ مانده‌ی بسته‌شده دوباره در انتخابگرها می‌آید.")) return;
    try {
      await api.post(`/sales-quotes/${editId}/reopen-follow-up`, {});
      await followUp.reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  async function runAction(path: string) {
    if (!editId) return;
    try {
      await api.post(`/sales-quotes/${editId}/${path}`, {});
      const d: Detail = await api.get(`/sales-quotes/${editId}`);
      setMeta({ number: d.number, status: d.status });
      flash();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  const extraActions: { label: string; icon: JSX.Element; onClick: () => void }[] = [];
  if (editId && meta) {
    if (status === "DRAFT") extraActions.push({ label: "تایید", icon: <CheckIcon />, onClick: () => runAction("approve") });
    else extraActions.push({ label: "برگشت از تایید", icon: <UndoIcon />, onClick: () => runAction("unapprove") });
  }

  return (
    <FormPage
      title={editId ? "ویرایش پیش‌فاکتور" : "پیش‌فاکتور جدید"}
      formId="sales-quote-form"
      closePath="/sales-quotes"
      newPath="/sales-quotes/new"
      onDelete={editId && status === "DRAFT" ? handleDelete : undefined}
      saveDisabled={locked}
      extraActions={extraActions}
      toolbarExtra={editId ? (
        <>
          <PrintButton docType="SALES_QUOTE" sourceId={editId} title="چاپ پیش‌فاکتور" />
          {hasPermission("sales.operations.sales-quotes.create") && (
            <button type="button" className="toolbar-icon-btn" onClick={duplicateQuote} title="تکثیر پیش‌فاکتور (نسخه‌ی جدید با تاریخ امروز، ذخیره‌نشده)">
              <DuplicateIcon />
            </button>
          )}
          {hasPermission("sales.operations.sales-quotes.closeFollowUp") && followUp.info && (
            followUp.info.state === "CLOSED_PARTIAL" || followUp.info.state === "CLOSED_NO_SALE" ? (
              <button type="button" className="toolbar-icon-btn" title="بازگشایی پیگیری (مانده‌ی بسته‌شده دوباره قابل پیگیری می‌شود)" onClick={reopenFollowUp}>
                <UndoIcon />
              </button>
            ) : followUp.info.remainingQty > 1e-9 ? (
              <button type="button" className="toolbar-icon-btn" title="بستن پیگیری (مانده‌ی پیش‌فاکتور فروش نشد/منصرف شد)" onClick={() => setFollowUpDialog(true)}>
                <CloseCircleIcon />
              </button>
            ) : null
          )}
          <DownstreamMenu actions={QUOTE_DOWNSTREAM_ACTIONS} sourceId={editId} disabledReason={status !== "APPROVED" ? "پیش‌فاکتور تایید نشده است؛ ابتدا آن را تایید کنید" : null} />
        </>
      ) : undefined}
      wide
    >
      <form id="sales-quote-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <FollowUpBanner info={followUp.info} />
        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="je-header-grid" style={{ marginBottom: 16, maxWidth: 900 }}>
            <div className="form-field">
              <label>شماره</label>
              <input dir="ltr" value={meta ? toFaDigits(String(meta.number)) : "خودکار پس از ذخیره"} disabled />
            </div>
            <div className="form-field">
              <label>وضعیت</label>
              <div><span className="badge">{STATUS_FA[status]}</span></div>
            </div>
            <div className="form-field">
              <label>تاریخ<RequiredMark /></label>
              <JalaliDatePicker fiscalYear value={header.date} onChange={(v) => setHeader({ ...header, date: v })} />
            </div>
            <div className="form-field">
              <label>تاریخ اعتبار <InfoHint text="اختیاری — تا این تاریخ پیش‌فاکتور معتبر است؛ در چاپ پیش‌فاکتور می‌آید. نباید قبل از تاریخ پیش‌فاکتور باشد." title="تاریخ اعتبار" /></label>
              <JalaliDatePicker value={header.validUntil} onChange={(v) => setHeader({ ...header, validUntil: v })} />
            </div>
            <div className="form-field">
              <label>مشتری<RequiredMark /></label>
              <RecordPickerField
                title="انتخاب مشتری"
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
              <select value={header.salesTypeId} onChange={(e) => setHeader({ ...header, salesTypeId: e.target.value })}>
                <option value="">انتخاب کنید</option>
                {salesTypes.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>مرکز فروش<RequiredMark /></label>
              <select value={header.salesCenterId} onChange={(e) => setHeader({ ...header, salesCenterId: e.target.value })}>
                <option value="">انتخاب کنید</option>
                {salesCenters.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
            <div className="form-field fx-only">
              <label>ارز<RequiredMark /></label>
              <select value={header.currencyId} onChange={(e) => setHeader({ ...header, currencyId: e.target.value })}>
                <option value="">انتخاب کنید</option>
                {currencies.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div className="form-field full">
              <DescriptionField value={header.description} onChange={(v) => setHeader({ ...header, description: v })} />
            </div>
          </div>

          <div className="je-lines-toolbar">
            <span className="je-lines-title">اقلام</span>
            <button type="button" className="btn secondary" style={{ marginInlineStart: "auto", marginInlineEnd: 8, padding: "4px 10px", fontSize: 12 }} onClick={recallPrices} disabled={locked} title="فی ردیف‌ها را دوباره از اعلامیه قیمت (برای مرکز، نوع فروش، ارز و تاریخ همین سند) فراخوانی می‌کند">
              بازفراخوانی قیمت
            </button>
            <button type="button" className="toolbar-icon-btn primary mobile-fab" onClick={addRow} title="ردیف جدید">
              <PlusIcon />
            </button>
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
                  <th>قیمت اعلامیه</th>
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
                  return (
                    <tr key={idx}>
                      <td data-label="ردیف" style={{ textAlign: "center", color: "var(--ink-soft)", fontWeight: 600 }}>{toFaDigits(String(idx + 1))}</td>
                      <td data-label="کالا" style={{ minWidth: 200 }}>
                        <RecordPickerField
                          title="انتخاب کالا"
                          disabled={locked}
                          displayValue={item ? `${toFaDigits(item.fullCode)} — ${item.title}` : ""}
                          rows={pickerRows}
                          columns={[
                            { header: "کد", render: (g) => toFaDigits(g.fullCode), filterValue: (g) => g.fullCode, width: "110px" },
                            { header: "عنوان", render: (g) => g.title, filterValue: (g) => g.title },
                          ]}
                          onSelect={(g) => onGoodsItemChange(idx, String(g.id))}
                        />
                      </td>
                      <td data-label="واحد" style={{ minWidth: 90, color: "var(--ink-soft)" }}>{item?.mainUnit?.title || row.unitTitle || "—"}</td>
                      <td data-label="مقدار" style={{ minWidth: 120 }}>
                        <AmountInput value={row.quantity} onChange={(v) => onQuantityChange(idx, v)} allowDecimal disabled={locked} />
                      </td>
                      <td data-label="فی" style={{ minWidth: 120 }}>
                        <AmountInput value={row.unitPrice} onChange={(v) => onUnitPriceChange(idx, v)} allowDecimal disabled={locked} />
                      </td>
                      <td
                        data-label="قیمت اعلامیه"
                        style={{ minWidth: 110, color: row.listPrice !== "" && Number(row.unitPrice) !== Number(row.listPrice) ? "var(--warning, #b7791f)" : "var(--ink-soft)", whiteSpace: "nowrap" }}
                        title={row.listPrice !== "" && Number(row.unitPrice) !== Number(row.listPrice) ? "فی نهایی با قیمت اعلامیه فرق دارد (فی دستی)" : undefined}
                      >
                        {row.listPrice === "" ? "—" : formatAmountFa(row.listPrice)}
                      </td>
                      <td data-label="مبلغ" style={{ minWidth: 120 }}>
                        <AmountInput value={row.amount} onChange={(v) => onAmountChange(idx, v)} allowDecimal disabled={locked} />
                      </td>
                      <td data-label="تخفیف" style={{ minWidth: 120 }}>
                        <AmountInput value={row.discount} onChange={(v) => onDiscountChange(idx, v)} allowDecimal placeholder="۰" disabled={locked} />
                      </td>
                      <td data-label="ارزش افزوده" style={{ minWidth: 120 }}>
                        <AmountInput value={row.vatAmount} onChange={(v) => updateRow(idx, { vatAmount: v })} allowDecimal placeholder="۰" disabled={locked} />
                      </td>
                      <td data-label="شرح" style={{ minWidth: 140 }}>
                        <input value={row.description} onChange={(e) => updateRow(idx, { description: e.target.value })} disabled={locked} />
                      </td>
                      <td data-label="" className="mc-actions">
                        <button type="button" className="btn danger" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => removeRow(idx)} disabled={locked}>
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
            <span className="je-lines-totals">جمع مبلغ: {formatAmountFa(totalAmount)} — جمع تخفیف: {formatAmountFa(totalDiscount)} — جمع مالیات بر ارزش افزوده: {formatAmountFa(totalVat)}</span>
          </div>
        </div>
      </form>
      {followUpDialog && editId && followUp.info && (
        <CloseFollowUpDialog
          quoteId={editId}
          info={followUp.info}
          onClose={() => setFollowUpDialog(false)}
          onDone={() => {
            setFollowUpDialog(false);
            followUp.reload();
          }}
        />
      )}
    </FormPage>
  );
}
