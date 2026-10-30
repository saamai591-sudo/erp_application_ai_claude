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

// آیکن «راهبری» (فلش خمیده به سند بعدی)؛ وقتی بیش از یک فرم مقصد وجود دارد، یک علامت Combo (فلش پایین) کنارش می‌آید
function DownstreamIcon({ combo }: { combo: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M8 6 H21 V18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
        <path d="M3 6 L8 2.8 V9.2 Z" fill="currentColor" />
      </svg>
      {combo && (
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
          <path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
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
        <button type="button" className="toolbar-icon-btn" onClick={() => (allowed.length === 1 ? choose(allowed[0]) : setOpen((v) => !v))} title={allowed.length === 1 ? allowed[0].label : "صدور سند بعدی"}>
          <DownstreamIcon combo={allowed.length > 1} />
        </button>
        {open && allowed.length > 1 && (
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
