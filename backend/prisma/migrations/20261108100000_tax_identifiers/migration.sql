-- شناسه‌های مالیاتی (سامانه مودیان): شناسه ۱۳ رقمی کالا/خدمت (sstid) و کد مالیاتی واحد سنجش (mu)؛ هر دو اختیاری هنگام تعریف و فقط هنگام ارسال صورتحساب الزامی‌اند
ALTER TABLE "GoodsItem" ADD COLUMN "taxItemId" TEXT;
ALTER TABLE "UnitOfMeasure" ADD COLUMN "taxCode" TEXT;
