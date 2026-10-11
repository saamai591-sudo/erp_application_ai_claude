import crypto from "crypto";
import zlib from "zlib";
import { prisma } from "../lib/prisma";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { hydrateSharedHtml, PRINT_CSP_META, renderSavedTemplate } from "./printService";

// لینک اشتراک‌گذاری سند چاپی با مشتری: کاربر از دکمه‌ی «چاپ» لینکی می‌سازد که مشتری بدون ورود و تا تاریخ انقضا می‌تواند سند را ببیند.
// • توکن ۲۵۶ بیتی تصادفی؛ فقط هش SHA-256 آن ذخیره می‌شود (لینک را فقط لحظه‌ی ساخت می‌توان دید).
// • عکس‌فوری: همان HTML قالبِ لحظه‌ی ساخت (gzip، بدون فونت و لوگو/مهر) ذخیره می‌شود؛ ویرایشِ بعدیِ سند آن را عوض نمی‌کند.
// • بعد از انقضا/لغو محتوا پاک می‌شود و فقط ردیفِ آمار می‌ماند.
// مسیر عمومی نمایش در routes/printShare.ts است (بدون requireAuth)؛ ساخت/فهرست/لغو در routes/printTemplates.ts و با مجوز «مشاهده»ی همان سند.

export const SHARE_DEFAULT_DAYS = 7;
export const SHARE_MAX_DAYS = 60;
/** حداکثر لینک فعال برای هر سند */
export const SHARE_MAX_ACTIVE_PER_DOC = 5;

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface ShareLinkRow {
  id: number;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  title: string;
  createdAt: Date;
  createdByName: string;
  expiresAt: Date;
  revokedAt: Date | null;
  firstViewedAt: Date | null;
  lastViewedAt: Date | null;
  viewCount: number;
}

function statusOf(l: { revokedAt: Date | null; expiresAt: Date }, now: Date): ShareLinkRow["status"] {
  if (l.revokedAt) return "REVOKED";
  return l.expiresAt.getTime() <= now.getTime() ? "EXPIRED" : "ACTIVE";
}

/** محتوای لینک‌های منقضی/لغوشده را پاک می‌کند (ردیف آمار می‌ماند)؛ هنگام ساخت لینک جدید و لغو صدا زده می‌شود */
async function purgeDeadContent(now: Date) {
  await prisma.printShareLink.updateMany({
    where: { contentGz: { not: null }, OR: [{ expiresAt: { lte: now } }, { revokedAt: { not: null } }] },
    data: { contentGz: null },
  });
}

export async function createShareLink(input: {
  documentType: string;
  sourceId: number;
  templateId: number;
  digits?: "LATIN" | "PERSIAN";
  days: number;
  userId: number | null;
}) {
  const days = Math.round(input.days);
  if (!Number.isFinite(days) || days < 1 || days > SHARE_MAX_DAYS) throw new Error(`مدت اعتبار لینک باید بین ۱ تا ${SHARE_MAX_DAYS} روز باشد`);
  const now = new Date();
  await purgeDeadContent(now);

  const active = await prisma.printShareLink.count({
    where: { documentType: input.documentType as any, sourceId: input.sourceId, revokedAt: null, expiresAt: { gt: now } },
  });
  if (active >= SHARE_MAX_ACTIVE_PER_DOC) {
    throw new Error(`برای هر سند حداکثر ${SHARE_MAX_ACTIVE_PER_DOC} لینک فعال مجاز است؛ یکی از لینک‌های قبلی را لغو کنید`);
  }

  const r = await renderSavedTemplate(input.templateId, input.sourceId, input.digits, { forShare: true });
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const row = await prisma.printShareLink.create({
    data: {
      tokenHash: hashToken(token),
      documentType: input.documentType as any,
      sourceId: input.sourceId,
      title: r.title,
      fileName: r.fileName,
      contentGz: zlib.gzipSync(Buffer.from(r.html, "utf8"), { level: 9 }),
      expiresAt,
      createdById: input.userId,
    },
  });
  return { id: row.id, token, expiresAt, title: r.title };
}

export async function listShareLinks(documentType: string, sourceId: number): Promise<ShareLinkRow[]> {
  const now = new Date();
  const rows = await prisma.printShareLink.findMany({
    where: { documentType: documentType as any, sourceId },
    orderBy: { id: "desc" },
    take: 30,
    select: { id: true, title: true, createdAt: true, createdById: true, expiresAt: true, revokedAt: true, firstViewedAt: true, lastViewedAt: true, viewCount: true },
  });
  const ids = Array.from(new Set(rows.map((r) => r.createdById).filter((x): x is number => x != null)));
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } }) : [];
  const names = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
  return rows.map((r) => ({
    id: r.id,
    status: statusOf(r, now),
    title: r.title,
    createdAt: r.createdAt,
    createdByName: r.createdById != null ? names.get(r.createdById) ?? "" : "",
    expiresAt: r.expiresAt,
    revokedAt: r.revokedAt,
    firstViewedAt: r.firstViewedAt,
    lastViewedAt: r.lastViewedAt,
    viewCount: r.viewCount,
  }));
}

export async function revokeShareLink(documentType: string, sourceId: number, id: number) {
  const link = await prisma.printShareLink.findFirst({ where: { id, documentType: documentType as any, sourceId } });
  if (!link) throw new Error("لینک یافت نشد");
  if (!link.revokedAt) {
    await prisma.printShareLink.update({ where: { id }, data: { revokedAt: new Date(), contentGz: null } });
  }
}

// ─── نمایش عمومی ────────────────────────────────────────────────────────────

/** مرورگرهای پیش‌نمایش لینک (تلگرام، واتساپ …) صفحه را خودشان باز می‌کنند؛ بازدید حساب نمی‌شود */
const PREVIEW_UA = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|skype|linkedin|curl|wget|python|go-http/i;

export function isPreviewAgent(userAgent: string | undefined): boolean {
  return PREVIEW_UA.test(userAgent ?? "");
}

export type SharedDocument = { ok: true; html: string; title: string } | { ok: false };

/** سند اشتراکی را برای نمایش آماده می‌کند؛ توکن نامعتبر/منقضی/لغوشده → ok:false (بدون تفکیک دلیل) */
export async function openSharedDocument(token: string, opts: { countView: boolean; nonce: string }): Promise<SharedDocument> {
  if (!TOKEN_RE.test(token)) return { ok: false };
  const now = new Date();
  const link = await prisma.printShareLink.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!link || link.revokedAt || link.expiresAt.getTime() <= now.getTime() || !link.contentGz) return { ok: false };

  if (opts.countView) {
    await prisma.printShareLink.update({
      where: { id: link.id },
      data: { viewCount: { increment: 1 }, lastViewedAt: now, ...(link.firstViewedAt ? {} : { firstViewedAt: now }) },
    });
  }
  const raw = zlib.gunzipSync(Buffer.from(link.contentGz)).toString("utf8");
  const html = await hydrateSharedHtml(raw);
  return { ok: true, html: decorateSharedHtml(html, link.title, link.expiresAt, opts.nonce), title: link.title };
}

const PAPER_PX: Record<string, [number, number]> = { A4: [794, 1123], A5: [559, 794] };

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** صفحه‌ی نمایش: CSP با nonce (فقط اسکریپت دکمه‌ی چاپ)، عرض viewport به اندازه‌ی کاغذ (موبایل کوچک‌نمایی می‌کند) و نوار بالا با «چاپ» */
function decorateSharedHtml(html: string, title: string, expiresAt: Date, nonce: string): string {
  let out = html;
  out = out.replace(PRINT_CSP_META, () =>
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; script-src 'nonce-${nonce}'">`
  );
  const m = /@page\s*\{\s*size:\s*(A4|A5)\s+(portrait|landscape)/i.exec(out);
  if (m) {
    const [w, h] = PAPER_PX[m[1].toUpperCase()] ?? PAPER_PX.A4;
    const px = m[2].toLowerCase() === "landscape" ? h : w;
    out = out.replace(/<meta name="viewport"[^>]*>/i, () => `<meta name="viewport" content="width=${px}">`);
  }
  const bar =
    `<div class="erp-share-bar"><span>${escapeHtml(title)}</span><span class="erp-share-exp">اعتبار لینک تا ${formatJalaliDateForMessage(expiresAt)}</span>` +
    `<button id="erp-share-print" type="button">چاپ / ذخیره PDF</button></div>` +
    `<script nonce="${nonce}">document.getElementById("erp-share-print").addEventListener("click",function(){window.print();});</script>`;
  const css =
    `<style>.erp-share-bar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:0 0 10px;padding:8px 10px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;font-size:10pt}` +
    `.erp-share-bar button{margin-inline-start:auto;font:inherit;padding:4px 12px;cursor:pointer}.erp-share-exp{color:#475569}` +
    `@media print{.erp-share-bar{display:none}}</style>`;
  out = out.replace("</head>", () => `${css}</head>`);
  out = out.replace(/<body([^>]*)>/i, (_m, attrs) => `<body${attrs}>${bar}`);
  return out;
}

export function renderInvalidSharePage(): string {
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>لینک نامعتبر</title><style>body{font-family:Tahoma,sans-serif;background:#f8fafc;color:#1e293b;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}div{background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:24px 32px;text-align:center}</style></head><body><div><h2>این لینک معتبر نیست یا منقضی شده است</h2><p>برای دریافت لینک جدید با فرستنده تماس بگیرید.</p></div></body></html>`;
}

// ─── محدودیت نرخ (در حافظه؛ یک نمونه‌ی backend) ─────────────────────────────

const rate = new Map<string, { n: number; reset: number }>();

/** true = مجاز؛ هر کلید حداکثر max درخواست در بازه‌ی windowMs */
export function allowRate(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (rate.size > 5000) {
    for (const [k, v] of rate) if (v.reset <= now) rate.delete(k);
  }
  const cur = rate.get(key);
  if (!cur || cur.reset <= now) {
    rate.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  cur.n += 1;
  return cur.n <= max;
}
