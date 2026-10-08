// قالب «سیمی» (wire) صورتحساب برای API نسخه‌ی قبلی سامانه مودیان (self-tsp) و تولید متن امضا.
//
// منبع پروتکل: کد SDK رسمی سازمان (TaxCollectData.Library، ClientType.SELF_TSP) که سیستم سام هم با آن کار می‌کند. این‌جا از روی «رفتار» پروتکل بازنویسی شده (نه کپی کد).
// نکته‌ی کلیدی: امضا روی «متن نرمال‌شده» است — همه‌ی فیلدهای DTO (حتی null) به‌ترتیب کلید مرتب، فقط مقدارها با «#» به هم چسبیده؛ پس مجموعه‌ی کلیدها مهم است و ما
// عیناً همه‌ی فیلدهای DTO صورتحساب را (با null) می‌فرستیم.

import { Prisma } from "@prisma/client";

export const WIRE_HEADER_KEYS = [
  "taxid", "indatim", "indati2m", "inty", "inno", "irtaxid", "inp", "ins", "tins", "tob", "bid", "tinb", "sbc", "bpc", "bbc", "ft", "bpn", "scln", "scc", "crn", "billid",
  "tprdis", "tdis", "tadis", "tvam", "todam", "tbill", "setm", "cap", "insp", "tvop", "tax17", "cdcn", "cdcd", "tonw", "torv", "tocv",
] as const;
export const WIRE_BODY_KEYS = [
  "sstid", "sstt", "mu", "am", "fee", "cfee", "cut", "exr", "prdis", "dis", "adis", "vra", "vam", "odt", "odr", "odam", "olt", "olr", "olam", "consfee", "spro", "bros", "tcpbs",
  "cop", "vop", "bsrn", "tsstam", "nw", "ssrv", "sscv",
] as const;
export const WIRE_PAYMENT_KEYS = ["iinn", "acn", "trmn", "trn", "pcn", "pid", "pdt", "pmt", "pv"] as const;

export interface WireInvoice {
  header: Record<string, any>;
  body: Record<string, any>[];
  payments: Record<string, any>[] | null;
  extension: Record<string, any>[] | null;
}

function fill(keys: readonly string[], src: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of keys) out[k] = src[k] ?? null;
  // فیلدهای خارج از DTO قدیمی (مثلاً insr در نسخه‌ی ۷٫۹) فقط وقتی مقدار دارند اضافه می‌شوند
  for (const k of Object.keys(src)) if (!(k in out) && src[k] !== null && src[k] !== undefined) out[k] = src[k];
  return out;
}

/** خروجی ساخت JSON (services/taxInvoiceBuilder.ts) ← DTO کامل SDK؛ payments/extension خالی مثل SDK «null» می‌شوند */
export function toWireInvoice(payload: { header: Record<string, any>; body: Record<string, any>[]; payments?: Record<string, any>[] }): WireInvoice {
  const payments = (payload.payments ?? []).map((p) => fill(WIRE_PAYMENT_KEYS, p));
  return {
    header: fill(WIRE_HEADER_KEYS, payload.header),
    body: payload.body.map((b) => fill(WIRE_BODY_KEYS, b)),
    payments: payments.length ? payments : null,
    extension: null,
  };
}

/** متن عددی بدون نمای علمی (e-notation) */
function numberText(n: number): string {
  if (!Number.isFinite(n)) throw new Error("مقدار عددی نامعتبر");
  return new Prisma.Decimal(n).toFixed();
}

/** JSON با اعداد به‌صورت literal ساده (JSON.stringify برای ۱e-8 نمای علمی می‌نویسد) — همان متنی که در امضا هم می‌آید */
export function stringifyWire(value: any): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return numberText(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stringifyWire).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.entries(value)
      .map(([k, v]) => `${JSON.stringify(k)}:${stringifyWire(v)}`)
      .join(",")}}`;
  }
  throw new Error("نوع داده‌ی نامعتبر برای JSON");
}

function scalarText(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return numberText(v);
  return String(v);
}

function flatten(prefix: string, input: any, out: Map<string, string>) {
  if (Array.isArray(input)) {
    input.forEach((e, i) => flatten(prefix ? `${prefix}.E${i}` : `E${i}`, e, out));
    return;
  }
  if (input !== null && typeof input === "object") {
    for (const [k, v] of Object.entries(input)) flatten(prefix ? `${prefix}.${k}` : k, v, out);
    return;
  }
  out.set(prefix, scalarText(input));
}

/** ترتیب کلیدها: بدون توجه به بزرگی/کوچکی حروف (معادل مرتب‌سازی SDK با فرهنگ) */
function compareKeys(a: string, b: string): number {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la < lb) return -1;
  if (la > lb) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * متن نرمال‌شده برای امضا: ساختار به کلیدهای «a.b.E0.c» مسطح می‌شود (لیست‌ها با E<index>)، کلیدها مرتب می‌شوند، فقط مقدارها می‌آیند؛
 * مقدار خالی/null ← «#»، هر «#» داخل مقدار ← «##»، و مقدارها با «#» به هم وصل می‌شوند.
 * @param headers هدرهای امضاشونده (Authorization بدون پیشوند Bearer، requestTraceId، timestamp) که به کلیدها اضافه می‌شوند
 */
export function normalizeForSignature(data: any, headers: Record<string, string> = {}): string {
  const out = new Map<string, string>();
  if (data !== null && data !== undefined) flatten("", data, out);
  for (const [k, v] of Object.entries(headers)) out.set(k, v);
  const keys = [...out.keys()].sort(compareKeys);
  return keys
    .map((k) => {
      const v = out.get(k) ?? "";
      return v === "" ? "#" : v.replace(/#/g, "##");
    })
    .join("#");
}
