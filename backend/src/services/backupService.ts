import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";
import { computeNextRun, ScheduleSpec, validateSchedule } from "../jobs/schedule";
import { tehranParts } from "../jobs/time";

// پشتیبان‌گیری خودکار از دیتابیس. سیاست فقط از صفحه‌ی «مدیریت» (/management) تنظیم می‌شود (routes/managementBackup.ts).
//  • فرمت: pg_dump -Fc بدون رمزنگاری (تصمیم صریح کاربر) — محافظت = دسترسی فایل سیستم + دانلود فقط با رمز مدیریت.
//  • اجرا داخل همین پروسه است و به SCHEDULER_ENABLED (کارهای زمان‌بندی‌شده) و وضعیت لایسنس وابسته نیست.
//  • فایل‌ها در BACKUP_DIR (پیش‌فرض /backups) می‌مانند؛ باید یک volume جدا باشد وگرنه با ساخت دوباره‌ی کانتینر پاک می‌شوند.

export const BACKUP_DIR = process.env.BACKUP_DIR || "/backups";
const TICK_MS = 60_000;
const MIN_FREE_BYTES = 100 * 1024 * 1024;
const MAX_RUN_ROWS = 1000;
const STDERR_LIMIT = 4000;

export class BackupError extends Error {}

export interface PolicyInput {
  enabled: boolean;
  frequency: "INTERVAL" | "DAILY" | "WEEKLY";
  intervalHours: number;
  timeOfDay: string;
  weekdays: number[];
  keepRecent: number;
  keepMonthly: number;
}

// ─── ابزار ───────────────────────────────────────────────────────────────────────────────────────────────────────────

function appVersion(): string {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "..", "package.json"), "utf8")).version || "";
  } catch {
    return "";
  }
}

/** پارامترهای اتصال pg_* از DATABASE_URL (رمز فقط در متغیر محیطیِ پروسه‌ی فرزند، نه آرگومان) */
function pgEnv(database?: string): NodeJS.ProcessEnv {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new BackupError("DATABASE_URL تنظیم نشده است");
  const u = new URL(raw);
  return {
    ...process.env,
    PGHOST: u.hostname,
    PGPORT: u.port || "5432",
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: database ?? decodeURIComponent(u.pathname.replace(/^\//, "")),
  };
}

interface CmdResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv, timeoutMs = 60 * 60_000): Promise<CmdResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (d) => {
      if (stdout.length < STDERR_LIMIT) stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      if (stderr.length < STDERR_LIMIT) stderr += d.toString();
    });
    child.on("error", (e: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (e.code === "ENOENT") reject(new BackupError(`ابزار ${cmd} روی این سرور نصب نیست (ایمیج بک‌اند باید postgresql-client داشته باشد)`));
      else reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

const pad = (n: number) => String(n).padStart(2, "0");

/** نام فایل با ساعت دیواری تهران: erp-20261115-020000-v1.24.0.dump */
export function backupFileName(date: Date, version: string): string {
  const p = tehranParts(date);
  return `erp-${p.year}${pad(p.month)}${pad(p.day)}-${pad(p.hour)}${pad(p.minute)}${pad(new Date(date).getUTCSeconds())}-v${version || "x"}.dump`;
}

function safeBackupPath(fileName: string): string {
  const base = path.basename(fileName);
  if (base !== fileName || !/^erp-[0-9]{8}-[0-9]{6}-v[0-9A-Za-z.\-]+\.dump$/.test(base)) throw new BackupError("نام فایل پشتیبان نامعتبر است");
  return path.join(BACKUP_DIR, base);
}

export function backupFilePath(fileName: string): string {
  return safeBackupPath(fileName);
}

export async function audit(action: string, detail?: string, ip?: string | null) {
  try {
    await prisma.backupAuditLog.create({ data: { action, detail: detail ?? null, ip: ip ?? null } });
  } catch (e) {
    console.error("[backup] ثبت رویداد ناموفق بود", e);
  }
}

// ─── سیاست ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export function policyToSpec(p: Pick<PolicyInput, "frequency" | "intervalHours" | "timeOfDay" | "weekdays">): ScheduleSpec {
  if (p.frequency === "INTERVAL") return { type: "INTERVAL", intervalMinutes: p.intervalHours * 60 };
  return { type: p.frequency, timeOfDay: p.timeOfDay, weekdays: p.frequency === "WEEKLY" ? p.weekdays : null };
}

export async function getPolicy() {
  const existing = await prisma.backupPolicy.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.backupPolicy.create({ data: { id: 1, weekdays: [] } });
}

/** پیام خطای فارسی یا null */
export function validatePolicy(p: PolicyInput): string | null {
  if (!["INTERVAL", "DAILY", "WEEKLY"].includes(p.frequency)) return "نوع تکرار نامعتبر است";
  if (p.frequency === "INTERVAL" && (!Number.isInteger(p.intervalHours) || p.intervalHours < 1 || p.intervalHours > 24 * 31)) {
    return "فاصله‌ی پشتیبان‌گیری باید عددی صحیح بین ۱ و ۷۴۴ ساعت باشد";
  }
  const sched = validateSchedule(policyToSpec(p));
  if (sched) return sched;
  if (!Number.isInteger(p.keepRecent) || p.keepRecent < 2 || p.keepRecent > 365) return "تعداد نسخه‌های اخیر باید بین ۲ و ۳۶۵ باشد";
  if (!Number.isInteger(p.keepMonthly) || p.keepMonthly < 0 || p.keepMonthly > 60) return "تعداد نسخه‌های ماهانه باید بین ۰ و ۶۰ باشد";
  return null;
}

export async function savePolicy(p: PolicyInput) {
  const err = validatePolicy(p);
  if (err) throw new BackupError(err);
  const nextRunAt = p.enabled ? computeNextRun(policyToSpec(p), new Date()) : null;
  return prisma.backupPolicy.upsert({
    where: { id: 1 },
    create: { id: 1, ...p, weekdays: p.weekdays, nextRunAt },
    update: { ...p, weekdays: p.weekdays, nextRunAt },
  });
}

// ─── وضعیت ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface BackupState {
  dir: string;
  dirOk: boolean;
  dirMessage: string | null;
  freeBytes: number | null;
  toolOk: boolean;
  lastSuccess: { id: number; at: string; fileName: string | null; sizeBytes: number | null } | null;
  warnings: string[];
}

/** آستانه‌ی «پشتیبان قدیمی»: دو برابر فاصله‌ی انتظار (حداقل ۳۶ ساعت برای روزانه) */
function staleAfterHours(p: { frequency: string; intervalHours: number }): number {
  if (p.frequency === "INTERVAL") return Math.max(2, p.intervalHours * 2 + 1);
  if (p.frequency === "WEEKLY") return 9 * 24;
  return 36;
}

async function dirStatus(): Promise<{ ok: boolean; message: string | null; free: number | null }> {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    fs.accessSync(BACKUP_DIR, fs.constants.W_OK);
  } catch {
    return { ok: false, message: `پوشه‌ی پشتیبان (${BACKUP_DIR}) در دسترس یا قابل‌نوشتن نیست؛ volume آن را در docker-compose تنظیم کنید`, free: null };
  }
  try {
    const s = await fs.promises.statfs(BACKUP_DIR);
    return { ok: true, message: null, free: Number(s.bavail) * Number(s.bsize) };
  } catch {
    return { ok: true, message: null, free: null };
  }
}

export async function getBackupState(): Promise<BackupState> {
  const policy = await getPolicy();
  const dir = await dirStatus();
  const tool = await run("pg_dump", ["--version"], process.env, 10_000).then((r) => r.code === 0).catch(() => false);
  const last = await prisma.backupRun.findFirst({ where: { status: "SUCCESS" }, orderBy: { startedAt: "desc" } });
  const warnings: string[] = [];
  if (!dir.ok && dir.message) warnings.push(dir.message);
  if (!tool) warnings.push("ابزار pg_dump در این ایمیج نیست؛ پشتیبان‌گیری کار نمی‌کند");
  if (!policy.enabled) warnings.push("پشتیبان‌گیری خودکار خاموش است");
  if (policy.enabled && !last) warnings.push("هنوز هیچ پشتیبان موفقی گرفته نشده است");
  if (policy.enabled && last && Date.now() - last.startedAt.getTime() > staleAfterHours(policy) * 3600_000) {
    warnings.push("آخرین پشتیبان موفق قدیمی‌تر از حد انتظار است؛ تاریخچه را بررسی کنید");
  }
  if (!policy.externalDestination) warnings.push("هیچ مقصد بیرون از سرور تنظیم نشده است؛ پشتیبان‌ها فقط روی همین سرور هستند و با خرابی دیسک یا سرور از بین می‌روند");
  return {
    dir: BACKUP_DIR,
    dirOk: dir.ok,
    dirMessage: dir.message,
    freeBytes: dir.free,
    toolOk: tool,
    lastSuccess: last ? { id: last.id, at: last.startedAt.toISOString(), fileName: last.fileName, sizeBytes: last.sizeBytes === null ? null : Number(last.sizeBytes) } : null,
    warnings,
  };
}

// ─── اجرای پشتیبان ──────────────────────────────────────────────────────────────────────────────────────────────────

let running = false;

export function isBackupRunning(): boolean {
  return running;
}

/** یک پشتیبان کامل می‌گیرد و ردیف تاریخچه را برمی‌گرداند؛ در صورت خطا هم ردیف FAILED ثبت می‌شود */
export async function runBackup(trigger: "SCHEDULED" | "MANUAL") {
  if (running) throw new BackupError("یک پشتیبان‌گیری دیگر در حال اجراست");
  running = true;
  const version = appVersion();
  const startedAt = new Date();
  const row = await prisma.backupRun.create({ data: { trigger, status: "RUNNING", startedAt, appVersion: version || null } });
  let tmp: string | null = null;
  try {
    const dir = await dirStatus();
    if (!dir.ok) throw new BackupError(dir.message || "پوشه‌ی پشتیبان در دسترس نیست");
    const lastSize = await prisma.backupRun.findFirst({ where: { status: "SUCCESS", sizeBytes: { not: null } }, orderBy: { startedAt: "desc" }, select: { sizeBytes: true } });
    const need = Math.max(MIN_FREE_BYTES, lastSize?.sizeBytes ? Number(lastSize.sizeBytes) * 2 : 0);
    if (dir.free !== null && dir.free < need) {
      throw new BackupError(`فضای آزاد دیسک پشتیبان کافی نیست (آزاد: ${Math.floor(dir.free / 1048576)} مگابایت، لازم: ${Math.ceil(need / 1048576)} مگابایت)`);
    }
    const fileName = backupFileName(startedAt, version);
    const finalPath = safeBackupPath(fileName);
    tmp = `${finalPath}.partial`;
    const dump = await run("pg_dump", ["-Fc", "--no-owner", "-f", tmp], pgEnv());
    if (dump.code !== 0) throw new BackupError(`pg_dump ناموفق بود: ${dump.stderr.trim().slice(0, 600) || `کد ${dump.code}`}`);
    // سالم‌بودن آرشیو (فهرست محتوا خوانده می‌شود)
    const list = await run("pg_restore", ["--list", tmp], process.env, 10 * 60_000);
    if (list.code !== 0) throw new BackupError(`فایل پشتیبان ساخته شد ولی قابل‌خواندن نیست: ${list.stderr.trim().slice(0, 400)}`);
    fs.chmodSync(tmp, 0o600);
    fs.renameSync(tmp, finalPath);
    tmp = null;
    const size = fs.statSync(finalPath).size;
    const done = await prisma.backupRun.update({
      where: { id: row.id },
      data: { status: "SUCCESS", finishedAt: new Date(), fileName, sizeBytes: BigInt(size) },
    });
    await applyRetention().catch((e) => console.error("[backup] اعمال سیاست نگه‌داری ناموفق بود", e));
    return done;
  } catch (e: any) {
    if (tmp) fs.rmSync(tmp, { force: true });
    const message = String(e?.message || e).slice(0, 1000);
    console.error("[backup] ناموفق:", message);
    return prisma.backupRun.update({ where: { id: row.id }, data: { status: "FAILED", finishedAt: new Date(), errorMessage: message } });
  } finally {
    running = false;
  }
}

// ─── نگه‌داری ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** نسخه‌های موفقِ باقی‌مانده: keepRecent جدیدترین + جدیدترین نسخه‌ی هر یک از keepMonthly ماهِ اخیر؛ بقیه حذف می‌شوند */
export async function applyRetention() {
  const policy = await getPolicy();
  const keepRecent = Math.max(2, policy.keepRecent);
  const runs = await prisma.backupRun.findMany({
    where: { status: "SUCCESS", fileDeleted: false, fileName: { not: null } },
    orderBy: { startedAt: "desc" },
  });
  const keep = new Set<number>();
  runs.slice(0, keepRecent).forEach((r) => keep.add(r.id));
  if (policy.keepMonthly > 0) {
    const seenMonths: string[] = [];
    for (const r of runs) {
      const p = tehranParts(r.startedAt);
      const key = `${p.year}-${pad(p.month)}`;
      if (seenMonths.includes(key)) continue;
      if (seenMonths.length >= policy.keepMonthly) break;
      seenMonths.push(key);
      keep.add(r.id);
    }
  }
  for (const r of runs) {
    if (keep.has(r.id) || !r.fileName) continue;
    try {
      fs.rmSync(safeBackupPath(r.fileName), { force: true });
    } catch (e) {
      console.error("[backup] حذف فایل قدیمی ناموفق بود", r.fileName, e);
      continue;
    }
    await prisma.backupRun.update({ where: { id: r.id }, data: { fileDeleted: true } });
  }
  // پوشه‌ی نیمه‌کاره‌ها و تاریخچه‌ی خیلی قدیمی
  try {
    for (const f of fs.readdirSync(BACKUP_DIR)) {
      if (!f.endsWith(".partial")) continue;
      const full = path.join(BACKUP_DIR, f);
      if (Date.now() - fs.statSync(full).mtimeMs > 24 * 3600_000) fs.rmSync(full, { force: true });
    }
  } catch {
    /* پوشه در دسترس نیست؛ وضعیت خودش هشدار می‌دهد */
  }
  const total = await prisma.backupRun.count();
  if (total > MAX_RUN_ROWS) {
    const old = await prisma.backupRun.findMany({ orderBy: { startedAt: "asc" }, take: total - MAX_RUN_ROWS, select: { id: true } });
    await prisma.backupRun.deleteMany({ where: { id: { in: old.map((o) => o.id) }, fileDeleted: true } });
  }
}

// ─── تست بازگردانی ──────────────────────────────────────────────────────────────────────────────────────────────────

/** فایل را در یک دیتابیس موقت بازمی‌گرداند، چند شمارش ساده می‌گیرد و دیتابیس موقت را پاک می‌کند */
export async function testRestore(runId: number) {
  const row = await prisma.backupRun.findUnique({ where: { id: runId } });
  if (!row || row.status !== "SUCCESS" || !row.fileName || row.fileDeleted) throw new BackupError("فایل پشتیبانِ این ردیف در دسترس نیست");
  const file = safeBackupPath(row.fileName);
  if (!fs.existsSync(file)) throw new BackupError("فایل پشتیبان روی دیسک پیدا نشد");
  if (running) throw new BackupError("یک پشتیبان‌گیری در حال اجراست؛ بعد از پایان دوباره تلاش کنید");
  const tmpDb = `erp_restore_test_${Date.now()}`;
  const adminEnv = pgEnv("postgres");
  let ok = false;
  let message = "";
  try {
    const created = await run("createdb", [tmpDb], adminEnv, 60_000);
    if (created.code !== 0) throw new BackupError(`ساخت دیتابیس موقت ناموفق بود: ${created.stderr.trim().slice(0, 300)}`);
    const restored = await run("pg_restore", ["--no-owner", "--no-privileges", "--exit-on-error", "-d", tmpDb, file], pgEnv(tmpDb), 60 * 60_000);
    if (restored.code !== 0) throw new BackupError(`بازگردانی ناموفق بود: ${restored.stderr.trim().slice(0, 400)}`);
    const q = async (sql: string) => {
      const r = await run("psql", ["-Atc", sql], pgEnv(tmpDb), 5 * 60_000);
      if (r.code !== 0) throw new BackupError(`پرس‌وجو روی دیتابیس بازگردانده‌شده ناموفق بود: ${r.stderr.trim().slice(0, 300)}`);
      return r.stdout.trim();
    };
    const tables = Number(await q("select count(*) from information_schema.tables where table_schema = 'public'"));
    const users = await q(`select count(*) from "User"`);
    const entries = await q(`select count(*) from "JournalEntry"`);
    if (!(tables > 0)) throw new BackupError("دیتابیس بازگردانده‌شده جدولی ندارد");
    ok = true;
    message = `بازگردانی موفق: ${tables} جدول، ${users} کاربر، ${entries} سند حسابداری`;
  } catch (e: any) {
    message = String(e?.message || e).slice(0, 600);
  } finally {
    await run("dropdb", ["--if-exists", tmpDb], adminEnv, 60_000).catch(() => undefined);
  }
  await prisma.backupRun.update({ where: { id: runId }, data: { testedAt: new Date(), testOk: ok, testMessage: message } });
  return { ok, message };
}

// ─── زمان‌سنج ───────────────────────────────────────────────────────────────────────────────────────────────────────

let timer: NodeJS.Timeout | null = null;
let ticking = false;

async function tick() {
  if (ticking || running) return;
  ticking = true;
  try {
    const p = await getPolicy();
    if (!p.enabled) return;
    const now = new Date();
    const spec = policyToSpec(p);
    if (!p.nextRunAt) {
      await prisma.backupPolicy.update({ where: { id: 1 }, data: { nextRunAt: computeNextRun(spec, now) } });
      return;
    }
    if (p.nextRunAt.getTime() > now.getTime()) return;
    // نوبت جاافتاده فقط یک‌بار جبران می‌شود؛ نوبت بعدی از «اکنون» حساب می‌شود
    await prisma.backupPolicy.update({ where: { id: 1 }, data: { nextRunAt: computeNextRun(spec, now) } });
    await runBackup("SCHEDULED");
  } catch (e) {
    console.error("[backup] خطا در زمان‌سنج", e);
  } finally {
    ticking = false;
  }
}

/** اجراهای RUNNING از پروسه‌ی قبلی را شکست‌خورده علامت می‌زند و زمان‌سنج را روشن می‌کند */
export async function startBackupScheduler() {
  const cutoff = new Date(Date.now() - 1000);
  await prisma.backupRun.updateMany({
    where: { status: "RUNNING", startedAt: { lt: cutoff } },
    data: { status: "FAILED", finishedAt: new Date(), errorMessage: "برنامه در میانه‌ی پشتیبان‌گیری متوقف شد" },
  });
  if (timer) clearInterval(timer);
  timer = setInterval(() => void tick(), TICK_MS);
  setTimeout(() => void tick(), 15_000);
  console.log("[backup] زمان‌سنج پشتیبان‌گیری روشن شد (سیاست از صفحه‌ی مدیریت)");
}
