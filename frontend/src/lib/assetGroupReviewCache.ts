import { SelectId } from "./useChainedMultiSelect";
import { registerReviewReportCache, TabScopedStore } from "./reviewReportCache";
import { TabViewState } from "./useReviewTabLoader";

export interface AssetGroupReviewSnapshot {
  chainState: { selections: Record<number, Set<SelectId>>; order: number[] };
  activeTab: number;
  filters: { fromDate: string; toDate: string };
  tabData: Record<number, any[]>;
  tabViewState?: Record<number, TabViewState>;
  loadedTabs: number[];
}

// هم‌الگوی pettyCashReviewCache.ts — یک نمونه‌ی واحد؛ با بستن تب گزارش پاک می‌شود.
const store = new TabScopedStore<AssetGroupReviewSnapshot>();

export function getAssetGroupReviewSnapshot(): AssetGroupReviewSnapshot | null {
  return store.get();
}

export function setAssetGroupReviewSnapshot(snapshot: AssetGroupReviewSnapshot) {
  store.set(snapshot);
}

function clearAssetGroupReviewSnapshot() {
  store.clearAll();
}

registerReviewReportCache("/asset-group-review", clearAssetGroupReviewSnapshot);
