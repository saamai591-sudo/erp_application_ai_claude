import { SelectId } from "./useChainedMultiSelect";
import { registerReviewReportCache } from "./reviewReportCache";
import { TabViewState } from "./useReviewTabLoader";
import { ActiveFilter } from "../components/DataTable";

export interface SalesReviewSnapshot {
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

// دقیقاً هم‌الگوی warehouseReviewCache.ts — یک نمونه‌ی واحد (این گزارش برخلاف مرور انبار، دو نما/mode ندارد).
let cached: SalesReviewSnapshot | null = null;

export function getSalesReviewSnapshot(): SalesReviewSnapshot | null {
  return cached;
}

export function setSalesReviewSnapshot(snapshot: SalesReviewSnapshot) {
  cached = snapshot;
}

export function clearSalesReviewSnapshot() {
  cached = null;
}

registerReviewReportCache("/sales-review", clearSalesReviewSnapshot);
