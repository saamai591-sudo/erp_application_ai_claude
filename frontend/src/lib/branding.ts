import { API_URL } from "./apiUrl";

// عنوان و آیکن تب مرورگر = نام شرکت و لوگوی «مشخصات شرکت» (GET /api/branding، بدون نیاز به ورود تا صفحه‌ی ورود هم همان را نشان بدهد).
// اگر نام شرکت تنظیم نشده باشد عنوان پیش‌فرض و اگر لوگو نباشد آیکن پیش‌فرض مرورگر می‌ماند.

const DEFAULT_TITLE = "نرم‌افزار حسابداری";
const ICON_ATTR = "data-company-icon";

function setFavicon(href: string | null) {
  const head = document.head;
  let link = head.querySelector<HTMLLinkElement>(`link[${ICON_ATTR}]`);
  if (!href) {
    link?.remove();
    return;
  }
  if (!link) {
    // آیکن‌های قبلی صفحه کنار گذاشته می‌شوند تا مرورگر فقط لوگوی شرکت را بردارد
    head.querySelectorAll('link[rel~="icon"]').forEach((l) => l.remove());
    link = document.createElement("link");
    link.rel = "icon";
    link.setAttribute(ICON_ATTR, "1");
    head.appendChild(link);
  }
  link.href = href;
}

/** نام شرکت و لوگو را از سرور می‌گیرد و روی عنوان/آیکن تب می‌نشاند؛ هر خطایی بی‌صدا نادیده گرفته می‌شود */
export async function refreshBranding(): Promise<void> {
  try {
    const r = await fetch(`${API_URL}/branding`, { cache: "no-store" });
    if (!r.ok) return;
    const b: { name?: string; logoVersion?: number | null } = await r.json();
    document.title = b.name?.trim() || DEFAULT_TITLE;
    setFavicon(b.logoVersion ? `${API_URL}/branding/logo?v=${b.logoVersion}` : null);
  } catch {
    // اتصال برقرار نیست؛ عنوان/آیکن پیش‌فرض می‌ماند
  }
}
