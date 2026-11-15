import { useEffect, useMemo, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { ChainedTabsBar } from "../components/ChainedTabsBar";
import { SelectableBalanceTable, BalanceTableColumn } from "../components/SelectableBalanceTable";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { useChainedMultiSelect, SelectId } from "../lib/useChainedMultiSelect";
import { getPartyBalanceReviewSnapshot, setPartyBalanceReviewSnapshot } from "../lib/partyBalanceReviewCache";
import { toFaDigits } from "../lib/formatAmount";
import { resolveReviewDateRange, FiscalPeriodRange } from "../lib/fiscalYearDefaultDate";
import { useReviewTabLoader, useReviewTabActivation, useReviewTabViewState, serializeForDepsKey } from "../lib/useReviewTabLoader";
import { useFxEnabled } from "../lib/useEntitlements";
import { api } from "../lib/api";
import { ColumnFilterType } from "../components/DataTable";
import { SignedCell } from "../components/reviewColumns";

// «مانده مشتریان» (فروش › گزارش)، «مانده تامین‌کنندگان» (زنجیره تامین › گزارش) و «مانده طرف‌حساب‌ها» (حسابداری › گزارش؛ هر دو نقش، تفکیکی یا تجمیعی) —
// گزارش از پایه‌ی «مرورها» (هم‌الگوی مرور گروه دارایی): دو تب زنجیره‌ای «گروه» (اول) و «طرف‌حساب»؛ انتخاب ردیف در هر تب، تب بعدی را فیلتر می‌کند
// (گروه‌های انتخاب‌شده ← فقط طرف‌حساب‌های آن گروه‌ها؛ طرف‌حساب‌های انتخاب‌شده ← تب گروه فقط همین طرف‌حساب‌ها را جمع می‌زند) — ارزِ ردیفِ انتخاب‌شده هم همراه فیلتر می‌شود.
// ستون‌ها مثل «مرور فروش و خرید» سام (Documents/SaleAndPurchaseBillReview.xlsx): کد، عنوان، ارز، مانده اول دوره، فروش (خرید)، برگشت، تخفیف، ارزش افزوده، خالص، دریافت، پرداخت، مانده.
// همه مبلغ‌ها علامت‌دار (بدهکار مثبت، بستانکار منفی، منفی‌ها قرمز داخل پرانتز)؛ خالص = فروش + برگشت + تخفیف + ارزش افزوده؛ مانده = اول دوره + خالص + دریافت + پرداخت.
// گزارش عملیاتی است (از اسناد، نه سند حسابداری) و فقط داخل سال مالی انتخاب‌شده کار می‌کند. مبالغ به ارز خودِ سند و ارزش افزوده به ارز پایه (ردیف ریال).
// منطق: backend/src/services/partyBalanceReportService.ts.

type Scope = "CUSTOMER" | "SUPPLIER" | "ALL";
interface Figures {
  opening: number;
  sale: number;
  saleReturn: number;
  discount: number;
  vat: number;
  net: number;
  received: number;
  paid: number;
  closing: number;
}
interface PartyRow extends Figures {
  id: SelectId;
  key: string;
  role: "CUSTOMER" | "SUPPLIER" | null;
  roleTitle: string;
  partyId: number;
  partyCode: number | null;
  partyTitle: string;
  currencyId: number;
  currencyTitle: string;
  customerClosing: number | null;
  supplierClosing: number | null;
}
/** ردیف تب «گروه»: نقش × گروه × ارز (گروه مشتری و گروه تامین‌کننده دو فهرست جدا هستند) */
interface GroupRow extends Figures {
  id: SelectId;
  key: string;
  role: "CUSTOMER" | "SUPPLIER";
  roleTitle: string;
  groupId: number | null;
  groupTitle: string;
  currencyId: number;
  currencyTitle: string;
  partyCount: number;
}
interface CurrencyOption { id: number; title: string }

const AMOUNT_KEYS = ["opening", "sale", "saleReturn", "discount", "vat", "net", "received", "paid", "closing"] as const;

const GROUP_TAB = 0;
const PARTY_TAB = 1;

const CONFIG: Record<Scope, { slug: string; title: string; noun: string; groupLabel: string; sale: string; ret: string }> = {
  CUSTOMER: { slug: "customers", title: "مانده مشتریان", noun: "مشتری", groupLabel: "گروه مشتری", sale: "فروش", ret: "برگشت فروش" },
  SUPPLIER: { slug: "suppliers", title: "مانده تامین‌کنندگان", noun: "تامین‌کننده", groupLabel: "گروه تامین‌کننده", sale: "خرید", ret: "برگشت خرید" },
  ALL: { slug: "all", title: "مانده طرف‌حساب‌ها", noun: "طرف‌حساب", groupLabel: "گروه", sale: "فروش / خرید", ret: "برگشت فروش / خرید" },
};

/** اعداد منفی به‌شکل متعارف حسابداری (داخل پرانتز و قرمز) — همان الگوی صفحه‌های مرور؛ کلاس olap-amount-negative در styles.css هست. */
export default function PartyBalanceReport({ scope }: { scope: Scope }) {
  const cfg = CONFIG[scope];
  const base = `/party-balance-report/${cfg.slug}`;
  const fxEnabled = useFxEnabled();
  const snapshot = getPartyBalanceReviewSnapshot();
  const [periodsLoaded, setPeriodsLoaded] = useState(false);
  const [filters, setFilters] = useState(snapshot?.filters ?? { fromDate: "", toDate: "", currencyId: "", mode: "SEPARATE" as "SEPARATE" | "CONSOLIDATED", onlyWithBalance: false, bothRoles: false });
  const [activeTab, setActiveTab] = useState(snapshot?.activeTab ?? GROUP_TAB);
  const [tabData, setTabData] = useState<Record<number, (GroupRow | PartyRow)[]>>(snapshot?.tabData ?? {});
  const tabLoader = useReviewTabLoader(snapshot?.loadedTabs ?? []);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const chain = useChainedMultiSelect(snapshot?.chainState);
  const tabView = useReviewTabViewState(activeTab, snapshot?.tabViewState ?? {});

  useEffect(() => {
    setPartyBalanceReviewSnapshot({
      chainState: { selections: chain.selections, order: chain.order },
      activeTab,
      filters,
      tabData,
      tabViewState: tabView.viewState,
      loadedTabs: Array.from(tabLoader.loadedTabs),
    });
  }, [chain.selections, chain.order, activeTab, filters, tabData, tabView.viewState, tabLoader.loadedTabs]);

  useEffect(() => {
    async function init() {
      const [per, cs]: [FiscalPeriodRange[], CurrencyOption[]] = await Promise.all([api.get("/fiscal-periods"), api.get("/currencies")]);
      setCurrencies(cs);
      setPeriodsLoaded(true);
      setFilters((prev) => (prev.fromDate ? prev : { ...prev, ...resolveReviewDateRange(per) }));
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildParams(tabIndex: number) {
    const p = new URLSearchParams();
    p.set("from", filters.fromDate);
    p.set("to", filters.toDate);
    p.set("tab", tabIndex === GROUP_TAB ? "GROUP" : "PARTY");
    if (filters.currencyId) p.set("currencyId", filters.currencyId);
    if (scope === "ALL") p.set("mode", filters.mode);
    if (filters.onlyWithBalance) p.set("onlyWithBalance", "1");
    if (scope === "ALL" && filters.bothRoles) p.set("bothRoles", "1");
    const groupKeys = new Set<string>();
    const partyKeys = new Set<string>();
    for (const t of chain.tabsBefore(tabIndex)) {
      const rows = tabData[t] || [];
      for (const id of chain.get(t)) {
        const row: any = rows.find((r) => String(r.id) === String(id));
        if (!row) continue;
        // ارز ردیف هم همراه انتخاب به تب بعد منتقل می‌شود (گروه/طرف‌حساب + ارز)
        if (t === GROUP_TAB) groupKeys.add(`${row.role}:${row.groupId ?? 0}:${row.currencyId}`);
        if (t === PARTY_TAB) partyKeys.add(`${row.partyId}:${row.currencyId}`);
      }
    }
    if (groupKeys.size) p.set("groupKeys", Array.from(groupKeys).join(","));
    if (partyKeys.size) p.set("partyKeys", Array.from(partyKeys).join(","));
    return p;
  }

  async function loadTab(tab: number) {
    await tabLoader.run(
      tab,
      async (isStale) => {
        const res = await api.get(`${base}?${buildParams(tab).toString()}`);
        if (isStale()) return;
        const rows = (tab === GROUP_TAB ? res.groupRows : res.rows).map((r: any) => ({ ...r, id: r.key }));
        setTabData((prev) => ({ ...prev, [tab]: rows }));
      },
      setError
    );
  }

  const activationDepsKey = useMemo(() => serializeForDepsKey({ upstream: chain.upstream(activeTab), filters }), [chain.selections, chain.order, activeTab, filters]);
  useReviewTabActivation(periodsLoaded && !!filters.fromDate, activeTab, tabLoader.loadedTabs, (tab) => loadTab(tab), activationDepsKey);

  // «حذف همه فیلترها»: انتخاب‌های زنجیره‌ای هم فیلتر محسوب می‌شوند؛ فقط بازه‌ی تاریخ و گزینه‌های بالای گزارش می‌مانند
  function clearFilters() {
    chain.reset();
    setTabData({});
    tabView.reset();
    tabLoader.resetLoaded();
    setActiveTab(GROUP_TAB);
  }

  // تغییر فیلترهای بالا فقط داده‌ی بارگذاری‌شده را باطل می‌کند؛ انتخاب‌ها، فیلتر/مرتب‌سازی ستون‌ها و تب فعال می‌مانند
  function invalidateData() {
    setTabData({});
    tabLoader.resetLoaded();
  }
  function change(patch: Partial<typeof filters>) {
    setFilters((p) => ({ ...p, ...patch }));
    invalidateData();
  }

  const consolidated = scope === "ALL" && filters.mode === "CONSOLIDATED";
  const tabDefs = [
    { key: "pbr-0", label: cfg.groupLabel, count: chain.get(GROUP_TAB).size },
    { key: "pbr-1", label: cfg.noun, count: chain.get(PARTY_TAB).size },
  ];
  // جمعِ پایین جدول فقط وقتی معنی دارد که ارزها قاطی نشوند (بدون زیرسیستم ارزی، یا با فیلتر یک ارز)
  const sumTotals = !fxEnabled || !!filters.currencyId;

  const figureCols = <T extends Figures>(): BalanceTableColumn<T>[] => {
    const col = (header: string, get: (r: T) => number, width: string): BalanceTableColumn<T> => ({
      header,
      render: (r) => <SignedCell value={get(r)} />,
      sortValue: get,
      filterType: "number",
      filterValue: get,
      exportValue: get,
      decimal: sumTotals,
      width,
    });
    return [
      col("مانده اول دوره", (r) => r.opening, "150px"),
      col(cfg.sale, (r) => r.sale, "140px"),
      col(cfg.ret, (r) => r.saleReturn, "140px"),
      col("تخفیف", (r) => r.discount, "130px"),
      col("ارزش افزوده", (r) => r.vat, "140px"),
      col("خالص", (r) => r.net, "150px"),
      col("دریافت", (r) => r.received, "140px"),
      col("پرداخت", (r) => r.paid, "140px"),
      col("مانده", (r) => r.closing, "160px"),
    ];
  };

  const groupColumns = useMemo((): BalanceTableColumn<GroupRow>[] => {
    const str: ColumnFilterType = "string";
    const text = (header: string, get: (r: GroupRow) => string, width?: string): BalanceTableColumn<GroupRow> => ({ header, render: get, sortValue: get, filterType: str, filterValue: get, width });
    return [
      ...(scope === "ALL" ? [text("نقش", (r) => r.roleTitle, "130px")] : []),
      text(cfg.groupLabel, (r) => r.groupTitle),
      { ...text("ارز", (r) => r.currencyTitle, "90px"), fxOnly: true },
      { header: `تعداد ${cfg.noun}`, render: (r) => toFaDigits(String(r.partyCount)), sortValue: (r) => r.partyCount, filterType: "number", filterValue: (r) => r.partyCount, width: "110px" },
      ...figureCols<GroupRow>(),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, sumTotals]);

  const partyColumns = useMemo((): BalanceTableColumn<PartyRow>[] => {
    const str: ColumnFilterType = "string";
    const text = (header: string, get: (r: PartyRow) => string, width?: string): BalanceTableColumn<PartyRow> => ({ header, render: get, sortValue: get, filterType: str, filterValue: get, width });
    const extra = (header: string, get: (r: PartyRow) => number): BalanceTableColumn<PartyRow> => ({ header, render: (r) => <SignedCell value={get(r)} />, sortValue: get, filterType: "number", filterValue: get, exportValue: get, decimal: sumTotals, width: "150px" });
    return [
      text(`کد ${cfg.noun}`, (r) => (r.partyCode === null ? "" : toFaDigits(String(r.partyCode))), "90px"),
      text(`عنوان ${cfg.noun}`, (r) => r.partyTitle),
      ...(scope === "ALL" ? [text("نقش", (r) => r.roleTitle, "130px")] : []),
      { ...text("ارز", (r) => r.currencyTitle, "90px"), fxOnly: true },
      ...figureCols<PartyRow>(),
      ...(consolidated ? [extra("مانده به عنوان مشتری", (r) => r.customerClosing ?? 0), extra("مانده به عنوان تامین‌کننده", (r) => r.supplierClosing ?? 0)] : []),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, consolidated, sumTotals]);

  // «جمع کل به تفکیک ارز»: کارت مستقل زیر جدول (فقط در این گزارش‌ها؛ پایه‌ی مرورها دست‌نخورده)، فقط وقتی ردیف‌های تب فعال بیش از یک ارز دارند — جمع ارزهای مختلف
  // بی‌معنی است، پس هر ارز جدا جمع می‌شود. از همه‌ی ردیف‌های بارگذاری‌شده‌ی تب فعال جمع می‌زند (فیلتر ستون‌های جدول را نمی‌بیند).
  const currencyTotals = useMemo(() => {
    const by = new Map<number, { title: string } & Figures>();
    for (const r of (tabData[activeTab] || []) as Figures[] & { currencyId: number; currencyTitle: string }[]) {
      const row = r as unknown as Figures & { currencyId: number; currencyTitle: string };
      let t = by.get(row.currencyId);
      if (!t) by.set(row.currencyId, (t = { title: row.currencyTitle, opening: 0, sale: 0, saleReturn: 0, discount: 0, vat: 0, net: 0, received: 0, paid: 0, closing: 0 }));
      for (const k of AMOUNT_KEYS) t[k] += row[k];
    }
    return [...by.values()];
  }, [tabData, activeTab]);
  // کارت وقتی دیده می‌شود که جمعِ فوتر جدول نیست (زیرسیستم ارزی روشن و فیلتر یک ارز نیست، حتی اگر ردیف‌های همین تب تک‌ارزی باشند — مثلاً بعد از انتخاب یک ردیف گروه که ارزش هم همراه فیلتر می‌شود) یا ارزها بیش از یکی‌اند
  const totalsCard =
    currencyTotals.length > 0 && (!sumTotals || currencyTotals.length > 1) ? (
      <div className="card" style={{ padding: 12, marginTop: 8, fontSize: 13.5, overflowX: "auto" }}>
        <b>جمع کل به تفکیک ارز</b>
        <table className="je-lines-table" style={{ width: "100%", marginTop: 6 }}>
          <thead>
            <tr>
              <th>ارز</th>
              <th>مانده اول دوره</th>
              <th>{cfg.sale}</th>
              <th>{cfg.ret}</th>
              <th>تخفیف</th>
              <th>ارزش افزوده</th>
              <th>خالص</th>
              <th>دریافت</th>
              <th>پرداخت</th>
              <th>مانده</th>
            </tr>
          </thead>
          <tbody>
            {currencyTotals.map((t) => (
              <tr key={t.title}>
                <td>{t.title}</td>
                {AMOUNT_KEYS.map((k) => <td key={k}><SignedCell value={t[k]} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : null;

  const infoText =
    `در تب «${cfg.groupLabel}» می‌توانید یک یا چند ردیف را انتخاب کنید تا تب «${cfg.noun}» فقط ${cfg.noun}‌های همان گروه‌ها — در همان ارزِ ردیف انتخاب‌شده — را نشان دهد؛ برعکس، با انتخاب ${cfg.noun} در تب دوم، تب گروه فقط همین ${cfg.noun}‌ها را (در همان ارز) جمع می‌زند. ` +
    `مانده از روی اسناد (فاکتور، دریافت و پرداخت، تنخواه، برگشت چک) و «مانده اول دوره» است؛ نه از سند حسابداری — پس فاکتوری که هنوز سند نخورده هم دیده می‌شود. ` +
    `فقط داخل سال مالی انتخاب‌شده کار می‌کند و مانده‌ی اول دوره = افتتاحیه‌ی سال + گردش قبل از «از تاریخ». همه‌ی مبلغ‌ها علامت‌دار است: مثبت یعنی طرف‌حساب به ما بدهکار است و منفی (قرمز، داخل پرانتز) یعنی ما به او بدهکاریم. ` +
    `خالص = ${cfg.sale} + برگشت + تخفیف + ارزش افزوده؛ مانده = اول دوره + خالص + دریافت + پرداخت. مبلغ فاکتور به ارز خودِ سند و ارزش افزوده همیشه به ارز پایه می‌آید (فاکتور دلاری = ردیف دلاری برای مبلغ + ردیف ریالی برای ارزش افزوده)؛ ارزهای مختلف جدا می‌مانند` +
    `${fxEnabled ? " و ردیف «جمع» فقط با فیلتر یک ارز نمایش داده می‌شود" : ""}.` +
    `${scope === "ALL" ? " «تجمیعی»: در تب طرف‌حساب یک ردیف برای هر طرف‌حساب (جمع جبری دو نقش) با مانده‌ی هر نقش در ستون‌های جدا؛ تب گروه همیشه به تفکیک نقش است." : ""} ` +
    `هنوز در مانده نیامده: برگشت از خرید (سند انبار)، فروش فروشگاهی، برگشت چک خرج‌شده.`;

  return (
    <div>
      <ErrorToast message={error} />

      <div className="card ar-filters">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
          <div className="form-field-inline">
            <label>از تاریخ</label>
            <JalaliDatePicker value={filters.fromDate} onChange={(v) => { if (v !== filters.fromDate) change({ fromDate: v }); }} fiscalYear />
          </div>
          <div className="form-field-inline">
            <label>تا تاریخ</label>
            <JalaliDatePicker value={filters.toDate} onChange={(v) => { if (v !== filters.toDate) change({ toDate: v }); }} fiscalYear />
          </div>
          <div className="form-field-inline fx-only">
            <label>ارز</label>
            <select value={filters.currencyId} onChange={(e) => change({ currencyId: e.target.value })}>
              <option value="">همه</option>
              {currencies.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          {scope === "ALL" && (
            <div className="form-field-inline">
              <label>نمایش</label>
              <select value={filters.mode} onChange={(e) => change({ mode: e.target.value as "SEPARATE" | "CONSOLIDATED" })}>
                <option value="SEPARATE">تفکیکی (به تفکیک نقش)</option>
                <option value="CONSOLIDATED">تجمیعی (هر طرف‌حساب یک ردیف)</option>
              </select>
            </div>
          )}
          <label className="checkbox-row"><input type="checkbox" checked={filters.onlyWithBalance} onChange={(e) => change({ onlyWithBalance: e.target.checked })} /> فقط دارای مانده</label>
          {scope === "ALL" && (
            <label className="checkbox-row"><input type="checkbox" checked={filters.bothRoles} onChange={(e) => change({ bothRoles: e.target.checked })} /> فقط طرف‌حساب‌های دو نقشه</label>
          )}
        </div>
      </div>

      <ChainedTabsBar
        tabs={tabDefs}
        activeIndex={activeTab}
        onChange={setActiveTab}
        actions={
          <>
            <InfoHint text={infoText} title={cfg.title} />
            <RefreshButton onClick={() => loadTab(activeTab)} title="رفرش تب جاری" />
          </>
        }
        onClearFilters={clearFilters}
      />

      {activeTab === GROUP_TAB && (
        <>
        <SelectableBalanceTable
          stateKey={GROUP_TAB}
          rows={(tabData[GROUP_TAB] || []) as GroupRow[]}
          columns={groupColumns}
          selected={chain.get(GROUP_TAB)}
          onToggle={(id: SelectId) => chain.toggle(GROUP_TAB, id)}
          loading={tabLoader.loading}
          emptyText="داده‌ای برای این بازه وجود ندارد"
          autoBestFit
          restoreFilters={tabView.restoreFilters}
          restoreSort={tabView.restoreSort}
          onFiltersChange={tabView.onFiltersChange}
          onSortChange={tabView.onSortChange}
        />
          {totalsCard}
        </>
      )}

      {activeTab === PARTY_TAB && (
        <>
        <SelectableBalanceTable
          stateKey={PARTY_TAB}
          rows={(tabData[PARTY_TAB] || []) as PartyRow[]}
          columns={partyColumns}
          selected={chain.get(PARTY_TAB)}
          onToggle={(id: SelectId) => chain.toggle(PARTY_TAB, id)}
          loading={tabLoader.loading}
          emptyText="داده‌ای برای این بازه وجود ندارد"
          autoBestFit
          restoreFilters={tabView.restoreFilters}
          restoreSort={tabView.restoreSort}
          onFiltersChange={tabView.onFiltersChange}
          onSortChange={tabView.onSortChange}
        />
          {totalsCard}
        </>
      )}
    </div>
  );
}
