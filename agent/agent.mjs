// عامل محلی کارتخوان — اجرای مستقل با Node (توسعه و آزمایش). روی صندوق‌ها از «برنامه‌ی صندوق» (پوشه‌ی pos-app) استفاده می‌شود که همین هسته را درون خودش دارد.
// اجرا: node agent.mjs  (تنظیمات از config.json کنار همین فایل یا مسیر AGENT_CONFIG)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAgent } from "./core.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = process.env.AGENT_CONFIG || path.join(DIR, "config.json");

let cfg;
try {
  cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
} catch (e) {
  console.error(`فایل تنظیمات خوانده نشد (${CONFIG_FILE}): ${e.message}\nاز config.example.json یک کپی با نام config.json بسازید و آدرس سرور و توکن را در آن بنویسید.`);
  process.exit(1);
}
if (!cfg.serverUrl || !cfg.token) {
  console.error("serverUrl و token در config.json الزامی است.");
  process.exit(1);
}

const agent = createAgent({ serverUrl: cfg.serverUrl, token: cfg.token, pollMs: cfg.pollMs, readers: cfg.readers, dataDir: DIR });
process.on("SIGINT", () => agent.stop());
process.on("SIGTERM", () => agent.stop());
await agent.start();
