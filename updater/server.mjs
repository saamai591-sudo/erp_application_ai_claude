// سرویس updater — اجرای به‌روزرسانی نسخه روی همین نصب (docker compose).
//
// اصول امنیتی:
//  • فقط از بک‌اند و با UPDATER_TOKEN درخواست می‌پذیرد (روی شبکه‌ی داخلی compose؛ پورت به بیرون باز نیست).
//  • فقط manifestی را اجرا می‌کند که امضای معتبر (کلید عمومی انتشار) داشته باشد؛ بررسی امضا را مستقل از بک‌اند دوباره انجام می‌دهد.
//  • ایمیج‌ها با digest امضاشده pull می‌شوند (نه با تگِ قابل‌تغییر) و سپس محلی با تگ نسخه برچسب می‌خورند.
//  • قبل از هر تغییر، پشتیبان کامل دیتابیس؛ در شکست، برگشت خودکار (و بازگردانی دیتابیس اگر مایگریشن اجرا شده باشد).
// فایل compose مشتری عوض نمی‌شود؛ فقط ERP_VERSION و ERP_REGISTRY در .env کنار آن.

import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const PORT = Number(process.env.UPDATER_PORT || 4100);
const TOKEN = process.env.UPDATER_TOKEN || "";
const PUBLIC_KEY_B64 = process.env.RELEASE_PUBLIC_KEY_B64 || "MCowBQYDK2VwAyEAIHAFGzejPKZvtPgvdLcvlaRVs7Kxl1CxD/1xOp5KPkk=";
const PROJECT_DIR = process.env.PROJECT_DIR || "/project";
const BACKUP_DIR = process.env.BACKUP_DIR || "/backups";
const COMPOSE_FILE_NAME = process.env.COMPOSE_FILE_NAME || "docker-compose.prod.yml";
const DB_SERVICE = process.env.DB_SERVICE || "db";
const DB_USER = process.env.POSTGRES_USER || "erp";
const DB_NAME = process.env.POSTGRES_DB || "accounting_erp";
const HEALTH_URL = process.env.HEALTH_URL || "http://backend:4000/api/health";
const FRONT_URL = process.env.FRONT_URL || "http://frontend:5173/";
const HEALTH_TIMEOUT_MS = Number(process.env.HEALTH_TIMEOUT_MS || 300000);

const STATE_FILE = path.join(BACKUP_DIR, "update-state.json");
const HISTORY_FILE = path.join(BACKUP_DIR, "update-history.json");

const SEMVER = /^\d+\.\d+\.\d+$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
// میزبان[:پورت] با پیشوند مسیر اختیاری (repo.saam.ir/saamai)
const HOST_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?(\/[a-z0-9]+([._-][a-z0-9]+)*)*$/i;

// ─── وضعیت ───────────────────────────────────────────────────────────────────────────────────────────────────────────

let state = readJson(STATE_FILE, { status: "IDLE", steps: [] });
if (state.status === "RUNNING") {
  // پروسه وسط کار مرده (مثلاً ری‌استارت)؛ وضعیت نامعلوم را صادقانه گزارش کن
  state = { ...state, status: "UNKNOWN", error: "updater در میانه‌ی به‌روزرسانی متوقف شد؛ وضعیت نصب را بررسی کنید", finishedAt: new Date().toISOString() };
  saveState();
}

function readJson(file, def) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return def;
  }
}
function writeJson(file, obj) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(obj, null, 2), { mode: 0o600 });
  } catch (e) {
    console.error("[updater] نوشتن فایل وضعیت ناموفق:", e.message);
  }
}
function saveState() {
  writeJson(STATE_FILE, state);
}
function step(text) {
  state.steps.push({ at: new Date().toISOString(), text });
  console.log("[updater]", text);
  saveState();
}
function pushHistory() {
  const h = readJson(HISTORY_FILE, []);
  h.unshift({ from: state.fromVersion, to: state.version, status: state.status, startedAt: state.startedAt, finishedAt: state.finishedAt, error: state.error || null, backupFile: state.backupFile || null });
  writeJson(HISTORY_FILE, h.slice(0, 50));
}

// ─── ابزارها ─────────────────────────────────────────────────────────────────────────────────────────────────────────

class UpdateFail extends Error {}

function run(cmd, args, { input, env, timeoutMs = 600000, stdoutFile } = {}) {
  return new Promise((resolve, reject) => {
    const out = stdoutFile ? fs.createWriteStream(stdoutFile, { mode: 0o600 }) : null;
    const p = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ["pipe", "pipe", "pipe"] });
    let so = "";
    let se = "";
    const timer = setTimeout(() => p.kill("SIGKILL"), timeoutMs);
    if (out) p.stdout.pipe(out);
    else p.stdout.on("data", (d) => (so = (so + d).slice(-20000)));
    p.stderr.on("data", (d) => (se = (se + d).slice(-4000)));
    p.on("error", (e) => {
      clearTimeout(timer);
      reject(new UpdateFail(`اجرای ${cmd} ناموفق: ${e.message}`));
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      const fin = () => (code === 0 ? resolve({ stdout: so, stderr: se }) : reject(new UpdateFail(`${cmd} ${args.slice(0, 3).join(" ")} کد ${code}: ${se.trim().split("\n").slice(-3).join(" | ")}`)));
      if (out) out.end(fin);
      else fin();
    });
    if (input !== undefined) p.stdin.end(input);
    else p.stdin.end();
  });
}

// run با ورودی از فایل (برای pg_restore)
function runWithFileStdin(cmd, args, file, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { env: { ...process.env, ...opts.env }, stdio: ["pipe", "pipe", "pipe"] });
    let se = "";
    p.stderr.on("data", (d) => (se = (se + d).slice(-4000)));
    p.stdout.on("data", () => {});
    const timer = setTimeout(() => p.kill("SIGKILL"), opts.timeoutMs || 1800000);
    p.on("error", (e) => {
      clearTimeout(timer);
      reject(new UpdateFail(`اجرای ${cmd} ناموفق: ${e.message}`));
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      // pg_restore با --clean روی دیتابیس موجود هشدارهای بی‌ضرر می‌دهد؛ فقط کد ۰ یا ۱ (هشدار) را می‌پذیریم
      if (code === 0 || (opts.okCodes || []).includes(code)) resolve();
      else reject(new UpdateFail(`${cmd} کد ${code}: ${se.trim().split("\n").slice(-3).join(" | ")}`));
    });
    fs.createReadStream(file).pipe(p.stdin);
  });
}

function verifyManifest(payloadB64, signatureB64) {
  const payload = Buffer.from(payloadB64, "base64").toString("utf8");
  const key = crypto.createPublicKey({ key: Buffer.from(PUBLIC_KEY_B64, "base64"), format: "der", type: "spki" });
  if (!crypto.verify(null, Buffer.from(payload, "utf8"), key, Buffer.from(signatureB64, "base64"))) throw new UpdateFail("امضای نسخه معتبر نیست");
  const m = JSON.parse(payload);
  if (m.format !== "ERP-RELEASE" || !SEMVER.test(m.version)) throw new UpdateFail("قالب manifest نامعتبر است");
  for (const n of ["backend", "frontend"]) {
    const i = m.images?.[n];
    if (!i || typeof i.repo !== "string" || !DIGEST.test(i.digest) || !/^[\w][\w.-]*$/.test(String(i.tag))) throw new UpdateFail(`ایمیج ${n} در manifest نامعتبر است`);
  }
  return m;
}

// ─── .env ────────────────────────────────────────────────────────────────────────────────────────────────────────────

const envPath = () => path.join(PROJECT_DIR, ".env");
function readEnvText() {
  try {
    return fs.readFileSync(envPath(), "utf8");
  } catch {
    return "";
  }
}
function setEnvVars(text, vars) {
  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  let out = text;
  for (const [k, v] of Object.entries(vars)) {
    const re = new RegExp(`^${k}=.*$`, "m");
    if (re.test(out)) out = out.replace(re, `${k}=${v}`);
    else out = out + (out && !out.endsWith("\n") ? nl : "") + `${k}=${v}${nl}`;
  }
  return out;
}
function writeEnvText(text) {
  const tmp = envPath() + ".updater-tmp";
  fs.writeFileSync(tmp, text, { mode: 0o600 });
  fs.renameSync(tmp, envPath());
}

// ─── docker compose ──────────────────────────────────────────────────────────────────────────────────────────────────

async function composeBase() {
  let project = process.env.COMPOSE_PROJECT_NAME || "";
  if (!project) {
    try {
      const r = await run("docker", ["inspect", os.hostname(), "--format", '{{index .Config.Labels "com.docker.compose.project"}}'], { timeoutMs: 20000 });
      project = r.stdout.trim();
    } catch {
      /* ignore */
    }
  }
  if (!project) throw new UpdateFail("نام پروژه‌ی compose تشخیص داده نشد (updater باید داخل همان پروژه‌ی compose اجرا شود)");
  // فایل‌های compose همان‌هایی‌اند که خودِ این کانتینر با آن‌ها ساخته شده (label پروژه)؛ از مسیر میزبان فقط نام فایل خوانده می‌شود و فایل از /project می‌آید.
  // به این ترتیب فایل override مشتری هم حفظ می‌شود.
  const files = [];
  try {
    const r = await run("docker", ["inspect", os.hostname(), "--format", '{{index .Config.Labels "com.docker.compose.project.config_files"}}'], { timeoutMs: 20000 });
    for (const f of r.stdout.trim().split(",").filter(Boolean)) {
      const name = path.basename(f.replace(/\\/g, "/"));
      if (fs.existsSync(path.join(PROJECT_DIR, name))) files.push(path.join(PROJECT_DIR, name));
    }
  } catch {
    /* جایگزین پایین */
  }
  if (!files.length) {
    const alt = fs.existsSync(path.join(PROJECT_DIR, COMPOSE_FILE_NAME)) ? COMPOSE_FILE_NAME : "docker-compose.yml";
    if (!fs.existsSync(path.join(PROJECT_DIR, alt))) throw new UpdateFail(`فایل compose در پوشه‌ی نصب (${PROJECT_DIR}) پیدا نشد`);
    files.push(path.join(PROJECT_DIR, alt));
  }
  return ["compose", "-p", project, "--project-directory", PROJECT_DIR, ...files.flatMap((f) => ["-f", f])];
}

async function dbMigrationCount(base) {
  try {
    const r = await run("docker", [...base, "exec", "-T", DB_SERVICE, "psql", "-U", DB_USER, "-d", DB_NAME, "-tAc", 'select count(*) from "_prisma_migrations"'], { timeoutMs: 60000 });
    return Number(r.stdout.trim());
  } catch {
    return null;
  }
}

async function waitHealthy(version, base) {
  const until = Date.now() + HEALTH_TIMEOUT_MS;
  let last = "";
  while (Date.now() < until) {
    try {
      const r = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(5000) });
      if (r.ok) {
        const v = await run("docker", [...base, "exec", "-T", "backend", "node", "-e", "console.log(require('./package.json').version)"], { timeoutMs: 30000 }).catch(() => ({ stdout: "" }));
        if (v.stdout.trim() === version) {
          const f = await fetch(FRONT_URL, { signal: AbortSignal.timeout(5000) }).catch(() => null);
          if (f && f.ok) return;
          last = "frontend پاسخ نمی‌دهد";
        } else last = `نسخه‌ی در حال اجرا ${v.stdout.trim() || "نامعلوم"} است`;
      } else last = `health کد ${r.status}`;
    } catch (e) {
      last = e.message;
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new UpdateFail(`نسخه‌ی جدید در مهلت مقرر سالم بالا نیامد (${last})`);
}

// ─── خط لوله‌ی به‌روزرسانی ───────────────────────────────────────────────────────────────────────────────────────────

async function apply({ manifest, registry, fromVersion }) {
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const dockerCfg = fs.mkdtempSync(path.join(os.tmpdir(), "updater-docker-"));
  const dockerEnv = { DOCKER_CONFIG: dockerCfg };
  const oldEnvText = readEnvText();
  let base;
  let backupFile = null;
  let migBefore = null;
  let envChanged = false;
  try {
    base = await composeBase();
    if (!HOST_RE.test(registry.host)) throw new UpdateFail("آدرس ریجستری نامعتبر است");
    for (const n of ["backend", "frontend"]) {
      if (!manifest.images[n].repo.startsWith(registry.host + "/")) throw new UpdateFail(`آدرس ایمیج ${n} با ریجستری تنظیم‌شده نمی‌خواند`);
    }

    step("ورود به ریجستری");
    await run("docker", ["login", registry.host.split("/")[0], "-u", registry.user, "--password-stdin"], { input: registry.password, env: dockerEnv, timeoutMs: 60000 });

    step("بررسی سلامت نصب فعلی (دیتابیس)");
    migBefore = await dbMigrationCount(base);
    if (migBefore === null) throw new UpdateFail("اتصال به دیتابیس برای پشتیبان‌گیری ممکن نیست؛ به‌روزرسانی انجام نشد");

    step("پشتیبان‌گیری از دیتابیس");
    backupFile = path.join(BACKUP_DIR, `pre-update-${fromVersion || "x"}-to-${manifest.version}-${stamp}.dump`);
    await run("docker", [...base, "exec", "-T", DB_SERVICE, "pg_dump", "-U", DB_USER, "-Fc", "--no-owner", DB_NAME], { stdoutFile: backupFile, timeoutMs: 1800000 });
    const size = fs.statSync(backupFile).size;
    if (size < 1024) throw new UpdateFail("فایل پشتیبان خالی است؛ به‌روزرسانی انجام نشد");
    state.backupFile = path.basename(backupFile);
    saveState();

    for (const n of ["backend", "frontend"]) {
      const i = manifest.images[n];
      step(`دریافت ایمیج ${n} (${manifest.version})`);
      await run("docker", ["pull", `${i.repo}@${i.digest}`], { env: dockerEnv, timeoutMs: 1800000 });
      await run("docker", ["tag", `${i.repo}@${i.digest}`, `${i.repo}:${manifest.version}`], { timeoutMs: 60000 });
    }

    step("تنظیم نسخه در .env");
    try {
      fs.writeFileSync(envPath() + ".bak-before-update", oldEnvText, { mode: 0o600 });
    } catch {
      /* ignore */
    }
    writeEnvText(setEnvVars(oldEnvText, { ERP_VERSION: manifest.version, ERP_REGISTRY: registry.host }));
    envChanged = true;

    step("راه‌اندازی نسخه‌ی جدید");
    await run("docker", [...base, "up", "-d", "--no-deps", "backend", "frontend"], { timeoutMs: 600000 });

    step("انتظار برای سالم بودن نسخه‌ی جدید");
    await waitHealthy(manifest.version, base);

    state.status = "SUCCESS";
    state.finishedAt = new Date().toISOString();
    step(`به‌روزرسانی به نسخه‌ی ${manifest.version} با موفقیت انجام شد`);
  } catch (e) {
    state.error = e.message || String(e);
    step(`شکست: ${state.error}`);
    // ── برگشت ──
    try {
      if (envChanged) writeEnvText(oldEnvText);
      if (base) {
        const migAfter = await dbMigrationCount(base);
        const migrated = migAfter !== null && migBefore !== null && migAfter !== migBefore;
        if (migrated && backupFile) {
          step("مایگریشن‌ها اجرا شده بودند؛ بازگردانی دیتابیس از پشتیبان");
          await run("docker", [...base, "stop", "backend", "frontend"], { timeoutMs: 120000 }).catch(() => {});
          await runWithFileStdin("docker", [...base, "exec", "-T", DB_SERVICE, "pg_restore", "-U", DB_USER, "-d", DB_NAME, "--clean", "--if-exists", "--no-owner"], backupFile, { okCodes: [1] });
        }
        step("بازگشت به نسخه‌ی قبلی");
        await run("docker", [...base, "up", "-d", "--no-deps", "backend", "frontend"], { timeoutMs: 600000 });
        state.rolledBack = true;
      }
      state.status = "ROLLED_BACK";
    } catch (e2) {
      state.status = "FAILED";
      state.error += ` | برگشت هم ناموفق بود: ${e2.message}. نصب را دستی بررسی کنید؛ پشتیبان: ${state.backupFile || "ندارد"}`;
      step(state.error);
    }
    state.finishedAt = new Date().toISOString();
  } finally {
    try {
      fs.rmSync(dockerCfg, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    saveState();
    pushHistory();
  }
}

// ─── HTTP ────────────────────────────────────────────────────────────────────────────────────────────────────────────

function authorized(req) {
  const h = String(req.headers.authorization || "");
  if (!TOKEN || !h.startsWith("Bearer ")) return false;
  const a = Buffer.from(h.slice(7));
  const b = Buffer.from(TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = "";
    req.on("data", (d) => {
      s += d;
      if (s.length > 2_000_000) {
        reject(new Error("big"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(s));
  });
}

const send = (res, code, obj) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
};

http
  .createServer(async (req, res) => {
    try {
      if (req.url === "/health") return send(res, 200, { ok: true });
      if (!authorized(req)) return send(res, 401, { error: "نامعتبر" });
      if (req.method === "GET" && req.url === "/status") return send(res, 200, { ...state, history: readJson(HISTORY_FILE, []) });
      if (req.method === "POST" && req.url === "/apply") {
        if (state.status === "RUNNING") return send(res, 409, { error: "یک به‌روزرسانی در حال انجام است" });
        const body = JSON.parse(await readBody(req));
        let manifest;
        try {
          manifest = verifyManifest(String(body.payload || ""), String(body.signature || ""));
        } catch (e) {
          return send(res, 400, { error: e.message });
        }
        const r = body.registry || {};
        if (!r.host || !r.user || !r.password) return send(res, 400, { error: "اطلاعات ریجستری ناقص است" });
        state = { status: "RUNNING", version: manifest.version, fromVersion: String(body.fromVersion || ""), startedAt: new Date().toISOString(), steps: [] };
        saveState();
        send(res, 202, { started: true });
        apply({ manifest, registry: { host: String(r.host), user: String(r.user), password: String(r.password) }, fromVersion: state.fromVersion }).catch((e) => console.error("[updater]", e));
        return;
      }
      send(res, 404, { error: "پیدا نشد" });
    } catch (e) {
      send(res, 500, { error: "خطای داخلی" });
    }
  })
  .listen(PORT, () => console.log(`[updater] آماده روی ${PORT}`));
