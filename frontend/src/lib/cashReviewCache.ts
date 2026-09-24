import { SelectId } from "./useChainedMultiSelect";
import { registerReviewReportCache } from "./reviewReportCache";
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
let cached: CashReviewSnapshot | null = null;

export function getCashReviewSnapshot(): CashReviewSnapshot | null {
  return cached;
}

export function setCashReviewSnapshot(snapshot: CashReviewSnapshot) {
  cached = snapshot;
}

export function clearCashReviewSnapshot() {
  cached = null;
}

registerReviewReportCache("/cash-review", clearCashReviewSnapshot);
