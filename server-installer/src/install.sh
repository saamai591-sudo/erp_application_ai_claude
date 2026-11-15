#!/usr/bin/env bash
# نصب‌کننده‌ی ERP روی سرور لینوکسی (Ubuntu / Debian). برنامه‌ی ویندوزی آن را از راه SSH روی سرور اجرا می‌کند (با دسترسی root).
# پیش از این فایل، هدری با این متغیرها می‌آید (رمزها هرگز در خط فرمان نمی‌آیند، فقط از stdin):
#   MODE=check|install  INSTALL_NAME  REGISTRY (host[/prefix])  REG_USER  REG_PASS  REL_VERSION (خالی = آخرین)  SERVER_IP  FORCE=0|1
# خروجی خط‌به‌خط برای برنامه‌ی ویندوزی: ##STEP <متن>  ##OK <متن>  ##WARN <متن>  ##ERR <متن>  ##RESULT <json>
set -uo pipefail
export DEBIAN_FRONTEND=noninteractive LC_ALL=C.UTF-8 2>/dev/null || true

step() { echo "##STEP $*"; }
ok()   { echo "##OK $*"; }
warn() { echo "##WARN $*"; }
fail() { echo "##ERR $*"; exit 1; }
run()  { "$@" > /tmp/erp-install-last.log 2>&1 || { tail -n 8 /tmp/erp-install-last.log | sed 's/^/   /'; return 1; }; }

[ "$(id -u)" = "0" ] || fail "این اسکریپت باید با دسترسی root اجرا شود"
[ -n "${INSTALL_NAME:-}" ] && [ -n "${REGISTRY:-}" ] || fail "نام نصب و آدرس ریجستری الزامی است"
case "$INSTALL_NAME" in *[!A-Za-z0-9._-]*) fail "نام نصب فقط می‌تواند شامل حروف انگلیسی، عدد، نقطه، خط تیره و زیرخط باشد";; esac

HOST="${REGISTRY%%/*}"
PREFIX=""; [ "$HOST" != "$REGISTRY" ] && PREFIX="${REGISTRY#*/}"
RELEASE_REPO="${PREFIX:+$PREFIX/}accounting-erp-release"
DIR="/opt/$INSTALL_NAME"

# ───────────── ۱) سیستم‌عامل ─────────────
step "بررسی سیستم‌عامل"
# فایل os-release متغیرهایی مثل VERSION و ID دارد؛ پس فقط در subshell خوانده می‌شود تا متغیرهای خودمان را بازنویسی نکند
[ -r /etc/os-release ] || fail "نوع سیستم‌عامل شناخته نشد"
OS_FAMILY=$(. /etc/os-release; echo "${ID:-}${ID_LIKE:-}")
OS_NAME=$(. /etc/os-release; echo "${PRETTY_NAME:-${ID:-}}")
case "$OS_FAMILY" in
  *ubuntu*|*debian*) ok "$OS_NAME";;
  *) fail "فعلاً فقط Ubuntu و Debian پشتیبانی می‌شود ($OS_NAME). نصب دستی: Documents/راهنمای نصب نسخه‌ی جدید روی سرور.md";;
esac

# ───────────── ۲) پیش‌نیازها ─────────────
step "بررسی پیش‌نیازها"
MISSING=()
for c in curl openssl python3; do
  if command -v "$c" >/dev/null 2>&1; then ok "$c نصب است"; else warn "$c نصب نیست"; MISSING+=("$c"); fi
done
docker_ready() { docker compose version >/dev/null 2>&1 && docker info >/dev/null 2>&1; }
if docker_ready; then ok "Docker و Docker Compose آماده‌اند"; NEED_DOCKER=0; else warn "Docker یا Docker Compose نصب/آماده نیست"; NEED_DOCKER=1; fi

if [ "${MODE:-install}" = "check" ]; then
  [ ${#MISSING[@]} -eq 0 ] && [ "$NEED_DOCKER" = "0" ] && ok "همه‌ی پیش‌نیازها آماده است" || warn "در حالت «نصب» موارد بالا خودکار نصب می‌شوند"
  step "بررسی دسترسی به ریجستری"
  if command -v curl >/dev/null 2>&1; then
    code=$(curl -sS -m 15 -o /dev/null -w "%{http_code}" "https://$HOST/v2/" 2>/dev/null || echo 000)
    case "$code" in 200|401) ok "ریجستری $HOST در دسترس است";; *) fail "سرور به ریجستری $HOST نمی‌رسد (کد $code). اتصال اینترنت/فایروال سرور را بررسی کنید";; esac
  else
    warn "curl نصب نیست؛ دسترسی به ریجستری بعد از نصب پیش‌نیازها بررسی می‌شود"
  fi
  echo "##RESULT {\"check\":true}"
  exit 0
fi

if [ ${#MISSING[@]} -gt 0 ]; then
  step "نصب ${MISSING[*]}"
  run apt-get update -y || warn "apt-get update خطا داد؛ ادامه می‌دهیم"
  run apt-get install -y "${MISSING[@]}" || fail "نصب ${MISSING[*]} انجام نشد"
  ok "نصب شد"
fi

if [ "$NEED_DOCKER" = "1" ]; then
  step "نصب Docker"
  run apt-get update -y || true
  if run apt-get install -y docker.io docker-compose-v2; then
    ok "Docker از مخزن سیستم‌عامل نصب شد"
  else
    warn "نصب از مخزن سیستم‌عامل نشد؛ تلاش با اسکریپت رسمی Docker"
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh 2>/dev/null || fail "دانلود اسکریپت Docker ممکن نشد. اینترنت سرور یا دسترسی به get.docker.com را بررسی کنید؛ یا Docker را دستی نصب کنید"
    run sh /tmp/get-docker.sh || fail "نصب Docker با اسکریپت رسمی هم شکست خورد"
    ok "Docker با اسکریپت رسمی نصب شد"
  fi
  systemctl enable --now docker >/dev/null 2>&1 || true
  for i in 1 2 3 4 5 6 7 8 9 10; do docker_ready && break; sleep 2; done
  docker_ready || fail "Docker نصب شد ولی آماده نیست (docker info / docker compose version خطا می‌دهند)"
fi

# ───────────── ۳) ریجستری ─────────────
step "ورود به ریجستری $HOST"
code=$(curl -sS -m 15 -o /dev/null -w "%{http_code}" "https://$HOST/v2/" 2>/dev/null || echo 000)
case "$code" in 200|401) ;; *) fail "سرور به ریجستری $HOST نمی‌رسد (کد $code)";; esac
if [ -n "${REG_USER:-}" ]; then
  printf '%s' "${REG_PASS:-}" | docker login "$HOST" -u "$REG_USER" --password-stdin >/tmp/erp-install-last.log 2>&1 \
    || fail "ورود به ریجستری با این نام کاربری و رمز انجام نشد"
  ok "وارد ریجستری شد"
else
  warn "نام کاربری ریجستری داده نشد؛ بدون ورود ادامه می‌دهیم"
fi

# ───────────── ۴) نسخه ─────────────
step "تعیین نسخه"
if [ -z "${REL_VERSION:-}" ]; then
  tags=$(curl -fsS -m 30 -u "${REG_USER:-x}:${REG_PASS:-x}" "https://$HOST/v2/$RELEASE_REPO/tags/list" 2>/dev/null) || fail "فهرست نسخه‌ها از ریجستری خوانده نشد"
  REL_VERSION=$(printf '%s' "$tags" | python3 -c 'import sys,json,re
t=[x for x in json.load(sys.stdin).get("tags") or [] if re.fullmatch(r"\d+\.\d+\.\d+",x)]
t.sort(key=lambda v:tuple(map(int,v.split("."))))
print(t[-1] if t else "")') || true
  [ -n "$REL_VERSION" ] || fail "هیچ نسخه‌ای در ریجستری پیدا نشد"
  ok "آخرین نسخه: $REL_VERSION"
else
  ok "نسخه‌ی انتخابی: $REL_VERSION"
fi

# ───────────── ۵) پوشه‌ی نصب ─────────────
step "آماده‌سازی پوشه‌ی $DIR"
if [ -f "$DIR/.env" ] && [ "${FORCE:-0}" != "1" ]; then
  fail "در $DIR قبلاً نصبی هست. برای به‌روزرسانی از صفحه‌ی /management استفاده کنید؛ برای نصب دوباره نام دیگری بدهید"
fi
mkdir -p "$DIR" && cd "$DIR" || fail "ساخت پوشه‌ی $DIR ممکن نشد"
ok "$DIR"

# ───────────── ۶) فایل compose همین نسخه (از manifest امضاشده در ریجستری) ─────────────
step "دریافت فایل compose نسخه‌ی $REL_VERSION"
REL="$REGISTRY/accounting-erp-release:$REL_VERSION"
run docker pull "$REL" || fail "ایمیج نسخه ($REL) دریافت نشد؛ شماره‌ی نسخه یا دسترسی را بررسی کنید"
docker inspect --format '{{index .Config.Labels "erp.release.manifest"}}' "$REL" | base64 -d 2>/dev/null \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['compose'],end='')" > docker-compose.prod.yml 2>/dev/null
grep -q '^services:' docker-compose.prod.yml 2>/dev/null || fail "فایل compose از manifest خوانده نشد"
ok "docker-compose.prod.yml"

# ───────────── ۷) پورت‌ها ─────────────
step "انتخاب پورت‌های آزاد"
port_free() { ! ss -ltn 2>/dev/null | awk 'NR>1{print $4}' | grep -qE "[:.]$1\$"; }
pick_port() { p=$1; while ! port_free "$p"; do p=$((p+100)); [ "$p" -gt 60000 ] && fail "پورت آزاد پیدا نشد"; done; echo "$p"; }
BP=$(pick_port 4000); FP=$(pick_port 5173)
ok "API روی $BP و وب روی $FP"

# ───────────── ۸) ایمیج دیتابیس ─────────────
step "ایمیج دیتابیس"
DBIMG="postgres:16-alpine"
if docker image inspect "$DBIMG" >/dev/null 2>&1; then
  ok "$DBIMG روی همین سرور هست"
elif timeout 180 docker pull "$DBIMG" >/tmp/erp-install-last.log 2>&1; then
  ok "$DBIMG از Docker Hub گرفته شد"
elif timeout 180 docker pull "$REGISTRY/postgres:16-alpine" >/tmp/erp-install-last.log 2>&1; then
  DBIMG="$REGISTRY/postgres:16-alpine"; ok "ایمیج دیتابیس از ریجستری خودمان گرفته شد"
else
  fail "ایمیج دیتابیس (postgres:16-alpine) نه از Docker Hub و نه از ریجستری ($REGISTRY/postgres:16-alpine) گرفته نشد. یک‌بار آن را روی رایانه‌ای با اینترنت آزاد در ریجستری بگذارید (docker pull / tag / push)"
fi

# ───────────── ۹) .env ─────────────
step "ساخت تنظیمات (.env) با رمزهای تصادفی"
SIP="${SERVER_IP:-$(hostname -I | awk '{print $1}')}"
{
  echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
  echo "JWT_SECRET=$(openssl rand -base64 32)"
  echo "UPDATER_TOKEN=$(openssl rand -hex 32)"
  echo "ERP_REGISTRY=$REGISTRY"
  echo "ERP_VERSION=$REL_VERSION"
  echo "VITE_API_URL=http://$SIP:$BP/api"
  [ "$DBIMG" != "postgres:16-alpine" ] && echo "DB_IMAGE=$DBIMG"
} > .env
chmod 600 .env
if grep -q 'BACKEND_PORT' docker-compose.prod.yml; then
  { echo "BACKEND_PORT=$BP"; echo "FRONTEND_PORT=$FP"; } >> .env
else
  sed -i "s/- \"4000:4000\"/- \"$BP:4000\"/; s/- \"5173:5173\"/- \"$FP:5173\"/" docker-compose.prod.yml
fi
ok ".env ساخته شد"

# ───────────── ۱۰) دریافت ایمیج‌ها و اجرا ─────────────
step "دریافت ایمیج‌های برنامه (چند دقیقه طول می‌کشد)"
run docker compose -f docker-compose.prod.yml pull backend frontend updater || fail "دریافت ایمیج‌ها شکست خورد"
ok "ایمیج‌ها دریافت شد"

step "بالا آوردن سرویس‌ها"
run docker compose -f docker-compose.prod.yml up -d || fail "docker compose up خطا داد"
ok "سرویس‌ها اجرا شدند"

step "انتظار برای آماده شدن (مهاجرت‌های دیتابیس)"
READY=0
for i in $(seq 1 60); do
  if [ "$(curl -s -m 5 "http://127.0.0.1:$BP/api/health" 2>/dev/null)" = '{"ok":true}' ]; then READY=1; break; fi
  sleep 4
done
if [ "$READY" != "1" ]; then
  docker compose -f docker-compose.prod.yml logs --tail 20 backend 2>&1 | sed 's/^/   /'
  fail "backend تا ۴ دقیقه آماده نشد؛ لاگ بالا را بررسی کنید"
fi
ok "backend سالم است"

if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow "$BP/tcp" >/dev/null 2>&1 && ufw allow "$FP/tcp" >/dev/null 2>&1 && ok "پورت‌های $BP و $FP در فایروال باز شد"
fi

echo "##RESULT {\"web\":\"http://$SIP:$FP\",\"manage\":\"http://$SIP:$FP/management\",\"dir\":\"$DIR\",\"version\":\"$REL_VERSION\",\"apiPort\":$BP,\"webPort\":$FP}"
