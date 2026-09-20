import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getTitleForPath } from "./tabTitle";
import { clearReviewReportCacheForPath, clearAllReviewReportCaches } from "./reviewReportCache";
import { clearPersistedStateByPrefix, clearPersistedStateFamily } from "./usePersistedState";
import { refreshTabIfStale } from "./listInvalidation";

export interface Tab {
  id: string;
  path: string;
  title: string;
}

interface TabsCtx {
  tabs: Tab[];
  activeTabId: string | null;
  /** با هر «رفرش خودکار» یک واحد بالا می‌رود — Layout آن را همراه activeTabId در کلید Outlet استفاده
   * می‌کند تا حتی سوییچ به تبی که از قبل هم فعال بوده (کلیک دوباره روی همان تب) در صورت کهنه بودن،
   * remount واقعی بشود؛ نگاه کنید به switchTabInternal. */
  refreshNonce: number;
  openTab: (path: string) => void;
  switchTab: (id: string) => void;
  closeTab: (id: string) => void;
  closeAllTabs: () => void;
}

const Ctx = createContext<TabsCtx | null>(null);

let counter = 0;
function nextId() {
  counter += 1;
  return `tab-${counter}`;
}

// طبق تصمیم صریح کاربر: رفرش خودکار فقط برای تب‌های «فهرست» است، هرگز برای فرم‌ها — تا یک فرم نیمه‌کاره
// با تغییر یک Resource نامرتبط، ناخواسته پاک نشود (کاربر باید همیشه بتواند بی‌دغدغه فرم باز نگه دارد).
// مسیر تب همیشه «مسیر + query» است (مثلاً /accounts/new?parentId=5)؛ اگر query نگه داشته نشود، برگشتن به تب
// فرمِ زیرمجموعه به فرم دیگری (ریشه) می‌رود و حالت/داده‌ی فرم عوض می‌شود.
function pathOnly(path: string): string {
  return path.split("?")[0];
}

function isFormShapedPath(path: string): boolean {
  const base = pathOnly(path);
  return base.endsWith("/new") || base.endsWith("/edit");
}

function isListShapedPath(path: string): boolean {
  return !isFormShapedPath(path);
}

// کشِ فرم‌ها با کلید `form:<مسیر>` (گاهی با query، گاهی بدون آن — بسته به صفحه) و پسوندهایی مثل :form/:header
// ذخیره می‌شود. فقط همین «خانواده»‌ی دقیق پاک می‌شود، نه هر کلیدی که همین رشته را به‌عنوان پیشوند دارد.
function clearFormState(path: string) {
  clearPersistedStateFamily(`form:${path}`);
  const base = pathOnly(path);
  if (base !== path) clearPersistedStateFamily(`form:${base}`);
}

export function TabsProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const initialized = useRef(false);

  /** اگر مسیر یک «تب فهرست» باشد و کهنه شده باشد (یعنی یکی از Resourceهایی که واقعاً واکشی کرده، از
   * زمان آخرین دیدنش تغییر کرده)، کشش را پاک می‌کند و برای اجبار به remount (حتی اگر همین الان هم تب
   * فعال بوده باشد) refreshNonce را بالا می‌برد. */
  function maybeRefreshOnVisit(path: string) {
    if (isListShapedPath(path) && refreshTabIfStale(pathOnly(path))) {
      setRefreshNonce((n) => n + 1);
    }
  }

  // در اولین بارگذاری، اگر کاربر مستقیم روی یک مسیر داخلی (نه خانه) وارد شده، یک تب برایش بساز
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (location.pathname !== "/") {
      const fullPath = location.pathname + location.search;
      const tab: Tab = { id: nextId(), path: fullPath, title: getTitleForPath(pathOnly(fullPath)) };
      setTabs([tab]);
      setActiveTabId(tab.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentFullPath = location.pathname + location.search;

  // هماهنگ‌سازی: وقتی ناوبری داخلی (نه از طریق openTab) مسیر را عوض می‌کند،
  // تب فعال همان تب به‌روزرسانی می‌شود (نه ساخت تب جدید). این حالت شامل navigate() مستقیمی هم می‌شود که
  // فرم‌ها بعد از ذخیره/حذف به لیست خودشان می‌زنند (مثلاً handleDelete در PurchaseInvoices.tsx) — چون آن
  // navigate() از switchTab/closeTab رد نمی‌شود، اگر اینجا maybeRefreshOnVisit صدا زده نشود، لیست مقصد
  // (اگر از قبل کش‌شده بود) کهنه می‌ماند و رکورد حذف/ویرایش‌شده را نشان نمی‌دهد.
  //
  // قاعده‌ی پایه: اگر تب فعال یک «فهرست» است و ناوبری داخلی (navigate/Link در هر صفحه‌ای) به یک «فرم»
  // (/new یا /edit) می‌رود، فرم هرگز جای فهرست را نمی‌گیرد؛ در یک تب تازه باز می‌شود و تب فهرست دست‌نخورده
  // می‌ماند — یعنی رفتار «باز شدن فرم در تب جدید» برای همه‌ی صفحات (حاضر و آینده) یکسان است و نیازی نیست
  // هر صفحه جداگانه openTab صدا بزند. اگر همان فرم قبلاً در تبی باز است، به همان تب (با حالت فعلی‌اش) می‌رویم.
  useEffect(() => {
    if (!initialized.current) return;
    const active = tabs.find((t) => t.id === activeTabId);
    if (active && active.path !== currentFullPath) {
      if (isListShapedPath(active.path) && isFormShapedPath(currentFullPath)) {
        const existing = tabs.find((t) => t.path === currentFullPath);
        if (existing) {
          setActiveTabId(existing.id);
        } else {
          clearFormState(currentFullPath);
          const tab: Tab = { id: nextId(), path: currentFullPath, title: getTitleForPath(pathOnly(currentFullPath)) };
          setTabs((prev) => [...prev, tab]);
          setActiveTabId(tab.id);
        }
        return;
      }
      maybeRefreshOnVisit(currentFullPath);
    }
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId && t.path !== currentFullPath
          ? { ...t, path: currentFullPath, title: getTitleForPath(pathOnly(currentFullPath)) }
          : t
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  function openTab(path: string) {
    // هر بار که از منو (یا هرجای دیگر) یک تب جدید باز می‌شود، هیچ داده‌ی کش‌شده‌ای خوانده نشود؛
    // فرم/فهرست همیشه تازه از سرور واکشی شود. فقط سوییچ بین تب‌های از قبل بازشده (switchTab) کش را حفظ می‌کند.
    const base = pathOnly(path);

    // فرمی که همین الان (با همین مسیر و query) در یک تب باز است، دوباره ساخته نمی‌شود: دو تب با یک کلید کش
    // مشترک، حالت همدیگر را خراب می‌کنند. به همان تب می‌رویم و حالت نیمه‌کاره‌اش دست‌نخورده می‌ماند.
    if (isFormShapedPath(path)) {
      const existing = tabs.find((t) => t.path === path);
      if (existing) {
        setActiveTabId(existing.id);
        navigate(existing.path);
        return;
      }
    }

    // فقط «خانواده‌ی دقیق» کلیدِ همین مسیر پاک می‌شود (نه هر کلیدی که پیشوند مشترک دارد) — قبلاً باز کردن تب
    // «/accounts» همه‌ی فرم‌های /accounts/new و /accounts/:id/edit را هم پاک می‌کرد.
    clearFormState(path);
    clearPersistedStateFamily(base);
    clearReviewReportCacheForPath(base);

    const tab: Tab = { id: nextId(), path, title: getTitleForPath(base) };
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
    navigate(path);
  }

  function switchTab(id: string) {
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return;
    maybeRefreshOnVisit(tab.path);
    setActiveTabId(id);
    navigate(tab.path);
  }

  function closeTab(id: string) {
    setTabs((prev) => {
      const closed = prev.find((t) => t.id === id);
      if (closed) {
        clearReviewReportCacheForPath(pathOnly(closed.path));
        // فرمِ بسته‌شده کشش را با خودش می‌برد؛ فرم دیگری تحت تاثیر قرار نمی‌گیرد (clearFormState فقط خانواده‌ی دقیق را پاک می‌کند)
        if (isFormShapedPath(closed.path)) clearFormState(closed.path);
      }

      const idx = prev.findIndex((t) => t.id === id);
      const next = prev.filter((t) => t.id !== id);
      if (id === activeTabId) {
        if (next.length === 0) {
          setActiveTabId(null);
          navigate("/");
        } else {
          const neighbor = next[Math.max(0, idx - 1)] || next[0];
          maybeRefreshOnVisit(neighbor.path);
          setActiveTabId(neighbor.id);
          navigate(neighbor.path);
        }
      }
      return next;
    });
  }

  /** بستن همه‌ی تب‌های باز (مثلاً وقتی کاربر دوره مالی جاری را عوض می‌کند، تا هیچ فرمی با اطلاعات کش‌شده‌ی دوره‌ی قبلی باز نماند) */
  function closeAllTabs() {
    clearAllReviewReportCaches();
    clearPersistedStateByPrefix("");
    setTabs([]);
    setActiveTabId(null);
    navigate("/");
  }

  return (
    <Ctx.Provider value={{ tabs, activeTabId, refreshNonce, openTab, switchTab, closeTab, closeAllTabs }}>{children}</Ctx.Provider>
  );
}

export function useTabs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTabs must be used within TabsProvider");
  return ctx;
}
