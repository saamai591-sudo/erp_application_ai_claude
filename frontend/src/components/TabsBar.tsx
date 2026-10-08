import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTabs, isUnsavedFormTab } from "../lib/TabsContext";
import { showToast } from "../lib/toast";

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

// تب «خانه» (مسیر /) با اقدام‌های گروهیِ منوی راست‌کلیک بسته نمی‌شود
const isHomeTab = (path: string) => path.split("?")[0] === "/";
// «ذخیره‌شده» = تبی که تغییر ذخیره‌نشده ندارد (فهرست‌ها، فرم‌های ذخیره‌شده، فرم‌های «جدید»ِ دست‌نخورده) — همان تشخیصی که هنگام بستن تب تایید می‌گیرد

export function TabsBar() {
  const { tabs, activeTabId, switchTab, closeTab, closeTabs } = useTabs();
  const [menu, setMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menu]);

  if (tabs.length === 0) return null;

  const isDirty = (t: { path: string }) => isUnsavedFormTab(t.path);
  const menuTab = menu ? tabs.find((t) => t.id === menu.tabId) : undefined;
  const idx = menuTab ? tabs.findIndex((t) => t.id === menuTab.id) : -1;
  const closable = (list: typeof tabs) => list.filter((t) => !isHomeTab(t.path));

  // اقدام‌های منو؛ هر کدام فقط وقتی فعال است که تبی برای بستن داشته باشد
  const others = menuTab ? closable(tabs.filter((t) => t.id !== menuTab.id)) : [];
  const after = menuTab ? closable(tabs.slice(idx + 1)) : [];
  const before = menuTab ? closable(tabs.slice(0, idx)) : [];
  const saved = closable(tabs.filter((t) => !isDirty(t)));
  const all = closable(tabs);

  const items: { label: string; disabled: boolean; run: () => void }[] = menuTab
    ? [
        { label: "بستن", disabled: false, run: () => closeTab(menuTab.id) },
        { label: "بستن بقیه‌ی تب‌ها", disabled: others.length === 0, run: () => closeTabs(others.map((t) => t.id), { activateId: menuTab.id }) },
        { label: "بستن همه‌ی تب‌ها", disabled: all.length === 0, run: () => closeTabs(all.map((t) => t.id)) },
        { label: "بستن تب‌های بعد از این", disabled: after.length === 0, run: () => closeTabs(after.map((t) => t.id), { activateId: menuTab.id }) },
        { label: "بستن تب‌های قبل از این", disabled: before.length === 0, run: () => closeTabs(before.map((t) => t.id), { activateId: menuTab.id }) },
        {
          label: "بستن تب‌های ذخیره‌شده",
          disabled: false,
          run: () => {
            if (saved.length === 0) return showToast("تب ذخیره‌شده‌ای برای بستن وجود ندارد", "error");
            closeTabs(saved.map((t) => t.id), { activateId: tabs.find((t) => isDirty(t))?.id });
          },
        },
      ]
    : [];

  return (
    <div className="tabs-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab-item ${tab.id === activeTabId ? "active" : ""}`}
          onClick={() => switchTab(tab.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
          }}
          onMouseDown={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              closeTab(tab.id);
            }
          }}
        >
          <span className="tab-title">{tab.title}</span>
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
            title="بستن"
          >
            <CloseIcon />
          </button>
        </div>
      ))}
      {menu &&
        menuTab &&
        createPortal(
          <>
            <div className="tab-ctx-backdrop" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} />
            <div className="tab-ctx-menu" style={{ top: menu.y, left: Math.min(menu.x, window.innerWidth - 200) }} role="menu">
              {items.map((it) => (
                <button
                  key={it.label}
                  type="button"
                  role="menuitem"
                  className="tab-ctx-item"
                  disabled={it.disabled}
                  onClick={() => {
                    setMenu(null);
                    it.run();
                  }}
                >
                  {it.label}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
