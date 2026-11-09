// کلاینت کوچک ریجستری Docker (HTTP API v2) فقط برای خواندن: فهرست تگ‌ها و LABEL‌های ایمیج «manifest نسخه».
// بدون docker pull و بدون وابستگی؛ فقط HTTPS، احراز هویت Basic و (در صورت درخواست ریجستری) Bearer token.

export interface RegistryCreds {
  host: string;
  user: string;
  password: string;
}

export class RegistryError extends Error {}

const TIMEOUT_MS = 20000;
const ACCEPT_MANIFEST = [
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
  "application/vnd.oci.image.manifest.v1+json",
  "application/vnd.docker.distribution.manifest.v2+json",
].join(", ");

// فقط برای آزمایش روی ریجستری http داخلی (REGISTRY_ALLOW_HTTP=1)؛ در نصب واقعی همیشه https
const scheme = () => (process.env.REGISTRY_ALLOW_HTTP === "1" ? "http" : "https");

const basic = (c: RegistryCreds) => "Basic " + Buffer.from(`${c.user}:${c.password}`).toString("base64");

async function getToken(c: RegistryCreds, challenge: string): Promise<string> {
  const realm = /realm="([^"]+)"/.exec(challenge)?.[1];
  if (!realm) throw new RegistryError("پاسخ احراز هویت ریجستری قابل‌فهم نیست");
  const u = new URL(realm);
  const service = /service="([^"]+)"/.exec(challenge)?.[1];
  const scope = /scope="([^"]+)"/.exec(challenge)?.[1];
  if (service) u.searchParams.set("service", service);
  if (scope) u.searchParams.set("scope", scope);
  const r = await fetch(u, { headers: { Authorization: basic(c) }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!r.ok) throw new RegistryError("نام کاربری یا رمز ریجستری پذیرفته نشد");
  const j: any = await r.json();
  return j.token || j.access_token;
}

async function get(c: RegistryCreds, path: string, accept?: string): Promise<Response> {
  const url = `${scheme()}://${c.host}${path}`;
  const headers: Record<string, string> = { Authorization: basic(c) };
  if (accept) headers.Accept = accept;
  let r: Response;
  try {
    r = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (r.status === 401) {
      const ch = r.headers.get("www-authenticate") || "";
      if (/^Bearer/i.test(ch)) {
        const token = await getToken(c, ch);
        r = await fetch(url, { headers: { ...headers, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      }
    }
  } catch (e: any) {
    if (e instanceof RegistryError) throw e;
    throw new RegistryError(`ارتباط با ریجستری (${c.host}) برقرار نشد`);
  }
  if (r.status === 401 || r.status === 403) throw new RegistryError("نام کاربری یا رمز ریجستری پذیرفته نشد یا دسترسی ندارد");
  if (r.status === 404) throw new RegistryError("ریجستری یا نسخه‌ای با این مشخصات پیدا نشد");
  if (!r.ok) throw new RegistryError(`ریجستری خطا داد (${r.status})`);
  return r;
}

export async function listTags(c: RegistryCreds, repo: string): Promise<string[]> {
  const r = await get(c, `/v2/${repo}/tags/list`);
  const j: any = await r.json();
  return Array.isArray(j.tags) ? j.tags : [];
}

/** LABEL‌های ایمیج (برای تگ یا digest)؛ اگر مانیفست index/list بود، اولین مانیفست غیر attestation خوانده می‌شود */
export async function getLabels(c: RegistryCreds, repo: string, ref: string): Promise<Record<string, string>> {
  let r = await get(c, `/v2/${repo}/manifests/${ref}`, ACCEPT_MANIFEST);
  let m: any = await r.json();
  if (Array.isArray(m.manifests)) {
    const d = m.manifests.find((x: any) => x?.annotations?.["vnd.docker.reference.type"] !== "attestation-manifest") || m.manifests[0];
    if (!d?.digest) throw new RegistryError("مانیفست ایمیج نسخه ناقص است");
    r = await get(c, `/v2/${repo}/manifests/${d.digest}`, ACCEPT_MANIFEST);
    m = await r.json();
  }
  const cfg = m?.config?.digest;
  if (!cfg) throw new RegistryError("مانیفست ایمیج نسخه ناقص است");
  const b = await get(c, `/v2/${repo}/blobs/${cfg}`);
  const j: any = await b.json();
  return j?.config?.Labels || j?.Labels || {};
}
