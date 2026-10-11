// اگر VITE_API_URL صراحتاً تنظیم نشده باشد، آدرس بک‌اند از روی همان host ای که فرانت‌اند رویش باز شده
// محاسبه می‌شود (نه localhost ثابت) — چون این مقدار در زمان build/dev یک‌بار برای همه‌ی کلاینت‌ها ساخته
// می‌شود؛ اگر ثابت روی localhost باشد، کاربرهایی که از یک PC دیگر در شبکه به آدرس IP سرور وصل می‌شوند
// درخواستشان به localhost خودشان (نه سرور) می‌رود و با ERR_CONNECTION_REFUSED مواجه می‌شوند.
import { recordResourceFetch, recordResourceMutation } from "./listInvalidation";
import { rememberVersion, attachVersion, hasRememberedVersion, forgetVersion } from "./concurrencyToken";
import { getSavedFiscalPeriodId } from "./userSettings";
import { getAuthToken } from "./authToken";
import { scheduleAutoToast } from "./toast";
import { API_URL } from "./apiUrl";

/** آدرس کاملِ (قابل‌اشتراک) یک مسیر API، مثل لینک نمایش عمومی سند: https://دامنه/api/share/… */
export function absoluteApiUrl(path: string): string {
  return new URL(`${API_URL}${path}`, window.location.origin).href;
}

export class ApiError extends Error {
  warning?: boolean;
  /** فرمت استاندارد خطای عملیات دسته‌ای (bulk) — وقتی بک‌اند به‌جای یک پیام تکی، فهرست ساختاریافته‌ای
   * از شکست‌های مستقل هر آیتم را در details برمی‌گرداند (نگاه کنید به backend/src/lib/bulkError.ts)،
   * این‌جا هم عیناً حمل می‌شود تا BulkErrorDialog بتواند دکمه‌ی «دانلود جزئیات خطا (اکسل)» را نشان دهد.
   * برای بقیه‌ی خطاها (اکثریت قریب‌به‌اتفاق) این فیلد همیشه undefined می‌ماند — رفتار قبلی دست‌نخورده است. */
  details?: Record<string, unknown>[];
  constructor(message: string, warning?: boolean, details?: Record<string, unknown>[]) {
    super(message);
    this.warning = warning;
    this.details = details;
  }
}

async function request(path: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const fiscalPeriodId = getSavedFiscalPeriodId();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // دوره مالی «انتخاب‌شده‌ی کاربر» (تنظیمات کاربری) — بک‌اند این هدر را برای محدودکردن خودکار
      // لیست موجودیت‌های دارای fiscalPeriodId به همین دوره می‌خواند (لیب/prisma.ts). اگر کاربر هنوز
      // چیزی انتخاب نکرده، خالی می‌ماند و بک‌اند خودش fallback به آخرین دوره مالی می‌زند.
      ...(fiscalPeriodId ? { "x-fiscal-period-id": fiscalPeriodId } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // قفل لایسنس: نرم‌افزار فعال نیست ⇒ صفحه‌ی مدیریت (فعال‌سازی)
    if (res.status === 403 && data.code === "LICENSE_REQUIRED" && !window.location.pathname.startsWith("/management")) {
      window.location.assign("/management");
    }
    throw new ApiError(data.error || "خطای ناشناخته رخ داد", data.warning, data.details);
  }
  return data;
}

/** گزینه‌ی اختیاری هر درخواست؛ silent: پیام موفقیت خودکار نشان داده نشود */
export interface MutationOptions {
  silent?: boolean;
}

/**
 * مسیرهایی که با POST/PUT صدا زده می‌شوند ولی «عملیات» نیستند (ورود، اعتبارسنجی/پیش‌بررسی، کوئری گزارش، تنظیمات شخصی).
 * هر مسیر جدیدی از این نوع باید یا اینجا اضافه شود یا با { silent: true } صدا زده شود؛ بقیه‌ی POST/PUT/DELETEها خودکار پیام موفقیت می‌گیرند.
 */
const NON_OPERATION_PATHS = [/^\/auth\//, /^\/me\/preferences/, /\/(check|validate|preview|olap-pivot)(\?|$)/];

const VERB_MESSAGES: Record<string, string> = {
  approve: "تایید انجام شد",
  unapprove: "برگشت از تایید انجام شد",
  review: "بررسی انجام شد",
  unreview: "برگشت از بررسی انجام شد",
  "issue-journal-entry": "سند حسابداری صادر شد",
  "issue-warehouse-journal-entries": "سند حسابداری صادر شد",
  "journal-entry": "سند حسابداری حذف شد",
  issue: "صدور انجام شد",
  "re-edit": "ویرایش مجدد ذخیره شد",
  void: "ابطال انجام شد",
  reopen: "باز کردن انجام شد",
  close: "بستن انجام شد",
  reverse: "برگشت انجام شد",
  renumber: "شماره‌گذاری مجدد انجام شد",
  "accounting-confirm": "تایید حسابداری انجام شد",
  "accounting-confirm-revert": "برگشت از تایید حسابداری انجام شد",
  "advance-allocations": "تخصیص پیش‌پرداخت/پیش‌دریافت ذخیره شد",
  confirm: "تایید انجام شد",
  move: "جابه‌جایی انجام شد",
  run: "اجرا انجام شد",
  transition: "تغییر وضعیت انجام شد",
  "import-jobs": "درخواست درون‌ریزی ثبت شد",
};

function successMessage(method: "POST" | "PUT" | "DELETE", path: string): string {
  const clean = path.split("?")[0].replace(/\/+$/, "");
  const last = clean.split("/").pop() || "";
  if (method === "DELETE" && last !== "journal-entry") return "حذف انجام شد";
  if (VERB_MESSAGES[last]) return VERB_MESSAGES[last];
  const isRecord = /^\d+$/.test(last);
  if (method === "PUT") return isRecord ? "تغییرات ذخیره شد" : "ذخیره شد";
  if (method === "POST") return "ثبت شد";
  return "عملیات با موفقیت انجام شد";
}

/** پیام موفقیت خودکار پایه برای هر عملیات تغییردهنده (نگاه کنید به scheduleAutoToast در toast.ts) */
function notifySuccess(method: "POST" | "PUT" | "DELETE", path: string, options?: MutationOptions) {
  if (options?.silent || NON_OPERATION_PATHS.some((re) => re.test(path))) return;
  scheduleAutoToast(successMessage(method, path));
}

export const api = {
  get: (path: string) => request(path).then((data) => {
    recordResourceFetch(path);
    rememberVersion(path, data);
    return data;
  }),
  post: (path: string, body?: any, options?: MutationOptions) => request(path, { method: "POST", body: JSON.stringify(body) }).then((data) => {
    recordResourceMutation(path);
    notifySuccess("POST", path, options);
    return data;
  }),
  put: async (path: string, body?: any, options?: MutationOptions) => {
    const hadVersion = hasRememberedVersion(path);
    const data = await request(path, { method: "PUT", body: JSON.stringify(attachVersion(path, body)) });
    recordResourceMutation(path);
    notifySuccess("PUT", path, options);
    if (data && typeof data === "object" && typeof data.updatedAt === "string") {
      rememberVersion(path, data);
    } else if (hadVersion) {
      // بیشتر بک‌اندها در پاسخ PUT فقط { id } برمی‌گردانند و صفحه‌ی ویرایش هم بعد از ذخیره دوباره GET نمی‌زند؛
      // نسخه‌ی به‌خاطر‌سپرده‌شده کهنه می‌ماند و ذخیره‌ی بعدیِ همان فرم به‌اشتباه «توسط کاربر دیگری تغییر کرده»
      // می‌خورد (utils/concurrency.ts). پس نسخه‌ی تازه‌ی همان رکورد را بی‌سروصدا می‌خوانیم؛ اگر ممکن نبود،
      // نسخه‌ی کهنه را رها می‌کنیم (بک‌اند وقتی updatedAt نرسد کنترل را رد می‌کند، نه اینکه خطای کاذب بدهد).
      try {
        rememberVersion(path, await request(path));
      } catch {
        forgetVersion(path);
      }
    }
    return data;
  },
  del: (path: string, options?: MutationOptions) => request(path, { method: "DELETE" }).then((data) => {
    recordResourceMutation(path);
    notifySuccess("DELETE", path, options);
    return data;
  }),
};

/** دانلود یک فایل متنی/باینری محافظت‌شده با توکن (مثلاً public-key.txt / csr.txt) و ذخیره با نام داده‌شده */
export async function downloadFile(path: string, filename: string) {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error || "خطا در دانلود فایل");
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export { getAuthToken as getToken };
