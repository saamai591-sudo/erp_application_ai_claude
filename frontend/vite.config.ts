import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

// نسخه‌ی خودِ frontend (frontend/package.json) هنگام build/dev داخل برنامه جاگذاری می‌شود (__APP_VERSION__)؛ دیالوگ «درباره» آن را
// با نسخه‌ی سرور مقایسه می‌کند تا ناهماهنگیِ ایمیج‌های frontend و backend دیده شود.
const appVersion: string = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  // usePolling: بدون این گزینه، تغییرات فایل روی bind mount ویندوز/Docker به chokidar نمی‌رسد
  // (رویدادهای inotify از هاست به کانتینر پراکسی نمی‌شوند) و Vite همچنان نسخه‌ی قدیمی فایل را از
  // کش سرور می‌دهد؛ حتی رفرش کامل مرورگر هم فایل تازه را نمی‌آورد و فقط ری‌استارت کانتینر جواب می‌دهد.
  server: {
    host: true,
    port: 5173,
    watch: { usePolling: true, interval: 300 },
    allowedHosts: ["erp.greenbits.ir"],
  },
});
