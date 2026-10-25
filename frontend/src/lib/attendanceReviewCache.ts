import { SelectId } from "./useChainedMultiSelect";
import { registerReviewReportCache, TabScopedStore } from "./reviewReportCache";
import { TabViewState } from "./useReviewTabLoader";

export interface AttendanceReviewSnapshot {
  chainState: { selections: Record<number, Set<SelectId>>; order: number[] };
  activeTab: number;
  filters: import("../components/AttendanceMonthField").AttendanceMonth;
  employees: any[] | null;
  data: any | null;
  loadedKey: string;
  tabViewState?: Record<number, TabViewState>;
}

// هم‌الگوی pettyCashReviewCache.ts — یک نمونه‌ی واحد به‌ازای هر تب گزارش؛ با بستن تب پاک می‌شود.
const store = new TabScopedStore<AttendanceReviewSnapshot>();

export const getAttendanceReviewSnapshot = () => store.get();
export const setAttendanceReviewSnapshot = (s: AttendanceReviewSnapshot) => store.set(s);
export const clearAttendanceReviewSnapshot = () => store.clearAll();

registerReviewReportCache("/attendance-review", clearAttendanceReviewSnapshot);
