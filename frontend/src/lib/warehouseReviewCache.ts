import { SelectId } from "./useChainedMultiSelect";

export interface WarehouseReviewSnapshot {
  chainState: { selections: Record<number, Set<SelectId>>; order: number[] };
  activeTab: number;
  filters: { fromDate: string; toDate: string };
  tabData: Record<number, any[]>;
  loadedTabs: number[];
  ledgerRows: any[];
  ledgerPage: number;
  ledgerPageSize: number;
  ledgerTotal: number;
  ledgerTotalPages: number;
}

// دو نمای «مرور تعدادی»/«مرور مبلغی» یک کامپوننت مشترک‌اند اما دو گزارش مستقل — کش هرکدام جدا نگه
// داشته می‌شود (دقیقاً مثل accountsReviewCache، فقط اینجا به‌ازای mode).
const cached = new Map<string, WarehouseReviewSnapshot>();

export function getWarehouseReviewSnapshot(mode: string): WarehouseReviewSnapshot | null {
  return cached.get(mode) ?? null;
}

export function setWarehouseReviewSnapshot(mode: string, snapshot: WarehouseReviewSnapshot) {
  cached.set(mode, snapshot);
}
