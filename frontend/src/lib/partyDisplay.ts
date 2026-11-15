/**
 * منبع حقیقتِ «عنوان نمایشیِ طرف حساب» در فرانت‌اند. قاعده (هم‌راستا با backend/src/utils/partyTitle.ts):
 * «عنوان تفصیل» (detailTitle) اگر باشد، وگرنه نام حقوقی / «نام و نام خانوادگی».
 * قبلاً partyDisplayName داخل pages/Users.tsx بود و ده‌ها صفحه نسخه‌ی محلی customerTitle/supplierTitle/… داشتند.
 */
export interface PartyNameLike {
  category?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  /** عنوان تفصیل (یکتا)؛ اگر باشد به‌جای نام نمایش داده می‌شود تا اشخاص هم‌نام از هم تفکیک شوند */
  detailTitle?: string | null;
}

export function partyDisplayName(p: PartyNameLike | null | undefined): string {
  if (!p) return "—";
  if (p.detailTitle) return p.detailTitle;
  if (p.category === "LEGAL") return p.name || "";
  const person = `${p.firstName || ""} ${p.lastName || ""}`.trim();
  return person || p.name || "";
}

/** عنوان نمایشیِ نقشِ دارای party (مشتری/تامین‌کننده/…): partyDisplayName(option.party). */
export function partyTitleOf(option: { party: PartyNameLike | null | undefined }): string {
  return partyDisplayName(option.party);
}
