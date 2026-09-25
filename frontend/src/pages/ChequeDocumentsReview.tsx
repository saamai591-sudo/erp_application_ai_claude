import { useEffect, useMemo, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { ChainedTabsBar } from "../components/ChainedTabsBar";
import { SelectableBalanceTable, BalanceTableColumn } from "../components/SelectableBalanceTable";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { useChainedMultiSelect, SelectId } from "../lib/useChainedMultiSelect";
import { getChequeReviewSnapshot, setChequeReviewSnapshot } from "../lib/chequeReviewCache";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { resolveReviewDateRange, FiscalPeriodRange } from "../lib/fiscalYearDefaultDate";
import { useReviewTabLoader, useReviewTabActivation, useReviewTabViewState, serializeForDepsKey } from "../lib/useReviewTabLoader";
import { useTabs } from "../lib/TabsContext";
import { api } from "../lib/api";

// گزارش‌های «مرور اسناد دریافتنی» و «مرور اسناد پرداختنی» (مدیریت نقدینگی و چک > گزارش) — Documents/تغییرات نقدینگی و چک راه اندازی مرور
// اسناد دریافتی و پرداختی.md. سه تب زنجیره‌ای: «وضعیت» (هر وضعیت چک) ← «اسناد» (چک‌ها) ← «جزئیات» (رویدادهای اسنادِ تاییدشده‌ی چک‌ها).
// بازه‌ی تاریخ = تاریخ اسناد (دریافت/صدور/واگذاری/وصول...) و به‌صورت پیش‌فرض دوره‌ی مالی جاری است؛ بازه‌ی چنددوره‌ای مجاز نیست
// (کنترل قطعی در بک‌اند: services/chequeReviewService.ts). هر دو گزارش یک کامپوننت‌اند و فقط kind فرق دارد.

type Kind = "receivable" | "payable";

interface StatusRow { id: SelectId; status: string; title: string; count: number; amount: number }
interface ChequeRow { id: number; number: string; partyDisplay: string; bankBranchTitle: string; dueDate: string; amount: number; status: string; statusTitle: string; firstDate: string | null; lastDate: string | null; eventCount: number }
interface DetailRow { id: number; chequeId: number; chequeNumber: string; partyDisplay: string; amount: number; date: string; typeTitle: string; docRoute: string | null; docId: number | null; docNumber: number | null; description: string | null; chequeStatusTitle: string }

const STATUS_TAB = 0;
const CHEQUE_TAB = 1;
const DETAIL_TAB = 2;
const TAB_LABELS = ["وضعیت", "اسناد", "جزئیات"];
const ENDPOINT = ["statuses", "cheques", "details"];

const CONFIG: Record<Kind, { title: string; info: string }> = {
  receivable: {
    title: "مرور اسناد دریافتنی",
    info:
      "چک‌های دریافتنی (اسناد دریافتنی) دوره‌ی مالی. در تب «وضعیت» یک یا چند وضعیت را انتخاب کنید تا تب «اسناد» فقط چک‌های همان وضعیت‌ها را نشان دهد؛ " +
      "انتخاب چک‌ها در تب «اسناد» تب «جزئیات» (رسید دریافت، خرج چک، واگذاری به بانک، برگشت از واگذاری، وصول/برگشت) را فیلتر می‌کند. " +
      "بازه‌ی تاریخ بر اساس تاریخ اسناد است و نباید بیش از یک دوره‌ی مالی را شامل شود؛ مبالغ به ارز پایه و فقط از اسناد تاییدشده‌اند.",
  },
  payable: {
    title: "مرور اسناد پرداختنی",
    info:
      "چک‌های پرداختنی (اسناد پرداختنی) دوره‌ی مالی. در تب «وضعیت» یک یا چند وضعیت را انتخاب کنید تا تب «اسناد» فقط چک‌های همان وضعیت‌ها را نشان دهد؛ " +
      "انتخاب چک‌ها در تب «اسناد» تب «جزئیات» (صدور چک، وصول/برگشت) را فیلتر می‌کند. " +
      "بازه‌ی تاریخ بر اساس تاریخ اسناد است و نباید بیش از یک دوره‌ی مالی را شامل شود؛ مبالغ به ارز پایه و فقط از اسناد تاییدشده‌اند.",
  },
};

function periodOf(date: string, periods: FiscalPeriodRange[]): FiscalPeriodRange | undefined {
  return periods.find((p) => p.fromDate.slice(0, 10) <= date && date <= p.toDate.slice(0, 10));
}

export default function ChequeDocumentsReview({ kind }: { kind: Kind }) {
  const cfg = CONFIG[kind];
  const { openTab } = useTabs();
  const snapshot = getChequeReviewSnapshot(kind);
  const [periods, setPeriods] = useState<FiscalPeriodRange[]>([]);
  const [periodsLoaded, setPeriodsLoaded] = useState(false);
  const [filters, setFilters] = useState(snapshot?.filters ?? { fromDate: "", toDate: "" });
  const [activeTab, setActiveTab] = useState(snapshot?.activeTab ?? 0);
  const [tabData, setTabData] = useState<Record<number, any[]>>(snapshot?.tabData ?? {});
  const tabLoader = useReviewTabLoader(snapshot?.loadedTabs ?? []);
  const [error, setError] = useState<string | null>(null);
  const chain = useChainedMultiSelect(snapshot?.chainState);
  const tabView = useReviewTabViewState(activeTab, snapshot?.tabViewState ?? {});

  useEffect(() => {
    setChequeReviewSnapshot(kind, { chainState: { selections: chain.selections, order: chain.order }, activeTab, filters, tabData, tabViewState: tabView.viewState, loadedTabs: Array.from(tabLoader.loadedTabs) });
  }, [chain.selections, chain.order, activeTab, filters, tabData, tabView.viewState, tabLoader.loadedTabs, kind]);

  useEffect(() => {
    async function init() {
      const per: FiscalPeriodRange[] = await api.get("/fiscal-periods");
      setPeriods(per);
      setPeriodsLoaded(true);
      setFilters((prev) => (prev.fromDate ? prev : resolveReviewDateRange(per)));
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** بازه‌ی چنددوره‌ای مجاز نیست: اگر «از» و «تا» در یک دوره‌ی مالی نباشند پیام برمی‌گرداند */
  function rangeError(f: { fromDate: string; toDate: string }): string | null {
    if (!f.fromDate || !f.toDate) return null;
    if (f.toDate < f.fromDate) return "«تا تاریخ» نباید قبل از «از تاریخ» باشد";
    const a = periodOf(f.fromDate, periods);
    const b = periodOf(f.toDate, periods);
    if (!a || !b) return "بازه‌ی تاریخ باید در یک دوره‌ی مالی تعریف‌شده باشد";
    if (a.id !== b.id) return "بازه‌ی گزارش نمی‌تواند بیش از یک دوره‌ی مالی را شامل شود";
    return null;
  }

  function buildParams(tabIndex: number) {
    const p = new URLSearchParams();
    p.set("fromDate", filters.fromDate);
    p.set("toDate", filters.toDate);
    const statuses = new Set<string>();
    const chequeIds = new Set<string>();
    for (const t of chain.tabsBefore(tabIndex)) {
      const rows = tabData[t] || [];
      for (const id of chain.get(t)) {
        const row = rows.find((r: any) => String(r.id) === String(id));
        if (!row) continue;
        if (t === STATUS_TAB) statuses.add(String(row.status));
        if (t === CHEQUE_TAB) chequeIds.add(String(row.id));
      }
    }
    if (statuses.size) p.set("statuses", Array.from(statuses).join(","));
    if (chequeIds.size) p.set("chequeIds", Array.from(chequeIds).join(","));
    return p;
  }

  async function loadTab(tab: number) {
    const msg = rangeError(filters);
    if (msg) {
      setError(msg);
      return;
    }
    await tabLoader.run(
      tab,
      async (isStale) => {
        const data = await api.get(`/cheque-review/${kind}/${ENDPOINT[tab]}?${buildParams(tab).toString()}`);
        if (isStale()) return;
        setTabData((prev) => ({ ...prev, [tab]: data }));
      },
      setError
    );
  }

  const activationDepsKey = useMemo(() => serializeForDepsKey({ selections: chain.selections, order: chain.order, filters }), [chain.selections, chain.order, filters]);
  useReviewTabActivation(periodsLoaded && !!filters.fromDate, activeTab, tabLoader.loadedTabs, (tab) => loadTab(tab), activationDepsKey);

  function clearFilters() {
    chain.reset();
    setTabData({});
    tabView.reset();
    tabLoader.resetLoaded();
    setActiveTab(0);
  }

  function onDateChange(field: "fromDate" | "toDate", value: string) {
    const next = { ...filters, [field]: value };
    const msg = rangeError(next);
    if (msg) {
      setError(msg);
      return;
    }
    setFilters(next);
    clearFilters();
  }

  const tabDefs = TAB_LABELS.map((label, idx) => ({ key: `chq-${idx}`, label, count: idx === DETAIL_TAB ? 0 : chain.get(idx).size }));

  const statusColumns: BalanceTableColumn<StatusRow>[] = useMemo(
    () => [
      { header: "وضعیت", render: (r) => r.title, sortValue: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
      { header: "تعداد", render: (r) => toFaDigits(String(r.count)), sortValue: (r) => r.count, filterType: "number", filterValue: (r) => r.count },
      { header: "مبلغ", render: (r) => formatAmountFa(r.amount), sortValue: (r) => r.amount, filterType: "number", filterValue: (r) => r.amount, decimal: true },
    ],
    []
  );
  const chequeColumns: BalanceTableColumn<ChequeRow>[] = useMemo(
    () => [
      { header: "شماره چک", render: (r) => toFaDigits(r.number), sortValue: (r) => r.number, filterType: "string", filterValue: (r) => r.number },
      { header: "طرف حساب", render: (r) => r.partyDisplay, sortValue: (r) => r.partyDisplay, filterType: "string", filterValue: (r) => r.partyDisplay },
      { header: "شعبه بانک", render: (r) => r.bankBranchTitle, sortValue: (r) => r.bankBranchTitle, filterType: "string", filterValue: (r) => r.bankBranchTitle },
      { header: "سررسید", render: (r) => formatJalaliDate(r.dueDate), sortValue: (r) => r.dueDate, filterType: "date", filterValue: (r) => r.dueDate?.slice(0, 10) },
      { header: "مبلغ", render: (r) => formatAmountFa(r.amount), sortValue: (r) => r.amount, filterType: "number", filterValue: (r) => r.amount, decimal: true },
      { header: "وضعیت", render: (r) => r.statusTitle, sortValue: (r) => r.statusTitle, filterType: "string", filterValue: (r) => r.statusTitle },
      { header: "اولین رویداد بازه", render: (r) => (r.firstDate ? formatJalaliDate(r.firstDate) : ""), sortValue: (r) => r.firstDate || "", filterType: "date", filterValue: (r) => r.firstDate?.slice(0, 10) },
      { header: "آخرین رویداد بازه", render: (r) => (r.lastDate ? formatJalaliDate(r.lastDate) : ""), sortValue: (r) => r.lastDate || "", filterType: "date", filterValue: (r) => r.lastDate?.slice(0, 10) },
      { header: "تعداد رویداد", render: (r) => toFaDigits(String(r.eventCount)), sortValue: (r) => r.eventCount, filterType: "number", filterValue: (r) => r.eventCount },
    ],
    []
  );
  const detailColumns: BalanceTableColumn<DetailRow>[] = useMemo(
    () => [
      { header: "تاریخ", render: (r) => formatJalaliDate(r.date), sortValue: (r) => r.date, filterType: "date", filterValue: (r) => r.date?.slice(0, 10) },
      { header: "رویداد", render: (r) => <span className="badge">{r.typeTitle}</span>, sortValue: (r) => r.typeTitle, filterType: "string", filterValue: (r) => r.typeTitle },
      { header: "شماره سند", render: (r) => (r.docNumber ? toFaDigits(String(r.docNumber)) : ""), sortValue: (r) => r.docNumber || 0, filterType: "number", filterValue: (r) => r.docNumber || 0 },
      { header: "شماره چک", render: (r) => toFaDigits(r.chequeNumber), sortValue: (r) => r.chequeNumber, filterType: "string", filterValue: (r) => r.chequeNumber },
      { header: "طرف حساب", render: (r) => r.partyDisplay, sortValue: (r) => r.partyDisplay, filterType: "string", filterValue: (r) => r.partyDisplay },
      { header: "مبلغ", render: (r) => formatAmountFa(r.amount), sortValue: (r) => r.amount, filterType: "number", filterValue: (r) => r.amount, decimal: true },
      { header: "وضعیت فعلی چک", render: (r) => r.chequeStatusTitle, sortValue: (r) => r.chequeStatusTitle, filterType: "string", filterValue: (r) => r.chequeStatusTitle },
      { header: "شرح", render: (r) => toFaDigits(r.description || ""), sortValue: (r) => r.description || "", filterType: "string", filterValue: (r) => r.description || "" },
    ],
    []
  );

  return (
    <div>
      <ErrorToast message={error} />

      <div className="card ar-filters">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
          <div className="form-field-inline">
            <label>از تاریخ</label>
            <JalaliDatePicker value={filters.fromDate} onChange={(v) => onDateChange("fromDate", v)} />
          </div>
          <div className="form-field-inline">
            <label>تا تاریخ</label>
            <JalaliDatePicker value={filters.toDate} onChange={(v) => onDateChange("toDate", v)} />
          </div>
        </div>
      </div>

      <ChainedTabsBar
        tabs={tabDefs}
        activeIndex={activeTab}
        onChange={setActiveTab}
        actions={
          <>
            <InfoHint text={cfg.info} title={cfg.title} />
            <RefreshButton onClick={() => loadTab(activeTab)} title="رفرش تب جاری" />
          </>
        }
        onClearFilters={clearFilters}
      />

      {activeTab === STATUS_TAB && (
        <SelectableBalanceTable
          stateKey={STATUS_TAB}
          rows={(tabData[STATUS_TAB] || []) as StatusRow[]}
          columns={statusColumns}
          selected={chain.get(STATUS_TAB)}
          onToggle={(id: SelectId) => chain.toggle(STATUS_TAB, id)}
          loading={tabLoader.loading}
          restoreFilters={tabView.restoreFilters}
          restoreSort={tabView.restoreSort}
          onFiltersChange={tabView.onFiltersChange}
          onSortChange={tabView.onSortChange}
        />
      )}
      {activeTab === CHEQUE_TAB && (
        <SelectableBalanceTable
          stateKey={CHEQUE_TAB}
          rows={(tabData[CHEQUE_TAB] || []) as ChequeRow[]}
          columns={chequeColumns}
          selected={chain.get(CHEQUE_TAB)}
          onToggle={(id: SelectId) => chain.toggle(CHEQUE_TAB, id)}
          loading={tabLoader.loading}
          emptyText="چکی یافت نشد"
          restoreFilters={tabView.restoreFilters}
          restoreSort={tabView.restoreSort}
          onFiltersChange={tabView.onFiltersChange}
          onSortChange={tabView.onSortChange}
        />
      )}
      {activeTab === DETAIL_TAB && (
        <SelectableBalanceTable
          stateKey={DETAIL_TAB}
          rows={(tabData[DETAIL_TAB] || []) as DetailRow[]}
          columns={detailColumns}
          selectable={false}
          onRowDoubleClick={(r: DetailRow) => {
            if (!r.docRoute || !r.docId) return;
            openTab(r.docRoute === "/treasury-openings" ? r.docRoute : `${r.docRoute}/${r.docId}/edit`);
          }}
          loading={tabLoader.loading}
          emptyText="رویدادی یافت نشد"
          restoreFilters={tabView.restoreFilters}
          restoreSort={tabView.restoreSort}
          onFiltersChange={tabView.onFiltersChange}
          onSortChange={tabView.onSortChange}
        />
      )}
    </div>
  );
}
