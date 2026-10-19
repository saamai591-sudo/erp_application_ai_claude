-- حکم کارگزینی عطف به یک «شروع همکاری» صادر می‌شود: EmploymentDecree.startRecordId = رکورد شروعِ دوره‌ای که تاریخ صدور داخل آن است
-- (تاریخ صدور قبل از اولین شروع = اولین شروع). برای هر شروع همکاری فقط یک حکم «استخدام» (ایندکس یکتای جزئی).

ALTER TABLE "EmploymentDecree" ADD COLUMN "startRecordId" INTEGER;

-- پر کردن احکام قبلی: رکورد شروع = آخرین رکورد غیرپایان که قبل از آن رکوردی نیست یا رکورد قبلی‌اش پایان است، با تاریخ ≤ تاریخ صدور،
-- به‌شرط اینکه بین آن و تاریخ صدور پایانی نیامده باشد؛ تاریخ صدورِ قبل از اولین شروع = اولین رکورد. حکم استخدامِ تکراری برای یک شروع، بدون مرجع می‌ماند.
DO $$
DECLARE
  d RECORD;
  sid INT;
  sdate DATE;
  first_date DATE;
BEGIN
  FOR d IN SELECT "id", "employeeId", "issueDate", "type" FROM "EmploymentDecree" ORDER BY "effectiveDate", "id" LOOP
    sid := NULL;
    SELECT r."id", r."effectiveDate" INTO sid, sdate
    FROM "EmployeeStatusRecord" r
    WHERE r."employeeId" = d."employeeId"
      AND r."status" NOT IN ('TERMINATED', 'RETIRED', 'ABANDONED')
      AND r."effectiveDate" <= d."issueDate"
      AND COALESCE((
        SELECT p."status" IN ('TERMINATED', 'RETIRED', 'ABANDONED')
        FROM "EmployeeStatusRecord" p
        WHERE p."employeeId" = r."employeeId" AND p."effectiveDate" < r."effectiveDate"
        ORDER BY p."effectiveDate" DESC LIMIT 1
      ), TRUE)
    ORDER BY r."effectiveDate" DESC
    LIMIT 1;

    IF sid IS NOT NULL AND EXISTS (
      SELECT 1 FROM "EmployeeStatusRecord" e
      WHERE e."employeeId" = d."employeeId" AND e."status" IN ('TERMINATED', 'RETIRED', 'ABANDONED')
        AND e."effectiveDate" > sdate AND e."effectiveDate" <= d."issueDate"
    ) THEN
      sid := NULL;
    END IF;

    IF sid IS NULL THEN
      SELECT min("effectiveDate") INTO first_date FROM "EmployeeStatusRecord" WHERE "employeeId" = d."employeeId";
      IF first_date IS NOT NULL AND d."issueDate" < first_date THEN
        SELECT "id" INTO sid FROM "EmployeeStatusRecord" WHERE "employeeId" = d."employeeId" AND "effectiveDate" = first_date;
      END IF;
    END IF;

    IF sid IS NOT NULL AND d."type" = 'HIRE' AND EXISTS (
      SELECT 1 FROM "EmploymentDecree" o WHERE o."startRecordId" = sid AND o."type" = 'HIRE' AND o."id" <> d."id"
    ) THEN
      RAISE NOTICE 'حکم % (استخدام) برای شروع همکاری تکراری است؛ بدون مرجع ماند', d."id";
      sid := NULL;
    END IF;

    UPDATE "EmploymentDecree" SET "startRecordId" = sid WHERE "id" = d."id";
  END LOOP;
END $$;

CREATE INDEX "EmploymentDecree_startRecordId_idx" ON "EmploymentDecree"("startRecordId");
ALTER TABLE "EmploymentDecree" ADD CONSTRAINT "EmploymentDecree_startRecordId_fkey" FOREIGN KEY ("startRecordId") REFERENCES "EmployeeStatusRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- برای هر شروع همکاری فقط یک حکم استخدام (Prisma ایندکس جزئی را مدل نمی‌کند؛ migrate diff آن را نشان می‌دهد)
CREATE UNIQUE INDEX "EmploymentDecree_one_hire_per_start_key" ON "EmploymentDecree"("startRecordId") WHERE "type" = 'HIRE' AND "startRecordId" IS NOT NULL;
