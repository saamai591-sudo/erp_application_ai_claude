// ورودی «ساعت:دقیقه» با ماسک: کاربر فقط رقم می‌زند و «:» خودکار می‌آید (hh:mm؛ برای ساعت‌های تجمعی hhh:mm).
// ارقام از راست پر می‌شوند (مثل ماشین‌حساب): ۲ رقم آخر دقیقه و بقیه ساعت است؛ پس «۰۷۲۰» و «۷۲۰» هر دو «07:20» می‌شوند و Backspace آخرین رقم را برمی‌دارد.
// مقدار متنیِ ماسک‌شده برمی‌گردد («» وقتی رقمی نیست)؛ معتبر بودن دقیقه (≤۵۹) و سقف ساعت را مصرف‌کننده بررسی می‌کند.

const toLatin = (s: string) => s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

/** رقم‌ها → «HH:MM» (ساعت حداقل دو رقم)؛ بدون رقم = «» */
export function maskHm(digits: string): string {
  if (!digits) return "";
  const p = digits.padStart(3, "0");
  return `${p.slice(0, -2).padStart(2, "0")}:${p.slice(-2)}`;
}

/** دقیقه → متن ماسک‌شده («HH:MM») */
export function minutesToMask(min: number): string {
  return maskHm(String(Math.floor(min / 60) * 100 + (min % 60)));
}

/** متن ماسک‌شده → دقیقه (null = ناقص/نامعتبر) */
export function maskToMinutes(text: string): number | null {
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(toLatin(text).trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function TimeInput({
  value,
  onChange,
  maxHourDigits = 2,
  disabled,
  width = 90,
  placeholder = "00:00",
  onBlur,
  autoFocus,
}: {
  value: string;
  onChange: (text: string) => void;
  /** حداکثر تعداد رقم ساعت (۲ = تا ۹۹:۵۹ برای ساعت روزانه، ۳ = تا ۹۹۹:۵۹ برای ساعت‌های تجمعی) */
  maxHourDigits?: number;
  disabled?: boolean;
  width?: number;
  placeholder?: string;
  onBlur?: () => void;
  autoFocus?: boolean;
}) {
  return (
    <input
      dir="ltr"
      inputMode="numeric"
      disabled={disabled}
      autoFocus={autoFocus}
      placeholder={placeholder}
      value={value}
      style={{ width, textAlign: "center" }}
      onBlur={onBlur}
      onChange={(e) => {
        // رقم‌های متن جدید؛ صفرهای پیشِ ساعت (که فقط برای نمایش بودند) حذف می‌شوند تا سقف رقم‌ها اشتباه محاسبه نشود
        const digits = toLatin(e.target.value).replace(/\D/g, "").replace(/^0+/, "");
        if (digits.length > maxHourDigits + 2) return; // پر است؛ رقم اضافه نادیده گرفته می‌شود
        onChange(maskHm(digits));
      }}
    />
  );
}
