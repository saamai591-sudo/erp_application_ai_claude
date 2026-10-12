-- منابع انسانی: اجزای حکم و حکم کارگزینی (شامل اطلاعات قرارداد)؛ نوع همکاری از Employee به حکم منتقل می‌شود

CREATE TYPE "DecreeValueType" AS ENUM ('MONTHLY_AMOUNT', 'DAILY_AMOUNT', 'HOURLY_AMOUNT', 'PERCENT');
CREATE TYPE "DecreeType" AS ENUM ('HIRE', 'RENEWAL', 'ANNUAL_RAISE', 'PROMOTION', 'AMENDMENT');
CREATE TYPE "DecreeStatus" AS ENUM ('DRAFT', 'APPROVED');

CREATE TABLE "DecreeComponent" (
    "id" SERIAL NOT NULL, "code" INTEGER NOT NULL, "title" TEXT NOT NULL, "valueType" "DecreeValueType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true, "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "DecreeComponent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DecreeComponent_code_key" ON "DecreeComponent"("code");
CREATE UNIQUE INDEX "DecreeComponent_title_key" ON "DecreeComponent"("title");

CREATE TABLE "EmploymentDecree" (
    "id" SERIAL NOT NULL, "number" INTEGER NOT NULL, "employeeId" INTEGER NOT NULL, "type" "DecreeType" NOT NULL,
    "issueDate" DATE NOT NULL, "effectiveDate" DATE NOT NULL, "endDate" DATE, "employmentTypeId" INTEGER NOT NULL,
    "weeklyHours" DECIMAL(5,2), "description" TEXT, "status" "DecreeStatus" NOT NULL DEFAULT 'DRAFT',
    "positionId" INTEGER, "orgUnitId" INTEGER, "costCenterId" INTEGER, "appliedAssignmentId" INTEGER, "previousAssignmentId" INTEGER,
    "approvedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmploymentDecree_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmploymentDecree_number_key" ON "EmploymentDecree"("number");
CREATE INDEX "EmploymentDecree_employeeId_effectiveDate_idx" ON "EmploymentDecree"("employeeId", "effectiveDate");
-- هر کارمند در هر تاریخ اعمال حداکثر یک حکم تاییدشده (Prisma ایندکس جزئی را مدل نمی‌کند)
CREATE UNIQUE INDEX "EmploymentDecree_approved_effective_key" ON "EmploymentDecree"("employeeId", "effectiveDate") WHERE "status" = 'APPROVED';
ALTER TABLE "EmploymentDecree" ADD CONSTRAINT "EmploymentDecree_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmploymentDecree" ADD CONSTRAINT "EmploymentDecree_employmentTypeId_fkey" FOREIGN KEY ("employmentTypeId") REFERENCES "EmploymentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmploymentDecree" ADD CONSTRAINT "EmploymentDecree_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmploymentDecree" ADD CONSTRAINT "EmploymentDecree_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmploymentDecree" ADD CONSTRAINT "EmploymentDecree_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmploymentDecree" ADD CONSTRAINT "EmploymentDecree_appliedAssignmentId_fkey" FOREIGN KEY ("appliedAssignmentId") REFERENCES "EmployeeAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "EmploymentDecreeLine" (
    "id" SERIAL NOT NULL, "decreeId" INTEGER NOT NULL, "componentId" INTEGER NOT NULL, "value" DECIMAL(20,4) NOT NULL,
    CONSTRAINT "EmploymentDecreeLine_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmploymentDecreeLine_decreeId_componentId_key" ON "EmploymentDecreeLine"("decreeId", "componentId");
ALTER TABLE "EmploymentDecreeLine" ADD CONSTRAINT "EmploymentDecreeLine_decreeId_fkey" FOREIGN KEY ("decreeId") REFERENCES "EmploymentDecree"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmploymentDecreeLine" ADD CONSTRAINT "EmploymentDecreeLine_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "DecreeComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- نوع همکاری از این پس روی حکم است (کارمند هنوز در محیط‌های واقعی نیست؛ مقدار قبلی بدون حکم معنایی ندارد)
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_employmentTypeId_fkey";
ALTER TABLE "Employee" DROP COLUMN "employmentTypeId";

-- اجزای پیش‌فرض (قابل ویرایش)
INSERT INTO "DecreeComponent" ("code", "title", "valueType") VALUES
  (1, 'حقوق پایه', 'MONTHLY_AMOUNT'),
  (2, 'پایه سنوات', 'DAILY_AMOUNT'),
  (3, 'حق مسکن', 'MONTHLY_AMOUNT'),
  (4, 'بن خواروبار', 'MONTHLY_AMOUNT'),
  (5, 'حق اولاد', 'MONTHLY_AMOUNT'),
  (6, 'فوق‌العاده شغل', 'MONTHLY_AMOUNT'),
  (7, 'فوق‌العاده ایاب و ذهاب', 'MONTHLY_AMOUNT'),
  (8, 'حق مسئولیت', 'MONTHLY_AMOUNT'),
  (9, 'حق جذب', 'MONTHLY_AMOUNT')
ON CONFLICT DO NOTHING;
