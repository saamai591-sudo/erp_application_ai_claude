import { SelectId } from "./useChainedMultiSelect";
import { registerReviewReportCache, TabScopedStore } from "./reviewReportCache";
import { TabViewState } from "./useReviewTabLoader";
import { ActiveFilter } from "../components/DataTable";

export interface CashReviewSnapshot {
  chainState: { selections: Record<number, Set<SelectId>>; order: number[] };
  activeTab: number;
  filters: { fromDate: string; toDate: string };
  tabData: Record<number, any[]>;
  tabViewState?: Record<number, TabViewState>;
  loadedTabs: number[];
  ledgerRows: any[];
  ledgerPage: number;
  ledgerPageSize: number;
  ledgerTotal: number;
  ledgerTotalPages: number;
  ledgerSort?: { header: string; dir: "asc" | "desc" } | null;
  ledgerFilters?: Record<string, ActiveFilter>;
}

// دقیقاً هم‌الگوی salesReviewCache.ts — یک نمونه‌ی واحد؛ با بستن تب گزارش پاک می‌شود.
const store = new TabScopedStore<CashReviewSnapshot>();

export function getCashReviewSnapshot(): CashReviewSnapshot | null {
  return store.get();
}

export function setCashReviewSnapshot(snapshot: CashReviewSnapshot) {
  store.set(snapshot);
}

export function clearCashReviewSnapshot() {
  store.clearAll();
}

registerReviewReportCache("/cash-review", clearCashReviewSnapshot);
