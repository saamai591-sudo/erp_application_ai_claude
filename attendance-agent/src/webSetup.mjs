import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { ping, resolveApiBase } from "./api.mjs";
import { normalizeStartDate, protectSecrets, readConfigFile, resolveConfig, writeConfigFile } from "./config.mjs";
import { gregorianToJalali, jalaliToGregorian } from "./jalali.mjs";
import { convertRow } from "./convert.mjs";
import { boundParams, buildQuery, lowerBound, openReady, toLogical } from "./source.mjs";
import { closeJournal, initJournal, listBatches, listEvents, listPunches, summary as journalSummary } from "./journal.mjs";
import { loadState } from "./state.mjs";

// صفحه‌ی تنظیم «عامل تردد»: یک وب‌سرور محلی (فقط 127.0.0.1، با توکن یک‌بارمصرف در آدرس) که صفحه‌ی فارسی تنظیم را در مرورگر باز می‌کند؛ چون کنسول ویندوز فارسی را درست نشان نمی‌دهد.
// همان کارهای «setup / test / preview» را می‌کند و نصب/حذف Scheduled Task و وضعیت اجرا را هم نشان می‌دهد. رمزها هرگز به مرورگر برگردانده نمی‌شوند (فقط «ثبت شده است»).

const TASK = "ERP Attendance Agent";
const IDLE_MS = 60 * 60 * 1000;

const ps = (script) => spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], { encoding: "utf8", windowsHide: true });

function readExisting(configFile) {
  try {
    return readConfigFile(configFile);
  } catch {
    return null;
  }
}

/** تاریخ ذخیره‌شده (میلادی "YYYY-MM-DD") → متن شمسی "YYYY/MM/DD" برای نمایش در انتخابگر */
function isoToJalaliText(iso) {
  const n = normalizeStartDate(iso);
  if (!n) return iso || "";
  const [y, m, d] = n.split("-").map(Number);
  const j = gregorianToJalali(y, m, d);
  return j.jy + "/" + String(j.jm).padStart(2, "0") + "/" + String(j.jd).padStart(2, "0");
}

/** تعداد روز و روز هفته‌ی اول ماه شمسی (شنبه = ۰) برای انتخابگر تاریخ صفحه، و تاریخ امروز به شمسی */
function jalaliMonthInfo(y, m) {
  const g = jalaliToGregorian(y, m, 1);
  const firstDow = (new Date(Date.UTC(g.gy, g.gm - 1, g.gd)).getUTCDay() + 1) % 7;
  let days = m <= 6 ? 31 : m <= 11 ? 30 : 29;
  if (m === 12) {
    try {
      jalaliToGregorian(y, 12, 30);
      days = 30;
    } catch {
      /* سال کبیسه نیست */
    }
  }
  const now = new Date();
  const t = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return { days, firstDow, today: { y: t.jy, m: t.jm, d: t.jd } };
}

/** از فرم صفحه، ساختار فایل تنظیمات می‌سازد (رمز خالی = همان رمز قبلی) */
function rawFromForm(f, existing) {
  const s = (v) => String(v ?? "").trim();
  const columns = { userId: s(f.userId) };
  if (s(f.mode) === "1") columns.dateTime = s(f.dateTime);
  else {
    columns.date = s(f.date);
    columns.time = s(f.time);
  }
  if (s(f.device)) columns.device = s(f.device);
  columns.cursor = s(f.cursor);
  // ستون پیگیری خالی = حالت خودکار: پیگیری با همان ستون‌های تاریخ و ساعت تردد (برای جدولی که شناسه‌ی افزایشی یا زمان ثبت ندارد)
  const cursorType = columns.cursor ? s(f.cursorType) || "number" : "auto";
  const init = s(f.initialCursor);
  return {
    server: { url: s(f.url), token: s(f.token) || existing?.server?.token || "" },
    db: { type: s(f.dbType), host: s(f.host), ...(s(f.port) ? { port: Number(s(f.port)) } : {}), database: s(f.database), user: s(f.user), password: s(f.password) || existing?.db?.password || "" },
    source: {
      table: s(f.table),
      columns,
      dateFormat: s(f.dateFormat) || "gregorian",
      cursorType,
      initialCursor: cursorType === "number" ? Number(init || 0) : init,
      ...(s(f.startDate) ? { startDate: normalizeStartDate(f.startDate) ?? s(f.startDate) } : {}),
      ...(s(f.where) ? { where: s(f.where) } : {}),
      overlapMinutes: existing?.source?.overlapMinutes ?? 10,
    },
    sync: { intervalSeconds: Number(s(f.intervalSeconds)) || 300, batchSize: existing?.sync?.batchSize ?? 2000 },
  };
}

function formFromRaw(raw) {
  if (!raw) return { dbType: "mssql", mode: "2", dateFormat: "gregorian", cursorType: "number", initialCursor: "0", intervalSeconds: "300", hasToken: false, hasPassword: false };
  const c = raw.source?.columns || {};
  return {
    url: raw.server?.url || "",
    hasToken: !!raw.server?.token,
    dbType: raw.db?.type || "mssql",
    host: raw.db?.host || "",
    port: raw.db?.port ? String(raw.db.port) : "",
    database: raw.db?.database || "",
    user: raw.db?.user || "",
    hasPassword: !!raw.db?.password,
    table: raw.source?.table || "",
    userId: c.userId || "",
    mode: c.dateTime ? "1" : "2",
    dateTime: c.dateTime || "",
    date: c.date || "",
    time: c.time || "",
    device: c.device || "",
    cursor: c.cursor || "",
    dateFormat: raw.source?.dateFormat || "gregorian",
    cursorType: raw.source?.cursorType === "datetime" ? "datetime" : "number",
    initialCursor: raw.source?.initialCursor != null ? String(raw.source.initialCursor) : "0",
    startDate: isoToJalaliText(raw.source?.startDate),
    where: raw.source?.where || "",
    intervalSeconds: String(raw.sync?.intervalSeconds ?? 300),
  };
}

async function runTest(raw) {
  const steps = [];
  const step = async (title, fn) => {
    try {
      steps.push({ title, ok: true, detail: (await fn()) || "" });
      return true;
    } catch (e) {
      steps.push({ title, ok: false, detail: e?.message || String(e) });
      return false;
    }
  };
  let cfg;
  if (!(await step("بررسی کامل‌بودن تنظیمات", async () => void (cfg = resolveConfig(raw))))) return steps;
  await step("اتصال به ERP", async () => {
    const base = await resolveApiBase(cfg.server.url);
    return `آدرس API: ${base} — اتصال «${(await ping(cfg.server)).connection}» پذیرفته شد`;
  });
  let src;
  if (await step("اتصال به دیتابیس کارت‌ساعت", async () => {
    src = await openReady(cfg.db, cfg.source);
    await src.ping();
  })) {
    await step("خواندن جدول و ستون‌ها", async () => {
      const lb = lowerBound(cfg.source, { cursor: null });
      await src.query(buildQuery(cfg.db.type, cfg.source, 1, lb.operator), boundParams(lb, cfg.source));
      return "جدول و ستون‌ها قابل‌خواندن‌اند";
    });
  }
  await src?.close?.().catch(() => {});
  return steps;
}

async function runPreview(raw) {
  const cfg = resolveConfig(raw);
  const src = await openReady(cfg.db, cfg.source);
  try {
    const lb = lowerBound(cfg.source, { cursor: null });
    const rows = toLogical(await src.query(buildQuery(cfg.db.type, cfg.source, 10, lb.operator), boundParams(lb, cfg.source)), cfg.source);
    return rows.map((r) => {
      try {
        const c = convertRow(r.raw, cfg.source);
        return { raw: JSON.stringify(r.raw), ok: true, text: `${c.deviceUserId} | ${c.date} ${c.time}${c.deviceName ? ` | ${c.deviceName}` : ""}` };
      } catch (e) {
        return { raw: JSON.stringify(r.raw), ok: false, text: e.message };
      }
    });
  } finally {
    await src.close().catch(() => {});
  }
}

function taskStatus() {
  if (process.platform !== "win32") return "نامشخص (فقط ویندوز)";
  const r = ps(`$t = Get-ScheduledTask -TaskName '${TASK}' -ErrorAction SilentlyContinue; if ($t) { $t.State.ToString() } else { 'NONE' }`);
  const out = (r.stdout || "").trim();
  if (!out || out === "NONE") return "نصب نشده";
  return { Running: "در حال اجرا", Ready: "نصب شده (در انتظار اجرا)", Disabled: "غیرفعال" }[out] || out;
}

function openBrowser(url) {
  if (process.platform === "win32") spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true }).unref();
}

export async function startWebSetup({ configFile, entry, stateDir }) {
  const token = crypto.randomBytes(16).toString("hex");
  const scriptsDir = [path.join(path.dirname(entry), "scripts"), path.join(path.dirname(path.dirname(entry)), "scripts")].find((d) => fs.existsSync(path.join(d, "install-task.ps1"))) || path.join(path.dirname(entry), "scripts");
  let idle;
  const bump = () => {
    clearTimeout(idle);
    idle = setTimeout(() => process.exit(0), IDLE_MS);
  };

  const server = http.createServer(async (req, res) => {
    bump();
    const send = (code, body, type = "application/json; charset=utf-8") => {
      res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
      res.end(typeof body === "string" ? body : JSON.stringify(body));
    };
    try {
      const port = server.address().port;
      if (req.headers.host !== `127.0.0.1:${port}` && req.headers.host !== `localhost:${port}`) return send(403, { error: "forbidden" });
      const url = new URL(req.url, "http://x");
      if (req.method === "GET" && url.pathname === "/") {
        if (url.searchParams.get("t") !== token) return send(403, "این صفحه فقط با آدرسی که برنامه باز می‌کند کار می‌کند.", "text/plain; charset=utf-8");
        return send(200, PAGE.replace("__TOKEN__", () => token).replace("__CONFIG__", () => configFile), "text/html; charset=utf-8");
      }
      if (req.headers["x-token"] !== token) return send(403, { error: "forbidden" });
      if (req.method === "GET" && url.pathname === "/api/config") return send(200, { form: formFromRaw(readExisting(configFile)) });
      if (req.method === "GET" && url.pathname.startsWith("/api/journal/")) {
        await initJournal(stateDir);
        const q = url.searchParams, pg = q.get("page"), size = Math.min(200, Number(q.get("size")) || 50);
        const which = url.pathname.slice("/api/journal/".length);
        if (which === "summary") {
          const st = loadState(stateDir);
          const cfgRaw = readExisting(configFile);
          return send(200, {
            journal: journalSummary(),
            state: { cursor: st.cursor ?? null, sent: st.sent ?? 0, lastOkAt: st.lastOkAt ?? null, lastError: st.lastError ?? null },
            task: taskStatus(),
            config: cfgRaw ? { dbType: cfgRaw.db?.type, host: cfgRaw.db?.host, database: cfgRaw.db?.database, table: cfgRaw.source?.table, startDate: isoToJalaliText(cfgRaw.source?.startDate), intervalSeconds: cfgRaw.sync?.intervalSeconds ?? 300, erp: cfgRaw.server?.url } : null,
          });
        }
        if (which === "batches") return send(200, listBatches(pg, size));
        if (which === "punches") return send(200, listPunches(pg, size, q.get("q") || "", q.get("status") || ""));
        if (which === "events") return send(200, listEvents(pg, size, q.get("level") || ""));
        if (which === "log") {
          const lines = Math.min(1000, Number(q.get("lines")) || 300);
          let text = "";
          try {
            text = fs.readFileSync(path.join(stateDir, "agent.log"), "utf8");
          } catch {
            /* هنوز لاگی نیست */
          }
          return send(200, { text: text.split(String.fromCharCode(10)).slice(-lines).join(String.fromCharCode(10)) });
        }
        return send(404, { error: "not found" });
      }
      if (req.method === "GET" && url.pathname === "/api/jmonth") {
        const y = Number(url.searchParams.get("y")), m = Number(url.searchParams.get("m"));
        if (!(y >= 1300 && y < 1700 && m >= 1 && m <= 12)) return send(400, { error: "bad month" });
        return send(200, jalaliMonthInfo(y, m));
      }
      if (req.method === "GET" && url.pathname === "/api/status") {
        const st = loadState(stateDir);
        return send(200, { task: taskStatus(), cursor: st.cursor, sent: st.sent ?? 0, lastOkAt: st.lastOkAt, lastError: st.lastError, hasConfig: fs.existsSync(configFile) });
      }
      if (req.method !== "POST") return send(404, { error: "not found" });
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 100_000) return send(413, { error: "too large" });
      }
      const data = body ? JSON.parse(body) : {};
      const existing = readExisting(configFile);
      if (url.pathname === "/api/test") return send(200, { steps: await runTest(rawFromForm(data, existing)) });
      if (url.pathname === "/api/preview") {
        try {
          return send(200, { rows: await runPreview(rawFromForm(data, existing)) });
        } catch (e) {
          return send(200, { error: e.message });
        }
      }
      if (url.pathname === "/api/save") {
        const raw = rawFromForm(data, existing);
        try {
          resolveConfig(raw);
        } catch (e) {
          return send(200, { error: e.message });
        }
        protectSecrets(raw);
        fs.mkdirSync(path.dirname(configFile), { recursive: true });
        writeConfigFile(configFile, raw);
        return send(200, { ok: true });
      }
      if (url.pathname === "/api/service") {
        if (process.platform !== "win32") return send(200, { error: "فقط در ویندوز" });
        if (data.action === "install") {
          if (!fs.existsSync(configFile)) return send(200, { error: "ابتدا تنظیمات را ذخیره کنید." });
          const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", path.join(scriptsDir, "install-task.ps1"), "-Node", process.execPath, "-Entry", entry, "-Config", configFile], { encoding: "utf8", windowsHide: true });
          if (r.status !== 0) return send(200, { error: `نصب نشد (برنامه باید با دسترسی Administrator اجرا شود): ${(r.stderr || r.stdout || "").trim().slice(0, 300)}` });
        } else if (data.action === "remove") {
          const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", path.join(scriptsDir, "uninstall-task.ps1")], { encoding: "utf8", windowsHide: true });
          if (r.status !== 0) return send(200, { error: `حذف نشد: ${(r.stderr || r.stdout || "").trim().slice(0, 300)}` });
        } else return send(400, { error: "bad action" });
        return send(200, { ok: true });
      }
      if (url.pathname === "/api/done") {
        send(200, { ok: true });
        closeJournal();
        setTimeout(() => process.exit(0), 300);
        return;
      }
      return send(404, { error: "not found" });
    } catch (e) {
      return send(500, { error: e?.message || String(e) });
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/?t=${token}`;
  console.log(`صفحه‌ی تنظیم عامل تردد در مرورگر باز می‌شود. اگر باز نشد این آدرس را در مرورگر بزنید:\n${url}\n\n(با دکمه‌ی «پایان» در صفحه یا Ctrl+C بسته می‌شود.)`);
  bump();
  openBrowser(url);
}

const PAGE = `<!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>تنظیم عامل تردد</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--bg:#f4f5f8;--card:#fff;--ink:#1d2130;--mut:#6b7285;--line:#d9dce5;--pri:#4f46e5;--ok:#13795b;--bad:#b42318}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.7 Tahoma,"Segoe UI",sans-serif}
.wrap{max-width:860px;margin:0 auto;padding:20px 16px 60px}h1{font-size:20px;margin:6px 0 2px}.sub{color:var(--mut);margin:0 0 16px;font-size:12px;direction:ltr;text-align:right}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:0 0 14px}
.card h2{font-size:15px;margin:0 0 10px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 14px}
@media(max-width:640px){.grid{grid-template-columns:1fr}}
label{display:block;font-size:12px;color:var(--mut);margin-bottom:2px}input,select{width:100%;padding:7px 9px;border:1px solid var(--line);border-radius:6px;font:inherit;background:#fff;color:var(--ink)}
input.ltr,select.ltr{direction:ltr;text-align:left}.hint{font-size:11px;color:var(--mut);margin-top:2px}.full{grid-column:1/-1}
.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}button{border:1px solid var(--line);background:#fff;border-radius:6px;padding:8px 14px;font:inherit;cursor:pointer}
button.p{background:var(--pri);border-color:var(--pri);color:#fff}button:disabled{opacity:.5;cursor:default}
.res{margin-top:10px;font-size:13px}.res div{padding:3px 0}.ok{color:var(--ok)}.bad{color:var(--bad)}
table{width:100%;border-collapse:collapse;font-size:12px;direction:ltr}td,th{border:1px solid var(--line);padding:4px 6px;text-align:left}.mono{font-family:Consolas,monospace}
.tabs{display:flex;gap:6px;margin:0 0 14px}.tab{padding:8px 18px;border-radius:8px}.tab.on,.stb.on{background:var(--pri);border-color:var(--pri);color:#fff}.subtabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.mono{font-family:Consolas,monospace}.tbl{overflow:auto;max-height:520px}.tbl th{position:sticky;top:0;background:#f0f1f6}.tbl td{direction:rtl;text-align:right;vertical-align:top}.pill{display:inline-block;padding:0 8px;border-radius:10px;font-size:11px}.pill.ok{background:#e4f5ee}.pill.bad{background:#fde7e4}.pill.warn{background:#fff3d6;color:#7a5b00}pre.lg{direction:ltr;text-align:left;white-space:pre-wrap;word-break:break-all;font:11px/1.5 Consolas,monospace;max-height:520px;overflow:auto;background:#fafafa;border:1px solid var(--line);border-radius:6px;padding:8px;margin:0}
.calwrap{position:relative}.sdrow{display:flex;gap:6px}.sdrow input{flex:1}.cal{position:absolute;z-index:5;top:62px;right:0;background:#fff;border:1px solid var(--line);border-radius:8px;padding:8px;box-shadow:0 6px 18px rgba(0,0,0,.18);width:270px}.calh{display:flex;align-items:center;justify-content:space-between;gap:4px;margin-bottom:6px}.calh input{width:70px;text-align:center}.cg{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;font-size:12px}.cg b{color:var(--mut);font-weight:normal}.cg button{padding:5px 0;border:0;border-radius:4px;background:#fff}.cg button:hover{background:#eef}.cg .sel{background:var(--pri);color:#fff}.cg .tod{outline:1px solid var(--pri)}
.st{display:grid;grid-template-columns:230px 1fr;gap:4px 10px;font-size:13px}.st b{color:var(--mut);font-weight:normal}
</style></head><body><div class="wrap">
<h1>تنظیم عامل تردد</h1><p class="sub" id="cfgpath">__CONFIG__</p>
<div class="tabs"><button class="tab on" id="tMon">وضعیت و رکوردها</button><button class="tab" id="tSet">تنظیمات</button></div>
<div id="paneMon">
<div class="card"><h2>خلاصه‌ی وضعیت</h2><div class="st" id="mSum">…</div>
<div class="row"><button class="p" id="mRef">به‌روزرسانی</button><label style="display:inline-flex;align-items:center;gap:4px;color:var(--ink);margin:0"><input type="checkbox" id="mAuto" checked style="width:auto"> به‌روزرسانی خودکار هر ۱۵ ثانیه</label></div></div>
<div class="card"><div class="subtabs"><button class="stb on" data-m="batches">ارسال‌ها به ERP</button><button class="stb" data-m="punches">رکوردهای خوانده‌شده از دستگاه</button><button class="stb" data-m="events">خطاها و هشدارها</button><button class="stb" data-m="log">فایل لاگ</button></div>
<div class="row" id="mFilt" style="margin:0 0 10px"><input id="mQ" class="ltr" placeholder="جست‌وجو: شناسه‌ی کارت یا تاریخ (مثلاً 2026-11)" style="max-width:320px"><select id="mSt" style="max-width:220px"><option value="">همه‌ی وضعیت‌ها</option><option value="SENT">ارسال شده</option><option value="BAD">قابل تبدیل نبود (ارسال نشد)</option></select><select id="mLv" style="max-width:200px"><option value="">خطا و هشدار</option><option value="ERROR">فقط خطا</option><option value="WARN">فقط هشدار</option></select><button id="mGo">اعمال</button></div>
<div id="mBody" class="tbl"></div>
<div class="row" id="mPager"><button id="mPrev">قبلی</button><span id="mPg" style="align-self:center"></span><button id="mNext">بعدی</button></div></div>
</div>
<div id="paneSet" style="display:none">

<div class="card"><h2>۱. اتصال به ERP</h2><div class="grid">
<div class="full"><label>آدرس ERP</label><input id="url" class="ltr" placeholder="http://192.168.1.10:5174"><div class="hint">همان آدرسی که ERP با آن در مرورگر باز می‌شود. آدرس API را برنامه خودش پیدا می‌کند (اگر آدرس API را بدهید، مثلاً http://192.168.1.10:4000/api، همان استفاده می‌شود).</div></div>
<div class="full"><label>توکن اتصال <span id="tokNote" class="hint"></span></label><input id="token" class="ltr" type="password" autocomplete="off" placeholder="atd_..."><div class="hint">از فرم «اتصال دستگاه حضور و غیاب» در ERP (فقط هنگام ساخت اتصال یک بار نمایش داده می‌شود).</div></div>
</div></div>

<div class="card"><h2>۲. دیتابیس کارت‌ساعت</h2><div class="grid">
<div><label>نوع دیتابیس</label><select id="dbType" class="ltr"><option value="mssql">SQL Server</option><option value="mysql">MySQL / MariaDB</option><option value="postgres">PostgreSQL</option></select></div>
<div><label>پورت (خالی = پیش‌فرض)</label><input id="port" class="ltr"></div>
<div><label>آدرس سرور دیتابیس</label><input id="host" class="ltr" placeholder="192.168.1.20  یا  HOST\\INSTANCE"></div>
<div><label>نام دیتابیس</label><input id="database" class="ltr"></div>
<div><label>کاربر (فقط‌خواندنی)</label><input id="user" class="ltr" autocomplete="off"></div>
<div><label>رمز کاربر <span id="pwNote" class="hint"></span></label><input id="password" class="ltr" type="password" autocomplete="off"></div>
</div></div>

<div class="card"><h2>۳. جدول ورود و خروج</h2><div class="grid">
<div class="full"><label>نام جدول</label><input id="table" class="ltr" placeholder="dbo.Traffic"></div>
<div><label>ستون شناسه‌ی کاربر</label><input id="userId" class="ltr"></div>
<div><label>تاریخ و ساعت در دیتابیس</label><select id="mode"><option value="2">دو ستون جدا (تاریخ، ساعت)</option><option value="1">یک ستون (تاریخ‌وساعت)</option></select></div>
<div id="g2"><label>ستون تاریخ</label><input id="date" class="ltr"></div>
<div id="g2b"><label>ستون ساعت</label><input id="time" class="ltr"></div>
<div id="g1" style="display:none"><label>ستون تاریخ‌وساعت</label><input id="dateTime" class="ltr"></div>
<div><label>ستون نام/شناسه‌ی دستگاه (اختیاری)</label><input id="device" class="ltr"></div>
<div><label>نوع تاریخ در دیتابیس</label><select id="dateFormat"><option value="gregorian">میلادی</option><option value="jalali">شمسی</option></select></div>
<div><label>ستون پیگیری ثبت‌های تازه (اختیاری)</label><input id="cursor" class="ltr"><div class="hint">اگر جدول شناسه‌ی افزایشی یا زمان ثبت دارد، نامش را بنویسید. اگر ندارد <b>خالی بگذارید</b>؛ آن‌وقت خودکار با همان ستون‌های تاریخ و ساعت تردد پیگیری می‌شود.</div></div>
<div><label>نوع ستون پیگیری (فقط وقتی ستون پیگیری پر است)</label><select id="cursorType"><option value="number">عدد (شناسه‌ی افزایشی)</option><option value="datetime">زمان ثبت</option></select></div>
<div class="full calwrap"><label>تاریخ شروع خواندن (اختیاری)</label><div class="sdrow"><input id="startDate" class="ltr" placeholder="مثلاً 1405/01/01"><button type="button" id="sdPick">انتخاب تاریخ</button><button type="button" id="sdClear">پاک‌کردن</button></div><div id="cal" class="cal" style="display:none"></div><div class="hint">تاریخ را شمسی انتخاب کنید؛ برنامه آن را خودش مطابق «نوع تاریخ در دیتابیس» (شمسی یا میلادی) ذخیره و استفاده می‌کند. فقط ثبت‌های همین روز و بعد از آن خوانده و ارسال می‌شود. برای «از امروز به بعد» امروز را انتخاب کنید؛ خالی = بدون محدودیت تاریخ.</div></div>
<div><label>شروع از (مقدار اولیه)</label><input id="initialCursor" class="ltr"><div class="hint">ستون پیگیری از نوع عدد: ۰ = همه‌ی تاریخچه. زمان ثبت: مثلاً 2026-11-01 00:00:00. بدون ستون پیگیری: تاریخ (و در صورت نیاز ساعت) با همان قالبی که در دیتابیس است، مثلاً 2026-11-01 یا 1405/08/10 08:00؛ خالی = همه‌ی تاریخچه</div></div>
<div><label>هر چند ثانیه یک بار بررسی شود</label><input id="intervalSeconds" class="ltr"></div>
<div class="full"><label>شرط اضافه (اختیاری)</label><input id="where" class="ltr" placeholder="Deleted = 0"></div>
</div>
<div class="row"><button class="p" id="bTest">آزمایش اتصال‌ها</button><button id="bPrev">پیش‌نمایش چند ردیف</button><button class="p" id="bSave">ذخیره‌ی تنظیمات</button></div>
<div class="res" id="res"></div></div>

<div class="card"><h2>۴. اجرای خودکار و وضعیت</h2>
<div class="st"><b>سرویس ویندوز</b><span id="sTask">…</span><b>آخرین ارسال موفق</b><span id="sOk">—</span><b>تعداد ارسال‌شده</b><span id="sSent">—</span><b>آخرین خطا</b><span id="sErr">—</span></div>
<div class="row"><button class="p" id="bInst">نصب و شروع اجرای خودکار</button><button id="bRem">حذف اجرای خودکار</button><button id="bRef">به‌روزرسانی وضعیت</button><button id="bDone" style="margin-inline-start:auto">پایان</button></div>
<div class="hint">اجرای خودکار با روشن‌شدن رایانه شروع می‌شود (حتی بدون ورود کاربر) و در صورت خطا خودش دوباره بالا می‌آید. لاگ: agent.log کنار فایل تنظیمات.</div>
<div class="res" id="res2"></div></div>
</div></div>
<script>
var T="__TOKEN__";
function $(i){return document.getElementById(i)}
var IDS=["url","token","dbType","host","port","database","user","password","table","userId","mode","dateTime","date","time","device","cursor","dateFormat","cursorType","initialCursor","startDate","where","intervalSeconds"];
function api(method,path,body){return fetch(path,{method:method,headers:{"x-token":T,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined}).then(function(r){return r.json()})}
function form(){var f={};IDS.forEach(function(i){f[i]=$(i).value});return f}
function esc(s){return String(s).replace(/[&<>]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;"}[c]})}
function modeUi(){var one=$("mode").value==="1";$("g1").style.display=one?"":"none";$("g2").style.display=one?"none":"";$("g2b").style.display=one?"none":""}
$("mode").onchange=modeUi;
function busy(b,on){b.disabled=on}
function run(btn,box,fn){busy(btn,true);box.innerHTML="<div>در حال انجام…</div>";fn().then(function(h){box.innerHTML=h}).catch(function(e){box.innerHTML='<div class="bad">'+esc(e.message||e)+'</div>'}).then(function(){busy(btn,false)})}
$("bTest").onclick=function(){run($("bTest"),$("res"),function(){return api("POST","/api/test",form()).then(function(r){return r.steps.map(function(s){return '<div class="'+(s.ok?"ok":"bad")+'">'+(s.ok?"✔ ":"✘ ")+esc(s.title)+(s.detail?" — "+esc(s.detail):"")+"</div>"}).join("")})})};
$("bPrev").onclick=function(){run($("bPrev"),$("res"),function(){return api("POST","/api/preview",form()).then(function(r){if(r.error)return '<div class="bad">✘ '+esc(r.error)+"</div>";if(!r.rows.length)return "<div>ردیفی بعد از نقطه‌ی شروع پیدا نشد.</div>";return '<table><tr><th>ردیف خام</th><th>تبدیل‌شده (شناسه | تاریخ ساعت | دستگاه)</th></tr>'+r.rows.map(function(x){return '<tr><td class="mono">'+esc(x.raw)+'</td><td class="'+(x.ok?"ok":"bad")+' mono">'+esc(x.text)+"</td></tr>"}).join("")+"</table>"})})};
$("bSave").onclick=function(){run($("bSave"),$("res"),function(){return api("POST","/api/save",form()).then(function(r){if(r.error)return '<div class="bad">✘ '+esc(r.error)+"</div>";$("token").value="";$("password").value="";load();return '<div class="ok">✔ تنظیمات ذخیره شد (رمزها محافظت‌شده). اگر اجرای خودکار نصب است، دور بعد با تنظیمات جدید کار می‌کند؛ برای اعمال فوری آن را حذف و دوباره نصب کنید.</div>'})})};
function status(){return api("GET","/api/status").then(function(s){$("sTask").textContent=s.task;$("sOk").textContent=s.lastOkAt?new Date(s.lastOkAt).toLocaleString("fa-IR"):"—";$("sSent").textContent=s.sent||"—";$("sErr").textContent=s.lastError||"—"})}
$("bRef").onclick=status;
$("bInst").onclick=function(){run($("bInst"),$("res2"),function(){return api("POST","/api/service",{action:"install"}).then(function(r){status();return r.error?'<div class="bad">✘ '+esc(r.error)+"</div>":'<div class="ok">✔ نصب شد و شروع به کار کرد.</div>'})})};
$("bRem").onclick=function(){run($("bRem"),$("res2"),function(){return api("POST","/api/service",{action:"remove"}).then(function(r){status();return r.error?'<div class="bad">✘ '+esc(r.error)+"</div>":'<div class="ok">✔ اجرای خودکار حذف شد.</div>'})})};
$("bDone").onclick=function(){api("POST","/api/done",{}).then(function(){document.body.innerHTML='<div style="padding:40px;text-align:center">می‌توانید این صفحه را ببندید.</div>'})};
var JM=["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"],JD=["ش","ی","د","س","چ","پ","ج"],cs={y:1405,m:1};
function en(s){var o="";String(s||"").split("").forEach(function(c){var k=c.charCodeAt(0);o+=k>=1776&&k<=1785?k-1776:k>=1632&&k<=1641?k-1632:c});return o}
function parseJ(t){var p=en(t).trim().split("/");if(p.length!==3)return null;var y=+p[0],m=+p[1],d=+p[2];return y>=1300&&y<1700&&m>=1&&m<=12&&d>=1&&d<=31?{y:y,m:m,d:d}:null}
function p2(n){return (n<10?"0":"")+n}
function drawCal(){api("GET","/api/jmonth?y="+cs.y+"&m="+cs.m).then(function(r){var sel=parseJ($("startDate").value),h='<div class="calh"><button type="button" data-a="prev">قبلی</button><span><b>'+JM[cs.m-1]+'</b> <input id="cY" type="number" value="'+cs.y+'"></span><button type="button" data-a="next">بعدی</button></div><div class="cg">';JD.forEach(function(x){h+="<b>"+x+"</b>"});for(var i=0;i<r.firstDow;i++)h+="<span></span>";for(var d=1;d<=r.days;d++){var c=(sel&&sel.y===cs.y&&sel.m===cs.m&&sel.d===d)?"sel":(r.today.y===cs.y&&r.today.m===cs.m&&r.today.d===d)?"tod":"";h+='<button type="button" class="'+c+'" data-d="'+d+'">'+d+"</button>"}h+='</div><div class="row" style="margin-top:6px"><button type="button" data-a="today">امروز</button><button type="button" data-a="close">بستن</button></div>';$("cal").innerHTML=h;$("cal").style.display=""})}
function openCal(){var v=parseJ($("startDate").value);if(v){cs.y=v.y;cs.m=v.m;drawCal()}else api("GET","/api/jmonth?y=1405&m=1").then(function(r){cs.y=r.today.y;cs.m=r.today.m;drawCal()})}
$("sdPick").onclick=function(){if($("cal").style.display==="none")openCal();else $("cal").style.display="none"};
$("sdClear").onclick=function(){$("startDate").value="";$("cal").style.display="none"};
$("cal").onclick=function(e){var t=e.target,d=t.getAttribute("data-d"),a=t.getAttribute("data-a");if(d){$("startDate").value=cs.y+"/"+p2(cs.m)+"/"+p2(+d);$("cal").style.display="none"}else if(a==="prev"){cs.m--;if(cs.m<1){cs.m=12;cs.y--}drawCal()}else if(a==="next"){cs.m++;if(cs.m>12){cs.m=1;cs.y++}drawCal()}else if(a==="today"){api("GET","/api/jmonth?y=1405&m=1").then(function(r){$("startDate").value=r.today.y+"/"+p2(r.today.m)+"/"+p2(r.today.d);$("cal").style.display="none"})}else if(a==="close")$("cal").style.display="none"};
$("cal").onchange=function(e){if(e.target.id==="cY"){var y=+e.target.value;if(y>=1300&&y<1700){cs.y=y;drawCal()}}};
var mt="batches",mp=1,MS=50,mTot=0;
function fdt(iso){if(!iso)return "—";var d=new Date(iso);return isNaN(d.getTime())?iso:d.toLocaleString("fa-IR")}
function td(x){return "<td>"+x+"</td>"}
function tbl(head,rows){if(!rows.length)return '<div class="hint" style="padding:10px">موردی نیست.</div>';return "<table><tr><th>"+head.join("</th><th>")+"</th></tr>"+rows.join("")+"</table>"}
function mSummary(){return api("GET","/api/journal/summary").then(function(s){var j=s.journal||{},st=s.state||{},c=s.config,r=[["سرویس ویندوز",s.task],["آخرین ارسال موفق",fdt(st.lastOkAt)],["جمع ردیف‌های ارسال‌شده",st.sent||0]];
if(j.enabled){r.push(["ارسال‌ها (دسته)",j.batches],["ردیف‌های ثبت‌شده در ژورنال",j.sentPunches],["ردیف‌هایی که قابل تبدیل نبود",j.badPunches],["خطاهای ۲۴ ساعت اخیر",j.errors24h],["هشدارهای ۲۴ ساعت اخیر",j.warnings24h]);if(j.lastPunch)r.push(["آخرین تردد ارسال‌شده",j.lastPunch.user_id+" — "+j.lastPunch.date+" "+j.lastPunch.time])}else r.push(["ژورنال","در دسترس نیست (ثبت ردیف‌ها فقط با نسخه‌ی نصب‌شده کار می‌کند)"]);
r.push(["آخرین خطای دور",st.lastError||"—"]);if(c)r.push(["دیتابیس",c.dbType+" — "+c.host+" / "+c.database+" / "+c.table],["تاریخ شروع خواندن",c.startDate||"بدون محدودیت"],["دوره‌ی بررسی",c.intervalSeconds+" ثانیه"],["ERP",c.erp]);
$("mSum").innerHTML=r.map(function(x){return "<b>"+esc(x[0])+"</b><span>"+esc(String(x[1]))+"</span>"}).join("")})}
function pill(t,k){return '<span class="pill '+k+'">'+esc(t)+"</span>"}
function mLoad(){var u="/api/journal/"+mt+"?page="+mp+"&size="+MS;$("mFilt").style.display=(mt==="punches"||mt==="events")?"":"none";$("mQ").style.display=$("mSt").style.display=mt==="punches"?"":"none";$("mLv").style.display=mt==="events"?"":"none";$("mPager").style.display=mt==="log"?"none":"";
if(mt==="punches")u+="&q="+encodeURIComponent($("mQ").value)+"&status="+$("mSt").value;if(mt==="events")u+="&level="+$("mLv").value;if(mt==="log")u+="&lines=300";
return api("GET",u).then(function(r){var h="";mTot=r.total||0;
if(mt==="batches")h=tbl(["زمان ارسال","تعداد ردیف","جدید","تکراری","پذیرفته","در انتظار نگاشت","ردشده","نامعتبر","بازه‌ی تردد"],(r.rows||[]).map(function(x){return "<tr>"+td(fdt(x.at))+td(x.rows)+td(x.new_rows==null?"—":x.new_rows)+td(x.duplicates==null?"—":x.duplicates)+td(x.accepted==null?"—":x.accepted)+td(x.pending==null?"—":x.pending)+td(x.rejected==null?"—":x.rejected)+td(x.invalid||0)+td('<span class="mono">'+esc(x.first_punch||"")+" ← "+esc(x.last_punch||"")+"</span>")+"</tr>"}));
else if(mt==="punches")h=tbl(["شناسه‌ی کارت","تاریخ","ساعت","دستگاه","وضعیت","دفعات ارسال","آخرین ارسال","توضیح / ردیف خام"],(r.rows||[]).map(function(x){return "<tr>"+td('<span class="mono">'+esc(x.user_id)+"</span>")+td('<span class="mono">'+esc(x.date)+"</span>")+td('<span class="mono">'+esc(x.time)+"</span>")+td(esc(x.device||"—"))+td(x.status==="SENT"?pill("ارسال شد","ok"):pill("قابل تبدیل نبود","bad"))+td(x.status==="SENT"?x.times:"—")+td(fdt(x.last_at))+td('<span class="mono" style="font-size:11px">'+esc(x.status==="BAD"?(x.note||"")+" — "+(x.raw||""):(x.raw||""))+"</span>")+"</tr>"}));
else if(mt==="events")h=tbl(["زمان","سطح","پیام"],(r.rows||[]).map(function(x){return "<tr>"+td(fdt(x.at))+td(x.level==="ERROR"?pill("خطا","bad"):pill("هشدار","warn"))+td(esc(x.message))+"</tr>"}));
else h='<pre class="lg">'+esc(r.text||"لاگی ثبت نشده است.")+"</pre>";
$("mBody").innerHTML=h;var pages=Math.max(1,Math.ceil(mTot/MS));$("mPg").textContent="صفحه "+mp+" از "+pages+" ("+mTot+" مورد)";$("mPrev").disabled=mp<=1;$("mNext").disabled=mp>=pages})}
function mAll(){mSummary();mLoad()}
document.querySelectorAll(".stb").forEach(function(b){b.onclick=function(){document.querySelectorAll(".stb").forEach(function(x){x.classList.remove("on")});b.classList.add("on");mt=b.getAttribute("data-m");mp=1;mLoad()}});
$("mRef").onclick=mAll;$("mGo").onclick=function(){mp=1;mLoad()};$("mQ").onkeydown=function(e){if(e.key==="Enter"){mp=1;mLoad()}};
$("mPrev").onclick=function(){if(mp>1){mp--;mLoad()}};$("mNext").onclick=function(){mp++;mLoad()};
function showPane(m){$("paneMon").style.display=m?"":"none";$("paneSet").style.display=m?"none":"";$("tMon").classList.toggle("on",m);$("tSet").classList.toggle("on",!m);if(m)mAll()}
$("tMon").onclick=function(){showPane(true)};$("tSet").onclick=function(){showPane(false)};
setInterval(function(){if($("mAuto").checked&&$("paneMon").style.display!=="none"&&!document.hidden)mAll()},15000);
api("GET","/api/status").then(function(s){showPane(!!s.hasConfig)});
function load(){return api("GET","/api/config").then(function(r){var f=r.form;IDS.forEach(function(i){if(f[i]!==undefined&&i!=="token"&&i!=="password")$(i).value=f[i]});$("tokNote").textContent=f.hasToken?"(ثبت شده است؛ برای نگه‌داشتن خالی بگذارید)":"";$("pwNote").textContent=f.hasPassword?"(ثبت شده است؛ برای نگه‌داشتن خالی بگذارید)":"";modeUi()})}
load().then(status);
</script></body></html>`;
