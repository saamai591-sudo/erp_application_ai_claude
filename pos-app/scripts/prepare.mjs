// هسته‌ی عامل (agent/core.mjs و drivers) را قبل از اجرا/ساخت به pos-app کپی می‌کند تا یک منبع واحد داشته باشیم؛ آیکن برنامه را هم آماده می‌کند.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(here, "..");
const dest = path.join(here, "agent-core");
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
fs.copyFileSync(path.join(root, "agent", "core.mjs"), path.join(dest, "core.mjs"));
fs.cpSync(path.join(root, "agent", "drivers"), path.join(dest, "drivers"), { recursive: true });

const icon = path.join(root, "frontend", "public", "pwa-512.png");
fs.mkdirSync(path.join(here, "build"), { recursive: true });
if (fs.existsSync(icon)) fs.copyFileSync(icon, path.join(here, "build", "icon.png"));
console.log("agent-core آماده شد");
