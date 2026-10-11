import crypto from "crypto";
import { Router } from "express";
import { allowRate, isPreviewAgent, openSharedDocument, renderInvalidSharePage } from "../services/printShareService";

// نمایش عمومی سند اشتراکی (بدون ورود): GET /api/share/:token → صفحه‌ی HTML. فقط همان یک عکس‌فوری را می‌دهد و به بقیه‌ی سیستم دسترسی ندارد.
// در index.ts بعد از دروازه‌ی لایسنس و قبل از requireAuth ثبت می‌شود.

const router = Router();

/** آدرس کلاینت: پشت nginx آخرین مقدار X-Forwarded-For همان است که nginx افزوده (مقدارهای قبلی را کلاینت می‌تواند جعل کند) */
function clientIp(req: any): string {
  const xff = String(req.headers["x-forwarded-for"] ?? "");
  const last = xff.split(",").pop()?.trim();
  return last || req.socket?.remoteAddress || "unknown";
}

function secureHeaders(res: any) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
}

router.get("/:token", async (req, res) => {
  secureHeaders(res);
  const ip = clientIp(req);
  if (!allowRate(`share:${ip}`, 60, 60_000)) {
    return res.status(429).send(renderInvalidSharePage());
  }
  const nonce = crypto.randomBytes(16).toString("base64");
  try {
    const r = await openSharedDocument(String(req.params.token), { countView: !isPreviewAgent(req.headers["user-agent"]), nonce });
    if (!r.ok) {
      // حدس‌زدن لینک: تلاش‌های نامعتبر پشت‌سرهم محدود می‌شود
      if (!allowRate(`share-bad:${ip}`, 20, 10 * 60_000)) return res.status(429).send(renderInvalidSharePage());
      return res.status(404).send(renderInvalidSharePage());
    }
    // CSP هدر هم‌خوان با meta داخل سند (اشتراک آن‌ها: فقط اسکریپتِ nonce‌دار)
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
    );
    return res.status(200).send(r.html);
  } catch (e) {
    console.error("[share] view failed:", e);
    return res.status(500).send(renderInvalidSharePage());
  }
});

export default router;
