import { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { getEntitlements, isFeatureEnabled } from "./licenseService";

// وقتی قابلیت FX (زیرسیستم ارزی) در لایسنس نیست، هر سندِ «جدید» باید به ارز پایه باشد. فرانت‌اند فیلدهای ارز را پنهان می‌کند،
// ولی «سرور منبع حقیقت است»: این میان‌افزار بدنه‌ی POST (ثبت جدید) را پیش از رسیدن به route ها نرمال می‌کند —
// هر currencyId ← ارز پایه و هر fxRate ← ۱ — تا هیچ مسیری (از جمله درخواست مستقیم API) سند ارزی نسازد و اعتبارسنجی‌ها/محاسبه‌ی
// مبالغ پایه با همان ارز پایه انجام شود. فرم ارز و نرخ ارز و رویه‌ها و تنظیمات حسابداری معاف‌اند (فرم‌ها هم با FEATURE_NOT_LICENSED بسته‌اند).
// ویرایش (PUT) عمداً دست‌نخورده است: سند ارزیِ قبلی (از زمانی که FX فعال بود) با همان ارزِ خودش قابل ویرایش می‌ماند — فرم فیلد ارز را پنهان
// می‌کند ولی مقدار ذخیره‌شده را دوباره می‌فرستد.
const EXEMPT_PREFIXES = ["/currencies", "/accounting-settings"];

let baseCache: { at: number; id: number | null } = { at: 0, id: null };
async function getBaseCurrencyId(): Promise<number | null> {
  if (Date.now() - baseCache.at > 30_000) {
    const base = await prisma.currency.findFirst({ where: { isBase: true }, select: { id: true } });
    baseCache = { at: Date.now(), id: base?.id ?? null };
  }
  return baseCache.id;
}

function normalize(node: any, baseId: number, depth = 0): void {
  if (!node || typeof node !== "object" || depth > 8) return;
  if (Array.isArray(node)) {
    for (const item of node) normalize(item, baseId, depth + 1);
    return;
  }
  for (const key of Object.keys(node)) {
    const v = node[key];
    if (key === "currencyId" && v !== null && v !== undefined && v !== "") {
      node[key] = typeof v === "string" ? String(baseId) : baseId;
    } else if (key === "fxRate" && v !== null && v !== undefined && v !== "") {
      node[key] = typeof v === "string" ? "1" : 1;
    } else if (v && typeof v === "object") {
      normalize(v, baseId, depth + 1);
    }
  }
}

export async function fxOffBodyNormalizer(req: Request, _res: Response, next: NextFunction) {
  try {
    if (req.method !== "POST" || !req.body || typeof req.body !== "object") return next();
    if (EXEMPT_PREFIXES.some((p) => req.path === p || req.path.startsWith(p + "/"))) return next();
    const ent = await getEntitlements();
    if (!ent.enforced || isFeatureEnabled(ent, "FX")) return next();
    const baseId = await getBaseCurrencyId();
    if (baseId) normalize(req.body, baseId);
  } catch (e) {
    console.error("[license] نرمال‌سازی ارز پایه ناموفق بود", e);
  }
  next();
}
