// ورودی «ساعت:دقیقه» با ماسک: کاربر از چپ می‌نویسد و «:» خودکار می‌آید.
//  • ساعت روزانه (۲ رقم ساعت): «۰۷» ← «07:» و ادامه‌ی «۲۰» ← «07:20».
//  • ساعت‌های تجمعی (تا ۳ رقم ساعت: hhh:mm): بعد از رقم سوم ساعت «:» خودکار می‌آید («۲۲۷» ← «227:»)؛ برای ساعت کمتر از ۱۰۰ کاربر «:» را می‌زند («۸۰:» ← ادامه‌ی دقیقه).
//  • رقم اول دقیقه بزرگ‌تر از ۵ صفر پیش می‌گیرد («07:7» ← «07:07»)؛ با خروج از فیلد مقدار کامل می‌شود («7» ← «07:00»).
// مقدار متنیِ ماسک‌شده برمی‌گردد («» وقتی چیزی نیست)؛ کامل بودن/معتبر بودن را مصرف‌کننده با maskToMinutes می‌سنجد.

const toLatin = (s: string) => s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

/** دقیقه → متن «HH:MM» (ساعت حداقل دو رقم) */
export function minutesToMask(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** رقم‌ها → «HH:MM» برای مقدار اولیه‌ی ساعت و دقیقه‌ی جداگانه (مثل ورود اطلاعات) */
export function maskHm(digits: string): string {
  if (!digits) return "";
  const p = digits.padStart(3, "0");
  return `${p.slice(0, -2).padStart(2, "0")}:${p.slice(-2)}`;
}

/** متن ماسک‌شده → دقیقه (null = ناقص/نامعتبر) */
export function maskToMinutes(text: string): number | null {
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(toLatin(text).trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** متنِ در حال تایپ → متن ماسک‌شده؛ deleting=true یعنی کاربر حذف می‌کند (دو رقمِ ساعت بدون «:» اجباری می‌ماند تا Backspace گیر نکند) */
function applyMask(raw: string, maxHourDigits: number, deleting: boolean): string {
  const t = toLatin(raw).replace(/[^0-9:]/g, "");
  if (!t) return "";
  const colon = t.indexOf(":");
  let hours: string;
  let minutes: string | null = null;
  if (colon >= 0) {
    hours = stripLeadingZeros(t.slice(0, colon).replace(/\D/g, "").slice(0, maxHourDigits));
    minutes = t.slice(colon + 1).replace(/\D/g, "").slice(0, 2);
  } else {
    const d = t.replace(/\D/g, "");
    // ساعتِ سه‌رقمی صفرِ پیشین ندارد: رقم اولِ صفر یعنی ساعت دو‌رقمی («0830» ← «08:30»، «0000» ← «00:00»)
    if (maxHourDigits > 2 && d.startsWith("0")) {
      if (d.length < 2 || (d.length === 2 && deleting)) return d;
      return finishMinutes(d.slice(0, 2), d.slice(2, 4));
    }
    // «:» خودکار: بعد از رقم آخرِ ساعت (فقط هنگام تایپ، نه حذف)
    if (d.length < maxHourDigits || (d.length === maxHourDigits && deleting)) return d;
    hours = d.slice(0, maxHourDigits);
    minutes = d.slice(maxHourDigits, maxHourDigits + 2);
  }
  return finishMinutes(hours, minutes);
}

/** صفرهای پیشینِ بیش از دو رقم حذف می‌شود («000» ← «00»، «007» ← «07») */
function stripLeadingZeros(h: string): string {
  return h.replace(/^0+(?=\d{2})/, "");
}

function finishMinutes(hours: string, minutesIn: string | null): string {
  let minutes = minutesIn;
  // رقم اول دقیقه بزرگ‌تر از ۵ ← صفر پیش می‌گیرد
  if (minutes && minutes.length === 1 && Number(minutes) > 5) minutes = `0${minutes}`;
  if (minutes && minutes.length === 2 && Number(minutes[0]) > 5) minutes = `0${minutes[0]}`;
  return `${hours}:${minutes ?? ""}`;
}

/** با خروج از فیلد: ساعت دو رقمی و دقیقه‌ی دو رقمی («7» ← «07:00»، «07:2» ← «07:02»)؛ متنِ بی‌رقم خالی می‌شود */
function normalize(text: string, maxHourDigits: number): string {
  const t = toLatin(text);
  const colon = t.indexOf(":");
  const hoursRaw = stripLeadingZeros((colon >= 0 ? t.slice(0, colon) : t).replace(/\D/g, "").slice(0, maxHourDigits));
  const minutesRaw = colon >= 0 ? t.slice(colon + 1).replace(/\D/g, "").slice(0, 2) : "";
  if (!hoursRaw && !minutesRaw) return "";
  const minutes = minutesRaw.length === 1 ? `0${minutesRaw}` : minutesRaw.padEnd(2, "0");
  return `${hoursRaw.padStart(2, "0")}:${minutes}`;
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
  /** حداکثر تعداد رقم ساعت (۲ = ساعت روزانه تا ۹۹:۵۹، ۳ = ساعت‌های تجمعی تا ۹۹۹:۵۹) */
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
      onChange={(e) => onChange(applyMask(e.target.value, maxHourDigits, e.target.value.length < value.length))}
      onBlur={() => {
        const n = normalize(value, maxHourDigits);
        if (n !== value) onChange(n);
        onBlur?.();
      }}
    />
  );
}
