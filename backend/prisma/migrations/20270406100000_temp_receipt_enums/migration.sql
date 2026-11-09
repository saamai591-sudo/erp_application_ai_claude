-- رسید موقت و برگشت رسید موقت (فقط تعدادی) + مبنای «رسید موقت» برای رسید انبار خرید
ALTER TYPE "InventoryDocumentType" ADD VALUE IF NOT EXISTS 'TEMP_RECEIPT';
ALTER TYPE "InventoryDocumentType" ADD VALUE IF NOT EXISTS 'TEMP_RECEIPT_RETURN';
ALTER TYPE "InventoryBasis" ADD VALUE IF NOT EXISTS 'TEMP_RECEIPT';
