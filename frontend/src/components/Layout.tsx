import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { useTabs } from "../lib/TabsContext";
import { filterModulesByAccess, ModuleGroup } from "../navConfig";
import { FitText } from "./FitText";
import { usePermissions } from "../lib/usePermissions";
import { TabsBar } from "./TabsBar";
import { UserSettingsModal } from "./UserSettingsModal";
import { applyFont, applyTheme } from "../lib/userSettings";
import { loadPreferences } from "../lib/preferences";

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";
const MOBILE_QUERY = "(max-width: 768px)";

/** حالت پیش‌فرض جمع‌شدگی سایدبار: در موبایل همیشه جمع‌شده شروع می‌شود (صرف‌نظر از مقدار ذخیره‌شده‌ی
 * قبلی)، وگرنه آخرین انتخاب کاربر روی همین دستگاه (localStorage — این یک ترجیح صرفاً نمایشی/دستگاهی
 * است، نه تنظیمات کاربر که باید بین دستگاه‌ها همگام بماند مثل فونت/تم). */
function getInitialSidebarCollapsed(): boolean {
  try {
    if (window.matchMedia?.(MOBILE_QUERY).matches) return true;
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}


/** آیکن+رنگ اختصاصی هر ماژول اصلی (بر اساس عنوان ماژول در navConfig) — طبق تصمیم صریح کاربر، هر ماژول
 * باید آیکنی یکتا و کاملاً قابل‌تمایز از بقیه داشته باشد (نگاه کنید به رنگ‌های --nc-mod-* در styles.css) */
const MODULE_ICON: Record<string, string> = {
  "تنظیمات": "gear",
  "اطلاعات پایه": "database",
  "حسابداری": "calculator",
  "کالا و خدمت": "box",
  "مدیریت موجودی و انبار": "warehouse",
  "زنجیره تامین": "truck",
  "فروش": "cart",
  "مدیریت خزانه": "wallet",
};

/** رنگ اختصاصی هر ساب‌ماژول (بر اساس عنوان ساب‌ماژول؛ همین عنوان‌ها در چند ماژول تکرار می‌شوند، پس یک‌بار نگاشت کافی است) */
const SUBMODULE_ICON: Record<string, string> = {
  "عملیات": "bolt",
  "تعریف ساختار": "layers",
  "گزارش": "chart",
  "تنظیمات": "sliders",
  "رسید انبار": "box",
  "حواله انبار": "warehouse",
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      style={{ transform: open ? "rotate(0deg)" : "rotate(90deg)", transition: "transform .15s", flexShrink: 0 }}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** آیکن پوشه‌ی باز — برای باز کردن فهرست هر فرم، بعد از عنوان فرم قرار می‌گیرد */
function FolderOpenIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3 8a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v.5H6.2a2 2 0 0 0-1.94 1.51L3 19V8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M3 19l2.3-8.24A2 2 0 0 1 7.23 9.3H20l-2.1 8.05A2 2 0 0 1 15.96 19H3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** آیکن اختصاصی هر فرم؛ طبق کلید icon تعریف‌شده در navConfig — سبک توپر/پررنگ (نه خطی) برای تنوع و وضوح بیشتر رنگ */
function NavIcon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "currentColor", stroke: "none" };
  switch (name) {
    case "shield":
      return <svg {...common}><path d="M12 2.2 19.5 5.3V11c0 5.3-3.1 9.1-7.5 10.8C7.6 20.1 4.5 16.3 4.5 11V5.3L12 2.2Z" /></svg>;
    case "user":
      return <svg {...common}><circle cx="12" cy="7.6" r="3.6" /><path d="M4.6 20.8a7.4 7.4 0 0 1 14.8 0Z" /></svg>;
    case "coin":
      return (
        <svg {...common}>
          <path fillRule="evenodd" d="M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19Zm0 3a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Z" />
          <rect x="11" y="7" width="2" height="10" rx="1" />
        </svg>
      );
    case "trend":
      return (
        <svg {...common}>
          <rect x="3" y="14" width="3.4" height="7" rx="1" />
          <rect x="8.3" y="10" width="3.4" height="11" rx="1" />
          <rect x="13.6" y="6" width="3.4" height="15" rx="1" />
          <path d="M15 3 21 3 21 9 18.5 6.5 14 11 11.5 8.5Z" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
          <rect x="3.5" y="5" width="17" height="4.6" rx="2.5" fillOpacity="0.55" />
          <rect x="7.3" y="2.3" width="1.8" height="4" rx="0.9" />
          <rect x="14.9" y="2.3" width="1.8" height="4" rx="0.9" />
        </svg>
      );
    case "sitemap":
      return (
        <svg {...common}>
          <rect x="9" y="3" width="6" height="4.4" rx="1" />
          <rect x="3" y="16" width="6" height="4.4" rx="1" />
          <rect x="15" y="16" width="6" height="4.4" rx="1" />
          <path d="M12 7.4V11M6 16v-3a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3" stroke="currentColor" strokeWidth="1.6" fill="none" />
        </svg>
      );
    case "pin":
      return <svg {...common}><path fillRule="evenodd" d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8Zm0 4.8a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4Z" /></svg>;
    case "tag":
      return <svg {...common}><path fillRule="evenodd" d="M11.4 3H6a2 2 0 0 0-2 2v5.4a2 2 0 0 0 .6 1.4l9.6 9.6a2 2 0 0 0 2.8 0l5.4-5.4a2 2 0 0 0 0-2.8L12.8 3.6a2 2 0 0 0-1.4-.6ZM8 8.6a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2Z" /></svg>;
    case "building":
      return (
        <svg {...common}>
          <rect x="4" y="3" width="10.5" height="18" rx="1" />
          <rect x="15" y="10" width="5.5" height="11" rx="1" />
        </svg>
      );
    case "wallet":
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="13" rx="2.5" />
          <rect x="3" y="6" width="18" height="4.5" rx="2.5" fillOpacity="0.55" />
          <circle cx="16.5" cy="14.2" r="1.5" />
        </svg>
      );
    case "card":
      return (
        <svg {...common}>
          <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
          <rect x="3" y="9" width="18" height="3" fillOpacity="0.55" />
        </svg>
      );
    case "bank":
      return (
        <svg {...common}>
          <path d="M12 2.5 3 8.5h18Z" />
          <rect x="3" y="9.5" width="18" height="9" rx="1" />
          <rect x="2" y="18.5" width="20" height="2" rx="1" />
        </svg>
      );
    case "briefcase":
      return (
        <svg {...common}>
          <path d="M8.2 8V6.2a3.8 3.8 0 0 1 7.6 0V8h-2V6.2a1.8 1.8 0 0 0-3.6 0V8Z" />
          <rect x="3.5" y="8" width="17" height="11.5" rx="2" />
        </svg>
      );
    case "layers":
      return (
        <svg {...common}>
          <path d="M12 3 21 7.5 12 12 3 7.5Z" />
          <path d="M12 7.3 21 11.8 12 16.3 3 11.8Z" fillOpacity="0.7" />
          <path d="M12 11.6 21 16.1 12 20.6 3 16.1Z" fillOpacity="0.45" />
        </svg>
      );
    case "tree":
      return (
        <svg {...common}>
          <circle cx="12" cy="4.5" r="2.3" />
          <circle cx="6" cy="12" r="2.3" />
          <circle cx="18" cy="12" r="2.3" />
          <circle cx="6" cy="19.5" r="2.3" />
          <circle cx="18" cy="19.5" r="2.3" />
          <path d="M12 6.8V10.5M6 14.3V17.2M18 14.3V17.2M8.8 10.5 6 12M15.2 10.5 18 12" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
      );
    case "file":
      return (
        <svg {...common}>
          <path d="M6.5 2.5h8.5l5 5v13.3a1.7 1.7 0 0 1-1.7 1.7H6.5a1.7 1.7 0 0 1-1.7-1.7V4.2a1.7 1.7 0 0 1 1.7-1.7Z" />
          <path d="M15 2.5 20 7.5h-3.3a1.7 1.7 0 0 1-1.7-1.7Z" fillOpacity="0.5" />
          <rect x="8" y="13" width="8" height="1.6" rx="0.8" fillOpacity="0.5" />
          <rect x="8" y="16.3" width="8" height="1.6" rx="0.8" fillOpacity="0.5" />
        </svg>
      );
    case "ledger":
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="1.8" />
          <rect x="4" y="3" width="3.5" height="18" rx="1.8" fillOpacity="0.6" />
          <rect x="10" y="8" width="7" height="1.4" rx="0.7" fillOpacity="0.55" />
          <rect x="10" y="12" width="7" height="1.4" rx="0.7" fillOpacity="0.55" />
          <rect x="10" y="16" width="5" height="1.4" rx="0.7" fillOpacity="0.55" />
        </svg>
      );
    case "gear": {
      const teeth = [0, 45, 90, 135, 180, 225, 270, 315];
      return (
        <svg {...common}>
          <path fillRule="evenodd" d="M12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Zm0 2.3a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4Z" />
          {teeth.map((deg) => (
            <rect key={deg} x="10.6" y="1.6" width="2.8" height="4.2" rx="1" transform={`rotate(${deg} 12 12)`} />
          ))}
        </svg>
      );
    }
    case "database":
      return (
        <svg {...common}>
          <path d="M4 5c0-1.7 3.6-3 8-3s8 1.3 8 3v14c0 1.7-3.6 3-8 3s-8-1.3-8-3V5Z" />
          <path d="M4 5c0 1.7 3.6 3 8 3s8-1.3 8-3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.5" />
        </svg>
      );
    case "calculator": {
      const btns: [number, number][] = [
        [7, 10.5], [10.5, 10.5], [14, 10.5],
        [7, 14], [10.5, 14], [14, 14],
        [7, 17.5], [10.5, 17.5], [14, 17.5],
      ];
      return (
        <svg {...common}>
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <rect x="7" y="4.3" width="10" height="4" rx="1" fillOpacity="0.5" />
          {btns.map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="2.6" height="2.2" rx="0.6" fillOpacity="0.9" />
          ))}
        </svg>
      );
    }
    case "box":
      return (
        <svg {...common}>
          <path d="M12 2 20 6 12 10 4 6Z" />
          <path d="M4 6v10l8 4V12Z" fillOpacity="0.75" />
          <path d="M20 6v10l-8 4V12Z" fillOpacity="0.5" />
        </svg>
      );
    case "bolt":
      return <svg {...common}><path d="M13 2 4 14h6l-1 8 10-13h-6l1-7Z" /></svg>;
    case "warehouse":
      return (
        <svg {...common}>
          <path d="M12 2 21.5 7.2V9.3H2.5V7.2Z" />
          <rect x="3.3" y="9.3" width="17.4" height="12.2" rx="1" fillOpacity="0.8" />
          <rect x="9.8" y="14.3" width="4.4" height="7.2" fillOpacity="0.45" />
        </svg>
      );
    case "truck":
      return (
        <svg {...common}>
          <rect x="2" y="7" width="12.5" height="10" rx="1" />
          <path d="M14.5 10.2h4l3 3.3V17h-7Z" fillOpacity="0.8" />
          <circle cx="7" cy="18.3" r="2.1" />
          <circle cx="17.3" cy="18.3" r="2.1" />
        </svg>
      );
    case "cart":
      return (
        <svg {...common}>
          <path d="M2.5 3h2.3l1.1 3.2M5.9 6.2 8 14.5h10l2.2-8.3H5.9Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <circle cx="9.3" cy="19" r="1.7" />
          <circle cx="17" cy="19" r="1.7" />
        </svg>
      );
    case "sliders":
      return (
        <svg {...common}>
          <rect x="3" y="5.6" width="18" height="1.8" rx="0.9" fillOpacity="0.35" />
          <circle cx="15" cy="6.5" r="2.6" />
          <rect x="3" y="11.6" width="18" height="1.8" rx="0.9" fillOpacity="0.35" />
          <circle cx="9" cy="12.5" r="2.6" />
          <rect x="3" y="17.6" width="18" height="1.8" rx="0.9" fillOpacity="0.35" />
          <circle cx="17" cy="18.5" r="2.6" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <rect x="3" y="13" width="3.2" height="8" rx="1" />
          <rect x="8.2" y="8" width="3.2" height="13" rx="1" />
          <rect x="13.4" y="4" width="3.2" height="17" rx="1" />
          <rect x="18.6" y="10" width="3.2" height="11" rx="1" fillOpacity="0.6" />
        </svg>
      );
    default:
      return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>;
  }
}

/** آیکن توپر چرخ‌دنده برای دکمه‌ی تنظیمات در نوار دکمه‌های رنگی */
function GearIconFilled() {
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Zm0 2.3a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4Z" />
      {teeth.map((deg) => (
        <rect key={deg} x="10.6" y="1.6" width="2.8" height="4.2" rx="1" transform={`rotate(${deg} 12 12)`} />
      ))}
    </svg>
  );
}

/** آیکن توپر خروج (power) برای دکمه‌ی خروج در نوار دکمه‌های رنگی */
function PowerIconFilled() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2h-2v9h2V2Z" />
      <path d="M17.8 5.2 16.4 6.6a6 6 0 1 1-8.8 0L6.2 5.2a8 8 0 1 0 11.6 0Z" />
    </svg>
  );
}

/** آیکن دکمه‌ی جمع/باز کردن سایدبار — جهتش با حالت (باز/جمع) عوض می‌شود */
function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform .15s" }}
    >
      <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M14.5 4v16" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 9.5 8 12l3 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** فلش کوچک «رفتن به سطح بعد» (سمت چپ ردیف زیرماژول، رو به داخل محتوا) */
function DrillInArrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginInlineStart: "auto" }}>
      <path d="M15 6 9 12l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * منوی فلای‌اوت یک ماژول — وقتی سایدبار جمع شده و کاربر روی آیکن یک ماژول کلیک می‌کند، به‌جای بازشدن
 * آکاردئون داخل خودِ سایدبار (که چون سایدبار overflow دارد بریده می‌شد)، زیرماژول‌ها/فرم‌هایش را در پنل‌های
 * شناور نشان می‌دهد. درست هم‌الگوی Modal.tsx (طبق همان تصمیم صریح کاربر): با createPortal به document.body
 * پورتال می‌شود تا هیچ استایل/overflow ناخواسته‌ای از سایدبار به آن ارث نرسد.
 * طبق تصمیم صریح کاربر (با نمونه‌ی تصویری مشخص)، دو سطح به‌صورت آبشاری/کنار هم است — نه جایگزینی محتوای
 * همان پنل: پنل اول (ثابت، کنار آیکن) فقط فهرست زیرماژول‌ها را نشان می‌دهد؛ با کلیک روی یک زیرماژول، یک
 * پنل دومِ جداگانه کنار آن (سمت چپش، رو به محتوا) باز می‌شود و فرم‌های همان زیرماژول را نشان می‌دهد — هر دو
 * پنل هم‌زمان روی صفحه می‌مانند. موقعیت پنل دوم از روی مستطیل واقعیِ رندرشده‌ی پنل اول (ref + getBoundingClientRect)
 * محاسبه می‌شود، نه یک عرض فرضی، تا با هر طول محتوایی درست بچسبد.
 */
function ModuleFlyout({
  mod,
  anchorRect,
  activePath,
  onNavigate,
  onClose,
}: {
  mod: ModuleGroup;
  anchorRect: DOMRect;
  activePath?: string;
  onNavigate: (path: string) => void;
  onClose: () => void;
}) {
  const panel1Ref = useRef<HTMLDivElement>(null);
  const panel2Ref = useRef<HTMLDivElement>(null);
  const [activeSubTitle, setActiveSubTitle] = useState<string | null>(null);
  const [panel1Rect, setPanel1Rect] = useState<DOMRect | null>(null);
  const activeSub = mod.subModules.find((s) => s.title === activeSubTitle) || null;

  useLayoutEffect(() => {
    if (panel1Ref.current) setPanel1Rect(panel1Ref.current.getBoundingClientRect());
  }, [mod]);

  useEffect(() => {
    function onDocPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (panel1Ref.current?.contains(target)) return;
      if (panel2Ref.current?.contains(target)) return;
      onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDocPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  // چون dir سراسری صفحه rtl است، سایدبار سمت راست است؛ پس هر پنل باید از سمت چپِ پنل/آیکنِ قبلی‌اش باز
  // شود — یعنی لبه‌ی راستش روی لبه‌ی چپِ عنصر قبلی بنشیند (right محاسبه‌شده از فاصله‌ی لبه‌ی چپ تا لبه‌ی صفحه)
  const style1: React.CSSProperties = {
    position: "fixed",
    top: Math.min(anchorRect.top, window.innerHeight - 24),
    right: window.innerWidth - anchorRect.left + 6,
    maxHeight: `calc(100vh - ${anchorRect.top}px - 16px)`,
  };
  const style2: React.CSSProperties | null = panel1Rect
    ? {
        position: "fixed",
        top: Math.min(panel1Rect.top, window.innerHeight - 24),
        right: window.innerWidth - panel1Rect.left + 6,
        maxHeight: `calc(100vh - ${panel1Rect.top}px - 16px)`,
      }
    : null;

  return createPortal(
    <>
      <div className="nav-flyout" ref={panel1Ref} style={style1}>
        <div className="nav-flyout-header">
          <span className={`module-icon mod-ic-${MODULE_ICON[mod.title] || "layers"}`}>
            <NavIcon name={MODULE_ICON[mod.title] || "layers"} />
          </span>
          {mod.title}
        </div>
        {mod.subModules.map((sub) => (
          <button
            key={sub.title}
            className={`nav-flyout-submodule-row ${activeSubTitle === sub.title ? "active" : ""}`}
            onClick={() => setActiveSubTitle((prev) => (prev === sub.title ? null : sub.title))}
          >
            <span className={`submodule-icon sub-ic-${SUBMODULE_ICON[sub.title] || "file"}`}>
              <NavIcon name={SUBMODULE_ICON[sub.title] || "file"} />
            </span>
            <span>{sub.title}</span>
            <DrillInArrow />
          </button>
        ))}
      </div>
      {activeSub && style2 && (
        <div className="nav-flyout" ref={panel2Ref} style={style2}>
          <div className="nav-flyout-header">
            <span className={`submodule-icon sub-ic-${SUBMODULE_ICON[activeSub.title] || "file"}`}>
              <NavIcon name={SUBMODULE_ICON[activeSub.title] || "file"} />
            </span>
            {activeSub.title}
          </div>
          {activeSub.items.map((item) => {
            const isListActive = activePath === item.list;
            const isNewActive = !!item.create && activePath === item.create;
            return (
              <div key={item.key} className={`nav-item ${isListActive ? "active-list" : ""}`}>
                <button
                  className={`nav-label ${isNewActive ? "active-new" : ""}`}
                  onClick={() => onNavigate(item.create ?? item.list)}
                  title={item.create ? "باز کردن فرم جدید در تب جدید" : "باز کردن فهرست در تب جدید"}
                >
                  <span className={`nav-form-icon ic-${item.icon}`}><NavIcon name={item.icon} /></span>
                  <span>{item.label}</span>
                </button>
                <button
                  className={`folder-btn ${isListActive ? "active" : ""}`}
                  title="باز کردن فهرست در تب جدید"
                  onClick={() => onNavigate(item.list)}
                >
                  <FolderOpenIcon />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>,
    document.body
  );
}

export default function Layout() {
  const { user, logout, loading } = useAuth();
  const { openTab, activeTabId, tabs, refreshNonce } = useTabs();
  const { hasFormView, loading: permissionsLoading } = usePermissions();
  // آکاردئون: در هر لحظه فقط یک ماژول و یک ساب‌ماژول باز است (به‌صورت پیش‌فرض همه بسته‌اند)
  const [openModule, setOpenModule] = useState<string | null>(null);
  const [openSubModule, setOpenSubModule] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // طبق تصمیم صریح کاربر: سایدبار قابل جمع‌شدن به یک ستون آیکن است؛ در حالت جمع، کلیک روی آیکن هر ماژول
  // به‌جای آکاردئون داخلی، یک فلای‌اوت شناور (ModuleFlyout) باز می‌کند که زیرماژول‌ها/فرم‌هایش را نشان می‌دهد.
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(getInitialSidebarCollapsed);
  const [flyoutAnchor, setFlyoutAnchor] = useState<{ title: string; rect: DOMRect } | null>(null);

  useEffect(() => {
    // در موبایل، صرف‌نظر از انتخاب قبلی کاربر، هر بار عرض صفحه به بازه‌ی موبایل می‌رسد سایدبار جمع می‌شود
    // (طبق تصمیم صریح کاربر: «روی موبایل حالت جمع‌شده همیشه پیش‌فرض باشد») — ولی خروج از حالت موبایل، آخرین
    // انتخاب دستی کاربر را دست‌نخورده می‌گذارد (این افکت فقط ورود به موبایل را force می‌کند، نه خروج از آن)
    const mql = window.matchMedia(MOBILE_QUERY);
    function onChange(e: MediaQueryListEvent | MediaQueryList) {
      if (e.matches) setSidebarCollapsed(true);
    }
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // localStorage ممکن است در حالت خصوصی/محدودشده در دسترس نباشد — صرفاً یک ترجیح نمایشی است، خطا مهم نیست
      }
      return next;
    });
    setFlyoutAnchor(null);
  }

  function onModuleIconClick(title: string, btn: HTMLButtonElement) {
    setFlyoutAnchor((prev) => (prev?.title === title ? null : { title, rect: btn.getBoundingClientRect() }));
  }
  // طبق تصمیم صریح کاربر (ریشه‌ی باگ پیش‌فرض بازه‌ی تاریخ در گزارش‌های Review): تا وقتی این fetch تمام
  // نشده، getPreference("fiscalPeriodId") (و هر تنظیم دیگری) مقدار DEFAULTS خالی را برمی‌گرداند — نه
  // مقدار واقعی ذخیره‌شده‌ی کاربر. صفحاتی که این مقدار را در افکت mount خودشان synchronous می‌خوانند
  // (مثل محاسبه‌ی پیش‌فرض «از تاریخ/تا تاریخ» بر مبنای دوره مالی انتخابی) دچار یک race واقعی می‌شدند:
  // اگر آن صفحه زودتر از resolve این fetch مانت می‌شد، پیش‌فرض اشتباه (آخرین دوره مالی به‌جای دوره مالی
  // واقعاً انتخاب‌شده) محاسبه می‌شد. راه‌حل ریشه‌ای این نیست که هر مصرف‌کننده جداگانه صبر کند، بلکه این
  // است که کل درخت صفحات (Outlet) اصلاً تا آماده‌شدن تنظیمات مانت نشود — دقیقاً هم‌الگوی گیت loading زیر.
  const [preferencesLoading, setPreferencesLoading] = useState(true);

  useEffect(() => {
    // تنظیمات کاربر (فونت/تم/…) سمت بک‌اند ذخیره شده‌اند (preferences.ts) — این‌جا یک‌بار بعد از ورود
    // کاربر واکشی و روی DOM اعمال می‌شوند، صرف‌نظر از این‌که کاربر قبلاً از همین مرورگر/سیستم وارد شده یا نه.
    loadPreferences().then((prefs) => {
      applyFont(prefs.font);
      applyTheme(prefs.theme);
      setPreferencesLoading(false);
    });
  }, []);

  // فقط فرم‌هایی که کاربر جاری واقعاً دسترسی «مشاهده» دارد در منو نشان داده می‌شوند — نگاه کنید به
  // filterModulesByAccess در navConfig.ts. تا وقتی مجوزها هنوز واکشی نشده، منو خالی نشان داده می‌شود
  // (نه همه‌ی فرم‌ها) تا حتی برای یک لحظه هم آیتم‌های غیرمجاز فلش نزنند.
  const visibleModules = useMemo(
    () => (permissionsLoading ? [] : filterModulesByAccess(hasFormView)),
    [permissionsLoading, hasFormView]
  );

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (preferencesLoading) return null;

  // مسیر تب شامل query هم هست (مثلاً /accounts/new?parentId=5)؛ برای تشخیص آیتم فعال منو فقط بخش مسیر مهم است
  const activePath = tabs.find((t) => t.id === activeTabId)?.path.split("?")[0];

  function toggleModule(title: string) {
    setOpenModule((prev) => {
      const next = prev === title ? null : title;
      setOpenSubModule(null); // با تعویض ماژول، ساب‌ماژول باز قبلی هم بسته شود
      return next;
    });
  }

  function toggleSubModule(key: string) {
    setOpenSubModule((prev) => (prev === key ? null : key));
  }

  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}
        onScroll={() => flyoutAnchor && setFlyoutAnchor(null)}
      >
        <div className="sidebar-head">
          {!sidebarCollapsed && <h1>حسابداری ERP</h1>}
          <button
            className="sidebar-toggle-btn"
            onClick={toggleSidebarCollapsed}
            title={sidebarCollapsed ? "باز کردن منو" : "جمع کردن منو"}
          >
            <CollapseIcon collapsed={sidebarCollapsed} />
          </button>
        </div>
        {visibleModules.map((mod) => {
          // حالت جمع‌شده: به‌جای آکاردئون، فقط آیکن ماژول نشان داده می‌شود؛ کلیک روی آن ModuleFlyout را باز/بسته می‌کند
          if (sidebarCollapsed) {
            const isFlyoutOpen = flyoutAnchor?.title === mod.title;
            return (
              <button
                key={mod.title}
                className={`module-icon-btn ${isFlyoutOpen ? "active" : ""}`}
                onClick={(e) => onModuleIconClick(mod.title, e.currentTarget)}
                title={mod.title}
              >
                <span className={`module-icon mod-ic-${MODULE_ICON[mod.title] || "layers"}`}>
                  <NavIcon name={MODULE_ICON[mod.title] || "layers"} />
                </span>
              </button>
            );
          }
          const modOpen = openModule === mod.title;
          return (
            <div key={mod.title} className="nav-module">
              <button className="module-title" onClick={() => toggleModule(mod.title)}>
                <ChevronIcon open={modOpen} />
                <span className={`module-icon mod-ic-${MODULE_ICON[mod.title] || "layers"}`}>
                  <NavIcon name={MODULE_ICON[mod.title] || "layers"} />
                </span>
                <FitText>{mod.title}</FitText>
              </button>
              {modOpen &&
                mod.subModules.map((sub) => {
                  const subKey = `${mod.title}/${sub.title}`;
                  const subOpen = openSubModule === subKey;
                  return (
                    <div key={subKey} className="nav-submodule">
                      <button className="submodule-title" onClick={() => toggleSubModule(subKey)}>
                        <ChevronIcon open={subOpen} />
                        <span className={`submodule-icon sub-ic-${SUBMODULE_ICON[sub.title] || "file"}`}>
                          <NavIcon name={SUBMODULE_ICON[sub.title] || "file"} />
                        </span>
                        <FitText>{sub.title}</FitText>
                      </button>
                      {subOpen &&
                        sub.items.map((item) => {
                          const isListActive = activePath === item.list;
                          const isNewActive = !!item.create && activePath === item.create;
                          return (
                            <div key={item.key} className={`nav-item ${isListActive ? "active-list" : ""}`}>
                              <button
                                className={`nav-label ${isNewActive ? "active-new" : ""}`}
                                onClick={() => openTab(item.create ?? item.list)}
                                title={item.create ? "باز کردن فرم جدید در تب جدید" : "باز کردن فهرست در تب جدید"}
                              >
                                <span className={`nav-form-icon ic-${item.icon}`}><NavIcon name={item.icon} /></span>
                                <FitText>{item.label}</FitText>
                              </button>
                              <button
                                className={`folder-btn ${isListActive ? "active" : ""}`}
                                title="باز کردن فهرست در تب جدید"
                                onClick={() => openTab(item.list)}
                              >
                                <FolderOpenIcon />
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
            </div>
          );
        })}
      </aside>
      {sidebarCollapsed &&
        flyoutAnchor &&
        (() => {
          const mod = visibleModules.find((m) => m.title === flyoutAnchor.title);
          if (!mod) return null;
          return (
            <ModuleFlyout
              mod={mod}
              anchorRect={flyoutAnchor.rect}
              activePath={activePath}
              onNavigate={(path) => {
                openTab(path);
                setFlyoutAnchor(null);
              }}
              onClose={() => setFlyoutAnchor(null)}
            />
          );
        })()}
      <div className="main">
        <div className="topbar">
          <div className="topbar-account">
            <div className="user">{user.firstName} {user.lastName}</div>
          </div>
          <div className="topbar-account">
            <button className="topbar-dock-btn dock-c-blue" onClick={() => setSettingsOpen(true)} title="تنظیمات کاربری">
              <GearIconFilled />
            </button>
            <button className="topbar-dock-btn dock-c-red" onClick={logout} title="خروج">
              <PowerIconFilled />
            </button>
          </div>
        </div>
        <TabsBar />
        <div className="content">
          {/* key={activeTabId}: باعث می‌شود هر تب یک نمونه‌ی کاملاً مستقل و تازه از کامپوننت صفحه داشته باشد.
              بدون این، چون مسیرهای «جدید» (مثلاً /goods/new) در تب‌های مختلف دقیقاً یک Route/کامپوننت را
              match می‌کنند، React آن را remount نمی‌کند و state فرم (حتی ذخیره‌نشده) از تب قبلی باقی می‌ماند.
              با کلیدگذاری بر اساس activeTabId: باز کردن یک تب *جدید* (openTab) همیشه remount واقعی می‌شود
              (چون activeTabId عوض می‌شود) و چون openTab کش usePersistedState را هم پاک می‌کند، فرم/فهرست
              همیشه از نو و خالی/تازه شروع می‌شود؛ ولی سوییچ بین تب‌های از‌قبل‌بازشده هم چون activeTabId
              عوض می‌شود remount می‌کند و چون کش آن تب پاک نشده، مقدار قبلی‌اش را از usePersistedState پس
              می‌گیرد (دقیقاً همان رفتاری که در توضیح usePersistedState قصد شده بود). ناوبری‌های navigate()
              ساده‌ی داخل همان تب (مثل ویرایش از فهرست) activeTabId را عوض نمی‌کنند، پس رفتار فعلی آن‌ها
              (بدون remount) دست‌نخورده می‌ماند. */}
          {/* refreshNonce: وقتی کاربر روی تبی کلیک می‌کند که «کهنه» تشخیص داده شده (نگاه کنید به
              TabsContext.maybeRefreshOnVisit/listInvalidation.ts)، حتی اگر همان تب از قبل هم فعال
              بوده باشد (activeTabId عوض نمی‌شود)، این عدد بالا می‌رود تا کلید Outlet هرحال تغییر کند و
              remount واقعی (پس واکشی دوباره‌ی فهرست) رخ بدهد. */}
          <Outlet key={`${activeTabId || "no-tab"}:${refreshNonce}`} />
        </div>
      </div>
      {settingsOpen && <UserSettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
