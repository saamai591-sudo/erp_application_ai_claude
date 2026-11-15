/**
 * قالب‌بندی مشترک چاپ فیش حقوق و لیست حقوق (قبلاً در payrollSlipPrint و payrollListPrint کپی شده بود —
 * نسخه‌ی فیش «۶۰ دقیقه» را به ساعت بعد منتقل نمی‌کرد و ممکن بود «01:60» چاپ کند).
 */

export const money = (v: string | number) => Math.round(Number(v)).toLocaleString("en-US");

/** ساعت اعشاری → «hh:mm» (۶۰ دقیقه به ساعت بعد منتقل می‌شود). */
function hhmm(hours: number): string {
  let h = Math.floor(hours + 1e-9);
  let m = Math.round((hours - h) * 60);
  if (m === 60) {
    h += 1;
    m = 0;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** مقدار یک عامل به متن چاپی بر اساس نوع مقدارش (TIME = ساعت:دقیقه، روز/عدد = تا ۲ اعشار، بقیه = مبلغ). */
export function valueText(amount: number, valueType: string | undefined): string {
  if (valueType === "TIME") return hhmm(amount);
  if (valueType === "DAYS" || valueType === "NUMBER") return String(Math.round(amount * 100) / 100);
  return money(amount);
}
