import { roundToCurrencyDecimals } from "./currencyConversion";

// =========================================================================
// تخفیف فاکتور خرید (کالا، «سایر هزینه‌ها» و فاکتور خرید خدمات): مبنای ثبت حسابداری و بهای رسید انبار همیشه
// «مبلغ − تخفیف» است (نه مبلغ ناخالص) — پرداختنی خرید، بدهکار موجودی/کنترل خرید/هزینه‌ی خدمت، و Cost رسید انبار.
// ارزش‌افزوده از قبل بر مبنای (مبلغ − تخفیف) محاسبه می‌شد و تغییری نکرده است.
// =========================================================================

/** مبلغ خالص یک ردیف = مبلغ − تخفیف */
export function netOf(amount: number, discount: number): number {
  return amount - discount;
}

/**
 * تسهیم ردیف «سایر هزینه‌ها»/خدمات مبنا-رسید-انبار: مجموع تسهیم‌ها همچنان باید برابر مبلغ ناخالص ردیف باشد (قاعده‌ی موجود)،
 * ولی آنچه به بهای رسید اضافه می‌شود سهم **خالص** است: allocated × (مبلغ − تخفیف) / مبلغ، و باقیمانده‌ی گرد کردن روی آخرین
 * تسهیم می‌نشیند تا مجموع دقیقاً برابر (مبلغ − تخفیف) شود. بدون تخفیف، مقادیر عیناً همان تسهیم‌های ورودی‌اند (رفتار قبلی).
 * خروجی: نگاشت شناسه‌ی تسهیم → مبلغ خالص (به ارز فاکتور).
 */
export function netAllocationAmounts(
  allocations: { id: number; allocatedAmount: unknown }[],
  amount: number,
  discount: number,
  decimalPlaces: number
): Map<number, number> {
  const result = new Map<number, number>();
  if (!(discount > 0) || !(amount > 0)) {
    for (const a of allocations) result.set(a.id, Number(a.allocatedAmount));
    return result;
  }
  const net = amount - discount;
  let assigned = 0;
  allocations.forEach((a, idx) => {
    const isLast = idx === allocations.length - 1;
    const v = isLast ? roundToCurrencyDecimals(net - assigned, decimalPlaces) : roundToCurrencyDecimals((Number(a.allocatedAmount) * net) / amount, decimalPlaces);
    assigned += v;
    result.set(a.id, v);
  });
  return result;
}
