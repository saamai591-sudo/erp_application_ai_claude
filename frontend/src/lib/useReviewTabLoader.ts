import { useEffect, useRef, useState } from "react";
import { ActiveFilter } from "../components/DataTable";

/**
 * فیلتر/مرتب‌سازیِ محلیِ هر تب (کلاینتی، بدون serverPaging) در گزارش‌های Review — چون
 * SelectableBalanceTable یک نمونه‌ی مشترک بین همه‌ی تب‌های یک گزارش است (طبق stateKey در آن
 * کامپوننت، برای جلوگیری از نشتِ فیلتر بین تب‌هایی که نام ستون یکسان اما معنای متفاوت دارند)، فراخوان‌
 * کننده (هر صفحه‌ی Review) باید فیلتر/مرتب‌سازیِ هر تب را این‌جا، کلیدشده با شماره‌ی تب، نگه دارد و از
 * طریق restoreFilters/restoreSort به آن کامپوننت برگرداند — وگرنه برگشتن به یک تبِ قبلاً فیلترشده،
 * فیلتر را پاک نشان می‌دهد (دقیقاً هم‌الگوی detailQuery در AccountsReview.tsx، اما برای تب‌های کاملاً
 * کلاینتی که serverPaging ندارند).
 */
export interface TabViewState {
  filters: Record<string, ActiveFilter>;
  sort: { header: string; dir: "asc" | "desc" } | null;
}
export const DEFAULT_TAB_VIEW: TabViewState = { filters: {}, sort: null };

/**
 * زیرساخت مشترکِ همان الگو — قبلاً هر گزارش (WarehouseReview.tsx/AccountsReview.tsx) یک state جدا
 * (dimViewState/balanceViewState) با چهار تابع تقریباً یکسان (onFiltersChange/onSortChange/...) برای
 * پیاده‌سازی TabViewState بالا می‌ساخت — طبق تصمیم صریح کاربر («این مورد رو نمیشه برد در بیس؟»)، این
 * تکرار حذف و در یک هوک مشترک جمع شد؛ هر گزارش فقط activeTab و مقدار اولیه (از snapshot خودش) را
 * می‌دهد و restoreFilters/restoreSort/onFiltersChange/onSortChange آماده برای پاس دادن مستقیم به
 * SelectableBalanceTable می‌گیرد. viewState خام هم برگردانده می‌شود تا فراخوان‌کننده آن را در
 * snapshot خودش ذخیره کند (هر گزارش کش خودش را دارد، این هوک چیزی را کش نمی‌کند).
 */
export function useReviewTabViewState(activeTab: number, initial: Record<number, TabViewState> = {}) {
  const [viewState, setViewState] = useState<Record<number, TabViewState>>(initial);
  const current = viewState[activeTab] ?? DEFAULT_TAB_VIEW;

  function onFiltersChange(filters: Record<string, ActiveFilter>) {
    setViewState((prev) => ({ ...prev, [activeTab]: { filters, sort: prev[activeTab]?.sort ?? null } }));
  }
  function onSortChange(sort: TabViewState["sort"]) {
    setViewState((prev) => ({ ...prev, [activeTab]: { filters: prev[activeTab]?.filters ?? {}, sort } }));
  }
  function reset() {
    setViewState({});
  }

  return { viewState, restoreFilters: current.filters, restoreSort: current.sort, onFiltersChange, onSortChange, reset };
}

/**
 * یک مقدار دلخواه (شامل Set/Map تودرتو — مثل chain.selections) را به یک رشته‌ی پایدار برای مقایسه‌ی
 * «آیا چیزی واقعاً عوض شده» تبدیل می‌کند؛ JSON.stringify خام روی Set خروجی «{}» می‌دهد (چون Set هیچ
 * ویژگی شمارش‌پذیر own ندارد)، پس بدون این replacer هر تغییر انتخاب زنجیره‌ای نامرئی می‌ماند. برای
 * URLSearchParams هم مشابه صادق است — فراخوان‌کننده باید خودش .toString() بدهد، نه خودِ شیء را.
 */
export function serializeForDepsKey(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v instanceof Set) return Array.from(v).sort();
    if (v instanceof Map) return Array.from(v.entries());
    return v;
  });
}

/**
 * زیرساخت مشترک بارگذاری تب‌های گزارش‌های Review (مرور حسابها، مرور تعدادی/مبلغی انبار، و هر گزارش
 * Review آینده‌ای که به همین الگوی ChainedTabsBar + useChainedMultiSelect پایبند باشد) — طبق تصمیم
 * صریح کاربر: قبلاً هر گزارش نسخه‌ی محلیِ مستقل اما تقریباً یکسانِ این منطق را داشت (یک تابع
 * skippedInitialFetch + یک پرچم tabLoading مشترک بین همه‌ی تب‌ها، بدون هیچ محافظتی در برابر
 * درهم‌آمیختن پاسخ دو fetch هم‌پوشان برای دو تب مختلف)، که باعث شد یک کلاس باگ («انتخاب یک ردیف در تبی،
 * سپس رفتن به تب دیگر، بدون نمایش دادهٔ آن») فقط در مرور تعدادی/مبلغی دیده شود، نه در مرور حسابها —
 * صرفاً چون این دو پیاده‌سازیِ مستقل، رفتار متفاوتی نسبت به زمان‌بندی fetchها داشتند. حالا هر دو گزارش
 * از همین یک منبع استفاده می‌کنند تا این کلاس باگ دیگر تکرار نشود.
 *
 * هر تب یک شماره‌ی نسل (generation) جداگانه دارد: هر بار run() برای یک تب صدا زده می‌شود، نسل آن تب
 * یکی بالا می‌رود؛ نتیجه‌ی یک fetch فقط وقتی commit می‌شود که نسل جاری آن تب هنوز همان نسلی باشد که آن
 * fetch با آن شروع شده — یعنی یک پاسخ دیرآمده از یک درخواست قدیمی‌تر هرگز نمی‌تواند رندر تب را با
 * نتیجه‌ی یک fetch تازه‌تر (یا در حال اجرا) برای همان تب خراب کند.
 */
export function useReviewTabLoader(initialLoadedTabs: number[] = []) {
  const [loading, setLoading] = useState(false);
  const [loadedTabs, setLoadedTabs] = useState<Set<number>>(() => new Set(initialLoadedTabs));
  const generationRef = useRef<Record<number, number>>({});

  function resetLoaded() {
    setLoadedTabs(new Set());
    generationRef.current = {};
  }

  /**
   * fetcher باید تمام setState های مربوط به داده‌ی خودش را فقط وقتی isStale() هنوز false است انجام
   * دهد؛ بعد از resolve شدن fetcher، اگر در همین فاصله یک run() جدیدتر برای همین tabIndex شروع شده
   * باشد (یعنی isStale() true شود)، این تابع loadedTabs/loading را هم دست‌نخورده رها می‌کند.
   */
  async function run(tabIndex: number, fetcher: (isStale: () => boolean) => Promise<void>, onError: (message: string) => void) {
    generationRef.current[tabIndex] = (generationRef.current[tabIndex] || 0) + 1;
    const myGeneration = generationRef.current[tabIndex];
    const isStale = () => generationRef.current[tabIndex] !== myGeneration;
    setLoading(true);
    try {
      await fetcher(isStale);
      if (!isStale()) setLoadedTabs((prev) => new Set(prev).add(tabIndex));
    } catch (e: any) {
      if (!isStale()) onError(e?.message || "خطا در بارگذاری اطلاعات");
    } finally {
      if (!isStale()) setLoading(false);
    }
  }

  return { loading, loadedTabs, setLoadedTabs, run, resetLoaded };
}

/**
 * افکت مشترک «فعال‌سازی تب»: هر تب یک «امضای» آخرین باری که واقعاً بارگذاری شد را نگه می‌دارد
 * (lastKeyByTab، بر مبنای depsKey — رشته‌ای که فراخوان‌کننده از فیلترها/انتخاب‌های زنجیره‌ای/... با
 * useMemo می‌سازد). با سوییچ به یک تب، اگر امضای فعلی (depsKey) دقیقاً همان امضای آخرین بارگذاری آن
 * تب باشد، onActivate اصلاً صدا زده نمی‌شود — یعنی برگشتن به یک تبِ قبلاً-دیده‌شده که هیچ‌کدام از
 * فیلترها/انتخاب‌های مؤثر بر آن از آخرین بار تغییر نکرده، هیچ fetch یا فلشِ «در حال بارگذاری» تازه‌ای
 * نشان نمی‌دهد (دقیقاً رفتاری که «مرور حسابها» باید داشته باشد و مرجع است). اگر چیزی که واقعاً به این
 * تب مربوط می‌شود عوض شده باشد (چه به‌خاطر لمس مستقیم خودِ تب، چه چون یک تبِ «بالادست» در ترتیب زمانی
 * فیلتر جدیدی تحمیل کرده)، depsKey عوض می‌شود و بارگذاری واقعی انجام می‌شود.
 */
export function useReviewTabActivation(
  ready: boolean,
  activeTab: number,
  loadedTabs: Set<number>,
  onActivate: (tabIndex: number) => void,
  depsKey: string
) {
  const skippedInitialFetch = useRef(false);
  const lastKeyByTab = useRef<Record<number, string>>({});
  useEffect(() => {
    if (!ready) return;
    if (!skippedInitialFetch.current) {
      skippedInitialFetch.current = true;
      if (loadedTabs.has(activeTab)) {
        lastKeyByTab.current[activeTab] = depsKey;
        return;
      }
    }
    if (lastKeyByTab.current[activeTab] === depsKey) return;
    lastKeyByTab.current[activeTab] = depsKey;
    onActivate(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, activeTab, depsKey]);
}
