import { SelectId } from "./useChainedMultiSelect";
import { registerReviewReportCache, TabScopedStore } from "./reviewReportCache";
import { TabViewState } from "./useReviewTabLoader";

export interface PartyBalanceReviewSnapshot {
  chainState: { selections: Record<number, Set<SelectId>>; order: number[] };
  activeTab: number;
  filters: { fromDate: string; toDate: string; currencyId: string; mode: "SEPARATE" | "CONSOLIDATED"; onlyWithBalance: boolean; bothRoles: boolean };
  tabData: Record<number, any[]>;
  tabViewState?: Record<number, TabViewState>;
  loadedTabs: number[];
}

// هم‌الگوی assetGroupReviewCache.ts — یک نمونه‌ی واحد برای هر سه فرمِ گزارش مانده (هر تبِ برنامه شناسه‌ی خودش را دارد و فقط یکی از سه صفحه در آن mount است)؛ با بستن تب گزارش پاک می‌شود.
const store = new TabScopedStore<PartyBalanceReviewSnapshot>();

export function getPartyBalanceReviewSnapshot(): PartyBalanceReviewSnapshot | null {
  return store.get();
}

export function setPartyBalanceReviewSnapshot(snapshot: PartyBalanceReviewSnapshot) {
  store.set(snapshot);
}

export function clearPartyBalanceReviewSnapshot() {
  store.clearAll();
}

registerReviewReportCache("/customer-balance-report", clearPartyBalanceReviewSnapshot);
registerReviewReportCache("/supplier-balance-report", clearPartyBalanceReviewSnapshot);
registerReviewReportCache("/party-balance-report", clearPartyBalanceReviewSnapshot);
