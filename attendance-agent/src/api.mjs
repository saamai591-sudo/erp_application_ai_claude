// ارتباط با ERP: GET /attendance-device/ping و POST /attendance-device/ingest با توکن اتصال.
// خطاهای شبکه و ۵xx «موقت» هستند (دور بعد دوباره)، ۴xx «دائمی» (تنظیم اشتباه: توکن/غیرفعال/ماژول) و روی لاگ می‌آیند.

export class ApiError extends Error {
  constructor(message, { status = 0, temporary = false } = {}) {
    super(message);
    this.status = status;
    this.temporary = temporary;
  }
}

const resolved = new Map();

async function probe(base) {
  try {
    const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) });
    const j = await r.json();
    return r.ok && j?.ok === true;
  } catch {
    return false;
  }
}

/**
 * آدرسی که کاربر می‌دهد می‌تواند آدرس خودِ برنامه‌ی ERP (همان که در مرورگر باز می‌شود) یا آدرس API باشد؛ آدرس API را خودمان پیدا می‌کنیم:
 * ۱) همان آدرس (اگر خودش API است)  ۲) apiUrl داخل config.js برنامه  ۳) «<آدرس>/api»  ۴) «hostname:4000/api» (پیش‌فرض نصب‌های رایج)
 * هر گزینه با GET /health امتحان می‌شود؛ نتیجه‌ی موفق برای دفعه‌های بعد نگه‌داری می‌شود.
 */
export async function resolveApiBase(input) {
  const given = String(input).trim().replace(/\/+$/, "");
  if (resolved.has(given)) return resolved.get(given);
  const withScheme = given.includes("://") ? given : `http://${given}`;
  let u;
  try {
    u = new URL(withScheme);
  } catch {
    throw new ApiError(`آدرس «${input}» معتبر نیست؛ مثلاً http://192.168.1.10:5174`);
  }
  const origin = u.origin;
  const candidates = [];
  const add = (c) => {
    const x = String(c).replace(/\/+$/, "");
    if (x && !candidates.includes(x)) candidates.push(x);
  };
  add(withScheme);
  try {
    const cfgJs = await (await fetch(`${origin}/config.js`, { signal: AbortSignal.timeout(5000) })).text();
    const m = cfgJs.match(/"apiUrl"\s*:\s*"([^"]*)"/);
    if (m && m[1]) add(m[1].startsWith("/") ? origin + m[1] : m[1]);
  } catch {
    /* config.js ندارد */
  }
  add(`${origin}/api`);
  add(`${u.protocol}//${u.hostname}:4000/api`);
  for (const c of candidates) {
    if (await probe(c)) {
      resolved.set(given, c);
      return c;
    }
  }
  throw new ApiError(`API در آدرس «${input}» پیدا نشد. این‌ها امتحان شد: ${candidates.join(" ، ")}. آدرس ERP را همان‌طور که در مرورگر باز می‌شود بنویسید یا آدرس API (مثلاً http://آدرس:4000/api) را بدهید، و مطمئن شوید این رایانه به سرور ERP دسترسی شبکه دارد.`, { temporary: true });
}

async function call(cfg, method, path, body) {
  const url = `${await resolveApiBase(cfg.url)}/attendance-device${path}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json; charset=utf-8" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    throw new ApiError(`اتصال به سرور ممکن نشد: ${e?.cause?.code || e?.message}`, { temporary: true });
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* پاسخ بدون JSON */
  }
  if (!res.ok) {
    const msg = data?.error || `خطای سرور (${res.status})`;
    throw new ApiError(msg, { status: res.status, temporary: res.status >= 500 || res.status === 429 });
  }
  if (!data || typeof data !== "object") {
    // معمولاً یعنی آدرس، صفحه‌ی خود ERP (مثلاً پورت ۵۱۷۴/۵۱۷۳) است نه آدرس API
    throw new ApiError(`پاسخ سرور از نوع داده‌ی API نیست (${url}). آدرس باید «آدرس API» باشد، مثلاً http://آدرس-سرور:4000/api، نه آدرسی که ERP با آن در مرورگر باز می‌شود.`, { status: res.status, temporary: false });
  }
  return data;
}

export const ping = (cfg) => call(cfg, "GET", "/ping");
export const ingest = (cfg, punches) => call(cfg, "POST", "/ingest", { punches });
