import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // usePolling: بدون این گزینه، تغییرات فایل روی bind mount ویندوز/Docker به chokidar نمی‌رسد
  // (رویدادهای inotify از هاست به کانتینر پراکسی نمی‌شوند) و Vite همچنان نسخه‌ی قدیمی فایل را از
  // کش سرور می‌دهد؛ حتی رفرش کامل مرورگر هم فایل تازه را نمی‌آورد و فقط ری‌استارت کانتینر جواب می‌دهد.
  server: { host: true, port: 5173, watch: { usePolling: true, interval: 300 } },
});
