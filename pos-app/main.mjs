// برنامه‌ی دسکتاپ صندوق: صفحه‌ی ERP را در یک پنجره‌ی اختصاصی باز می‌کند و به درخواست صفحه، مستقیم با کارتخوان و چاپگرهای ویندوزِ همین کامپیوتر کار می‌کند (سرور فقط تراکنش/کار چاپ را آماده و نتیجه را ثبت می‌کند).
// تنظیمات (آدرس سامانه، …) در userData/config.json ذخیره می‌شود؛ بار اول پنجره‌ی تنظیمات باز می‌شود (بعداً: Ctrl+Shift+S).
import { app, BrowserWindow, Menu, ipcMain, shell } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DRIVERS } from "./drivers/index.mjs";
import { discoverAll } from "./drivers/sadad.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const VERSION = app.getVersion();

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

const CONFIG_FILE = () => path.join(app.getPath("userData"), "config.json");
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE(), "utf8"));
  } catch {
    return {};
  }
}
function saveConfig(cfg) {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(CONFIG_FILE(), JSON.stringify(cfg, null, 2));
}

let cfg = {};
let mainWin = null;
let setupWin = null;

// ─── چاپ با Electron ───
let worker = null; // پنجره‌ی پنهان فقط برای فهرست چاپگرها
async function listPrinters() {
  if (!worker || worker.isDestroyed()) {
    worker = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
    await worker.loadURL("about:blank");
  }
  const arr = await worker.webContents.getPrintersAsync();
  return arr.map((p) => ({ name: p.name, isDefault: !!p.isDefault }));
}

// paper: "ROLL" (پیش‌فرض: عرض widthMm و ارتفاعِ محتوا، برای چاپگر حرارتی رول) | "A4" | "A5" (چاپگر لیزری/معمولی: کاغذ استاندارد؛ برگه‌ی ۸۰mm بالای صفحه چاپ می‌شود)
async function printHtml({ html, printer, outFile = "", widthMm, paper = "ROLL" }) {
  const standard = paper === "A4" || paper === "A5" ? paper : null;
  const w = Number(widthMm) > 0 ? Number(widthMm) : 80;
  const widthPx = Math.ceil((w / 25.4) * 96);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "erp-pos-print-"));
  const file = path.join(dir, "doc.html");
  fs.writeFileSync(file, html, "utf8");
  const win = new BrowserWindow({ show: false, width: widthPx, height: 100, useContentSize: true, webPreferences: { sandbox: true, javascript: true } });
  try {
    await win.loadURL(pathToFileURL(file).href);
    await new Promise((r) => setTimeout(r, 400)); // فونت و تصویر جاسازی‌شده
    const hPx = await win.webContents.executeJavaScript("(() => { const b = document.body; const cs = getComputedStyle(b); return Math.ceil(b.getBoundingClientRect().bottom + parseFloat(cs.marginBottom || 0) + window.scrollY); })()");
    const heightMicrons = Math.ceil((hPx / 96) * 25400) + 2000; // رول: ارتفاع = طول محتوا
    if (outFile) {
      const pdf = await win.webContents.printToPDF({ printBackground: true, margins: { marginType: "none" }, pageSize: standard ?? { width: w / 25.4, height: heightMicrons / 25400 } });
      fs.writeFileSync(outFile, pdf);
      return;
    }
    await new Promise((resolve, reject) => {
      win.webContents.print(
        { silent: true, deviceName: printer, printBackground: true, margins: { marginType: "none" }, pageSize: standard ?? { width: w * 1000, height: heightMicrons } },
        (ok, reason) => (ok ? resolve() : reject(new Error(`چاپ انجام نشد: ${reason || "نامشخص"}`))),
      );
    });
  } finally {
    if (!win.isDestroyed()) win.destroy();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ─── کارتخوان: اجرای تراکنش روی دستگاه به درخواست صفحه (بدون عامل و توکن) ───
// سرور فقط تراکنش را آماده و ثبت می‌کند؛ این برنامه مستقیم با دستگاهِ شبکه‌ی محل حرف می‌زند و صفحه نتیجه را با ورود خود کاربر به سرور می‌دهد.
// هر تراکنش با requestUid یکتاست: درخواست تکراری همان اجرای قبلی را برمی‌گرداند (هرگز دو بار از کارت پول نمی‌رود)،
// و نتیجه‌ی پایان‌یافته روی دیسک می‌ماند تا با بارگذاری مجدد صفحه یا بستن برنامه هم گم نشود و بتوان آن را به سرور رساند.
const CARD_RESULTS_FILE = () => path.join(app.getPath("userData"), "card-results.json");
const CLIENT_DRIVERS = ["SADAD", "PARSIAN"];
const cardRuns = new Map(); // requestUid → { promise, result, at }
function loadCardResults() {
  try {
    const arr = JSON.parse(fs.readFileSync(CARD_RESULTS_FILE(), "utf8"));
    for (const [uid, r] of arr) if (Date.now() - r.at < 7 * 24 * 3600 * 1000) cardRuns.set(uid, r);
  } catch {
    /* فایل نیست */
  }
}
function saveCardResults() {
  try {
    const done = [...cardRuns.entries()].filter(([, r]) => r.result).map(([uid, r]) => [uid, { result: r.result, at: r.at }]);
    fs.writeFileSync(CARD_RESULTS_FILE(), JSON.stringify(done));
  } catch {
    /* ادامه */
  }
}
function startCardRun(job) {
  const uid = String(job.requestUid);
  const existing = cardRuns.get(uid);
  if (existing) return existing;
  const run = { result: null, at: Date.now(), promise: null };
  run.promise = (async () => {
    let r;
    try {
      const drv = DRIVERS[job.driver];
      if (!drv || !CLIENT_DRIVERS.includes(job.driver)) r = { status: "FAILED", errorCode: "NO_DRIVER", errorMessage: `درایور «${job.driver}» در برنامه‌ی صندوق پشتیبانی نمی‌شود` };
      else r = await drv.send({ requestUid: uid, amount: job.amount, reader: { terminalNumber: job.terminalNumber }, config: job.ip ? { ip: job.ip, port: job.port } : (cfg.cardDevices || {})[job.terminalNumber] || {} }); // اولویت: آدرس ثبت‌شده در ERP ← config.json محلی ← پیدا کردن خودکار
    } catch (e) {
      // خطا بعد از شروع: ممکن است دستگاه اجرا کرده باشد ⇒ نامشخص (نه ناموفق)
      r = { status: "UNKNOWN", errorCode: "APP_DRIVER_ERROR", errorMessage: String(e?.message || e).slice(0, 300) };
    }
    run.result = r;
    saveCardResults();
    return r;
  })();
  cardRuns.set(uid, run);
  return run;
}

// ─── پنجره‌ها و منو ───
const origin = (u) => {
  try {
    return new URL(u).origin;
  } catch {
    return "";
  }
};
const allowedOrigins = () => new Set([origin(cfg.appUrl), origin(cfg.apiUrl)].filter(Boolean));

function openMain() {
  if (!cfg.appUrl) return openSetup();
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.show();
    mainWin.focus();
    return;
  }
  mainWin = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    title: "ERP",
    webPreferences: { preload: path.join(DIR, "preload-main.cjs"), sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  mainWin.once("ready-to-show", () => {
    mainWin.maximize();
    mainWin.show();
    if (cfg.fullscreen) mainWin.setFullScreen(true);
  });
  const wc = mainWin.webContents;
  wc.setWindowOpenHandler(({ url }) => {
    if (allowedOrigins().has(origin(url))) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });
  wc.on("will-navigate", (e, url) => {
    if (url.startsWith("file:")) return; // صفحه‌ی داخلی «سرور در دسترس نیست»
    if (!allowedOrigins().has(origin(url))) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
  wc.on("did-fail-load", (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 || url.startsWith("file:")) return;
    mainWin.loadFile(path.join(DIR, "offline.html"), { query: { url: cfg.appUrl } });
  });
  mainWin.on("closed", () => (mainWin = null));
  mainWin.loadURL(cfg.appUrl);
}

function openSetup() {
  if (setupWin && !setupWin.isDestroyed()) {
    setupWin.focus();
    return;
  }
  setupWin = new BrowserWindow({
    width: 600,
    height: 700,
    autoHideMenuBar: true,
    title: "تنظیمات برنامه‌ی صندوق",
    webPreferences: { preload: path.join(DIR, "preload.cjs"), sandbox: false, contextIsolation: true, nodeIntegration: false },
  });
  setupWin.on("closed", () => {
    setupWin = null;
    if (cfg.appUrl && !mainWin) openMain();
    else if (!cfg.appUrl && !mainWin) app.quit();
  });
  setupWin.loadFile(path.join(DIR, "setup.html"));
}

function buildMenu() {
  const t = [
    { label: "بارگذاری مجدد", accelerator: "F5", click: () => mainWin?.webContents.reload() },
    { label: "تمام‌صفحه", accelerator: "F11", click: () => mainWin?.setFullScreen(!mainWin.isFullScreen()) },
    { label: "تنظیمات اتصال", accelerator: "CommandOrControl+Shift+S", click: () => openSetup() },
    { label: "خروج", accelerator: "Alt+F4", click: () => app.quit() },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: "برنامه", submenu: t }]));
}

// ─── IPC چاپ برای صفحه‌ی ERP (فقط از آدرس‌های مجاز) ───
const fromAllowedPage = (e) => allowedOrigins().has(origin(e.senderFrame?.url ?? ""));
ipcMain.handle("pos:list-printers", async (e) => {
  if (!fromAllowedPage(e)) throw new Error("درخواست مجاز نیست");
  return listPrinters();
});
ipcMain.handle("pos:print", async (e, job) => {
  if (!fromAllowedPage(e)) throw new Error("درخواست مجاز نیست");
  if (!job || typeof job.html !== "string" || !job.printer) throw new Error("کار چاپ نامعتبر است");
  await printHtml({ html: job.html, printer: String(job.printer), outFile: cfg.printOutDir ? path.join(cfg.printOutDir, `print-${Date.now()}.pdf`) : "", widthMm: job.widthMm, paper: job.paper });
  return { ok: true };
});

ipcMain.handle("pos:card-pay", async (e, job) => {
  if (!fromAllowedPage(e)) throw new Error("درخواست مجاز نیست");
  const amount = Number(job?.amount);
  if (!job || !job.requestUid || !job.driver || !Number.isFinite(amount) || amount < 1) throw new Error("درخواست تراکنش نامعتبر است");
  return startCardRun({ requestUid: job.requestUid, driver: String(job.driver), amount, terminalNumber: String(job.terminalNumber ?? ""), ip: job.ip ? String(job.ip) : "", port: Number(job.port) || undefined }).promise;
});
// جستجوی دستگاه‌های سداد روی شبکه‌ی همین کامپیوتر (برای انتخاب در فرم کارتخوان)
ipcMain.handle("pos:card-discover", async (e) => {
  if (!fromAllowedPage(e)) throw new Error("درخواست مجاز نیست");
  return discoverAll(4500);
});
// نتیجه‌ی تراکنش (اگر پایان یافته): { status, ... } | { status: "RUNNING" } | null (اجرایی با این شناسه در این برنامه نیست)
ipcMain.handle("pos:card-result", (e, requestUid) => {
  if (!fromAllowedPage(e)) throw new Error("درخواست مجاز نیست");
  const r = cardRuns.get(String(requestUid));
  return r ? r.result ?? { status: "RUNNING" } : null;
});

// ─── IPC صفحه‌ی تنظیمات ───
ipcMain.handle("setup:get", () => cfg);

ipcMain.handle("setup:probe", async (_e, appUrl) => {
  const u = String(appUrl || "").replace(/\/+$/, "");
  let parsed;
  try {
    parsed = new URL(u);
  } catch {
    return { ok: false, error: "آدرس معتبر نیست." };
  }
  const candidates = [parsed.origin, `${parsed.protocol}//${parsed.hostname}:4000`];
  for (const c of candidates) {
    try {
      const res = await fetch(`${c}/api/health`, { signal: AbortSignal.timeout(5000) });
      // فرانت‌اند برای هر مسیری index.html با کد 200 می‌دهد؛ پس باید پاسخ JSON واقعی API باشد
      if (res.ok && (await res.json().catch(() => null))?.ok === true) return { ok: true, apiUrl: c };
    } catch {
      /* بعدی */
    }
  }
  return { ok: false, error: `به سرور وصل نشد (${parsed.origin}). آدرس، اینترنت یا فایروال را بررسی کنید.` };
});

ipcMain.handle("setup:save", async (_e, input) => {
  cfg = { ...cfg, appUrl: String(input.appUrl).replace(/\/+$/, ""), apiUrl: String(input.apiUrl).replace(/\/+$/, ""), fullscreen: !!input.fullscreen };
  delete cfg.token; // توکن عامل دیگر وجود ندارد
  saveConfig(cfg);
  return { ok: true };
});

ipcMain.handle("setup:done", () => {
  setupWin?.close();
});

// ─── راه‌اندازی ───
app.on("second-instance", () => {
  const w = mainWin && !mainWin.isDestroyed() ? mainWin : setupWin;
  if (w) {
    if (w.isMinimized()) w.restore();
    w.focus();
  }
});

app.whenReady().then(() => {
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true });
  cfg = loadConfig();
  buildMenu();
  loadCardResults();
  if (cfg.appUrl) {
    openMain();
  } else {
    openSetup();
  }
});

app.on("window-all-closed", () => app.quit());
