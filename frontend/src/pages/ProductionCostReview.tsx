import { useEffect, useMemo, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { ChainedTabsBar } from "../components/ChainedTabsBar";
import { SelectableBalanceTable, BalanceTableColumn } from "../components/SelectableBalanceTable";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { useChainedMultiSelect, SelectId } from "../lib/useChainedMultiSelect";
import { getProductionCostReviewSnapshot, setProductionCostReviewSnapshot } from "../lib/productionCostReviewCache";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { resolveReviewDateRange, FiscalPeriodRange } from "../lib/fiscalYearDefaultDate";
import { useReviewTabLoader, useReviewTabActivation, useReviewTabViewState, serializeForDepsKey } from "../lib/useReviewTabLoader";
import { api } from "../lib/api";
import { ColumnFilterType } from "../components/DataTable";

// «مرور بهای تمام‌شده تولید» (تولید › گزارش) — هم‌الگوی مرورها: تب‌های زنجیره‌ای دوره ← مرکز هزینه ← کالا ← اجزا؛ انتخاب ردیف در یک تب، تب‌های بعد را فیلتر می‌کند.
// داده از نتیجه‌ی ذخیره‌شده‌ی محاسبه می‌آید (backend/src/routes/productionCostReview.ts). تاریخ‌ها الزامی‌اند و پیش‌فرضشان ابتدا تا انتهای دوره‌ی مالی است.

const PERIOD_TAB = 0;
const CENTER_TAB = 1;
const ITEM_TAB = 2;
const COMPONENT_TAB = 3;
const TAB_LABELS = ["دوره", "مرکز هزینه", "کالا", "اجزا"];
const ENDPOINTS = ["periods", "centers", "items", "components"];

const INFO_TEXT =
  "نتیجه‌ی محاسبه‌ی بهای تمام‌شده‌ی دوره‌هایی که با بازه‌ی تاریخ همپوشانی دارند. جریان‌ها (مواد، دستمزد و سربار، ارزش تولید، رسید و تحویل) در دوره‌ها جمع می‌شوند و مانده‌ها (پای کار اول/آخر، منتقل‌نشده) اولین/آخرین دوره را می‌گیرند. «مواد» فقط مواد مصرفی است؛ نیمه‌ساخته‌ی تحویل‌گرفته از مرکز قبل در ستون جدا «هزینه انتقالی» می‌آید (ارزش آن هم در تولید مرکز مبدأ و هم در هزینه انتقالی مرکز مقصد دیده می‌شود، پس برای جمع بدون تکرار ستون «هزینه انتقالی» را کم کنید). «منتقل‌نشده» = تولیدِ ثبت‌شده در آمار که تا پایان دوره نه تحویل شده نه رسید انبار. تب «اجزا»: مواد (و نیمه‌ساخته‌ی انتقالی) هر جزء (مقدار و مبلغ واقعی، استاندارد = مقدار فرمول ساخت × تولید معادل، انحراف = واقعی − استاندارد که به نسبت استانداردِ هر کالا بین کالاهای مرکز تقسیم می‌شود) و هزینه‌ی تبدیل به تفکیک عامل جمع‌آوری و حساب معین؛ دوره‌هایی که پیش از این قابلیت محاسبه شده‌اند در این تب خالی‌اند تا محاسبه‌شان حذف و دوباره زده شود.";

interface Row {
  id: SelectId;
  periodId?: number;
  centerId?: number;
  goodsItemId?: number;
  code?: string | null;
  title?: string | null;
  kind?: string;
  detail?: string;
  [k: string]: any;
}

const KIND_FA: Record<string, string> = { MATERIAL: "ماده", TRANSFER: "هزینه انتقالی (نیمه‌ساخته)", CARRY_MATERIAL: "منتقل‌شده (مواد)", CONVERSION: "هزینه‌ی تبدیل", CARRY_CONVERSION: "منتقل‌شده (تبدیل)" };

const str: ColumnFilterType = "string";
function textCol(header: string, get: (r: Row) => string, width?: string): BalanceTableColumn<Row> {
  return { header, render: (r) => get(r) || "—", sortValue: (r) => get(r), filterType: str, filterValue: (r) => get(r), ...(width ? { width } : {}) };
}
function numCol(header: string, field: string, opts: { decimal?: boolean } = {}): BalanceTableColumn<Row> {
  return {
    header,
    render: (r) => (r[field] === null || r[field] === undefined ? "—" : formatAmountFa(r[field] as number)),
    sortValue: (r) => (r[field] as number) ?? 0,
    filterType: "number",
    filterValue: (r) => (r[field] as number) ?? 0,
    decimal: !!opts.decimal,
    totalValue: (r) => (r[field] as number) ?? 0,
  };
}

export default function ProductionCostReview() {
  const snapshot = getProductionCostReviewSnapshot();
  const [periodsLoaded, setPeriodsLoaded] = useState(false);
  const [filters, setFilters] = useState(snapshot?.filters ?? { fromDate: "", toDate: "" });
  const [activeTab, setActiveTab] = useState(snapshot?.activeTab ?? 0);
  const [tabData, setTabData] = useState<Record<number, Row[]>>((snapshot?.tabData as Record<number, Row[]>) ?? {});
  const tabLoader = useReviewTabLoader(snapshot?.loadedTabs ?? []);
  const [error, setError] = useState<string | null>(null);
  const chain = useChainedMultiSelect(snapshot?.chainState);
  const tabView = useReviewTabViewState(activeTab, snapshot?.tabViewState ?? {});
  const datesOk = !!filters.fromDate && !!filters.toDate;

  useEffect(() => {
    setProductionCostReviewSnapshot({
      chainState: { selections: chain.selections, order: chain.order },
      activeTab,
      filters,
      tabData,
      tabViewState: tabView.viewState,
      loadedTabs: Array.from(tabLoader.loadedTabs),
    });
  }, [chain.selections, chain.order, activeTab, filters, tabData, tabView.viewState, tabLoader.loadedTabs]);

  // پیش‌فرض تاریخ‌ها مثل مرور حساب‌ها: ابتدا تا انتهای دوره‌ی مالی انتخاب‌شده
  useEffect(() => {
    (async () => {
      const per: FiscalPeriodRange[] = await api.get("/fiscal-periods");
      setPeriodsLoaded(true);
      setFilters((prev) => (prev.fromDate || prev.toDate ? prev : resolveReviewDateRange(per)));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // فیلتر مؤثر روی هر تب = انتخاب‌های تب‌های «قبلی» زنجیره
  function buildParams(tabIndex: number) {
    const periods = new Set<string>();
    const centers = new Set<string>();
    const items = new Set<string>();
    for (const t of chain.tabsBefore(tabIndex)) {
      const rows = tabData[t] || [];
      for (const id of chain.get(t)) {
        const row = rows.find((r) => String(r.id) === String(id));
        if (!row) continue;
        if (t === PERIOD_TAB && row.periodId != null) periods.add(String(row.periodId));
        if (t === CENTER_TAB && row.centerId != null) centers.add(String(row.centerId));
        if (t === ITEM_TAB && row.goodsItemId != null) items.add(String(row.goodsItemId));
      }
    }
    const p = new URLSearchParams();
    p.set("fromDate", filters.fromDate);
    p.set("toDate", filters.toDate);
    if (periods.size) p.set("periodIds", Array.from(periods).join(","));
    if (centers.size) p.set("centerIds", Array.from(centers).join(","));
    if (items.size) p.set("itemIds", Array.from(items).join(","));
    return p;
  }

  async function loadTab(tabIndex: number) {
    if (!datesOk) return;
    await tabLoader.run(
      tabIndex,
      async (isStale) => {
        const data = await api.get(`/production-cost-review/${ENDPOINTS[tabIndex]}?${buildParams(tabIndex).toString()}`);
        if (isStale()) return;
        setTabData((prev) => ({ ...prev, [tabIndex]: data }));
      },
      setError
    );
  }

  const activationDepsKey = useMemo(() => serializeForDepsKey({ upstream: chain.upstream(activeTab), filters }), [chain.selections, chain.order, activeTab, filters]);
  // بدون «از تاریخ» و «تا تاریخ» گزارش بارگذاری/نمایش داده نمی‌شود
  useReviewTabActivation(periodsLoaded && datesOk, activeTab, tabLoader.loadedTabs, (tab) => loadTab(tab), activationDepsKey);

  function clearFilters() {
    chain.reset();
    setTabData({});
    tabView.reset();
    tabLoader.resetLoaded();
    setActiveTab(0);
  }

  // تغییر بازه‌ی تاریخ فقط داده‌ی بارگذاری‌شده را باطل می‌کند؛ انتخاب‌ها و فیلتر ستون‌ها می‌مانند
  function invalidateData() {
    setTabData({});
    tabLoader.resetLoaded();
  }

  const tabDefs = TAB_LABELS.map((label, idx) => ({ key: `pcr-${idx}`, label, count: idx === COMPONENT_TAB ? 0 : chain.get(idx).size }));

  const columns = useMemo((): BalanceTableColumn<Row>[] => {
    if (activeTab === COMPONENT_TAB) {
      return [
        textCol("نوع", (r) => KIND_FA[r.kind ?? ""] ?? "", "130px"),
        textCol("شرح", (r) => r.title || ""),
        textCol("عامل جمع‌آوری / شاخه", (r) => r.detail || "", "170px"),
        numCol("مقدار واقعی", "actualQty"),
        numCol("مبلغ واقعی", "actualAmount", { decimal: true }),
        numCol("مقدار استاندارد", "standardQty"),
        numCol("مبلغ استاندارد", "standardAmount", { decimal: true }),
        numCol("انحراف مقدار", "varianceQty"),
        numCol("انحراف مبلغ", "varianceAmount", { decimal: true }),
      ];
    }
    // مانده‌های اول/آخر دوره بین «دوره‌ها» جمع‌پذیر نیستند؛ بین مراکز/کالاها جمع‌پذیرند
    const bal = activeTab !== PERIOD_TAB;
    const cols: BalanceTableColumn<Row>[] = [];
    if (activeTab !== PERIOD_TAB) cols.push({ header: "کد", render: (r) => (r.code ? toFaDigits(String(r.code)) : "—"), sortValue: (r) => r.code ?? "", width: "100px", filterType: str, filterValue: (r) => r.code ?? "" });
    cols.push(textCol(TAB_LABELS[activeTab], (r) => r.title || ""));
    if (activeTab === ITEM_TAB) cols.push(numCol("تولید (آمار)", "finishedQty"));
    cols.push(
      numCol("پای کار اول", "openingWip", { decimal: bal }),
      numCol("مواد", "materialCost", { decimal: true }),
      numCol("هزینه انتقالی", "transferredCost", { decimal: true }),
      numCol("دستمزد و سربار", "conversionCost", { decimal: true }),
      numCol("ارزش تولید", "finishedValue", { decimal: true })
    );
    if (activeTab === ITEM_TAB) cols.push(numCol("تعداد رسید", "receiptQty"));
    cols.push(numCol("ارزش رسید", "receiptValue", { decimal: true }));
    if (activeTab === ITEM_TAB) cols.push(numCol("تعداد تحویل", "deliveredQty"));
    cols.push(numCol("ارزش تحویل", "deliveredValue", { decimal: true }));
    if (activeTab === ITEM_TAB) cols.push(numCol("تعداد منتقل‌نشده", "heldEndQty"));
    cols.push(numCol("مبلغ منتقل‌نشده", "heldEndValue", { decimal: bal }), numCol("پای کار آخر", "endingWip", { decimal: bal }));
    if (activeTab === ITEM_TAB) cols.push(numCol("فی واحد", "unitCost"));
    return cols;
  }, [activeTab]);

  return (
    <div>
      <ErrorToast message={error} />
      <div className="card ar-filters">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
          <div className="form-field-inline">
            <label>از تاریخ</label>
            <JalaliDatePicker value={filters.fromDate} onChange={(v) => { if (v === filters.fromDate) return; setFilters((p) => ({ ...p, fromDate: v })); invalidateData(); }} />
          </div>
          <div className="form-field-inline">
            <label>تا تاریخ</label>
            <JalaliDatePicker value={filters.toDate} onChange={(v) => { if (v === filters.toDate) return; setFilters((p) => ({ ...p, toDate: v })); invalidateData(); }} />
          </div>
        </div>
      </div>

      <ChainedTabsBar
        tabs={tabDefs}
        activeIndex={activeTab}
        onChange={setActiveTab}
        actions={
          <>
            <InfoHint text={INFO_TEXT} title="مرور بهای تمام‌شده تولید" />
            <RefreshButton onClick={() => loadTab(activeTab)} title="رفرش تب جاری" />
          </>
        }
        onClearFilters={clearFilters}
      />

      {!datesOk && (
        <div className="card" role="alert" style={{ padding: "10px 14px", marginBottom: 8 }}>
          «از تاریخ» و «تا تاریخ» الزامی است؛ تا هر دو انتخاب نشوند گزارش نمایش داده نمی‌شود.
        </div>
      )}

      <SelectableBalanceTable
        stateKey={activeTab}
        rows={datesOk ? tabData[activeTab] || [] : []}
        columns={columns}
        selectable={activeTab !== COMPONENT_TAB}
        selected={chain.get(activeTab)}
        onToggle={(id: SelectId) => chain.toggle(activeTab, id)}
        loading={tabLoader.loading}
        restoreFilters={tabView.restoreFilters}
        restoreSort={tabView.restoreSort}
        onFiltersChange={tabView.onFiltersChange}
        onSortChange={tabView.onSortChange}
      />
    </div>
  );
}
