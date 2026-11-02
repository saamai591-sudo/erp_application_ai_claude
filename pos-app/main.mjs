// برنامه‌ی دسکتاپ صندوق: صفحه‌ی ERP را در یک پنجره‌ی اختصاصی باز می‌کند، عامل کارتخوان را درون خودش اجرا می‌کند و چاپ مستقیم روی چاپگرهای ویندوز را (به درخواست صفحه) انجام می‌دهد.
// تنظیمات (آدرس، توکن، …) در userData/config.json ذخیره می‌شود؛ بار اول پنجره‌ی تنظیمات باز می‌شود (بعداً: Ctrl+Shift+S).
import { app, BrowserWindow, Menu, ipcMain, shell } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createAgent } from "./agent-core/core.mjs";

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
let agent = null;
let agentState = { online: false, error: "" };
let firstStatus = null; // برای صفحه‌ی تنظیمات: منتظر اولین نتیجه‌ی اتصال

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

// ─── عامل ───
async function stopAgent() {
  if (agent) {
    const a = agent;
    agent = null;
    await a.stop().catch(() => {});
  }
}
function startAgent() {
  agentState = { online: false, error: "" };
  if (!cfg.apiUrl || !cfg.token) return;
  agent = createAgent({
    serverUrl: cfg.apiUrl,
    token: cfg.token,
    pollMs: cfg.pollMs,
    readers: cfg.readers,
    version: `pos-${VERSION}`,
    dataDir: app.getPath("userData"),
    onStatus: (s) => {
      agentState = s;
      firstStatus?.(s);
      buildMenu();
    },
  });
  agent.start();
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
    { label: agentState.online ? "عامل: متصل ✔" : `عامل: قطع${agentState.error ? " — " + agentState.error : ""}`, enabled: false },
    { type: "separator" },
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
  const next = { ...cfg, appUrl: String(input.appUrl).replace(/\/+$/, ""), apiUrl: String(input.apiUrl).replace(/\/+$/, ""), token: String(input.token).trim(), fullscreen: !!input.fullscreen };
  cfg = next;
  saveConfig(cfg);
  await stopAgent();
  const first = new Promise((resolve) => {
    firstStatus = (s) => {
      firstStatus = null;
      resolve(s);
    };
    setTimeout(() => {
      firstStatus = null;
      resolve({ online: false, error: "" });
    }, 9000);
  });
  startAgent();
  const s = await first;
  return { online: s.online, error: s.error };
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
  if (cfg.appUrl && cfg.token) {
    startAgent();
    openMain();
  } else {
    openSetup();
  }
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  agent?.stop();
});
