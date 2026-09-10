import { useCallback, useState } from "react";

/**
 * پیدا کردن خودکار نزدیک‌ترین عنصر هم‌سطح (sibling) با یک selector مشخص، برای پورتال‌کردن یک تکه UI به
 * آن — دقیقاً هم‌الگوی مکانیزم موجود در DataTable.tsx برای «.header-toolbar» (نگاه کنید به
 * setRootRef/autoBulkContainer آن‌جا)، اما به‌صورت یک هوک عمومی که SelectableBalanceTable و نوار ابزار
 * تب «گردش» در گزارش‌های Review هر دو از آن استفاده می‌کنند — تا آیکن‌های پرینت/خروجی اکسل به‌جای یک
 * ردیف مستقل، داخل همان ردیف نوار تب‌ها (ChainedTabsBar) نمایش داده شوند، بدون این‌که خودِ منطق
 * export/print تکرار یا هر صفحه مجبور به سیم‌کشی دستی یک ref باشد.
 *
 * callback ref (نه useRef+useEffect) عمداً انتخاب شده: چون در برخی حالت‌ها (مثل بارگذاری اولیه‌ی
 * SelectableBalanceTable وقتی rows هنوز خالی است) عنصر ریشه ممکن است دیر رندر شود؛ callback ref دقیقاً
 * همان لحظه‌ای که گره DOM واقعاً متصل می‌شود صدا زده می‌شود، مستقل از این‌که وابستگی‌های یک effect عوض
 * شده باشند یا نه.
 */
export function useAutoPortalTarget<T extends HTMLElement = HTMLElement>(selector: string) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const ref = useCallback(
    (node: T | null) => {
      if (!node) return;
      const found = node.parentElement?.querySelector<HTMLElement>(selector) ?? null;
      setTarget(found);
    },
    [selector]
  );
  return { ref, target };
}
