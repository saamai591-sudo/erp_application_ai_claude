FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl
# package-lock.json هم کپی می‌شود و npm ci (نه npm install) استفاده می‌شود — بدون این دو، npm در build
# لینوکسی بدون توجه به نسخه‌های قفل‌شده‌ی package-lock.json دوباره resolve می‌کند و می‌تواند برای وابستگی‌های
# پلتفرمی (مثل باینری‌های esbuild) نسخه‌ای متفاوت از نسخه‌ی بسته‌ی اصلی نصب کند (خطای زمان اجرای esbuild:
# "Host version ... does not match binary version ...").
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
EXPOSE 4000
# seed.ts کاملاً upsert-محور است (بدون هیچ delete) — هر بار اجرا امن است، پس روی دیتابیس تازه هم بدون
# قدم دستی جداگانه کار می‌کند و روی دیتابیس موجود هم فقط رکوردهای پایه/مجوزها را به‌روز نگه می‌دارد.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run seed && npm run dev"]
