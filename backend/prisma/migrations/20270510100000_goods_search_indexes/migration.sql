-- جستجوی کالا در فرم‌ها (GET /goods-items/search): ILIKE '%…%' روی کد، بارکد و عنوان با اندیس trigram سریع می‌شود (ده‌ها هزار کالا).
-- pg_trgm جزو contrib خود PostgreSQL است؛ اگر روی یک سرور خاص قابل‌نصب نبود، مهاجرت شکست نمی‌خورد و جستجو فقط بدون اندیس (کندتر) کار می‌کند.
-- (اندیس‌ها در schema.prisma نمی‌آیند؛ مثل بقیه‌ی اندیس‌های خام، migrate diff آن‌ها را فهرست می‌کند.)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'pg_trgm در دسترس نیست؛ اندیس جستجوی کالا ساخته نمی‌شود: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE INDEX IF NOT EXISTS "GoodsItem_title_trgm_idx" ON "GoodsItem" USING gin ("title" gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS "GoodsItem_rawTitle_trgm_idx" ON "GoodsItem" USING gin ("rawTitle" gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS "GoodsItem_fullCode_trgm_idx" ON "GoodsItem" USING gin ("fullCode" gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS "GoodsItem_barcode_trgm_idx" ON "GoodsItem" USING gin ("barcode" gin_trgm_ops);
  END IF;
END $$;
