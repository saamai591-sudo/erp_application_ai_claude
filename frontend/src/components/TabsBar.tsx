import { useTabs } from "../lib/TabsContext";

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function TabsBar() {
  const { tabs, activeTabId, switchTab, closeTab } = useTabs();

  if (tabs.length === 0) return null;

  return (
    <div className="tabs-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab-item ${tab.id === activeTabId ? "active" : ""}`}
          onClick={() => switchTab(tab.id)}
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
    </div>
  );
}
