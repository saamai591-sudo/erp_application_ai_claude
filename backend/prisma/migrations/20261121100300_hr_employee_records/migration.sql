-- منابع انسانی: سوابق تاریخ‌دار تحصیلی / ایثارگری / تاهل به‌صورت موجودیت مستقل؛ حذف مقدار فعلی از Employee

CREATE TABLE "EmployeeEducationRecord" (
    "id" SERIAL NOT NULL, "employeeId" INTEGER NOT NULL, "effectiveDate" DATE NOT NULL,
    "educationLevelId" INTEGER NOT NULL, "field" TEXT, "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmployeeEducationRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmployeeEducationRecord_employeeId_effectiveDate_key" ON "EmployeeEducationRecord"("employeeId", "effectiveDate");
ALTER TABLE "EmployeeEducationRecord" ADD CONSTRAINT "EmployeeEducationRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeEducationRecord" ADD CONSTRAINT "EmployeeEducationRecord_educationLevelId_fkey" FOREIGN KEY ("educationLevelId") REFERENCES "EducationLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "EmployeeVeteranRecord" (
    "id" SERIAL NOT NULL, "employeeId" INTEGER NOT NULL, "effectiveDate" DATE NOT NULL,
    "isVeteran" BOOLEAN NOT NULL, "percent" DECIMAL(5,2), "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmployeeVeteranRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmployeeVeteranRecord_employeeId_effectiveDate_key" ON "EmployeeVeteranRecord"("employeeId", "effectiveDate");
ALTER TABLE "EmployeeVeteranRecord" ADD CONSTRAINT "EmployeeVeteranRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EmployeeMaritalRecord" (
    "id" SERIAL NOT NULL, "employeeId" INTEGER NOT NULL, "effectiveDate" DATE NOT NULL,
    "maritalStatus" "MaritalStatus" NOT NULL, "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmployeeMaritalRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmployeeMaritalRecord_employeeId_effectiveDate_key" ON "EmployeeMaritalRecord"("employeeId", "effectiveDate");
ALTER TABLE "EmployeeMaritalRecord" ADD CONSTRAINT "EmployeeMaritalRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- انتقال مقدار فعلی کارمندان موجود به اولین سابقه (تاریخ = شروع اولین دوره‌ی همکاری)
INSERT INTO "EmployeeEducationRecord" ("employeeId", "effectiveDate", "educationLevelId", "field", "updatedAt")
SELECT e."id", COALESCE((SELECT MIN(p."startDate") FROM "EmploymentPeriod" p WHERE p."employeeId" = e."id"), CURRENT_DATE),
       e."educationLevelId", e."educationField", CURRENT_TIMESTAMP
FROM "Employee" e WHERE e."educationLevelId" IS NOT NULL;

INSERT INTO "EmployeeVeteranRecord" ("employeeId", "effectiveDate", "isVeteran", "updatedAt")
SELECT e."id", COALESCE((SELECT MIN(p."startDate") FROM "EmploymentPeriod" p WHERE p."employeeId" = e."id"), CURRENT_DATE),
       e."isVeteran", CURRENT_TIMESTAMP
FROM "Employee" e;

INSERT INTO "EmployeeMaritalRecord" ("employeeId", "effectiveDate", "maritalStatus", "updatedAt")
SELECT e."id", COALESCE((SELECT MIN(p."startDate") FROM "EmploymentPeriod" p WHERE p."employeeId" = e."id"), CURRENT_DATE),
       e."maritalStatus", CURRENT_TIMESTAMP
FROM "Employee" e WHERE e."maritalStatus" IS NOT NULL;

ALTER TABLE "Employee" DROP CONSTRAINT "Employee_educationLevelId_fkey";
ALTER TABLE "Employee" DROP COLUMN "maritalStatus", DROP COLUMN "educationLevelId", DROP COLUMN "educationField", DROP COLUMN "isVeteran";
