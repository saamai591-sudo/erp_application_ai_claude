/**
 * منبع حقیقتِ «عنوان نمایشیِ طرف حساب» در بک‌اند. قاعده: «عنوان تفصیل» (Party.detailTitle، یکتا و همان چیزی که حسابداری نشان
 * می‌دهد) و اگر در دسترس نبود (کوئری فقط فیلدهای نام را select کرده) نام حقوقی / «نام و نام خانوادگی».
 * قبلاً حدود ۳۰ نسخه‌ی محلی با رفتار کمی متفاوت (بعضی با detailTitle، بیشتر بدون آن) در مسیرها و سرویس‌ها کپی شده بود.
 *
 * عمداً بیرون از این قاعده: چاپ اسناد (printService: نام رسمی مشتری)، صورتحساب مالیاتی (taxInvoiceBuilder: «نام (کد)») و
 * انتخابگر تفصیل (detailSelector).
 */
export interface PartyNameFields {
  category?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  detailTitle?: string | null;
}

export function partyTitle(p: PartyNameFields | null | undefined): string {
  if (!p) return "";
  if (p.detailTitle) return p.detailTitle;
  if (p.category === "LEGAL") return p.name || "";
  const person = `${p.firstName || ""} ${p.lastName || ""}`.trim();
  return person || p.name || "";
}

/** همان partyTitle ولی برای طرف حسابِ نبوده «null» (شکل خروجی APIهایی که null برمی‌گردانند). */
export function partyTitleOrNull(p: PartyNameFields | null | undefined): string | null {
  return p ? partyTitle(p) : null;
}
