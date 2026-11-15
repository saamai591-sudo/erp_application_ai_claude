import { useEffect, useMemo, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { ChainedTabsBar } from "../components/ChainedTabsBar";
import { SelectableBalanceTable, BalanceTableColumn } from "../components/SelectableBalanceTable";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { useChainedMultiSelect, SelectId } from "../lib/useChainedMultiSelect";
import { getAssetGroupReviewSnapshot, setAssetGroupReviewSnapshot } from "../lib/assetGroupReviewCache";
import { resolveReviewDateRange, FiscalPeriodRange } from "../lib/fiscalYearDefaultDate";
import { useReviewTabLoader, useReviewTabActivation, useReviewTabViewState, serializeForDepsKey } from "../lib/useReviewTabLoader";
import { api } from "../lib/api";
import { useTabs } from "../lib/TabsContext";
import { usePermissions } from "../lib/usePermissions";
import { showError } from "../lib/toast";
import { ColumnFilterType } from "../components/DataTable";
import { SignedCell } from "../components/reviewColumns";

// گزارش «مرور گروه دارایی» (دارایی ثابت › گزارش) — هم‌الگوی «مرور تنخواه» با دو تب زنجیره‌ای: «گروه حسابداری دارایی» و «دارایی».
// انتخاب گروه‌ها تب «دارایی» را فیلتر می‌کند. هر مبلغ با تاریخ سندش در بازه می‌افتد و رکورد وسط بازه کامل می‌آید (برای تطبیق با «مرور حسابها»)؛
// پلاکی که گروهش عوض شده در دو ردیف می‌آید. تعریف: backend/src/services/assetGroupReviewService.ts.

interface Figures { open: string; inc: string; transfer: string; dec: string; endCost: string; accOpen: string; accDuring: string; accTransfer: string; accOut: string; accumulated: string; bookValue: string }
interface GroupRow extends Figures { id: SelectId; groupId: number; groupTitle: string }
interface AssetRow extends Figures { id: SelectId; assetId: number; detailCode: string; title: string; groupId: number; groupTitle: string }

const GROUP_TAB = 0;
const ASSET_TAB = 1;
const TAB_LABELS = ["گروه حسابداری دارایی", "دارایی"];

const INFO_TEXT =
  "در تب «گروه حسابداری دارایی» می‌توانید یک یا چند گروه را انتخاب کنید تا تب «دارایی» فقط پلاک‌های همان گروه‌ها را نشان دهد. " +
  "هر مبلغ با تاریخ سندی که برایش صادر می‌شود در بازه می‌افتد (افزایش: سند تحصیل، استهلاک دوره: پایان دوره، نقل و انتقال: تاریخ سند تغییر گروه) و " +
  "رکورد وسط بازه کامل می‌آید. پلاکی که در بازه گروهش عوض شده در دو ردیف می‌آید: گروه مبدا (نقل و انتقال منفی) و گروه مقصد (مثبت).";

function numCol<T extends Figures>(header: string, field: keyof Figures): BalanceTableColumn<T> {
  return {
    header,
    render: (r) => <SignedCell value={Number(r[field]) || 0} />,
    sortValue: (r) => Number(r[field]) || 0,
    filterType: "number",
    filterValue: (r) => Number(r[field]) || 0,
    decimal: true,
  };
}

const figureCols = <T extends Figures>(): BalanceTableColumn<T>[] => [
  numCol<T>("اول دوره", "open"),
  numCol<T>("افزایش", "inc"),
  numCol<T>("نقل و انتقال", "transfer"),
  numCol<T>("کاهش", "dec"),
  numCol<T>("بهای پایان دوره", "endCost"),
  numCol<T>("استهلاک اول دوره", "accOpen"),
  numCol<T>("استهلاک طی دوره", "accDuring"),
  numCol<T>("نقل و انتقال استهلاک", "accTransfer"),
  numCol<T>("استهلاک دارایی‌های خارج‌شده", "accOut"),
  numCol<T>("استهلاک انباشته", "accumulated"),
  numCol<T>("ارزش دفتری", "bookValue"),
];

export default function AssetGroupReview() {
  const { openTab } = useTabs();
  const { hasPermission } = usePermissions();
  const snapshot = getAssetGroupReviewSnapshot();
  const [periodsLoaded, setPeriodsLoaded] = useState(false);
  const [filters, setFilters] = useState(snapshot?.filters ?? { fromDate: "", toDate: "" });
  const [activeTab, setActiveTab] = useState(snapshot?.activeTab ?? 0);
  const [tabData, setTabData] = useState<Record<number, (GroupRow | AssetRow)[]>>(snapshot?.tabData ?? {});
  const tabLoader = useReviewTabLoader(snapshot?.loadedTabs ?? []);
  const [error, setError] = useState<string | null>(null);

  const chain = useChainedMultiSelect(snapshot?.chainState);
  const tabView = useReviewTabViewState(activeTab, snapshot?.tabViewState ?? {});

  useEffect(() => {
    setAssetGroupReviewSnapshot({
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
      const per: FiscalPeriodRange[] = await api.get("/fiscal-periods");
      setPeriodsLoaded(true);
      setFilters((prev) => (prev.fromDate ? prev : resolveReviewDateRange(per)));
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildParams(tabIndex: number) {
    const p = new URLSearchParams();
    p.set("fromDate", filters.fromDate);
    p.set("toDate", filters.toDate);
    const groupIds = new Set<string>();
    for (const t of chain.tabsBefore(tabIndex)) {
      const rows = tabData[t] || [];
      for (const id of chain.get(t)) {
        const row: any = rows.find((r) => String(r.id) === String(id));
        if (row && t === GROUP_TAB) groupIds.add(String(row.groupId));
      }
    }
    if (groupIds.size) p.set("groupIds", Array.from(groupIds).join(","));
    return p;
  }

  async function loadTab(tab: number) {
    await tabLoader.run(
      tab,
      async (isStale) => {
        const res = await api.get(`/asset-group-review?${buildParams(tab).toString()}`);
        if (isStale()) return;
        const rows = tab === GROUP_TAB
          ? res.groups.map((g: any) => ({ ...g, id: g.groupId }))
          : res.assets.map((a: any) => ({ ...a, id: `${a.assetId}|${a.groupId}` }));
        setTabData((prev) => ({ ...prev, [tab]: rows }));
      },
      setError
    );
  }

  const activationDepsKey = useMemo(() => serializeForDepsKey({ upstream: chain.upstream(activeTab), filters }), [chain.selections, chain.order, activeTab, filters]);
  useReviewTabActivation(periodsLoaded && !!filters.fromDate, activeTab, tabLoader.loadedTabs, (tab) => loadTab(tab), activationDepsKey);

  // «حذف همه فیلترها»: انتخاب‌های زنجیره‌ای هم فیلتر محسوب می‌شوند؛ فقط بازه‌ی تاریخ بالای گزارش می‌ماند
  function clearFilters() {
    chain.reset();
    setTabData({});
    tabView.reset();
    tabLoader.resetLoaded();
    setActiveTab(0);
  }

  // تغییر بازه‌ی تاریخ فقط داده‌ی بارگذاری‌شده را باطل می‌کند؛ انتخاب‌ها، فیلتر/مرتب‌سازی و تب فعال می‌مانند
  function invalidateData() {
    setTabData({});
    tabLoader.resetLoaded();
  }

  function openAssetCard() {
    const sel = Array.from(chain.get(ASSET_TAB));
    const row = (tabData[ASSET_TAB] || []).find((r) => String(r.id) === String(sel[0])) as AssetRow | undefined;
    if (sel.length !== 1 || !row) return showError("یک دارایی انتخاب کنید");
    openTab(`/fixed-assets/${row.assetId}/card`);
  }

  const tabDefs = TAB_LABELS.map((label, idx) => ({ key: `agr-${idx}`, label, count: chain.get(idx).size }));

  const groupColumns = useMemo((): BalanceTableColumn<GroupRow>[] => {
    const strFilter: ColumnFilterType = "string";
    return [{ header: "گروه حسابداری دارایی", render: (r) => r.groupTitle, sortValue: (r) => r.groupTitle, filterType: strFilter, filterValue: (r) => r.groupTitle }, ...figureCols<GroupRow>()];
  }, []);

  const assetColumns = useMemo((): BalanceTableColumn<AssetRow>[] => {
    const strFilter: ColumnFilterType = "string";
    return [
      { header: "پلاک", render: (r) => r.detailCode, sortValue: (r) => r.detailCode, width: "110px", filterType: strFilter, filterValue: (r) => r.detailCode },
      { header: "عنوان دارایی", render: (r) => r.title, sortValue: (r) => r.title, filterType: strFilter, filterValue: (r) => r.title },
      { header: "گروه حسابداری دارایی", render: (r) => r.groupTitle, sortValue: (r) => r.groupTitle, filterType: strFilter, filterValue: (r) => r.groupTitle },
      ...figureCols<AssetRow>(),
    ];
  }, []);

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
            {hasPermission("fixed-assets.operations.fixed-assets.view") && (
              <button type="button" className="btn secondary" disabled={activeTab !== ASSET_TAB || chain.get(ASSET_TAB).size !== 1} title="یک دارایی را در تب «دارایی» انتخاب کنید" onClick={() => openAssetCard()}>کارت دارایی</button>
            )}
            <InfoHint text={INFO_TEXT} title="مرور گروه دارایی" />
            <RefreshButton onClick={() => loadTab(activeTab)} title="رفرش تب جاری" />
          </>
        }
        onClearFilters={clearFilters}
      />

      {activeTab === GROUP_TAB && (
        <SelectableBalanceTable
          stateKey={GROUP_TAB}
          rows={(tabData[GROUP_TAB] || []) as GroupRow[]}
          columns={groupColumns}
          selected={chain.get(GROUP_TAB)}
          onToggle={(id: SelectId) => chain.toggle(GROUP_TAB, id)}
          loading={tabLoader.loading}
          restoreFilters={tabView.restoreFilters}
          restoreSort={tabView.restoreSort}
          onFiltersChange={tabView.onFiltersChange}
          onSortChange={tabView.onSortChange}
        />
      )}

      {activeTab === ASSET_TAB && (
        <SelectableBalanceTable
          stateKey={ASSET_TAB}
          rows={(tabData[ASSET_TAB] || []) as AssetRow[]}
          columns={assetColumns}
          selected={chain.get(ASSET_TAB)}
          onToggle={(id: SelectId) => chain.toggle(ASSET_TAB, id)}
          loading={tabLoader.loading}
          emptyText="داده‌ای برای این بازه وجود ندارد"
          restoreFilters={tabView.restoreFilters}
          restoreSort={tabView.restoreSort}
          onFiltersChange={tabView.onFiltersChange}
          onSortChange={tabView.onSortChange}
        />
      )}
    </div>
  );
}
