-- انواع سند انبار «حواله/برگشت حواله فروش فروشگاهی» (با تایید تحویل فروش ساخته می‌شود)
ALTER TYPE "InventoryDocumentType" ADD VALUE IF NOT EXISTS 'STORE_SALE_ISSUE';
ALTER TYPE "InventoryDocumentType" ADD VALUE IF NOT EXISTS 'STORE_SALE_RETURN';
