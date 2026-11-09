import { useEffect, useMemo, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { RecordPickerField } from "../components/RecordPicker";
import { DataTable, Column } from "../components/DataTable";
import { PartyContactButton } from "../components/PartyContactButton";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatDisplayDate } from "../lib/formatDate";
import { resolveReviewDateRange, FiscalPeriodRange } from "../lib/fiscalYearDefaultDate";
import { useDefaultBaseCurrency } from "../lib/useDefaultBaseCurrency";
import { usePersistedState } from "../lib/usePersistedState";
import { api } from "../lib/api";

// «صورتحساب مشتری» (فروش › گزارش)، «صورتحساب تامین‌کننده» (زنجیره تامین › گزارش) و «صورتحساب طرف‌حساب» (حسابداری › گزارش؛ جامع = هر دو نقش) —
// ریز گردش یک طرف‌حساب در یک ارز (انتخاب ارز اجباری است؛ برای یک طرف‌حساب چند ارز هم‌زمان در یک صورتحساب نمی‌آید).
// سطح «کلی» = یک ردیف برای هر سند؛ «ریز» = ردیف قلم کالا (فاکتورها) و ردیف ابزار (دریافت/پرداخت) با ستون‌های کالا، مبلغ، تخفیف و ارزش افزوده.
// هم‌منبع با گزارش «مانده» (backend/src/services/partyStatementService.ts): مانده‌ی پایان این صورتحساب = ستون «مانده»ی گزارش مانده.
// علامت: بدهکار (+) = طرف‌حساب به ما بدهکار است؛ ارزش افزوده‌ی فاکتور ارزی ردیف جدا به ارز پایه می‌آید.

type Scope = "CUSTOMER" | "SUPPLIER" | "ALL";
interface StatementRow {
  id: string;
  key: string;
  isOpening: boolean;
  roleTitle: string;
  kind: string | null;
  kindTitle: string;
  docId: number | null;
  number: number | null;
  date: string | null;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  goodsCode: string | null;
  goodsTitle: string | null;
  quantity: number | null;
  unitTitle: string | null;
  unitPrice: number | null;
  amount: number | null;
  discount: number | null;
  vat: number | null;
}
interface PartyOption { id: number; code: number; title: string }
interface CurrencyOption { id: number; title: string; isBase?: boolean }

const CONFIG: Record<Scope, { slug: string; title: string; noun: string }> = {
  CUSTOMER: { slug: "customers", title: "صورتحساب مشتری", noun: "مشتری" },
  SUPPLIER: { slug: "suppliers", title: "صورتحساب تامین‌کننده", noun: "تامین‌کننده" },
  ALL: { slug: "all", title: "صورتحساب طرف‌حساب", noun: "طرف‌حساب" },
};

/** مسیر باز کردن هر نوع سند */
const DOC_PATH: Record<string, string> = {
  SALES_INVOICE: "/sales-invoices",
  SALES_RETURN: "/sales-return-invoices",
  PURCHASE_INVOICE: "/purchase-invoices",
  SERVICE_PURCHASE_INVOICE: "/service-purchase-invoices",
  PURCHASE_RETURN: "/purchase-returns",
  RECEIPT: "/receipts",
  PAYMENT: "/payments",
  PARTY_SETTLEMENT: "/party-settlements",
  PETTY_CASH_PAYMENT: "/petty-cash-payments",
  CHEQUE_CLEARING_RECEIVABLE: "/cheque-clearings-receivable",
  CHEQUE_CLEARING_PAYABLE: "/cheque-clearings-payable",
};

function SignedCell({ value }: { value: number }) {
  const negative = value < 0;
  return <span className={negative ? "olap-amount-negative" : undefined}>{negative ? `(${formatAmountFa(Math.abs(value))})` : formatAmountFa(value)}</span>;
}

export default function PartyStatement({ scope }: { scope: Scope }) {
  const cfg = CONFIG[scope];
  const base = `/party-statement/${cfg.slug}`;
  const [filters, setFilters] = usePersistedState("form:" + base + ":filters", { partyId: "", partyDisplay: "", currencyId: "", fromDate: "", toDate: "", level: "TOTAL" as "TOTAL" | "DETAIL" });
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const [per, cs, ps]: [FiscalPeriodRange[], CurrencyOption[], PartyOption[]] = await Promise.all([api.get("/fiscal-periods"), api.get("/currencies"), api.get(`${base}/parties`)]);
      setCurrencies(cs);
      setParties(ps);
      setFilters((prev) => (prev.fromDate ? prev : { ...prev, ...resolveReviewDateRange(per) }));
      setReady(true);
    }
    init().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ارز اجباری است؛ پیش‌فرض = ارز پایه
  useDefaultBaseCurrency({ enabled: ready, currencies, current: filters.currencyId, apply: (id) => setFilters((p) => ({ ...p, currencyId: id })) });

  async function load() {
    if (!filters.partyId || !filters.currencyId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ partyId: filters.partyId, currencyId: filters.currencyId, from: filters.fromDate, to: filters.toDate, level: filters.level });
      setData(await api.get(`${base}?${p.toString()}`));
    } catch (e: any) {
      setData(null);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (ready && filters.fromDate) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, filters.partyId, filters.currencyId, filters.fromDate, filters.toDate, filters.level]);

  const rows: StatementRow[] = useMemo(() => (data?.rows ?? []).map((r: any, i: number) => ({ ...r, id: `${i}:${r.key}` })), [data]);
  const detail = filters.level === "DETAIL";

  const columns: Column<StatementRow>[] = useMemo(() => {
    const num = (header: string, get: (r: StatementRow) => number | null, width = "130px", decimal = false): Column<StatementRow> => ({
      header,
      render: (r) => (get(r) === null ? "" : <SignedCell value={get(r) as number} />),
      sortValue: (r) => get(r) ?? 0,
      filterType: "number",
      filterValue: (r) => get(r) ?? 0,
      exportValue: (r: StatementRow) => get(r) ?? "",
      decimal,
      width,
    } as Column<StatementRow>);
    const text = (header: string, get: (r: StatementRow) => string, width?: string): Column<StatementRow> => ({ header, render: get, sortValue: get, filterType: "string", filterValue: get, width });
    const cols: Column<StatementRow>[] = [
      text("شماره سند", (r) => (r.number === null ? "" : toFaDigits(String(r.number))), "100px"),
      { header: "تاریخ سند", render: (r) => (r.date ? formatDisplayDate(r.date) : ""), sortValue: (r) => r.date ?? "", filterType: "date", filterValue: (r) => r.date ?? "", width: "110px" },
      text("شرح", (r) => r.description),
    ];
    if (scope === "ALL") cols.push(text("نقش", (r) => r.roleTitle, "100px"));
    cols.push(num("بدهکار", (r) => r.debit, "140px", true), num("بستانکار", (r) => r.credit, "140px", true), num("مانده در خط", (r) => r.balance, "160px"));
    if (detail) {
      cols.push(
        text("کد کالا", (r) => r.goodsCode ?? "", "130px"),
        text("عنوان کالا", (r) => r.goodsTitle ?? "", "200px"),
        num("مقدار", (r) => r.quantity, "100px"),
        text("واحد", (r) => r.unitTitle ?? "", "80px"),
        num("فی", (r) => r.unitPrice, "130px"),
        num("مبلغ", (r) => r.amount, "140px", true),
        num("تخفیف", (r) => r.discount, "120px", true),
        num("ارزش افزوده", (r) => r.vat, "130px", true)
      );
    }
    return cols;
  }, [scope, detail]);

  const closingFinal = data?.roleBalances?.final ?? null;
  const infoText =
    `ریز گردش یک ${cfg.noun} در یک ارز (انتخاب ارز اجباری است). «کلی»: یک ردیف برای هر سند؛ «ریز»: ردیف قلم کالا و ردیف ابزار دریافت/پرداخت. ` +
    `از اسناد فروش، خرید، دریافت، پرداخت، پرداخت تنخواه و برگشت چک ساخته می‌شود (نه سند حسابداری) و مانده‌ی پایان آن با گزارش «مانده» یکی است. ` +
    `ترتیب: تاریخ سند، بعد تاریخ ایجاد. ارزش افزوده‌ی فاکتور ارزی ردیف جدا به ارز پایه است. هنوز نیامده: برگشت از خرید، فروش فروشگاهی، برگشت چک خرج‌شده.`;

  const partyCols = [
    { header: "کد", render: (p: PartyOption) => toFaDigits(String(p.code)), filterValue: (p: PartyOption) => String(p.code), width: "90px" },
    { header: "عنوان", render: (p: PartyOption) => p.title, filterValue: (p: PartyOption) => p.title },
  ];

  return (
    <div className="party-statement-page">
      {data && (
        <aside className="card party-statement-aside" style={{ width: 250, flexShrink: 0, padding: 14, display: "flex", flexDirection: "column", gap: 10, position: "sticky", top: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{data.party.title}</div>
          <div style={{ color: "var(--muted, #667)", fontSize: 13 }}>کد تفصیلی: {toFaDigits(String(data.party.code ?? ""))}</div>
          <div><PartyContactButton partyId={data.party.id} title="اطلاعات تماس" /></div>
          <hr style={{ width: "100%", border: 0, borderTop: "1px solid var(--border, #ddd)" }} />
          {data.roleBalances.supplier !== null && scope !== "CUSTOMER" && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>مانده خرید:</span><SignedCell value={data.roleBalances.supplier} /></div>
          )}
          {data.roleBalances.customer !== null && scope !== "SUPPLIER" && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>مانده فروش:</span><SignedCell value={data.roleBalances.customer} /></div>
          )}
          {scope === "ALL" && closingFinal !== null && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontWeight: 700 }}><span>مانده نهایی:</span><SignedCell value={closingFinal} /></div>
          )}
          {scope !== "ALL" && closingFinal !== null && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontWeight: 700 }}><span>مانده نهایی:</span><SignedCell value={closingFinal} /></div>
          )}
          <div style={{ color: "var(--muted, #667)", fontSize: 12 }}>ارز: {data.currency.title}</div>
        </aside>
      )}      <div style={{ flex: 1, minWidth: 0 }}>
        <ErrorToast message={error} />
        <div className="card ar-filters">
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
            <div className="form-field-inline">
              <label>{cfg.noun}<RequiredMark /></label>
              <RecordPickerField
                title={`انتخاب ${cfg.noun}`}
                displayValue={filters.partyDisplay}
                rows={parties}
                columns={partyCols}
                onSelect={(p) => setFilters({ ...filters, partyId: String(p.id), partyDisplay: `${toFaDigits(String(p.code))} — ${p.title}` })}
              />
            </div>
            <div className="form-field-inline fx-only">
              <label>ارز<RequiredMark /></label>
              <select value={filters.currencyId} onChange={(e) => setFilters({ ...filters, currencyId: e.target.value })}>
                {currencies.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div className="form-field-inline">
              <label>از تاریخ</label>
              <JalaliDatePicker value={filters.fromDate} onChange={(v) => { if (v !== filters.fromDate) setFilters({ ...filters, fromDate: v }); }} fiscalYear />
            </div>
            <div className="form-field-inline">
              <label>تا تاریخ</label>
              <JalaliDatePicker value={filters.toDate} onChange={(v) => { if (v !== filters.toDate) setFilters({ ...filters, toDate: v }); }} fiscalYear />
            </div>
            <div className="form-field-inline">
              <label>سطح</label>
              <select value={filters.level} onChange={(e) => setFilters({ ...filters, level: e.target.value as "TOTAL" | "DETAIL" })}>
                <option value="TOTAL">کلی (هر سند یک ردیف)</option>
                <option value="DETAIL">ریز (قلم کالا / ابزار)</option>
              </select>
            </div>
            <InfoHint text={infoText} title={cfg.title} />
            <RefreshButton onClick={load} title="رفرش" />
          </div>
        </div>

        {!filters.partyId ? (
          <div className="card" style={{ padding: 16 }}>{cfg.noun} را انتخاب کنید.</div>
        ) : (
          <DataTable<StatementRow>
            key={filters.level}
            columns={columns}
            rows={rows}
            emptyText={loading ? "در حال بارگذاری…" : "رکوردی یافت نشد"}
            edit={{
              path: (r) => `${DOC_PATH[r.kind || ""]}/${r.docId}/edit`,
              guard: (r) => (r.isOpening || !r.kind || !DOC_PATH[r.kind] ? "این ردیف سند مستقل ندارد" : true),
            }}
            autoBestFit
          />
        )}
      </div>


    </div>
  );
}
