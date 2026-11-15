import { SelectId } from "./useChainedMultiSelect";
import { registerReviewReportCache, TabScopedStore } from "./reviewReportCache";
import { TabViewState } from "./useReviewTabLoader";

export interface ProductionCostReviewSnapshot {
  chainState: { selections: Record<number, Set<SelectId>>; order: number[] };
  activeTab: number;
  filters: { fromDate: string; toDate: string };
  tabData: Record<number, any[]>;
  tabViewState?: Record<number, TabViewState>;
  loadedTabs: number[];
}

// هم‌الگوی quoteReviewCache.ts — یک نمونه‌ی واحد به‌ازای هر تب مرورگر.
const store = new TabScopedStore<ProductionCostReviewSnapshot>();

export function getProductionCostReviewSnapshot(): ProductionCostReviewSnapshot | null {
  return store.get();
}

export function setProductionCostReviewSnapshot(snapshot: ProductionCostReviewSnapshot) {
  store.set(snapshot);
}

function clearProductionCostReviewSnapshot() {
  store.clearAll();
}

registerReviewReportCache("/production-cost-report", clearProductionCostReviewSnapshot);
