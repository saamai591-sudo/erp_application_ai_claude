import { SelectId } from "./useChainedMultiSelect";
import { registerReviewReportCache, TabScopedStore } from "./reviewReportCache";
import { TabViewState } from "./useReviewTabLoader";
import { ActiveFilter } from "../components/DataTable";

export interface BankAccountReviewSnapshot {
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
const store = new TabScopedStore<BankAccountReviewSnapshot>();

export function getBankAccountReviewSnapshot(): BankAccountReviewSnapshot | null {
  return store.get();
}

export function setBankAccountReviewSnapshot(snapshot: BankAccountReviewSnapshot) {
  store.set(snapshot);
}

export function clearBankAccountReviewSnapshot() {
  store.clearAll();
}

registerReviewReportCache("/bank-account-review", clearBankAccountReviewSnapshot);
