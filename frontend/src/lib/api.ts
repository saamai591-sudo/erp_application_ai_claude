// اگر VITE_API_URL صراحتاً تنظیم نشده باشد، آدرس بک‌اند از روی همان host ای که فرانت‌اند رویش باز شده
// محاسبه می‌شود (نه localhost ثابت) — چون این مقدار در زمان build/dev یک‌بار برای همه‌ی کلاینت‌ها ساخته
// می‌شود؛ اگر ثابت روی localhost باشد، کاربرهایی که از یک PC دیگر در شبکه به آدرس IP سرور وصل می‌شوند
// درخواستشان به localhost خودشان (نه سرور) می‌رود و با ERR_CONNECTION_REFUSED مواجه می‌شوند.
const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:4000/api`;

export class ApiError extends Error {
  warning?: boolean;
  constructor(message: string, warning?: boolean) {
    super(message);
    this.warning = warning;
  }
}

function getToken() {
  return localStorage.getItem("token");
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  get: (path: string) => request(path),
  post: (path: string, body?: any) => request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path: string, body?: any) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  del: (path: string) => request(path, { method: "DELETE" }),
};

export { getToken };
