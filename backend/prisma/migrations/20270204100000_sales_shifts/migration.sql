-- شیفت فروش + شیفت/تاریخ شروع شیفت روی فروش فروشگاهی (ستون‌های فروش nullable‌اند: فروش‌های قبلی خالی می‌مانند؛ سرور برای فروش جدید/ویرایش آن‌ها را الزامی می‌کند)
CREATE TABLE "SalesShift" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "stationId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SalesShift_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SalesShift_code_key" ON "SalesShift"("code");
CREATE UNIQUE INDEX "SalesShift_stationId_title_key" ON "SalesShift"("stationId", "title");
ALTER TABLE "SalesShift" ADD CONSTRAINT "SalesShift_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "SalesStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreSale" ADD COLUMN "shiftId" INTEGER, ADD COLUMN "shiftDate" DATE;
ALTER TABLE "StoreSale" ADD CONSTRAINT "StoreSale_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "SalesShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
