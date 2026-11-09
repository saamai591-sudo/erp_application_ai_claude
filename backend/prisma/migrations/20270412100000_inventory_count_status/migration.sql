-- وضعیت شمارش انبار: مغایرت‌گیری حتی بدون مغایرت (و بدون سند) وضعیت را «مغایرت‌گیری شده» می‌کند
CREATE TYPE "InventoryCountStatus" AS ENUM ('REGISTERED', 'RECONCILED');
ALTER TABLE "InventoryCount" ADD COLUMN "status" "InventoryCountStatus" NOT NULL DEFAULT 'REGISTERED';
ALTER TABLE "InventoryCount" ADD COLUMN "reconciledAt" TIMESTAMP(3);
UPDATE "InventoryCount" c SET "status" = 'RECONCILED', "reconciledAt" = now() WHERE EXISTS (SELECT 1 FROM "InventoryDocument" d WHERE d."countId" = c.id);
