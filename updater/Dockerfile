# سرویس «updater» — تنها بخشی از نصب که به docker دسترسی دارد (docker.sock). فقط از بک‌اند درخواست می‌گیرد، فقط امضای معتبر را اجرا می‌کند.
# بدون وابستگی npm؛ فقط Node + docker-cli + compose plugin.
FROM node:20-alpine
RUN apk add --no-cache docker-cli docker-cli-compose
WORKDIR /app
COPY server.mjs ./
ENV NODE_ENV=production
EXPOSE 4100
USER root
CMD ["node", "server.mjs"]
