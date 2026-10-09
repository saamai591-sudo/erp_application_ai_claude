import { addDaysIso, ISO_DATE_RE } from "./time";
import { maxGapDays, ScheduleSpec } from "./schedule";
import type { DateWindowValue, ParamDef } from "./types";

// اعتبارسنجی/نرمال‌سازی مقدار پارامترهای یک کار و تبدیل بازه‌های نسبی به تاریخ مشخص (به وقت تهران).

const MAX_DAYS_AGO = 3650;

const isBlank = (v: unknown) => v === null || v === undefined || v === "";

function daysAgo(v: unknown, label: string, errors: string[]): number | null {
  if (isBlank(v)) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > MAX_DAYS_AGO) {
    errors.push(`«${label}»: تعداد روز باید عددی صحیح بین ۰ و ${MAX_DAYS_AGO} باشد`);
    return null;
  }
  return n;
}

export function defaultParamValue(def: ParamDef): any {
  switch (def.type) {
    case "dateWindow":
      return { fromDaysAgo: def.default?.fromDaysAgo ?? null, toDaysAgo: def.default?.toDaysAgo ?? null } satisfies DateWindowValue;
    case "date":
      return def.default ?? null;
    case "number":
      return def.default ?? null;
    case "boolean":
      return def.default ?? false;
    case "select":
      return def.default ?? null;
  }
}

/** مقدارهای ورودی را به شکل استاندارد درمی‌آورد؛ کلیدهای ناشناخته حذف و کلیدهای غایب با پیش‌فرض پر می‌شوند */
export function normalizeParams(defs: ParamDef[], raw: unknown): { values: Record<string, any>; errors: string[] } {
  const src = raw && typeof raw === "object" ? (raw as Record<string, any>) : {};
  const values: Record<string, any> = {};
  const errors: string[] = [];
  for (const def of defs) {
    const has = Object.prototype.hasOwnProperty.call(src, def.key);
    const v = has ? src[def.key] : undefined;
    switch (def.type) {
      case "dateWindow": {
        if (!has) {
          values[def.key] = defaultParamValue(def);
          break;
        }
        const w = v && typeof v === "object" ? v : {};
        const fromDaysAgo = daysAgo(w.fromDaysAgo, `${def.label} — از چند روز قبل`, errors);
        const toDaysAgo = daysAgo(w.toDaysAgo, `${def.label} — تا چند روز قبل`, errors);
        if (fromDaysAgo !== null && toDaysAgo !== null && fromDaysAgo < toDaysAgo) {
          errors.push(`«${def.label}»: «از N روز قبل» نباید از «تا M روز قبل» کمتر باشد (سرِ قدیمی‌تر باید روز بیشتری قبل از امروز باشد)`);
        }
        values[def.key] = { fromDaysAgo, toDaysAgo } satisfies DateWindowValue;
        break;
      }
      case "date": {
        if (!has || isBlank(v)) values[def.key] = has ? null : defaultParamValue(def);
        else if (typeof v === "string" && ISO_DATE_RE.test(v)) values[def.key] = v;
        else {
          errors.push(`«${def.label}»: تاریخ نامعتبر است`);
          values[def.key] = null;
        }
        break;
      }
      case "number": {
        if (!has || isBlank(v)) {
          values[def.key] = has ? null : defaultParamValue(def);
          break;
        }
        const n = Number(v);
        if (!Number.isFinite(n) || (def.integer && !Number.isInteger(n)) || (def.min !== undefined && n < def.min) || (def.max !== undefined && n > def.max)) {
          errors.push(`«${def.label}»: عدد نامعتبر است${def.min !== undefined || def.max !== undefined ? ` (بین ${def.min ?? "−∞"} و ${def.max ?? "+∞"})` : ""}`);
          values[def.key] = null;
        } else values[def.key] = n;
        break;
      }
      case "boolean":
        values[def.key] = has ? !!v : defaultParamValue(def);
        break;
      case "select": {
        if (!has || isBlank(v)) values[def.key] = has ? null : defaultParamValue(def);
        else if (def.options.some((o) => o.value === v)) values[def.key] = v;
        else {
          errors.push(`«${def.label}»: گزینه‌ی نامعتبر`);
          values[def.key] = null;
        }
        break;
      }
    }
  }
  return { values, errors };
}

/** حالت «واقعی» فقط وقتی مجاز است که پارامترهای requiredForLive مقدار داشته باشند */
export function validateForLive(defs: ParamDef[], values: Record<string, any>): string[] {
  const errors: string[] = [];
  for (const def of defs) {
    if (!def.requiredForLive) continue;
    const v = values[def.key];
    const missing = def.type === "dateWindow" ? !v || v.fromDaysAgo === null || v.fromDaysAgo === undefined : v === null || v === undefined || v === "";
    if (missing) {
      errors.push(def.type === "dateWindow" ? `برای حالت «واقعی»، سرِ قدیمی‌ترِ بازه‌ی «${def.label}» (از N روز قبل) باید مشخص باشد` : `برای حالت «واقعی»، «${def.label}» الزامی است`);
    }
  }
  return errors;
}

/** مقدارهای ذخیره‌شده → مقدار واقعی برای اجرا (بازه‌های نسبی به تاریخ مشخصِ امروز-مبنا) */
export function resolveParams(defs: ParamDef[], values: Record<string, any>, today: string): Record<string, any> {
  const out: Record<string, any> = {};
  for (const def of defs) {
    const v = values[def.key];
    if (def.type === "dateWindow") {
      const w: DateWindowValue = v ?? { fromDaysAgo: null, toDaysAgo: null };
      out[def.key] = {
        from: w.fromDaysAgo === null || w.fromDaysAgo === undefined ? null : addDaysIso(today, -w.fromDaysAgo),
        to: w.toDaysAgo === null || w.toDaysAgo === undefined ? null : addDaysIso(today, -w.toDaysAgo),
      };
    } else out[def.key] = v ?? null;
  }
  return out;
}

/** هشدارهای غیرمسدودکننده درباره‌ی ترکیب زمان‌بندی و بازه‌ها — مهم‌ترین: «شکاف» (اسنادی که هیچ‌وقت بررسی نمی‌شوند) */
export function paramWarnings(defs: ParamDef[], values: Record<string, any>, schedule: ScheduleSpec): string[] {
  const warnings: string[] = [];
  const gap = maxGapDays(schedule);
  for (const def of defs) {
    if (def.type !== "dateWindow") continue;
    const w: DateWindowValue | undefined = values[def.key];
    if (!w) continue;
    if (w.fromDaysAgo !== null && w.toDaysAgo !== null) {
      const width = w.fromDaysAgo - w.toDaysAgo + 1;
      if (width < gap) {
        warnings.push(`بازه‌ی «${def.label}» (${width} روز) از بیشترین فاصله‌ی بین اجراها (${gap} روز) کوتاه‌تر است؛ اسناد بین بازه‌ها هیچ‌وقت بررسی نمی‌شوند`);
      }
    } else if (w.fromDaysAgo === null && w.toDaysAgo !== null) {
      warnings.push(`بازه‌ی «${def.label}» سرِ قدیمی ندارد؛ همه‌ی اسناد قدیمی‌تر (حتی دوره‌های مالی گذشته) هم در هر اجرا بررسی می‌شوند`);
    }
  }
  return warnings;
}
