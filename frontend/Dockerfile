FROM node:20-alpine
WORKDIR /app
# package-lock.json هم کپی می‌شود و npm ci (نه npm install) استفاده می‌شود — همان دلیل backend/Dockerfile:
# بدون لاک‌فایل، npm در build لینوکسی وابستگی‌های پلتفرمی را دوباره resolve می‌کند و می‌تواند ناسازگار شوند.
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["node", "node_modules/vite/bin/vite.js", "--host"]
