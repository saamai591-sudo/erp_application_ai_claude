import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { useTabs } from "../lib/TabsContext";
import { useTabScrollRestore } from "../lib/tabScroll";
import { filterModulesByAccess, ModuleGroup, NavItem } from "../navConfig";
import { resolveNavBehavior } from "../lib/formTypes";
import { FitText } from "./FitText";
import { usePermissions } from "../lib/usePermissions";
import { prefetchEntitlements } from "../lib/useEntitlements";
import { TabsBar } from "./TabsBar";
import { UserSettingsModal } from "./UserSettingsModal";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { AboutModal } from "./AboutModal";
import { FiscalPeriodBadge } from "./FiscalPeriodBadge";
import { WorkflowBell } from "./WorkflowBell";
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
  "امور مالیاتی": "receipt",
  "منابع انسانی": "users",
  "حقوق و دستمزد": "banknote",
  "مدیریت تردد": "clock",
  "کارتابل": "inbox",
  "فروش فروشگاهی": "store",
};

/** رنگ اختصاصی هر ساب‌ماژول (بر اساس عنوان ساب‌ماژول؛ همین عنوان‌ها در چند ماژول تکرار می‌شوند، پس یک‌بار نگاشت کافی است) */
const SUBMODULE_ICON: Record<string, string> = {
  "عملیات": "bolt",
  "تعریف ساختار": "layers",
  "گزارش": "chart",
  "تنظیمات": "sliders",
  "رسید انبار": "box",
  "حواله انبار": "warehouse",
  "پرسنلی": "users",
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
  // سبک «Outline رنگی» (به‌سبک Lucide/FontAwesome-regular): همه‌ی آیکن‌ها خطی‌اند، با همین ضخامت/اندازه/سرخط؛ رنگ از currentColor
  // (رنگ ماژول) می‌آید و داخل آیکن هیچ‌وقت پر نمی‌شود. آیکن جدید هم باید همین props را بگیرد.
  const o = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.1, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "shield":
      return (
        <svg {...o}>
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        </svg>
      );
    case "users":
      return (
        <svg {...o}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "banknote":
      return (
        <svg {...o}>
          <rect width="20" height="12" x="2" y="6" rx="2" />
          <circle cx="12" cy="12" r="2" />
          <path d="M6 12h.01M18 12h.01" />
        </svg>
      );
    case "inbox":
      return (
        <svg {...o}>
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      );
    case "clock":
      return (
        <svg {...o}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "user":
      return (
        <svg {...o}>
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "coin":
      return (
        <svg {...o}>
          <circle cx="12" cy="12" r="10" />
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
          <path d="M12 18V6" />
        </svg>
      );
    case "trend":
      return (
        <svg {...o}>
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...o}>
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M3 10h18" />
        </svg>
      );
    case "sitemap":
      return (
        <svg {...o}>
          <rect x="16" y="16" width="6" height="6" rx="1" />
          <rect x="2" y="16" width="6" height="6" rx="1" />
          <rect x="9" y="2" width="6" height="6" rx="1" />
          <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" />
          <path d="M12 12V8" />
        </svg>
      );
    case "pin":
      return (
        <svg {...o}>
          <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case "tag":
      return (
        <svg {...o}>
          <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
          <circle cx="7.5" cy="7.5" r=".5" />
        </svg>
      );
    case "building":
      return (
        <svg {...o}>
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
          <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
          <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
          <path d="M10 6h4" />
          <path d="M10 10h4" />
          <path d="M10 14h4" />
          <path d="M10 18h4" />
        </svg>
      );
    case "wallet":
      return (
        <svg {...o}>
          <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
          <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
        </svg>
      );
    case "card":
      return (
        <svg {...o}>
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <line x1="2" x2="22" y1="10" y2="10" />
        </svg>
      );
    case "bank":
      return (
        <svg {...o}>
          <line x1="3" x2="21" y1="22" y2="22" />
          <line x1="6" x2="6" y1="18" y2="11" />
          <line x1="10" x2="10" y1="18" y2="11" />
          <line x1="14" x2="14" y1="18" y2="11" />
          <line x1="18" x2="18" y1="18" y2="11" />
          <polygon points="12 2 20 7 4 7" />
        </svg>
      );
    case "briefcase":
      return (
        <svg {...o}>
          <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          <rect width="20" height="14" x="2" y="6" rx="2" />
        </svg>
      );
    case "layers":
      return (
        <svg {...o}>
          <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
          <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
          <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
        </svg>
      );
    case "tree":
      return (
        <svg {...o}>
          <path d="M21 12h-8" />
          <path d="M21 6H8" />
          <path d="M21 18h-8" />
          <path d="M3 6v4c0 1.1.9 2 2 2h3" />
          <path d="M3 10v6c0 1.1.9 2 2 2h3" />
        </svg>
      );
    case "file":
      return (
        <svg {...o}>
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          <path d="M10 9H8" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
        </svg>
      );
    case "ledger":
      return (
        <svg {...o}>
          <path d="M2 6h4" />
          <path d="M2 10h4" />
          <path d="M2 14h4" />
          <path d="M2 18h4" />
          <rect width="16" height="20" x="4" y="2" rx="2" />
          <path d="M16 2v20" />
        </svg>
      );
    case "gear":
      return (
        <svg {...o}>
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "database":
      return (
        <svg {...o}>
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5V19A9 3 0 0 0 21 19V5" />
          <path d="M3 12A9 3 0 0 0 21 12" />
        </svg>
      );
    case "calculator":
      return (
        <svg {...o}>
          <rect width="16" height="20" x="4" y="2" rx="2" />
          <line x1="8" x2="16" y1="6" y2="6" />
          <line x1="16" x2="16" y1="14" y2="18" />
          <path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01" />
        </svg>
      );
    case "box":
      return (
        <svg {...o}>
          <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
          <path d="M12 22V12" />
          <polyline points="3.29 7 12 12 20.71 7" />
          <path d="m7.5 4.27 9 5.15" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...o}>
          <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
        </svg>
      );
    case "warehouse":
      return (
        <svg {...o}>
          <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z" />
          <path d="M6 18h12" />
          <path d="M6 14h12" />
          <rect width="12" height="12" x="6" y="10" />
        </svg>
      );
    case "truck":
      return (
        <svg {...o}>
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
          <path d="M15 18H9" />
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
          <circle cx="17" cy="18" r="2" />
          <circle cx="7" cy="18" r="2" />
        </svg>
      );
    case "receipt":
      return (
        <svg {...o}>
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
          <path d="M12 17.5v-11" />
        </svg>
      );
    case "store":
      return (
        <svg {...o}>
          <path d="M3 9l1.5-5h15L21 9" />
          <path d="M3 9v1a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9" />
          <path d="M5 13v8h14v-8" />
          <path d="M10 21v-5h4v5" />
        </svg>
      );
    case "cart":
      return (
        <svg {...o}>
          <circle cx="8" cy="21" r="1" />
          <circle cx="19" cy="21" r="1" />
          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
        </svg>
      );
    case "sliders":
      return (
        <svg {...o}>
          <line x1="21" x2="14" y1="4" y2="4" />
          <line x1="10" x2="3" y1="4" y2="4" />
          <line x1="21" x2="12" y1="12" y2="12" />
          <line x1="8" x2="3" y1="12" y2="12" />
          <line x1="21" x2="16" y1="20" y2="20" />
          <line x1="12" x2="3" y1="20" y2="20" />
          <line x1="14" x2="14" y1="2" y2="6" />
          <line x1="8" x2="8" y1="10" y2="14" />
          <line x1="16" x2="16" y1="18" y2="22" />
        </svg>
      );
    case "chart":
      return (
        <svg {...o}>
          <path d="M3 3v16a2 2 0 0 0 2 2h16" />
          <path d="M18 17V9" />
          <path d="M13 17V5" />
          <path d="M8 17v-3" />
        </svg>
      );
    default:
      return (
        <svg {...o}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
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

/** آیکن توپر «درباره» (i داخل دایره) برای دکمه‌ی درباره در نوار دکمه‌های رنگی */
function InfoIconFilled() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4.4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm-1.4 4.6h2.2c.6 0 1 .4 1 1v5.2h.6a.9.9 0 0 1 0 1.8h-3.4a.9.9 0 0 1 0-1.8h.6V12.8h-.6a.9.9 0 0 1 0-1.8Z" />
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
/**
 * یک ردیف آیتم منوی سمت راست — تنها جایی که ظاهر/رفتار مشترک آیتم‌ها بر اساس «نوع فرم» (lib/formTypes.ts) اعمال می‌شود؛ هم منوی عادی و هم
 * منوی شناور (منوی جمع‌شده) از همین استفاده می‌کنند. آیکن «فهرست» فقط برای فرم‌های نوع list نمایش داده می‌شود (فرم‌های عملیاتی/گزارش فهرست جدا
 * ندارند)؛ برچسب فرم و راهنمای آن هم از همین رفتار می‌آید. هر فرم/آیتم جدید فقط نوعش را در navConfig مشخص می‌کند.
 */
function NavItemRow({ item, activePath, onOpen, fitLabel }: { item: NavItem; activePath?: string; onOpen: (path: string) => void; fitLabel?: boolean }) {
  const behavior = resolveNavBehavior(item);
  const isListActive = activePath === item.list;
  const isNewActive = !!item.create && activePath === item.create;
  return (
    <div className={`nav-item ${isListActive ? "active-list" : ""} ${behavior.showListIcon ? "" : "no-list-icon"}`}>
      <button className={`nav-label ${isNewActive ? "active-new" : ""}`} onClick={() => onOpen(behavior.labelTarget)} title={behavior.labelTitle}>
        <span className={`nav-form-icon ic-${item.icon}`}><NavIcon name={item.icon} /></span>
        {fitLabel ? <FitText>{item.label}</FitText> : <span>{item.label}</span>}
      </button>
      {behavior.showListIcon && (
        <button className={`folder-btn ${isListActive ? "active" : ""}`} title="باز کردن فهرست در تب جدید" onClick={() => onOpen(item.list)}>
          <FolderOpenIcon />
        </button>
      )}
    </div>
  );
}

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
  // صفحه‌ی باریک (موبایل) یا جایی که پنل دوم از لبه‌ی چپ بیرون می‌زند: به‌جای دو پنل کنار هم، یک پنل تمام‌عرض؛ انتخاب زیرماژول آن را با
  // فهرست فرم‌ها عوض می‌کند و دکمه‌ی «بازگشت» به فهرست زیرماژول‌ها برمی‌گردد
  const stacked = window.innerWidth <= 768 || (panel1Rect !== null && panel1Rect.left < 250);
  const stackedStyle: React.CSSProperties = { ...style1, left: 8, minWidth: 0, maxWidth: "none" };
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
      {!(stacked && activeSub) && (
      <div className="nav-flyout" ref={panel1Ref} style={stacked ? stackedStyle : style1}>
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
      )}
      {activeSub && style2 && (
        <div className="nav-flyout" ref={panel2Ref} style={stacked ? stackedStyle : style2}>
          {stacked && (
            <button type="button" className="nav-flyout-submodule-row" onClick={() => setActiveSubTitle(null)}>
              <span>→</span>
              <span>بازگشت به {mod.title}</span>
            </button>
          )}
          <div className="nav-flyout-header">
            <span className={`submodule-icon sub-ic-${SUBMODULE_ICON[activeSub.title] || "file"}`}>
              <NavIcon name={SUBMODULE_ICON[activeSub.title] || "file"} />
            </span>
            {activeSub.title}
          </div>
          {activeSub.items.map((item) => (
            <NavItemRow key={item.key} item={item} activePath={activePath} onOpen={onNavigate} />
          ))}
        </div>
      )}
    </>,
    document.body
  );
}

export default function Layout() {
  const { user, logout, loading } = useAuth();
  const { openTab, activeTabId, tabs, refreshNonce } = useTabs();
  useTabScrollRestore(activeTabId, refreshNonce);
  const { hasFormView, loading: permissionsLoading } = usePermissions();
  // ماژول‌ها/قابلیت‌های لایسنس (مثلاً FX) را زود می‌خواند تا فیلدهای ارزی پیش از رندر صفحه‌ها پنهان شوند
  useEffect(() => {
    if (user) prefetchEntitlements();
  }, [user?.id]);
  // آکاردئون: در هر لحظه فقط یک ماژول و یک ساب‌ماژول باز است (به‌صورت پیش‌فرض همه بسته‌اند)
  const [openModule, setOpenModule] = useState<string | null>(null);
  const [openSubModule, setOpenSubModule] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
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
                        sub.items.map((item) => (
                          <NavItemRow key={item.key} item={item} activePath={activePath} onOpen={openTab} fitLabel />
                        ))}
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
            <button type="button" className="topbar-user-btn" onClick={() => setPasswordOpen(true)} title="تغییر کلمه عبور">
              <span className="topbar-user-avatar" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c.8-3.6 3.8-5.6 7.5-5.6s6.7 2 7.5 5.6" /></svg>
              </span>
              <span className="user">{user.firstName} {user.lastName}</span>
            </button>
          </div>
          <div className="topbar-account">
            <WorkflowBell />
            <FiscalPeriodBadge />
            <button className="topbar-dock-btn dock-c-blue" onClick={() => setSettingsOpen(true)} title="تنظیمات کاربری">
              <GearIconFilled />
            </button>
            <button className="topbar-dock-btn dock-c-slate" onClick={() => setAboutOpen(true)} title="درباره" aria-label="درباره">
              <InfoIconFilled />
            </button>
            <button className="topbar-dock-btn dock-c-red" onClick={() => logout()} title="خروج">
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
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
      {passwordOpen && <ChangePasswordModal onClose={() => setPasswordOpen(false)} />}
    </div>
  );
}
