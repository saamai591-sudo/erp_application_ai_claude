import { Modal } from "./Modal";
import { ExportColumn, exportGridToCsv } from "../lib/gridExport";
import { ApiError } from "../lib/api";

function ExcelExportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8.5 13.5 12 18M12 13.5l-3.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * فرمت استاندارد نمایش خطا در کل سیستم، سطح Base: اگر خطا جزئیاتِ ساختاریافته (details) نداشته باشد،
 * دقیقاً مثل دیالوگ خطای ساده‌ی قدیمی (فقط پیام + دکمه‌ی بستن) عمل می‌کند؛ اگر خطا از یک عملیات دسته‌ای
 * (bulk) بیاید و details داشته باشد (طبق backend/src/lib/bulkError.ts)، علاوه بر پیام خلاصه، دکمه‌ی
 * «دانلود جزئیات خطا (اکسل)» هم نشان می‌دهد — کاربر به‌جای خواندن یک دیوار متن، فایل اکسلِ ردیف‌به‌ردیفِ
 * علت هر شکست را دانلود می‌کند (با همان lib/gridExport.ts که همه‌ی گریدهای پروژه استفاده می‌کنند).
 *
 * هر صفحه‌ی جدیدی که یک عملیات دسته‌ای دارد (بک‌اندش با sendBulkError پاسخ می‌دهد)، فقط کافی است این
 * کامپوننت را به‌جای Modal دستی/alert خودش به‌کار ببرد و detailColumns (ستون‌های فارسیِ فایل اکسل) را
 * بدهد — نیازی به پیاده‌سازی جدا نیست.
 */
export function BulkErrorDialog<T extends object = Record<string, unknown>>({
  error,
  detailColumns,
  gridName = "خطاها",
  onClose,
}: {
  /** پیام خطا؛ می‌تواند خودِ ApiError باشد (details را هم از رویش می‌خواند) یا فقط یک رشته‌ی ساده */
  error: ApiError | string;
  /** ستون‌های فایل اکسلِ جزئیات — فقط وقتی details موجود باشد لازم است */
  detailColumns?: ExportColumn<T>[];
  /** نام فایل خروجی اکسل (بدون پسوند) */
  gridName?: string;
  onClose: () => void;
}) {
  const message = typeof error === "string" ? error : error.message;
  const details = typeof error === "string" ? undefined : (error.details as T[] | undefined);
  const hasDetails = !!details && details.length > 0 && !!detailColumns;

  return (
    <Modal title="خطا" onClose={onClose}>
      <p style={{ whiteSpace: "pre-line" }}>{message}</p>
      <div className="actions" style={{ display: "flex", gap: 8, justifyContent: "flex-start" }}>
        {hasDetails && (
          <button type="button" className="btn secondary" onClick={() => exportGridToCsv(detailColumns!, details!, gridName)}>
            <ExcelExportIcon />
            <span style={{ marginInlineStart: 6 }}>دانلود جزئیات خطا (اکسل)</span>
          </button>
        )}
        <button type="button" className="btn" onClick={onClose}>
          بستن
        </button>
      </div>
    </Modal>
  );
}
