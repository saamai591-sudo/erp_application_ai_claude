import { SelectId } from "./useChainedMultiSelect";
import { registerReviewReportCache, TabScopedStore } from "./reviewReportCache";
import { TabViewState } from "./useReviewTabLoader";
import { ActiveFilter } from "../components/DataTable";

export interface GuaranteeReviewSnapshot {
  chainState: { selections: Record<number, Set<SelectId>>; order: number[] };
  activeTab: number;
  filters: { fromDate: string; toDate: string; status: string[]; due: string[] };
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

// هم‌الگوی pettyCashReviewCache.ts؛ برای هر جهت (دریافتی/پرداختی) یک نمونه‌ی جدا، با بستن تب گزارش پاک می‌شود.
const stores = { RECEIPT: new TabScopedStore<GuaranteeReviewSnapshot>(), PAYMENT: new TabScopedStore<GuaranteeReviewSnapshot>() };

export function getGuaranteeReviewSnapshot(direction: "RECEIPT" | "PAYMENT"): GuaranteeReviewSnapshot | null {
  return stores[direction].get();
}

export function setGuaranteeReviewSnapshot(direction: "RECEIPT" | "PAYMENT", snapshot: GuaranteeReviewSnapshot) {
  stores[direction].set(snapshot);
}

registerReviewReportCache("/guarantee-receipt-review", () => stores.RECEIPT.clearAll());
registerReviewReportCache("/guarantee-payment-review", () => stores.PAYMENT.clearAll());
