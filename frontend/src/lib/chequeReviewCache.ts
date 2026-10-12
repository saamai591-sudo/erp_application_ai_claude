import { SelectId } from "./useChainedMultiSelect";
import { registerReviewReportCache, TabScopedStore } from "./reviewReportCache";
import { TabViewState } from "./useReviewTabLoader";

export interface ChequeReviewSnapshot {
  chainState: { selections: Record<number, Set<SelectId>>; order: number[] };
  activeTab: number;
  filters: { fromDate: string; toDate: string };
  tabData: Record<number, any[]>;
  tabViewState?: Record<number, TabViewState>;
  loadedTabs: number[];
}

// هم‌الگوی cashReviewCache.ts — برای هر یک از دو گزارش (دریافتنی/پرداختنی) یک نمونه؛ با بستن تب گزارش پاک می‌شود.
const stores = { receivable: new TabScopedStore<ChequeReviewSnapshot>(), payable: new TabScopedStore<ChequeReviewSnapshot>() };

export function getChequeReviewSnapshot(kind: "receivable" | "payable"): ChequeReviewSnapshot | null {
  return stores[kind].get();
}
export function setChequeReviewSnapshot(kind: "receivable" | "payable", snapshot: ChequeReviewSnapshot) {
  stores[kind].set(snapshot);
}

registerReviewReportCache("/receivable-documents-review", () => {
  stores.receivable.clearAll();
});
registerReviewReportCache("/payable-documents-review", () => {
  stores.payable.clearAll();
});
