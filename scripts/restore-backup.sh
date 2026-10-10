#!/usr/bin/env bash
# بازگردانی یک پشتیبان خودکار (pg_dump -Fc) روی «همین» دیتابیس. روی سرور، داخل پوشه‌ای که docker-compose.yml در آن است اجرا شود:
#
#   ./restore-backup.sh erp-20261115-020000-v1.24.0.dump        ← فایل داخل volume پشتیبان‌ها (همان که برنامه ساخته)
#   ./restore-backup.sh /opt/erp-app/backups/old.dump            ← فایلی که روی خود سرور است (مثلاً دانلودشده و کپی‌شده)
#
# چه می‌کند: backend/frontend را می‌خواباند → از دیتابیس فعلی یک پشتیبان ایمنی می‌گیرد (pre-restore-*.dump) → دیتابیس را پاک و از نو
# می‌سازد → فایل را بازمی‌گرداند → سرویس‌ها را بالا می‌آورد. نام دیتابیس و کاربر باید با docker-compose.yml یکی باشد (پیش‌فرض: erp / accounting_erp).
# توجه: بازگردانی روی «همین کلاستر Postgres» لایسنس را معتبر نگه می‌دارد؛ روی یک دیتابیس کاملاً تازه (سرور جدید) شناسه‌ی کلاستر عوض
# می‌شود و لایسنس تازه لازم است (راهنما: Documents/راهنمای پشتیبان‌گیری و بازگردانی.md).
set -euo pipefail

DB_USER="${DB_USER:-erp}"
DB_NAME="${DB_NAME:-accounting_erp}"
FILE="${1:-}"

if [ -z "$FILE" ]; then
  echo "استفاده: $0 <نام فایل داخل volume پشتیبان‌ها | مسیر فایل روی این سرور>" >&2
  exit 1
fi

# dc: اجرای عادی (stdin بسته تا `exec -T` ورودی «تایید» را نخورد)؛ dcin: فقط برای pg_restore که ورودی را از پایپ می‌گیرد
dc() { docker compose "$@" </dev/null; }
dcin() { docker compose "$@"; }

# منبع فایل: مسیر روی همین ماشین، یا نام فایل داخل کانتینر backend (/backups)
if [ -f "$FILE" ]; then
  feed() { cat "$FILE"; }
  LABEL="$FILE"
else
  NAME="$(basename "$FILE")"
  if ! dc exec -T backend test -f "/backups/$NAME"; then
    echo "فایل «$FILE» نه روی این سرور هست و نه داخل /backups کانتینر backend." >&2
    exit 1
  fi
  # backend در مرحله‌ی بعد خوابانده می‌شود؛ پس فایل همین حالا به یک فایل موقت روی همین ماشین کپی می‌شود
  mkdir -p backups
  TMP_COPY="backups/.restore-tmp-$$.dump"
  trap 'rm -f "$TMP_COPY"' EXIT
  dc exec -T backend cat "/backups/$NAME" > "$TMP_COPY"
  feed() { cat "$TMP_COPY"; }
  LABEL="/backups/$NAME (volume پشتیبان‌ها)"
fi

echo "فایل: $LABEL"
echo "هشدار: دیتابیس «$DB_NAME» پاک و با محتوای این فایل جایگزین می‌شود. (قبلش یک پشتیبان ایمنی گرفته می‌شود.)"
read -r -p "برای ادامه عبارت RESTORE را تایپ کنید: " ANSWER
if [ "$ANSWER" != "RESTORE" ]; then
  echo "لغو شد."
  exit 1
fi

echo "۱) توقف backend و frontend…"
dc stop frontend backend

echo "۲) پشتیبان ایمنی از دیتابیس فعلی…"
mkdir -p backups
SAFE="backups/pre-restore-$(date +%Y%m%d-%H%M%S).dump"
dc exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc --no-owner > "$SAFE"
echo "   ذخیره شد: $SAFE ($(du -h "$SAFE" | cut -f1))"

echo "۳) ساخت دوباره‌ی دیتابیس…"
dc exec -T db psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$DB_NAME\" WITH (FORCE)"
dc exec -T db psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\""

echo "۴) بازگردانی…"
feed | dcin exec -T db pg_restore -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges --exit-on-error

echo "۵) راه‌اندازی دوباره…"
dc up -d backend frontend
echo "تمام شد. اگر مشکلی بود، پشتیبان ایمنی همین‌جاست: $SAFE"
