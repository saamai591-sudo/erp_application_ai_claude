// اگر VITE_API_URL صراحتاً تنظیم نشده باشد، آدرس بک‌اند از روی همان host ای که فرانت‌اند رویش باز شده
// محاسبه می‌شود (نه localhost ثابت) — چون این مقدار در زمان build/dev یک‌بار برای همه‌ی کلاینت‌ها ساخته
// می‌شود؛ اگر ثابت روی localhost باشد، کاربرهایی که از یک PC دیگر در شبکه به آدرس IP سرور وصل می‌شوند
// درخواستشان به localhost خودشان (نه سرور) می‌رود و با ERR_CONNECTION_REFUSED مواجه می‌شوند.
import { recordResourceFetch, recordResourceMutation } from "./listInvalidation";
import { rememberVersion, attachVersion } from "./concurrencyToken";
import { getSavedFiscalPeriodId } from "./userSettings";
import { getAuthToken } from "./authToken";

const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:4000/api`;

export class ApiError extends Error {
  warning?: boolean;
  constructor(message: string, warning?: boolean) {
    super(message);
    this.warning = warning;
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
    throw new ApiError(data.error || "خطای ناشناخته رخ داد", data.warning);
  }
  return data;
}

export const api = {
  get: (path: string) => request(path).then((data) => {
    recordResourceFetch(path);
    rememberVersion(path, data);
    return data;
  }),
  post: (path: string, body?: any) => request(path, { method: "POST", body: JSON.stringify(body) }).then((data) => {
    recordResourceMutation(path);
    return data;
  }),
  put: (path: string, body?: any) => request(path, { method: "PUT", body: JSON.stringify(attachVersion(path, body)) }).then((data) => {
    recordResourceMutation(path);
    rememberVersion(path, data);
    return data;
  }),
  del: (path: string) => request(path, { method: "DELETE" }).then((data) => {
    recordResourceMutation(path);
    return data;
  }),
};

export { getAuthToken as getToken };
