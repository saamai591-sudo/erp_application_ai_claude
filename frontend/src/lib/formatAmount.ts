const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toFaDigits(value: string): string {
  return value.replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/** عدد (رشته یا عدد) را با جداکننده سه‌رقمی و ارقام فارسی برای نمایش در فهرست‌ها قالب‌بندی می‌کند */
export function formatAmountFa(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const [intPart, decPart] = String(value).split(".");
  const withSeparators = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const formatted = decPart !== undefined ? `${withSeparators}.${decPart}` : withSeparators;
  return toFaDigits(formatted);
}
