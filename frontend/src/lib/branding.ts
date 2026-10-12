// عنوان تب مرورگر = نام شرکت «مشخصات شرکت» (GET /api/branding، بدون نیاز به ورود تا صفحه‌ی ورود هم همان را نشان بدهد).
// آیکن تب ثابت و بسته‌ی آیکن خود برنامه است (public/favicon.ico و …، لینک در index.html)، نه لوگوی شرکت.
// صفحه‌ی ورود از همین‌جا نام و لوگوی شرکت را می‌گیرد (fetchBranding).

import { API_URL } from "./apiUrl";

export const DEFAULT_TITLE = "سامانه مدیریت منابع سازمانی";

export interface Branding {
  name: string;
  /** آدرس لوگوی شرکت؛ null = لوگو تنظیم نشده */
  logoUrl: string | null;
}

/** نام و لوگوی شرکت را از سرور می‌گیرد؛ هر خطایی = مقدار خالی */
export async function fetchBranding(): Promise<Branding> {
  try {
    const r = await fetch(`${API_URL}/branding`, { cache: "no-store" });
    if (!r.ok) return { name: "", logoUrl: null };
    const b: { name?: string; logoVersion?: number | null } = await r.json();
    return { name: b.name?.trim() ?? "", logoUrl: b.logoVersion ? `${API_URL}/branding/logo?v=${b.logoVersion}` : null };
  } catch {
    return { name: "", logoUrl: null };
  }
}

/** عنوان تب را با نام شرکت هماهنگ می‌کند (نام تنظیم‌نشده = عنوان پیش‌فرض) */
export async function refreshBranding(): Promise<void> {
  const b = await fetchBranding();
  document.title = b.name || DEFAULT_TITLE;
}
