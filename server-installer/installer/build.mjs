#!/usr/bin/env node
// ساخت exe تک‌فایلی «نصب‌کننده‌ی ERP روی سرور»:  cd server-installer && npm run build
//  ۱) installer.mjs + ssh2 با esbuild در یک فایل جمع می‌شود (روی رایانه‌ی مقصد Node.js نصب نمی‌خواهد)
//  ۲) node.exe همین رایانه (x64) و فایل‌های install.sh و ui.html کنارش گذاشته می‌شود
//  ۳) با NSIS یک exe خوداستخراج‌شونده‌ی dist/ERP-Server-Installer-<نسخه>.exe ساخته می‌شود
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const stage = path.join(root, "dist", "stage");
const outFile = path.join(root, "dist", `ERP-Server-Installer-${version}.exe`);

if (process.platform !== "win32" || process.arch !== "x64") throw new Error("این ساخت فقط روی ویندوز x64 انجام می‌شود (node.exe همین رایانه در exe قرار می‌گیرد).");

fs.rmSync(path.join(root, "dist"), { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });

console.log("• جمع‌کردن installer.mjs با esbuild…");
await build({
  entryPoints: [path.join(root, "src", "installer.mjs")],
  outfile: path.join(stage, "installer.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  legalComments: "none",
  logLevel: "warning",
  // ssh2 در نبود این ماژول‌های اختیاری به پیاده‌سازی خالص JS برمی‌گردد
  external: ["cpu-features", "*.node"],
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; import { fileURLToPath as __fu } from 'node:url'; import { dirname as __dn } from 'node:path'; const require = __cr(import.meta.url); const __filename = __fu(import.meta.url); const __dirname = __dn(__filename);",
  },
});

// اسکریپت لینوکسی با LF و صفحه‌ی UI کنار bundle (installer.mjs هنگام اجرا از کنار خودش می‌خواند)
fs.writeFileSync(path.join(stage, "install.sh"), fs.readFileSync(path.join(root, "src", "install.sh"), "utf8").replace(/\r\n/g, "\n"));
fs.copyFileSync(path.join(root, "src", "ui.html"), path.join(stage, "ui.html"));

console.log(`• کپی node.exe (${process.version})…`);
fs.copyFileSync(process.execPath, path.join(stage, "node.exe"));

const candidates = [
  process.env.MAKENSIS,
  "C:\\Program Files (x86)\\NSIS\\makensis.exe",
  "C:\\Program Files\\NSIS\\makensis.exe",
  ...(() => {
    const cache = path.join(os.homedir(), "AppData", "Local", "electron-builder", "Cache", "nsis");
    return fs.existsSync(cache) ? fs.readdirSync(cache).filter((d) => d.startsWith("nsis-")).map((d) => path.join(cache, d, "makensis.exe")) : [];
  })(),
].filter(Boolean);
const makensis = candidates.find((p) => fs.existsSync(p));
if (!makensis) throw new Error("makensis پیدا نشد؛ NSIS را نصب کنید یا مسیر را در متغیر MAKENSIS بگذارید.");

console.log(`• ساخت exe با ${makensis}…`);
const r = spawnSync(makensis, [`/DVERSION=${version}`, `/DSTAGE=${stage}`, `/DOUTFILE=${outFile}`, path.join(root, "installer", "launcher.nsi")], { stdio: "inherit" });
if (r.status !== 0) throw new Error("makensis با خطا تمام شد.");
console.log(`\nآماده شد: ${outFile} (${(fs.statSync(outFile).size / 1048576).toFixed(1)} MB)`);
