import crypto from "crypto";

// manifest امضاشده‌ی هر نسخه‌ی قابل‌نصب (ساخته‌شده با scripts/build-release.mjs --push و امضاشده با کلید جدا از کلید لایسنس: scripts/release-sign.mjs).
// کلید عمومی امضا اینجا ثابت است (کلید خصوصی فقط دست مدیر انتشار است و هرگز داخل مخزن/ایمیج نمی‌رود). env RELEASE_PUBLIC_KEY_B64 فقط برای آزمایش.
// updater (updater/server.mjs) همین بررسی را مستقل انجام می‌دهد؛ منطق عمداً کوچک است و دو جا نوشته شده تا updater به کد بک‌اند وابسته نباشد.

const RELEASE_PUBLIC_KEY_B64 = process.env.RELEASE_PUBLIC_KEY_B64 || "MCowBQYDK2VwAyEAIHAFGzejPKZvtPgvdLcvlaRVs7Kxl1CxD/1xOp5KPkk=";

export interface ReleaseImage {
  repo: string;
  tag: string;
  digest: string;
}

export interface ReleaseManifest {
  format: "ERP-RELEASE";
  version: string;
  releasedAt: string;
  minFromVersion: string | null;
  manualNote: string | null;
  images: { backend: ReleaseImage; frontend: ReleaseImage; updater?: ReleaseImage };
  changelog: string;
  compose: string;
}

export class ReleaseManifestError extends Error {}

const SEMVER = /^\d+\.\d+\.\d+$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;

function checkImage(name: string, i: any): ReleaseImage {
  if (!i || typeof i.repo !== "string" || typeof i.tag !== "string" || typeof i.digest !== "string") throw new ReleaseManifestError(`ایمیج ${name} در manifest ناقص است`);
  if (!DIGEST.test(i.digest)) throw new ReleaseManifestError(`digest ایمیج ${name} نامعتبر است`);
  return { repo: i.repo, tag: i.tag, digest: i.digest };
}

/** payload = همان رشته‌ای که امضا شده (JSON)؛ هر دو base64 از LABEL ایمیج manifest خوانده می‌شوند */
export function verifyManifest(payloadB64: string, signatureB64: string): { manifest: ReleaseManifest; payload: string } {
  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64").toString("utf8");
  } catch {
    throw new ReleaseManifestError("manifest نامعتبر است");
  }
  let ok = false;
  try {
    const key = crypto.createPublicKey({ key: Buffer.from(RELEASE_PUBLIC_KEY_B64, "base64"), format: "der", type: "spki" });
    ok = crypto.verify(null, Buffer.from(payload, "utf8"), key, Buffer.from(signatureB64, "base64"));
  } catch {
    ok = false;
  }
  if (!ok) throw new ReleaseManifestError("امضای نسخه معتبر نیست");
  let m: any;
  try {
    m = JSON.parse(payload);
  } catch {
    throw new ReleaseManifestError("manifest نامعتبر است");
  }
  if (m.format !== "ERP-RELEASE" || !SEMVER.test(String(m.version))) throw new ReleaseManifestError("قالب manifest نامعتبر است");
  const manifest: ReleaseManifest = {
    format: "ERP-RELEASE",
    version: m.version,
    releasedAt: String(m.releasedAt || ""),
    minFromVersion: m.minFromVersion && SEMVER.test(m.minFromVersion) ? m.minFromVersion : null,
    manualNote: m.manualNote ? String(m.manualNote) : null,
    images: {
      backend: checkImage("backend", m.images?.backend),
      frontend: checkImage("frontend", m.images?.frontend),
      ...(m.images?.updater ? { updater: checkImage("updater", m.images.updater) } : {}),
    },
    changelog: String(m.changelog || ""),
    compose: String(m.compose || ""),
  };
  return { manifest, payload };
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}
