// عنوان تب مرورگر = نام شرکت «مشخصات شرکت» (GET /api/branding، بدون نیاز به ورود تا صفحه‌ی ورود هم همان را نشان بدهد).
// آیکن تب ثابت و بسته‌ی آیکن خود برنامه است (public/favicon.ico و …، لینک در index.html)، نه لوگوی شرکت.
// اگر نام شرکت تنظیم نشده باشد عنوان پیش‌فرض می‌ماند.

import { API_URL } from "./apiUrl";

const DEFAULT_TITLE = "نرم‌افزار حسابداری";

/** نام شرکت را از سرور می‌گیرد و عنوان تب را می‌گذارد؛ هر خطایی بی‌صدا نادیده گرفته می‌شود */
export async function refreshBranding(): Promise<void> {
  try {
    const r = await fetch(`${API_URL}/branding`, { cache: "no-store" });
    if (!r.ok) return;
    const b: { name?: string } = await r.json();
    document.title = b.name?.trim() || DEFAULT_TITLE;
  } catch {
    // اتصال برقرار نیست؛ عنوان پیش‌فرض می‌ماند
  }
}
