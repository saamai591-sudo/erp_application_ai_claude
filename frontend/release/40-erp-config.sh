#!/bin/sh
# هنگام بالا آمدن کانتینر: آدرس API را از متغیر محیطی VITE_API_URL در config.js می‌نویسد (خالی = برنامه خودش از hostname مرورگر می‌سازد)
set -e
api=$(printf '%s' "${VITE_API_URL:-}" | tr -d '"\\\n\r ')
printf 'window.__ERP_CONFIG__={"apiUrl":"%s"};\n' "$api" > /usr/share/nginx/html/config.js

# هدرهای امنیتی/CSP: قالب را با مبدأ API پر می‌کند (connect-src و img-src فقط به خود سایت و API باز است)
case "$api" in
  "") api_src="http://\$host:4000 https://\$host:4000" ;;
  http://*|https://*) api_src=$(printf '%s' "$api" | sed -E 's#^(https?://[^/]+).*#\1#') ;;
  *) api_src="" ;;
esac
sed "s#__API_SRC__#${api_src}#g" /etc/nginx/security-headers.tpl > /etc/nginx/security-headers.conf
