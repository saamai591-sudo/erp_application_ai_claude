import { SelectId } from "./useChainedMultiSelect";
import { registerReviewReportCache, TabScopedStore } from "./reviewReportCache";
import { TabViewState } from "./useReviewTabLoader";

export interface QuoteReviewSnapshot {
  chainState: { selections: Record<number, Set<SelectId>>; order: number[] };
  activeTab: number;
  filters: { fromDate: string; toDate: string };
  tabData: Record<number, any[]>;
  tabViewState?: Record<number, TabViewState>;
  loadedTabs: number[];
}

// دقیقاً هم‌الگوی warehouseReviewCache.ts — یک نمونه‌ی واحد (این گزارش برخلاف مرور انبار، دو نما/mode ندارد).
const store = new TabScopedStore<QuoteReviewSnapshot>();

export function getQuoteReviewSnapshot(): QuoteReviewSnapshot | null {
  return store.get();
}

export function setQuoteReviewSnapshot(snapshot: QuoteReviewSnapshot) {
  store.set(snapshot);
}

export function clearQuoteReviewSnapshot() {
  store.clearAll();
}

registerReviewReportCache("/quote-review", clearQuoteReviewSnapshot);
