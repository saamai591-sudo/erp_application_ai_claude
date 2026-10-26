-- مدیریت تردد: سقف مرخصی منفی (مثلاً تا ۱۰۰ ساعت)؛ خالی = بدون سقف
ALTER TABLE "AttendanceLeaveNegativePolicy" ADD COLUMN "limit" DECIMAL(12,4);
