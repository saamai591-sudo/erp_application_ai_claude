import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getTitleForPath } from "./tabTitle";
import { clearAccountsReviewSnapshot } from "./accountsReviewCache";
import { clearPersistedStateByPrefix } from "./usePersistedState";

export interface Tab {
  id: string;
  path: string;
  title: string;
}

interface TabsCtx {
  tabs: Tab[];
  activeTabId: string | null;
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

export function TabsProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const initialized = useRef(false);

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
  // تب فعال همان تب به‌روزرسانی می‌شود (نه ساخت تب جدید)
  useEffect(() => {
    if (!initialized.current) return;
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
    <Ctx.Provider value={{ tabs, activeTabId, openTab, switchTab, closeTab, closeAllTabs }}>{children}</Ctx.Provider>
  );
}

export function useTabs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTabs must be used within TabsProvider");
  return ctx;
}
