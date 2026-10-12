import { SelectId } from "./useChainedMultiSelect";
import { registerReviewReportCache, TabScopedStore } from "./reviewReportCache";
import { TabViewState } from "./useReviewTabLoader";
import { ActiveFilter } from "../components/DataTable";

export interface PurchaseReviewSnapshot {
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
const store = new TabScopedStore<PurchaseReviewSnapshot>();

export function getPurchaseReviewSnapshot(): PurchaseReviewSnapshot | null {
  return store.get();
}

export function setPurchaseReviewSnapshot(snapshot: PurchaseReviewSnapshot) {
  store.set(snapshot);
}

export function clearPurchaseReviewSnapshot() {
  store.clearAll();
}

registerReviewReportCache("/purchase-review", clearPurchaseReviewSnapshot);
