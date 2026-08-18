import { useTabs } from "../lib/TabsContext";

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** دکمه‌ی آیکنی «جدید» برای فهرست‌های غیر‌درختی؛ فرم‌های درختی (حسابها/ساختار سازمانی/مناطق جغرافیایی)
 * از دکمه‌ی داخلی خود درخت (TreeView) استفاده می‌کنند و به این کامپوننت نیاز ندارند. */
export function NewRecordButton({ path }: { path: string }) {
  const { openTab } = useTabs();
  return (
    <button type="button" className="toolbar-icon-btn primary" onClick={() => openTab(path)} title="جدید">
      <PlusIcon />
    </button>
  );
}
