# هدرهای امنیتی پایه (یافته‌های OWASP ZAP). نگینکس add_header را به location ارث نمی‌دهد وقتی خودش add_header دارد؛ پس فایل نهایی
# (/etc/nginx/security-headers.conf) در هر location include می‌شود. این قالب هنگام بالا آمدن کانتینر توسط 40-erp-config.sh به فایل نهایی تبدیل می‌شود:
# __API_SRC__ = مبدأ API (از VITE_API_URL؛ خالی ⇒ همان hostname با پورت ۴۰۰۰ که برنامه می‌سازد؛ مسیر نسبی مثل /api ⇒ هم‌مبدأ و خالی).
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "same-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
# CSP: اسکریپت فقط از خود سایت (index.html هیچ اسکریپت inline ندارد). style-src باید 'unsafe-inline' داشته باشد چون React استایل inline می‌گذارد؛
# استایل فونت‌ها از cdnjs و jsdelivr (styles.css) می‌آید. اتصال و تصویر (لوگوی شرکت) فقط به خود سایت و مبدأ API باز است.
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; font-src 'self' data: https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; img-src 'self' data: blob: __API_SRC__; connect-src 'self' __API_SRC__; frame-src 'self' blob: data:; media-src 'self' blob: data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" always;
