import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getTitleForPath } from "./tabTitle";
import { clearAccountsReviewSnapshot } from "./accountsReviewCache";
import { clearPersistedStateByPrefix } from "./usePersistedState";
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
function isListShapedPath(path: string): boolean {
  return !path.endsWith("/new") && !path.endsWith("/edit");
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
    if (isListShapedPath(path) && refreshTabIfStale(path)) {
      setRefreshNonce((n) => n + 1);
    }
  }

  // در اولین بارگذاری، اگر کاربر مستقیم روی یک مسیر داخلی (نه خانه) وارد شده، یک تب برایش بساز
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (location.pathname !== "/") {
      const tab: Tab = { id: nextId(), path: location.pathname, title: getTitleForPath(location.pathname) };
      setTabs([tab]);
      setActiveTabId(tab.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // هماهنگ‌سازی: وقتی ناوبری داخلی (نه از طریق openTab) مسیر را عوض می‌کند،
  // تب فعال همان تب به‌روزرسانی می‌شود (نه ساخت تب جدید). این حالت شامل navigate() مستقیمی هم می‌شود که
  // فرم‌ها بعد از ذخیره/حذف به لیست خودشان می‌زنند (مثلاً handleDelete در PurchaseInvoices.tsx) — چون آن
  // navigate() از switchTab/closeTab رد نمی‌شود، اگر اینجا maybeRefreshOnVisit صدا زده نشود، لیست مقصد
  // (اگر از قبل کش‌شده بود) کهنه می‌ماند و رکورد حذف/ویرایش‌شده را نشان نمی‌دهد.
  useEffect(() => {
    if (!initialized.current) return;
    const active = tabs.find((t) => t.id === activeTabId);
    if (active && active.path !== location.pathname) {
      maybeRefreshOnVisit(location.pathname);
    }
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId && t.path !== location.pathname
          ? { ...t, path: location.pathname, title: getTitleForPath(location.pathname) }
          : t
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  function openTab(path: string) {
    // هر بار که از منو (یا هرجای دیگر) یک تب جدید باز می‌شود، هیچ داده‌ی کش‌شده‌ای خوانده نشود؛
    // فرم/فهرست همیشه تازه از سرور واکشی شود. فقط سوییچ بین تب‌های از قبل بازشده (switchTab) کش را حفظ می‌کند.
    const base = path.split("?")[0];
    clearPersistedStateByPrefix(`form:${base}`);
    clearPersistedStateByPrefix(base);
    if (base.startsWith("/account-review")) clearAccountsReviewSnapshot();

    const tab: Tab = { id: nextId(), path, title: getTitleForPath(path) };
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
      if (closed?.path.startsWith("/account-review")) clearAccountsReviewSnapshot();

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
    tabs.forEach((t) => {
      if (t.path.startsWith("/account-review")) clearAccountsReviewSnapshot();
    });
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
