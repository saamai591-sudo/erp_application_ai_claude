import { useTabs } from "../lib/TabsContext";
import { PlusIcon } from "./icons";

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
