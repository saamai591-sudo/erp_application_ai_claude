import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { evaluateLicense } from "../license/licenseService";
import { tehranDate } from "../jobs/time";
import { compareVersions, ReleaseManifest, ReleaseManifestError, verifyManifest } from "./releaseManifest";
import { getLabels, listTags, RegistryCreds, RegistryError } from "./registryClient";
import { getAppVersion } from "../lib/appVersion";

// «به‌روزرسانی از داخل برنامه» — فقط از صفحه‌ی مدیریت (/management) و فقط با نشست مدیریت.
// بک‌اند فقط فهرست نسخه‌ها را از ریجستری می‌خواند (HTTP، بدون docker) و امضای هر manifest را می‌سنجد؛ اجرای واقعیِ به‌روزرسانی با سرویس جدای
// `updater` است (دسترسی docker دارد؛ بک‌اند ندارد) و آن هم امضا را مستقل دوباره می‌سنجد، پس بک‌اندِ آسیب‌دیده نمی‌تواند نسخه‌ی جعلی نصب کند.

export class UpdateError extends Error {}

const RELEASE_REPO = "accounting-erp-release";
// آدرس ریجستری = میزبان[:پورت] و در صورت نیاز یک پیشوند مسیر (مثلاً repo.saam.ir/saamai) برای وقتی که ایمیج‌ها در مخزنِ مشترک با پیشوند از بقیه جدا می‌شوند
const HOST_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?(\/[a-z0-9]+([._-][a-z0-9]+)*)*$/i;
const SALT = "erp-update-registry-password-v1";
const MAX_VERSIONS = 40;

function encryptionKey(): Buffer {
  const secret = process.env.TAX_KEY_ENCRYPTION_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new UpdateError("JWT_SECRET برای رمزنگاری رمز ریجستری تنظیم نشده است");
  return crypto.scryptSync(secret, SALT, 32);
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}

function decrypt(stored: string): string {
  const [iv, tag, data] = stored.split(":");
  if (!iv || !tag || !data) throw new UpdateError("رمز ذخیره‌شده‌ی ریجستری نامعتبر است");
  const d = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}

const currentVersion = (): string => getAppVersion();

export async function getSettings() {
  const s = await prisma.updateSettings.findUnique({ where: { id: 1 } });
  return { host: s?.registryHost ?? "", user: s?.registryUser ?? "", hasPassword: !!s?.registryPasswordEnc, currentVersion: currentVersion() };
}

/** password === undefined ⇒ رمز قبلی بدون تغییر می‌ماند */
export async function saveSettings(input: { host: string; user: string; password?: string }) {
  const host = String(input.host || "").trim().toLowerCase();
  const user = String(input.user || "").trim();
  if (!HOST_RE.test(host)) throw new UpdateError("آدرس ریجستری نامعتبر است (نام میزبان و در صورت لزوم :پورت و پیشوند مسیر، بدون https://؛ مثلاً repo.saam.ir/saamai)");
  if (!user) throw new UpdateError("نام کاربری ریجستری الزامی است");
  const old = await prisma.updateSettings.findUnique({ where: { id: 1 } });
  let enc = old?.registryPasswordEnc ?? null;
  if (input.password !== undefined && input.password !== "") enc = encrypt(input.password);
  if (!enc) throw new UpdateError("رمز ریجستری الزامی است");
  await prisma.updateSettings.upsert({
    where: { id: 1 },
    update: { registryHost: host, registryUser: user, registryPasswordEnc: enc },
    create: { id: 1, registryHost: host, registryUser: user, registryPasswordEnc: enc },
  });
  invalidateCache();
}

const releaseRepo = (c: { prefix: string }) => (c.prefix ? `${c.prefix}/${RELEASE_REPO}` : RELEASE_REPO);

async function creds(): Promise<RegistryCreds & { prefix: string; full: string }> {
  const s = await prisma.updateSettings.findUnique({ where: { id: 1 } });
  if (!s?.registryHost || !s.registryUser || !s.registryPasswordEnc) throw new UpdateError("اتصال به ریجستری نسخه‌ها هنوز تنظیم نشده است");
  // registryHost می‌تواند پیشوند مسیر هم داشته باشد: میزبان برای اتصال، پیشوند جلوی نام مخزن‌ها (مثلاً saamai/accounting-erp-release)
  const slash = s.registryHost.indexOf("/");
  const host = slash < 0 ? s.registryHost : s.registryHost.slice(0, slash);
  const prefix = slash < 0 ? "" : s.registryHost.slice(slash + 1);
  return { host, user: s.registryUser, password: decrypt(s.registryPasswordEnc), prefix, full: s.registryHost };
}

export interface ReleaseItem {
  version: string;
  releasedAt: string;
  changelog: string;
  minFromVersion: string | null;
  manualNote: string | null;
  current: boolean;
  eligible: boolean;
  reasons: string[];
}

let cache: { at: number; items: { manifest: ReleaseManifest; payload: string; signature: string }[] } | null = null;
function invalidateCache() {
  cache = null;
}

async function loadVerified(force: boolean) {
  if (!force && cache && Date.now() - cache.at < 60_000) return cache.items;
  const c = await creds();
  let tags: string[];
  try {
    tags = await listTags(c, releaseRepo(c));
  } catch (e) {
    if (e instanceof RegistryError) throw new UpdateError(e.message);
    throw e;
  }
  tags = tags.filter((t) => /^\d+\.\d+\.\d+$/.test(t)).sort((a, b) => compareVersions(b, a)).slice(0, MAX_VERSIONS);
  const items: { manifest: ReleaseManifest; payload: string; signature: string }[] = [];
  const queue = [...tags];
  const worker = async () => {
    for (let t = queue.shift(); t; t = queue.shift()) {
      try {
        const labels = await getLabels(c, releaseRepo(c), t);
        const { manifest, payload } = verifyManifest(labels["erp.release.manifest"] || "", labels["erp.release.signature"] || "");
        // تگِ ریجستری باید با نسخه‌ی داخل manifest امضاشده یکی باشد (جلوگیری از جابه‌جاکردن manifest نسخه‌ی دیگر زیر یک تگ)
        if (manifest.version !== t) continue;
        items.push({ manifest, payload, signature: labels["erp.release.signature"] });
      } catch (e) {
        if (e instanceof ReleaseManifestError || e instanceof RegistryError) continue; // نسخه‌ی نامعتبر/بدون امضا اصلاً نمایش داده نمی‌شود
        throw e;
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  items.sort((a, b) => compareVersions(b.manifest.version, a.manifest.version));
  cache = { at: Date.now(), items };
  return items;
}

/** بررسی اهلیت نصب یک نسخه روی این سرور؛ دلیل‌های رد به فارسی */
async function eligibility(m: ReleaseManifest, cur: string): Promise<string[]> {
  const reasons: string[] = [];
  if (cur) {
    const cmp = compareVersions(m.version, cur);
    if (cmp === 0) reasons.push("نسخه‌ی فعلی همین است");
    else if (cmp < 0) reasons.push("نسخه‌ی قدیمی‌تر از نسخه‌ی فعلی است؛ بازگشت فقط با بازگردانی پشتیبان ممکن است");
    if (m.minFromVersion && compareVersions(cur, m.minFromVersion) < 0) reasons.push(`ابتدا باید به نسخه‌ی ${m.minFromVersion} (یا بالاتر از آن) به‌روزرسانی کنید`);
  }
  // لایسنس: فقط نسخه‌هایی که تاریخ انتشارشان در دوره‌ی پشتیبانی/به‌روزرسانی است (اشتراکی منقضی‌شده هیچ نسخه‌ای)
  const lic = await evaluateLicense();
  if (lic.state === "EXPIRED") reasons.push("اشتراک منقضی شده است");
  else if (lic.license?.model === "PERPETUAL" && lic.license.supportUntil) {
    const rel = m.releasedAt ? tehranDate(new Date(m.releasedAt)) : "";
    if (rel && rel > lic.license.supportUntil) reasons.push(`این نسخه بعد از پایان دوره‌ی پشتیبانی (${lic.license.supportUntil}) منتشر شده است`);
  }
  return reasons;
}

export async function listReleases(force = false): Promise<{ currentVersion: string; releases: ReleaseItem[] }> {
  const cur = currentVersion();
  const items = await loadVerified(force);
  const releases: ReleaseItem[] = [];
  for (const i of items) {
    const reasons = await eligibility(i.manifest, cur);
    releases.push({
      version: i.manifest.version,
      releasedAt: i.manifest.releasedAt,
      changelog: i.manifest.changelog,
      minFromVersion: i.manifest.minFromVersion,
      manualNote: i.manifest.manualNote,
      current: i.manifest.version === cur,
      eligible: reasons.length === 0,
      reasons,
    });
  }
  return { currentVersion: cur, releases };
}

// ─── ارتباط با updater ──────────────────────────────────────────────────────────────────────────────────────────────

function updaterBase(): { url: string; token: string } {
  const token = process.env.UPDATER_TOKEN || "";
  if (!token) throw new UpdateError("سرویس به‌روزرسانی (updater) روی این نصب فعال نیست؛ ابتدا باید فایل compose را به نسخه‌ی جدید ببرید");
  return { url: process.env.UPDATER_URL || "http://updater:4100", token };
}

async function updaterCall(method: "GET" | "POST", p: string, body?: unknown): Promise<any> {
  const u = updaterBase();
  let r: Response;
  try {
    r = await fetch(u.url + p, {
      method,
      headers: { Authorization: `Bearer ${u.token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new UpdateError("ارتباط با سرویس به‌روزرسانی برقرار نشد (updater بالا نیست؟)");
  }
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new UpdateError(j.error || `سرویس به‌روزرسانی خطا داد (${r.status})`);
  return j;
}

export async function getUpdaterStatus() {
  return updaterCall("GET", "/status");
}

export async function applyRelease(version: string) {
  const cur = currentVersion();
  const items = await loadVerified(true);
  const it = items.find((i) => i.manifest.version === version);
  if (!it) throw new UpdateError("این نسخه در ریجستری پیدا نشد یا امضای معتبر ندارد");
  const reasons = await eligibility(it.manifest, cur);
  if (reasons.length) throw new UpdateError(reasons.join("؛ "));
  const c = await creds();
  await updaterCall("POST", "/apply", { payload: Buffer.from(it.payload, "utf8").toString("base64"), signature: it.signature, registry: { host: c.full, user: c.user, password: c.password }, fromVersion: cur });
}
