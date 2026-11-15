#!/usr/bin/env node
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { ApiError, ingest, ping } from "./api.mjs";
import { protectSecrets, readConfigFile, resolveConfig, writeConfigFile } from "./config.mjs";
import { convertRow } from "./convert.mjs";
import { closeJournal, initJournal, journalEnabled, pruneJournal, recordBad, recordEvent, recordSent } from "./journal.mjs";
import * as log from "./log.mjs";
import { boundParams, buildQuery, lowerBound, openReady, toLogical } from "./source.mjs";
import { loadState, saveState } from "./state.mjs";
import { startWebSetup } from "./webSetup.mjs";

// «عامل تردد»: برنامه‌ای کنار دیتابیس کارت‌ساعت که ثبت‌های ورود/خروج را فقط‌خواندنی می‌خواند و با API به ERP می‌فرستد. نگاشت شناسه‌ی دستگاه به کارمند در خود ERP انجام می‌شود.
//   node src/agent.mjs setup      ← صفحه‌ی تنظیم فارسی در مرورگر (رمزها با DPAPI)؛ با --console پرسش‌وپاسخ در کنسول
//   node src/agent.mjs test       ← تست اتصال به ERP و به دیتابیس
//   node src/agent.mjs preview    ← چند ردیف را می‌خواند و تبدیل‌شده نشان می‌دهد (چیزی ارسال نمی‌شود)
//   node src/agent.mjs once       ← یک دور خواندن و ارسال
//   node src/agent.mjs run        ← اجرای دائمی (هر چند دقیقه یک دور)
//   گزینه‌ی --config <فایل> (پیش‌فرض agent.config.json کنار برنامه، یا داخل پوشه‌ی متغیر محیطی AGENT_DATA_DIR که نصب‌کننده‌ی ویندوز آن را ProgramData می‌گذارد)

const here = process.env.AGENT_DATA_DIR || path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const cmd = args[0] && !args[0].startsWith("--") ? args[0] : "help";
const optIdx = args.indexOf("--config");
const configFile = path.resolve(optIdx >= 0 ? args[optIdx + 1] : path.join(here, "agent.config.json"));
const stateDir = path.dirname(configFile);
const CHUNK = 2000;

function ask(question, def = "") {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(`${question}${def ? ` [${def}]` : ""}: `, (v) => { rl.close(); resolve(v.trim() || def); }));
}
function askSecret(question) {
  return new Promise((resolve) => {
    process.stdout.write(`${question}: `);
    const stdin = process.stdin;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let buf = "";
    const onData = (chunk) => {
      for (const c of chunk) {
        const code = c.charCodeAt(0);
        if (code === 13 || code === 10) {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          return resolve(buf);
        }
        if (code === 3) process.exit(130);
        if (code === 127 || code === 8) buf = buf.slice(0, -1);
        else buf += c;
      }
    };
    stdin.on("data", onData);
  });
}

/** پرسش‌وپاسخ تنظیم؛ رمزها هرگز چاپ یا لاگ نمی‌شوند */
async function setup() {
  console.log("تنظیم «عامل تردد» — پاسخ پیش‌فرض داخل [ ] است.\n");
  const url = await ask("آدرس سرور ERP (مثلاً http://192.168.1.10:4000/api)");
  const token = await askSecret("توکن اتصال (از فرم «اتصال دستگاه حضور و غیاب» در ERP)");
  const type = await ask("نوع دیتابیس کارت‌ساعت (mssql / mysql / postgres)", "mssql");
  const host = await ask("آدرس سرور دیتابیس (برای SQL Server نمونه‌ی نام‌دار: HOST\\INSTANCE)");
  const port = await ask("پورت (خالی = پیش‌فرض)");
  const database = await ask("نام دیتابیس");
  const user = await ask("کاربر فقط‌خواندنی");
  const password = await askSecret("رمز کاربر دیتابیس");
  const table = await ask("نام جدول ورود و خروج (مثلاً dbo.Traffic)");
  const userId = await ask("ستون شناسه‌ی کاربر");
  const mode = await ask("تاریخ و ساعت در یک ستون است یا دو ستون جدا؟ (1 = یک ستون، 2 = دو ستون)", "2");
  const columns = { userId };
  if (mode === "1") columns.dateTime = await ask("ستون تاریخ و ساعت");
  else {
    columns.date = await ask("ستون تاریخ");
    columns.time = await ask("ستون ساعت");
  }
  const device = await ask("ستون نام/شناسه‌ی دستگاه (اختیاری)");
  if (device) columns.device = device;
  const dateFormat = await ask("تاریخ در دیتابیس شمسی است یا میلادی؟ (jalali / gregorian)", "gregorian");
  columns.cursor = await ask("ستون پیگیری ثبت‌های تازه (شناسه‌ی افزایشی یا زمان ثبت؛ اگر ندارید خالی بگذارید تا با تاریخ و ساعت تردد پیگیری شود)");
  const cursorType = columns.cursor ? await ask("نوع آن ستون (number / datetime)", "number") : "auto";
  if (!columns.cursor) delete columns.cursor;
  const initialCursor = await ask(cursorType === "number" ? "از کدام مقدار به بعد ارسال شود؟ (0 = همه‌ی تاریخچه)" : "از چه تاریخ (و ساعت) به بعد ارسال شود؟ (همان قالب دیتابیس، مثلاً 2026-11-01 یا 1405/08/10 08:00؛ خالی = همه‌ی تاریخچه)", cursorType === "number" ? "0" : "");
  const where = await ask("شرط اضافه (اختیاری، فقط شرط؛ مثلاً Deleted = 0)");
  const raw = {
    server: { url, token },
    db: { type, host, ...(port ? { port: Number(port) } : {}), database, user, password },
    source: { table, columns, dateFormat, cursorType, initialCursor: cursorType === "number" ? Number(initialCursor) : initialCursor, ...(where ? { where } : {}), overlapMinutes: 10 },
    sync: { intervalSeconds: 300, batchSize: 2000 },
  };
  protectSecrets(raw);
  writeConfigFile(configFile, raw);
  console.log(`\nتنظیمات در ${configFile} ذخیره شد (رمزها محافظت‌شده). حالا «test» و بعد «preview» را اجرا کنید.`);
}

function loadAll() {
  const raw = readConfigFile(configFile);
  if (protectSecrets(raw)) writeConfigFile(configFile, raw); // رمزهای متن ساده‌ی فایل، همین‌جا محافظت می‌شوند
  log.initLog(stateDir);
  return { cfg: resolveConfig(raw), state: loadState(stateDir) };
}

async function test(cfg) {
  const p = await ping(cfg.server);
  console.log(`✔ سرور ERP: اتصال «${p.connection}» پذیرفته شد`);
  const src = await openReady(cfg.db, cfg.source);
  try {
    await src.ping();
    console.log("✔ دیتابیس کارت‌ساعت: اتصال برقرار است");
    const lb = lowerBound(cfg.source, { cursor: null });
    await src.query(buildQuery(cfg.db.type, cfg.source, 1, lb.operator), boundParams(lb, cfg.source));
    console.log("✔ جدول و ستون‌ها قابل‌خواندن‌اند");
  } finally {
    await src.close();
  }
}

async function preview(cfg, state) {
  const src = await openReady(cfg.db, cfg.source);
  try {
    const lb = lowerBound(cfg.source, state);
    const rows = toLogical(await src.query(buildQuery(cfg.db.type, cfg.source, 10, lb.operator), boundParams(lb, cfg.source)), cfg.source);
    if (rows.length === 0) console.log("ردیفی بعد از نقطه‌ی شروع پیدا نشد.");
    for (const r of rows) {
      try {
        const c = convertRow(r.raw, cfg.source);
        console.log(`خام: ${JSON.stringify(r.raw)}  →  ${c.deviceUserId} | ${c.date} ${c.time}${c.deviceName ? ` | ${c.deviceName}` : ""}`);
      } catch (e) {
        console.log(`خام: ${JSON.stringify(r.raw)}  →  ✘ ${e.message}`);
      }
    }
  } finally {
    await src.close();
  }
}

/** یک دور: خواندن دسته‌ها از cursor، ارسال و جلو بردن cursor فقط پس از پذیرش سرور */
async function cycle(cfg, state) {
  const src = await openReady(cfg.db, cfg.source);
  let totalSent = 0, totalBad = 0, rounds = 0;
  try {
    for (;;) {
      const lb = lowerBound(cfg.source, state);
      const limit = cfg.sync.batchSize;
      const rows = toLogical(await src.query(buildQuery(cfg.db.type, cfg.source, limit, lb.operator), boundParams(lb, cfg.source)), cfg.source);
      if (rows.length === 0) break;
      const punches = [];
      const raws = [];
      const bad = [];
      for (const r of rows) {
        try {
          punches.push(convertRow(r.raw, cfg.source));
          raws.push(r.raw);
        } catch (e) {
          bad.push(e.message);
          recordBad(r.raw, e.message);
        }
      }
      if (bad.length) log.warn(`${bad.length} ردیف قابل‌تبدیل نبود و رد شد؛ نمونه: ${bad[0]}`);
      totalBad += bad.length;
      for (let i = 0; i < punches.length; i += CHUNK) {
        const r = await ingest(cfg.server, punches.slice(i, i + CHUNK));
        recordSent(punches.slice(i, i + CHUNK), raws.slice(i, i + CHUNK), r);
        if (r.invalid?.length) log.warn(`سرور ${r.invalid.length} ثبت را نامعتبر دانست؛ نمونه: ${r.invalid[0].error}`);
        log.info(`ارسال ${Math.min(CHUNK, punches.length - i)} ثبت: جدید ${r.newRows}، تکراری ${r.duplicates}، پذیرفته ${r.accepted}، در انتظار نگاشت ${r.pending}، ردشده ${r.rejected}`);
      }
      totalSent += punches.length;
      const last = rows[rows.length - 1].cursor;
      const advanced = String(last) !== String(state.cursor);
      state.cursor = last;
      state.sent = (state.sent ?? 0) + punches.length;
      state.lastOkAt = new Date().toISOString();
      state.lastError = null;
      saveState(state);
      rounds++;
      if (rows.length < limit || !advanced || rounds >= 200) break;
    }
  } finally {
    await src.close().catch(() => {});
  }
  return { totalSent, totalBad };
}

async function run(cfg, state) {
  let stop = false;
  process.on("SIGINT", () => (stop = true));
  process.on("SIGTERM", () => (stop = true));
  log.info(`عامل تردد شروع شد؛ هر ${cfg.sync.intervalSeconds} ثانیه یک دور`);
  while (!stop) {
    try {
      const r = await cycle(cfg, state);
      pruneJournal();
      if (r.totalSent) log.info(`دور کامل شد: ${r.totalSent} ثبت ارسال شد`);
    } catch (e) {
      state.lastError = e.message;
      try { saveState(state); } catch { /* ادامه */ }
      if (e instanceof ApiError && !e.temporary) log.error(`تنظیم سرور نیاز به بررسی دارد (${e.status}): ${e.message}`);
      else log.warn(`دور ناموفق (بعداً دوباره): ${e.message}`);
    }
    for (let i = 0; i < cfg.sync.intervalSeconds && !stop; i++) await new Promise((r) => setTimeout(r, 1000));
  }
  log.info("عامل تردد متوقف شد");
}

async function main() {
  if (cmd === "help") {
    console.log("دستورها: setup [--console] | test | preview | once | run   (گزینه: --config <فایل>)");
    return;
  }
  if (cmd === "setup" && !args.includes("--console")) return startWebSetup({ configFile, entry: fileURLToPath(import.meta.url), stateDir });
  if (cmd === "setup") return setup();
  const { cfg, state } = loadAll();
  if (cmd === "run" || cmd === "once") {
    await initJournal(stateDir);
    log.setSink((level, msg) => recordEvent(level, msg));
    pruneJournal();
    if (!journalEnabled()) log.warn("ژورنال محلی در دسترس نیست (نیاز به Node 22.5 یا جدیدتر)؛ ارسال بدون آن ادامه می‌یابد");
  }
  if (cmd === "test") return test(cfg);
  if (cmd === "preview") return preview(cfg, state);
  if (cmd === "once") {
    const r = await cycle(cfg, state);
    closeJournal();
    console.log(`پایان: ${r.totalSent} ثبت ارسال شد${r.totalBad ? `، ${r.totalBad} ردیف قابل‌تبدیل نبود` : ""}.`);
    return;
  }
  if (cmd === "run") return run(cfg, state);
  throw new Error(`دستور ناشناخته: ${cmd}`);
}

main().catch((e) => {
  console.error(`\nخطا: ${e?.message ?? e}`);
  process.exitCode = 1;
});
