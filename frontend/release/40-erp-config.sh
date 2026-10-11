#!/bin/sh
# هنگام بالا آمدن کانتینر: آدرس API را از متغیر محیطی VITE_API_URL در config.js می‌نویسد (خالی = برنامه خودش از hostname مرورگر می‌سازد)
set -e
api=$(printf '%s' "${VITE_API_URL:-}" | tr -d '"\\n\r ')
printf 'window.__ERP_CONFIG__={"apiUrl":"%s"};\n' "$api" > /usr/share/nginx/html/config.js
