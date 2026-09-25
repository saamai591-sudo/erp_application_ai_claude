import { SelectId } from "./useChainedMultiSelect";
import { registerReviewReportCache } from "./reviewReportCache";
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
const cached: Record<string, ChequeReviewSnapshot | null> = { receivable: null, payable: null };

export function getChequeReviewSnapshot(kind: "receivable" | "payable"): ChequeReviewSnapshot | null {
  return cached[kind];
}
export function setChequeReviewSnapshot(kind: "receivable" | "payable", snapshot: ChequeReviewSnapshot) {
  cached[kind] = snapshot;
}

registerReviewReportCache("/receivable-documents-review", () => {
  cached.receivable = null;
});
registerReviewReportCache("/payable-documents-review", () => {
  cached.payable = null;
});
