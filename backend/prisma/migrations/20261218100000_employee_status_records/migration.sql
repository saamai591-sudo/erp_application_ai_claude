-- سابقه‌ی وضعیت همکاری کارمند (EmployeeStatusRecord) جای EmploymentPeriod و Employee.status را می‌گیرد.
-- هر رکورد: از «تاریخ اعمال» به بعد کارمند در این وضعیت است. وضعیت‌های پایان در «اولین روز بعد از همکاری» ثبت می‌شوند
-- (پایان قدیمیِ دوره = آخرین روز همکاری، پس رکورد پایان = endDate + 1). دوره‌ی همکاری و وضعیت جاری از همین رکوردها مشتق می‌شوند.

CREATE TABLE "EmployeeStatusRecord" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "status" "EmployeeStatus" NOT NULL,
    "terminationReasonId" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeStatusRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeeStatusRecord_employeeId_effectiveDate_key" ON "EmployeeStatusRecord"("employeeId", "effectiveDate");

ALTER TABLE "EmployeeStatusRecord" ADD CONSTRAINT "EmployeeStatusRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeStatusRecord" ADD CONSTRAINT "EmployeeStatusRecord_terminationReasonId_fkey" FOREIGN KEY ("terminationReasonId") REFERENCES "TerminationReason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- انتقال داده: هر دوره ⇒ رکورد «شاغل» در شروع + (اگر بسته بود) رکورد پایان در endDate + 1
DO $$
DECLARE
  e RECORD;
  p RECORD;
  total INT;
  n INT;
  last_end DATE;
  ended_status "EmployeeStatus";
  last_date DATE;
BEGIN
  FOR e IN SELECT "id", "status" FROM "Employee" LOOP
    SELECT count(*) INTO total FROM "EmploymentPeriod" WHERE "employeeId" = e."id";
    n := 0;
    last_end := NULL;
    FOR p IN SELECT * FROM "EmploymentPeriod" WHERE "employeeId" = e."id" ORDER BY "startDate", "id" LOOP
      n := n + 1;
      IF last_end IS NOT NULL AND p."startDate" = last_end + 1 THEN
        -- پایان قبلی و شروع این دوره در یک روزند (بدون فاصله): در مدل جدید یک تاریخ دو رکورد نمی‌گیرد، پس هر دو برداشته می‌شوند و همکاری پیوسته می‌ماند
        DELETE FROM "EmployeeStatusRecord" WHERE "employeeId" = e."id" AND "effectiveDate" = last_end + 1;
        RAISE NOTICE 'کارمند %: پایان و شروع مجدد پیوسته در % ادغام شد', e."id", p."startDate";
      ELSE
        INSERT INTO "EmployeeStatusRecord" ("employeeId", "effectiveDate", "status", "note")
        VALUES (e."id", p."startDate", 'ACTIVE', CASE WHEN p."endDate" IS NULL THEN p."note" ELSE NULL END);
      END IF;
      IF p."endDate" IS NOT NULL THEN
        -- وضعیت پایان فقط برای آخرین دوره (روی خودِ کارمند) نگه داشته شده بود؛ بقیه «خاتمه همکاری»
        ended_status := CASE WHEN n = total AND e."status" IN ('TERMINATED', 'RETIRED', 'ABANDONED') THEN e."status" ELSE 'TERMINATED' END;
        INSERT INTO "EmployeeStatusRecord" ("employeeId", "effectiveDate", "status", "terminationReasonId", "note")
        VALUES (e."id", p."endDate" + 1, ended_status, p."terminationReasonId", p."note");
        last_end := p."endDate";
      ELSE
        last_end := NULL;
      END IF;
    END LOOP;

    -- وضعیت فعلیِ مرخصی/تعلیق (تاریخچه نداشت): از امروز (یا بعد از آخرین رکورد) ثبت می‌شود
    IF e."status" IN ('UNPAID_LEAVE', 'SICK_LEAVE', 'SUSPENDED') THEN
      SELECT max("effectiveDate") INTO last_date FROM "EmployeeStatusRecord" WHERE "employeeId" = e."id";
      INSERT INTO "EmployeeStatusRecord" ("employeeId", "effectiveDate", "status")
      VALUES (e."id", GREATEST(CURRENT_DATE, COALESCE(last_date + 1, CURRENT_DATE)), e."status");
    END IF;
  END LOOP;
END $$;

ALTER TABLE "Employee" DROP COLUMN "status";
DROP TABLE "EmploymentPeriod";
