#!/usr/bin/env node
// ساخت نصب‌کننده‌ی ویندوز «عامل تردد»:  node installer/build.mjs
//  ۱) کل عامل + درایورها با esbuild در یک فایل agent.mjs جمع می‌شود (بدون نیاز به node_modules روی رایانه‌ی مشتری)
//  ۲) node.exe همین رایانه (x64) کنار آن گذاشته می‌شود تا نصب Node.js لازم نباشد
//  ۳) با NSIS (makensis) نصب‌کننده‌ی dist/ERP-Attendance-Agent-Setup-<نسخه>.exe ساخته می‌شود
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = pkg.version;
const stage = path.join(root, "dist", "stage");
const outFile = path.join(root, "dist", `ERP-Attendance-Agent-Setup-${version}.exe`);

if (process.platform !== "win32" || process.arch !== "x64") throw new Error("این ساخت فقط روی ویندوز x64 انجام می‌شود (node.exe همین رایانه در نصب‌کننده قرار می‌گیرد).");

fs.rmSync(path.join(root, "dist"), { recursive: true, force: true });
fs.mkdirSync(path.join(stage, "scripts"), { recursive: true });

console.log("• جمع‌کردن عامل با esbuild…");
await build({
  entryPoints: [path.join(root, "src", "agent.mjs")],
  outfile: path.join(stage, "agent.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  legalComments: "none",
  logLevel: "warning",
  external: ["pg-native", "cloudflare:sockets", "msnodesqlv8", "mysql", "tedious-native"],
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; import { fileURLToPath as __fu } from 'node:url'; import { dirname as __dn } from 'node:path'; const require = __cr(import.meta.url); const __filename = __fu(import.meta.url); const __dirname = __dn(__filename);",
  },
});

console.log(`• کپی node.exe (${process.version})…`);
fs.copyFileSync(process.execPath, path.join(stage, "node.exe"));

const BOM = "\uFEFF";
for (const f of ["install-task.ps1", "uninstall-task.ps1"]) {
  const text = fs.readFileSync(path.join(root, "scripts", f), "utf8").replace(/^\uFEFF/, "");
  fs.writeFileSync(path.join(stage, "scripts", f), BOM + text.replace(/\r?\n/g, "\r\n"), "utf8");
}

// فایل‌های میان‌بر (با دسترسی مدیر اجرا می‌شوند؛ پوشه‌ی تنظیمات در ProgramData است)
const wrapper = (body, { pause = true } = {}) =>
  [
    "@echo off",
    "chcp 65001 >nul",
    "net session >nul 2>&1",
    "if errorlevel 1 (",
    `  powershell -NoProfile -Command "Start-Process -Verb RunAs -FilePath '%~f0'"`,
    "  exit /b",
    ")",
    'set "AGENT_DATA_DIR=%ProgramData%\\ERP Attendance Agent"',
    body,
    ...(pause ? ["echo.", "pause"] : []),
  ].join("\r\n") + "\r\n";
const run = (cmd) => `"%~dp0node.exe" "%~dp0agent.mjs" ${cmd}`;
fs.writeFileSync(path.join(stage, "setup.cmd"), wrapper(run("setup")));
fs.writeFileSync(path.join(stage, "test.cmd"), wrapper(run("test")));
fs.writeFileSync(path.join(stage, "preview.cmd"), wrapper(run("preview")));
fs.writeFileSync(path.join(stage, "once.cmd"), wrapper(run("once")));
fs.writeFileSync(path.join(stage, "open-log.cmd"), wrapper('if exist "%AGENT_DATA_DIR%\\agent.log" (start "" notepad "%AGENT_DATA_DIR%\\agent.log") else (echo agent.log not found yet & pause)', { pause: false }));

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

console.log("• ساخت راه‌انداز پنل (ERP-Attendance-Agent.exe)…");
const rl = spawnSync(makensis, [`/DOUTFILE=${path.join(stage, "ERP-Attendance-Agent.exe")}`, path.join(root, "installer", "launcher.nsi")], { stdio: "inherit" });
if (rl.status !== 0) throw new Error("ساخت راه‌انداز با خطا تمام شد.");

console.log(`• ساخت نصب‌کننده با ${makensis}…`);
const r = spawnSync(makensis, [`/DVERSION=${version}`, `/DSTAGE=${stage}`, `/DOUTFILE=${outFile}`, path.join(root, "installer", "agent.nsi")], { stdio: "inherit" });
if (r.status !== 0) throw new Error("makensis با خطا تمام شد.");
console.log(`\nآماده شد: ${outFile} (${(fs.statSync(outFile).size / 1048576).toFixed(1)} MB)`);
