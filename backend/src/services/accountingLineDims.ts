// منطق مشترکِ همگام‌سازی تفصیل‌های «ردیف‌های حسابداری» دریافت و پرداخت (syncReceiptAccountingLines / syncPaymentAccountingLines).
//
// هر سطح تفصیل (۱ تا ۳) یک منبع دارد: «خودکار» (سیستم از تفصیل پایه‌ی ابزار/موضوع پر کرده: صندوق، حساب بانکی، طرف حساب،
// تنخواه‌دار — قفل است) یا «دستی» (خالی یا واردشده توسط حسابدار).

type DimsLike = { detail1Code?: string | null; detail2Code?: string | null; detail3Code?: string | null };
type StoredDims = DimsLike & { detail1Source: string; detail2Source: string; detail3Source: string };

/**
 * وقتی معین ردیف همان قبلی است: فقط سطح‌های «خودکار» با مقدار فعلیِ ابزار/موضوع هم‌گام می‌شوند (مالک آن‌ها سیستم است؛
 * مثلاً با عوض‌شدن حساب بانکی یا طرف حساب، تفصیل قبلی نمی‌ماند). سطح‌های «دستی» هرگز تغییر نمی‌کنند.
 * اگر سطح خودکار الان مقدار نداشته باشد، خالی و «دستی» می‌شود (همان قاعده‌ی ساخت: کد خالی = دستی).
 * خروجی: فقط فیلدهای تغییرکرده برای update (خالی = تغییری لازم نیست).
 */
export function autoSlotRefreshPatch(cur: StoredDims, auto: DimsLike): Record<string, string | null> {
  const patch: Record<string, string | null> = {};
  for (const n of [1, 2, 3] as const) {
    if ((cur as any)[`detail${n}Source`] !== "AUTO") continue;
    const stored = ((cur as any)[`detail${n}Code`] as string | null | undefined) ?? null;
    const next = ((auto as any)[`detail${n}Code`] as string | null | undefined) ?? null;
    if (stored === next) continue;
    patch[`detail${n}Code`] = next;
    patch[`detail${n}Source`] = next ? "AUTO" : "MANUAL";
  }
  return patch;
}
