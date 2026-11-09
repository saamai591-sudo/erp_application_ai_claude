// آیکن برنامه را قبل از اجرا/ساخت آماده می‌کند (از آیکن PWA فرانت‌اند).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(here, "..");

const icon = path.join(root, "frontend", "public", "pwa-512.png");
fs.mkdirSync(path.join(here, "build"), { recursive: true });
if (fs.existsSync(icon)) fs.copyFileSync(icon, path.join(here, "build", "icon.png"));
console.log("آیکن آماده شد");
