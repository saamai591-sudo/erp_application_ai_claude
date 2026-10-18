import type { NextFunction, Request, Response } from "express";

// جلوگیری از افشای جزئیات داخلی در پاسخ‌های HTTP (یافته‌ی OWASP ZAP: «Application Error Disclosure»).
// پیام‌های کسب‌وکاری (فارسی، عمداً برای کاربر) دست‌نخورده می‌مانند؛ ولی هر متنِ خطایی که شبیه خطای داخلی باشد (Prisma/SQL، مسیر فایل، stack trace،
// کد خطای سیستم‌عامل/شبکه، خطای زمان اجرای JS) هنگام ارسال با پیام کلی عوض می‌شود و متن کامل فقط در لاگ سرور می‌ماند.
// چون صدها catch در routeها `e.message` را برمی‌گردانند، این محافظ در یک نقطه (res.json) همه را پوشش می‌دهد؛ routeهای جدید هم خودکار پوشش داده می‌شوند.

export const GENERIC_ERROR = "خطای سرور، لطفاً دوباره تلاش کنید";

const INTERNAL_PATTERNS: RegExp[] = [
  // Prisma
  /Invalid `?prisma\./i,
  /\bprisma\.[A-Za-z$]+\.[A-Za-z]+\(/,
  /Prisma(Client)?(Known|Unknown|Validation|Initialization|RustPanic)?(Request)?Error/,
  /Unique constraint failed on/i,
  /Foreign key constraint (failed|violated)/i,
  /Raw query failed/i,
  /Can't reach database server/i,
  /Timed out fetching a new connection/i,
  /Transaction API error|Transaction already closed/i,
  /Argument [`"]?\w+[`"]? (is missing|must not be)|Unknown (argument|field|arg)\b/i,
  // PostgreSQL / SQL
  /violates (foreign key|unique|not-null|check) constraint/i,
  /duplicate key value/i,
  /(relation|column|table) "[^"]+" does not exist/i,
  /current transaction is aborted/i,
  /\b(SELECT|INSERT INTO|UPDATE|DELETE FROM)\b[\s\S]{0,300}\b(FROM|VALUES|SET|WHERE)\b/,
  // stack trace / مسیر فایل / سورس
  /\n\s+at\s+\S/,
  /\bat\s+[\w.<>$ ]+\s+\([^)]*:\d+:\d+\)/,
  /[\w./\\-]+\.(?:tsx?|jsx?|jsc|mjs|cjs):\d+/,
  /(?:^|[\s("'`])(?:\/app\/|\/usr\/|\/home\/|\/opt\/|\/var\/|\/etc\/|\/root\/|[A-Za-z]:\\)[^\s)'"`]*/,
  /node_modules/,
  /\b(?:src|dist|prisma)[\\/][\w./\\-]+\.(?:ts|js|jsc|prisma)\b/,
  // خطای سیستم‌عامل/شبکه
  /\b(ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|ENOENT|EACCES|EPIPE|EADDRINUSE|EMFILE)\b/,
  // خطای زمان اجرای JavaScript
  /\b(TypeError|ReferenceError|SyntaxError|RangeError|EvalError|URIError)\b/,
  /Cannot read propert(?:y|ies) of|is not a function|is not defined|is not iterable|Unexpected (token|end of JSON)|in JSON at position/i,
];

/** آیا این متن شبیه یک خطای داخلی (و نه پیام کسب‌وکاری) است؟ */
export function looksInternal(text: string): boolean {
  return INTERNAL_PATTERNS.some((re) => re.test(text));
}

// کلیدهایی که هیچ‌وقت نباید به کلاینت برسند
const DEBUG_KEYS = new Set(["stack", "stackTrace", "sql", "sqlMessage"]);
// کلیدهایی که فهرست نتیجه‌ی هر ردیف/مورد را نگه می‌دارند (ورود از اکسل، محاسبه‌ی دسته‌ای، عملیات گروهی)؛ خطای هر مورد هم بررسی می‌شود
const LIST_KEYS = new Set(["results", "errors", "rows", "items", "failed", "problems", "details", "warnings"]);
const MESSAGE_KEYS = ["error", "message"] as const;

function isPlain(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}

interface Hit {
  field: string;
  original: string;
}

/** شیء را در صورت نیاز (کپیِ سطحی) اصلاح می‌کند؛ بدون تطبیق، همان مرجع را برمی‌گرداند تا پاسخ‌های عادی هیچ تغییری نکنند */
function scrub(value: unknown, depth: number, hits: Hit[], budget: { n: number }): unknown {
  if (budget.n-- <= 0) return value;
  if (Array.isArray(value)) {
    if (depth <= 0) return value;
    let out: unknown[] | null = null;
    value.forEach((el, i) => {
      const next = isPlain(el) ? scrub(el, depth - 1, hits, budget) : el;
      if (next !== el) {
        out ??= value.slice();
        out[i] = next;
      }
    });
    return out ?? value;
  }
  if (!isPlain(value)) return value;
  let out: Record<string, unknown> | null = null;
  const set = (k: string, v: unknown) => {
    out ??= { ...value };
    if (v === undefined) delete out[k];
    else out[k] = v;
  };
  for (const k of DEBUG_KEYS) if (k in value) set(k, undefined);
  for (const k of MESSAGE_KEYS) {
    const v = value[k];
    if (typeof v === "string" && looksInternal(v)) {
      hits.push({ field: k, original: v });
      set(k, GENERIC_ERROR);
    }
  }
  if (depth > 0) {
    for (const k of Object.keys(value)) {
      if (!LIST_KEYS.has(k)) continue;
      const v = value[k];
      if (Array.isArray(v) || isPlain(v)) {
        const next = scrub(v, depth - 1, hits, budget);
        if (next !== v) set(k, next);
      }
    }
  }
  return out ?? value;
}

/** پاسخ‌های JSON را پیش از ارسال بررسی می‌کند (در index.ts پیش از routeها نصب می‌شود) */
export function errorDisclosureGuard(req: Request, res: Response, next: NextFunction) {
  const original = res.json.bind(res);
  res.json = ((body?: unknown) => {
    try {
      const hits: Hit[] = [];
      const safe = scrub(body, 3, hits, { n: 5000 });
      if (hits.length > 0) {
        for (const h of hits) console.error(`[error-disclosure] ${req.method} ${req.originalUrl.split("?")[0]} → ${res.statusCode}: متن داخلی «${h.field}» با پیام کلی عوض شد:`, h.original);
        return original(safe);
      }
      return original(safe);
    } catch (e) {
      console.error("[error-disclosure] خطا در بررسی پاسخ:", e);
      return original(body);
    }
  }) as typeof res.json;
  next();
}
