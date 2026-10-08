import { ComponentType, useState } from "react";
import { usePermissions } from "../lib/usePermissions";
import { currentTabPath, isTabDirty } from "../lib/unsavedChanges";
import { showError } from "../lib/toast";

// «راهبری» به سند بعدی زنجیره: آیکن آبشاری نوار ابزار فرم مبدأ (مثلاً پیش‌فاکتور) با منوی اقدام‌های پایین‌دست (صدور حواله فروش، …). هر اقدام یک دیالوگ دارد که
// فقط اطلاعاتی را می‌گیرد که سند مبدأ ندارد؛ با تایید، تبِ «جدید» فرم مقصد با داده‌ی پیش‌پر باز می‌شود (lib/formPrefill.ts) و سند تا «ذخیره»ی کاربر ساخته نمی‌شود.
// اقدام‌ها فقط وقتی دیده می‌شوند که کاربر مجوز «ایجاد» فرم مقصد را دارد. تنها پیاده‌سازی منو؛ هر فرم مبدأ فقط فهرست اقدام‌هایش را می‌دهد.

export interface DownstreamAction {
  key: string;
  label: string;
  /** کلید مجوز ایجاد فرم مقصد، مثلاً sales.operations.sales-deliveries.create */
  permission: string;
  /** دیالوگ اقدام؛ sourceId = شناسه‌ی سند مبدأ */
  Dialog: ComponentType<{ sourceId: number; onClose: () => void }>;
}

function DownstreamIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 5h9a3 3 0 013 3v2M16 10l-2.5-2.5M16 10l2.5-2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" transform="translate(-1 0)" />
      <path d="M12 14l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 12h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function DownstreamMenu({ actions, sourceId, disabledReason }: { actions: DownstreamAction[]; sourceId: number; disabledReason?: string | null }) {
  const { hasPermission } = usePermissions();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<DownstreamAction | null>(null);
  const allowed = actions.filter((a) => hasPermission(a.permission));
  if (allowed.length === 0) return null;

  function choose(a: DownstreamAction) {
    setOpen(false);
    if (disabledReason) return showError(disabledReason);
    // سند مبدأ باید همان چیزی باشد که ذخیره شده؛ تغییر ذخیره‌نشده می‌تواند با داده‌ی سرور ناسازگار باشد
    if (isTabDirty(currentTabPath())) return showError("ابتدا تغییرات این فرم را ذخیره کنید");
    setDialog(a);
  }

  return (
    <>
      <div className="toolbar-menu-wrap">
        <button type="button" className="toolbar-icon-btn" onClick={() => setOpen((v) => !v)} title="صدور سند بعدی">
          <DownstreamIcon />
        </button>
        {open && (
          <>
            <div className="filter-backdrop" onClick={() => setOpen(false)} />
            <div className="toolbar-menu">
              {allowed.map((a) => (
                <button key={a.key} type="button" className="toolbar-menu-item" onClick={() => choose(a)} style={disabledReason ? { opacity: 0.55 } : undefined} title={disabledReason || undefined}>
                  {a.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {dialog && <dialog.Dialog sourceId={sourceId} onClose={() => setDialog(null)} />}
    </>
  );
}
