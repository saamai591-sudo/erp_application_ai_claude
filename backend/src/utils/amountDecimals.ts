// کنترل مرکزی «تعداد رقم اعشار مبلغ». منبع حقیقت: Currency.decimalPlaces.
// هر مبلغ ارز پایه (بدهکار/بستانکار) باید حداکثر به‌اندازه‌ی اعشار ارز پایه، و هر مبلغ ارزی (بدهکار/بستانکار ارزی)
// حداکثر به‌اندازه‌ی اعشار ارز همان تراکنش رقم اعشار داشته باشد. هم در نقطه‌ی صدور سند (services/journalEntryService.ts)
// و هم در لایه‌ی نوشتن ردیف‌های سند روی کلاینت مشترک Prisma (lib/prisma.ts) استفاده می‌شود تا هیچ مسیری آن را دور نزند.

/** آیا مقدار بیش از places رقم اعشار واقعی دارد؟ (نویز اعشاری ممیز شناور نادیده گرفته می‌شود) */
export function hasExcessDecimals(value: number, places: number): boolean {
  if (!Number.isFinite(value)) return false;
  const factor = 10 ** places;
  const rounded = Math.round(value * factor) / factor;
  const tolerance = Math.max(1e-6, Math.abs(value) * 1e-14);
  return Math.abs(value - rounded) > tolerance;
}

export interface DecimalCurrency {
  code?: string;
  title?: string;
  decimalPlaces: number;
}

/**
 * مبالغ یک ردیف سند را کنترل می‌کند: debit/credit به رقم اعشار ارز ردیف و baseDebit/baseCredit به رقم اعشار ارز پایه.
 * در صورت تخلف، خطای فارسی با برچسب ردیف می‌اندازد.
 */
export function assertLineAmountDecimals(
  line: { debit?: unknown; credit?: unknown; baseDebit?: unknown; baseCredit?: unknown },
  currency: DecimalCurrency,
  baseCurrency: DecimalCurrency,
  rowLabel: string
) {
  const name = (c: DecimalCurrency) => c.title || c.code || "";
  const check = (value: unknown, label: string, c: DecimalCurrency) => {
    if (value === undefined || value === null) return;
    const n = Number(value);
    if (hasExcessDecimals(n, c.decimalPlaces)) {
      throw new Error(`${rowLabel}: ${label} (${n}) بیش از تعداد رقم اعشار ارز «${name(c)}» (${c.decimalPlaces} رقم) است`);
    }
  };
  check(line.debit, "مبلغ بدهکار", currency);
  check(line.credit, "مبلغ بستانکار", currency);
  check(line.baseDebit, "مبلغ بدهکار (ارز پایه)", baseCurrency);
  check(line.baseCredit, "مبلغ بستانکار (ارز پایه)", baseCurrency);
}
