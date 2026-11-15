/**
 * کمکی‌های مشترک ردیف‌های فرم‌های سند (قبلاً در چند صفحه کپی شده بود).
 */

/**
 * مبلغ ردیف = مقدار × فیِ واحد، گردشده به تعداد رقم اعشار ارز پایه. فقط نمایش لحظه‌ای است؛ مقدار نهایی را بک‌اند حساب می‌کند
 * (`computeAmount` در routes/initialInventory.ts و همتاهایش). برای رسید تولید، اضافات انبارگردانی و موجودی اول دوره.
 */
export function recomputeAmount<R extends { quantity: string; unitCost: string; amount: string }>(row: R, baseDecimalPlaces: number): R {
  const qty = Number(row.quantity) || 0;
  const cost = Number(row.unitCost) || 0;
  if (!qty) return { ...row, amount: "" };
  const factor = Math.pow(10, baseDecimalPlaces);
  const amount = Math.round(qty * cost * factor) / factor;
  return { ...row, amount: amount ? String(amount) : "" };
}

/** مولد کلید یکتای کلاینتیِ ردیف‌های تازه (قبل از ذخیره) با پیشوند مشخص. */
export function createClientKeyGenerator(prefix = "new"): () => string {
  let seq = 0;
  return () => {
    seq += 1;
    return `${prefix}-${Date.now()}-${seq}`;
  };
}

/** وضعیت نمایشیِ دریافت/پرداخت: ثبت ← تایید حسابداری ← سند صادرشد (ثبت = اثر بعد از ذخیره؛ تایید حسابداری = مرحله‌ی حسابداری). */
export function treasuryDocStatusLabel(status: string, accountingStatus?: string, hasJournalEntry?: boolean): string {
  if (hasJournalEntry) return "سند صادر شده";
  if (accountingStatus === "APPROVED") return "تایید حسابداری";
  return status === "DRAFT" ? "ثبت (اثرگذاری با ذخیره‌ی بعدی)" : "ثبت";
}
