import { SelectId } from "./useChainedMultiSelect";
import { registerReviewReportCache } from "./reviewReportCache";
import { TabViewState } from "./useReviewTabLoader";
import { ActiveFilter } from "../components/DataTable";

export interface PettyCashReviewSnapshot {
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
let cached: PettyCashReviewSnapshot | null = null;

export function getPettyCashReviewSnapshot(): PettyCashReviewSnapshot | null {
  return cached;
}

export function setPettyCashReviewSnapshot(snapshot: PettyCashReviewSnapshot) {
  cached = snapshot;
}

export function clearPettyCashReviewSnapshot() {
  cached = null;
}

registerReviewReportCache("/petty-cash-review", clearPettyCashReviewSnapshot);
