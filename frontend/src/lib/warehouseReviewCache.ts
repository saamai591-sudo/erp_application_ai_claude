import { SelectId } from "./useChainedMultiSelect";
import { registerReviewReportCache } from "./reviewReportCache";
import { TabViewState } from "./useReviewTabLoader";
import { ActiveFilter } from "../components/DataTable";

export interface WarehouseReviewSnapshot {
  chainState: { selections: Record<number, Set<SelectId>>; order: number[] };
  activeTab: number;
  filters: { fromDate: string; toDate: string };
  tabData: Record<number, any[]>;
  dimViewState?: Record<number, TabViewState>;
  loadedTabs: number[];
  ledgerRows: any[];
  ledgerPage: number;
  ledgerPageSize: number;
  ledgerTotal: number;
  ledgerTotalPages: number;
  ledgerSort?: { header: string; dir: "asc" | "desc" } | null;
  ledgerFilters?: Record<string, ActiveFilter>;
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

export function clearWarehouseReviewSnapshot(mode: string) {
  cached.delete(mode);
}

// دو مسیر مستقل برای دو نمای همین کامپوننت (نگاه کنید به App.tsx) — هرکدام فقط باید کش نمای خودش را پاک کند
registerReviewReportCache("/warehousing/warehouse-review", () => clearWarehouseReviewSnapshot("qty"));
registerReviewReportCache("/warehouse-accounting/warehouse-review", () => clearWarehouseReviewSnapshot("amount"));
