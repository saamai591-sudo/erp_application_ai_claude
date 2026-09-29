import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getTitleForPath } from "./tabTitle";
import { clearReviewReportCacheForPath, clearAllReviewReportCaches } from "./reviewReportCache";
import { clearPersistedStateByPrefix, clearPersistedStateFamily, instanceOfPath } from "./usePersistedState";
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
  /** دکمه‌ی «جدید» داخل یک فرم باز: به‌جای باز کردن تب تازه، همین تب فعال را به حالت «جدید» برمی‌گرداند */
  resetActiveTabToNew: (newPath: string) => void;
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
  return base.endsWith("/new") || base.endsWith("/edit") || base.endsWith("/re-edit");
}

function isListShapedPath(path: string): boolean {
  return !isFormShapedPath(path);
}

// کشِ فرم‌ها با کلید `form:<مسیر>` (گاهی با query، گاهی بدون آن — بسته به صفحه) و پسوندهایی مثل :form/:header
// ذخیره می‌شود. فقط همین «خانواده»‌ی دقیق پاک می‌شود، نه هر کلیدی که همین رشته را به‌عنوان پیشوند دارد.
function clearFormState(path: string) {
  const base = pathOnly(path);
  const inst = instanceOfPath(path);
  if (inst) {
    // «فرم جدیدِ» چندنمونه‌ای (مسیر با _i): فقط کش همان نمونه پاک می‌شود، نه فرم جدید دیگری با همان مسیر پایه
    clearPersistedStateFamily(`form:${base}@${inst}`);
    return;
  }
  clearPersistedStateFamily(`form:${path}`);
  if (base !== path) clearPersistedStateFamily(`form:${base}`);
}

// چند «فرم جدید» هم‌زمان مجازند (مثلاً دو حواله فروش تازه): اگر مسیر /new از قبل در یک تب باز است، تب تازه مسیر یکتای «…?_i=<شماره>» می‌گیرد
// (کش هر نمونه جدا؛ نگاه کنید به usePersistedState). ویرایش یک رکورد (/edit) همچنان یک تب دارد.
let instanceCounter = 1;
function isNewFormPath(path: string): boolean {
  return pathOnly(path).endsWith("/new");
}
function withNewInstance(path: string): string {
  instanceCounter += 1;
  return `${path}${path.includes("?") ? "&" : "?"}_i=${instanceCounter}`;
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
        if (existing && isNewFormPath(currentFullPath) && !instanceOfPath(currentFullPath)) {
          // فرم جدیدِ دیگری با همین مسیر از قبل باز است: به‌جای رفتن به آن، نمونه‌ی تازه‌ای با مسیر یکتا باز می‌شود
          const uniquePath = withNewInstance(currentFullPath);
          clearFormState(uniquePath);
          const tab: Tab = { id: nextId(), path: uniquePath, title: getTitleForPath(pathOnly(uniquePath)) };
          setTabs((prev) => [...prev, tab]);
          setActiveTabId(tab.id);
          navigate(uniquePath, { replace: true });
        } else if (existing) {
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
        if (isNewFormPath(path) && !instanceOfPath(path)) {
          // فرم جدید دیگری با همین مسیر باز است: تب تازه با نمونه‌ی یکتا (به‌جای رفتن به تب موجود)
          path = withNewInstance(path);
        } else {
          setActiveTabId(existing.id);
          navigate(existing.path);
          return;
        }
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

  /** «جدید» از داخل یک فرم باز (مثلاً بعد از ذخیره): همین تب فعال دوباره‌ی فرم خالی می‌شود، تب جدید باز
   * نمی‌شود. «جدید» از فهرست و از منوی کناری همچنان تب تازه باز می‌کنند (همان openTab). اگر تب فعال اصلاً
   * فرم نیست، همان رفتار قبلی (تب تازه) را دارد. */
  function resetActiveTabToNew(newPath: string) {
    const active = tabs.find((t) => t.id === activeTabId);
    if (!active || !isFormShapedPath(active.path)) {
      openTab(newPath);
      return;
    }
    // کش فرمِ فعلی (رکورد در حال ویرایش یا پیش‌نویس فرم جدید) دور ریخته می‌شود تا فرم خالی شروع شود
    clearFormState(active.path);
    let path = newPath;
    // تب دیگری از قبل روی همین مسیرِ «جدید» است: کلید کش مشترک حالت همدیگر را خراب می‌کند، پس نمونه‌ی یکتا
    if (tabs.some((t) => t.id !== active.id && t.path === path) && !instanceOfPath(path)) {
      path = withNewInstance(path);
    }
    clearFormState(path);
    setTabs((prev) => prev.map((t) => (t.id === active.id ? { ...t, path, title: getTitleForPath(pathOnly(path)) } : t)));
    // remount واقعی همین تب (کلید Outlet در Layout)، حتی وقتی مسیر عوض نمی‌شود (مثلاً از /x/new به /x/new)
    setRefreshNonce((n) => n + 1);
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
    <Ctx.Provider value={{ tabs, activeTabId, refreshNonce, openTab, resetActiveTabToNew, switchTab, closeTab, closeAllTabs }}>{children}</Ctx.Provider>
  );
}

export function useTabs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTabs must be used within TabsProvider");
  return ctx;
}
