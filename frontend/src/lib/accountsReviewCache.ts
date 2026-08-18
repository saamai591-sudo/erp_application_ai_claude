import { SelectId } from "./useChainedMultiSelect";
import { ActiveFilter } from "../components/DataTable";

export interface DetailQueryState {
  page: number;
  pageSize: number;
  sort: { header: string; dir: "asc" | "desc" } | null;
}

export interface AccountsReviewSnapshot {
  chainState: { selections: Record<number, Set<SelectId>>; order: number[] };
  activeTab: number;
  filters: {
    fromDate: string;
    toDate: string;
    documentTypeIds: Set<number>;
    numberFrom: string;
    numberTo: string;
    referenceFrom: string;
    referenceTo: string;
  };
  tabData: Record<number, any[]>;
  /** فقط برای تب‌های تفصیل (که سمت سرور صفحه‌بندی می‌شوند)، به تفکیک تب: صفحه/تعداد در صفحه/مرتب‌سازی درخواستی (fetch trigger) */
  detailQuery: Record<number, DetailQueryState>;
  /** تعداد کل رکورد هر تب تفصیل — جدا از detailQuery نگه داشته می‌شود تا به‌روزرسانی‌اش باعث fetch مجدد نشود */
  detailTotal: Record<number, number>;
  ledgerRows: any[];
  ledgerPageSize: number;
  /** مرتب‌سازی/فیلتر ستونی تب «گردش» — سمت سرور اعمال می‌شود، دقیقاً مثل تب‌های تفصیل */
  ledgerSort: { header: string; dir: "asc" | "desc" } | null;
  ledgerFilters: Record<string, ActiveFilter>;
  loadedTabs: number[];
}

let cached: AccountsReviewSnapshot | null = null;

export function getAccountsReviewSnapshot(): AccountsReviewSnapshot | null {
  return cached;
}

export function setAccountsReviewSnapshot(snapshot: AccountsReviewSnapshot) {
  cached = snapshot;
}

export function clearAccountsReviewSnapshot() {
  cached = null;
}
