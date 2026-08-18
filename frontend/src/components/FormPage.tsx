import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTabs } from "../lib/TabsContext";
import { InfoHint } from "./InfoHint";

function KebabIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7h12ZM10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function FormPage({
  title,
  description,
  formId,
  closePath,
  newPath,
  onDelete,
  extraActions,
  saveDisabled,
  wide,
  children,
}: {
  title: string;
  description?: string;
  /** شناسه‌ی تگ <form> داخل children؛ دکمه‌ی «ذخیره» نوار ابزار با همین id به فرم متصل می‌شود */
  formId?: string;
  /** مسیر بازگشت برای دکمه‌ی × (بستن) */
  closePath: string;
  /** اگر مشخص شود، دکمه‌ی «جدید» یک تب مستقل جدید برای رکورد تازه باز می‌کند */
  newPath?: string;
  /** اگر مشخص شود (یعنی در حالت ویرایش هستیم)، گزینه‌ی «حذف» در منوی کشویی نمایش داده می‌شود */
  onDelete?: () => void | Promise<void>;
  /** عملیات سفارشی دیگر برای منوی کشویی (مثل بررسی/برگشت از بررسی)، بالای گزینه‌ی حذف */
  extraActions?: { label: string; icon?: ReactNode; onClick: () => void | Promise<void> }[];
  /** اگر true باشد، دکمه‌ی ذخیره غیرفعال می‌شود (مثلاً برای مشاهده‌ی سند در حال بررسی) */
  saveDisabled?: boolean;
  /** برای فرم‌های عریض (مثل سند حسابداری با جدول ردیف‌ها) سقف عرض ۷۲۰ پیکسل حذف می‌شود */
  wide?: boolean;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { openTab } = useTabs();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleDelete() {
    setMenuOpen(false);
    if (!onDelete) return;
    if (!window.confirm("از حذف این رکورد مطمئن هستید؟")) return;
    await onDelete();
  }

  async function handleExtraAction(action: { onClick: () => void | Promise<void> }) {
    setMenuOpen(false);
    await action.onClick();
  }

  const hasMenu = !!onDelete || (extraActions && extraActions.length > 0);

  return (
    <div>
      <div className="form-toolbar">
        <div className="form-toolbar-right">
          <span className="form-toolbar-title">{title}</span>
          <button type="button" className="toolbar-icon-btn" onClick={() => navigate(closePath)} title="بستن">
            <CloseIcon />
          </button>
        </div>
        <div className="form-toolbar-left">
          {description && <InfoHint text={description} title={title} />}
          <button type="submit" form={formId} className="toolbar-icon-btn primary" disabled={saveDisabled} title="ذخیره">
            <SaveIcon />
          </button>
          {newPath && (
            <button type="button" className="toolbar-icon-btn" onClick={() => openTab(newPath)} title="جدید">
              <PlusIcon />
            </button>
          )}
          {hasMenu && (
            <div className="toolbar-menu-wrap">
              <button type="button" className="toolbar-icon-btn" onClick={() => setMenuOpen((v) => !v)} title="عملیات بیشتر">
                <KebabIcon />
              </button>
              {menuOpen && (
                <>
                  <div className="filter-backdrop" onClick={() => setMenuOpen(false)} />
                  <div className="toolbar-menu">
                    {extraActions?.map((action, i) => (
                      <button key={i} type="button" className="toolbar-menu-item" onClick={() => handleExtraAction(action)}>
                        {action.icon}
                        {action.label}
                      </button>
                    ))}
                    {onDelete && (
                      <button type="button" className="toolbar-menu-item danger" onClick={handleDelete}>
                        <TrashIcon />
                        حذف
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="card" style={{ padding: 16, maxWidth: "100%" }}>
        {children}
      </div>
    </div>
  );
}
