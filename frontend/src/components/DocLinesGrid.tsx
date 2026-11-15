import { ReactNode } from "react";
import { toFaDigits } from "../lib/formatAmount";

// گریدِ ردیف‌های استانداردِ فرم‌های سندی: نوار عنوان + دکمه‌ی «+»، ناحیه‌ی اسکرول‌دار (`je-lines-*`) و
// نوار پایین با تعداد ردیف و جمع‌ها — همان ساختاری که فرم‌های انباری/خزانه (مثل رسید تولید) دارند؛
// صفحه فقط <thead>/<tbody> را می‌دهد. جدول خام `hr-table` برای ردیف‌های سند استفاده نشود.
export function DocLinesGrid({
  title = "ردیف‌ها",
  count,
  totals,
  onAdd,
  addTitle = "ردیف جدید",
  toolbarExtra,
  children,
}: {
  title?: string;
  count: number;
  /** متن جمع‌ها در نوار پایین (مثلاً «جمع مقدار: …») */
  totals?: ReactNode;
  /** بدون مقدار = دکمه‌ی افزودن نمایش داده نمی‌شود (سند قفل/فقط‌خواندنی) */
  onAdd?: () => void;
  addTitle?: string;
  /** دکمه/توضیح اضافه کنار عنوان (مثلاً «محاسبه از فرمول ساخت») */
  toolbarExtra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="je-lines-toolbar">
        <span className="je-lines-title">{title}</span>
        {toolbarExtra}
        {onAdd && (
          <button type="button" className="toolbar-icon-btn primary" onClick={onAdd} title={addTitle}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        )}
      </div>
      <div className="grid-wrap je-lines-wrap">
        <div className="je-lines-scroll grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
          <table className="je-lines-table">{children}</table>
        </div>
        <div className="grid-footer je-lines-footer">
          <span className="grid-footer-info">{count === 0 ? "بدون ردیف" : `${toFaDigits(String(count))} ردیف`}</span>
          {totals && <span className="je-lines-totals">{totals}</span>}
        </div>
      </div>
    </>
  );
}
