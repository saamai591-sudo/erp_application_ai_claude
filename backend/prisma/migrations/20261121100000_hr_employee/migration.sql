-- منابع انسانی › پرسنلی: کارمند (نقش روی Party)، پست، انتصاب، دوره‌ی همکاری، وابستگان؛ تاریخ تولد و جنسیت روی Party

CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED');
CREATE TYPE "MilitaryStatus" AS ENUM ('NOT_APPLICABLE', 'COMPLETED', 'EXEMPT', 'SUBJECT', 'IN_SERVICE');
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'UNPAID_LEAVE', 'SICK_LEAVE', 'TERMINATED', 'RETIRED', 'SUSPENDED', 'ABANDONED');
CREATE TYPE "DependentRelation" AS ENUM ('SPOUSE', 'CHILD', 'FATHER', 'MOTHER', 'SIBLING', 'OTHER');

ALTER TABLE "Party" ADD COLUMN "birthDate" DATE, ADD COLUMN "gender" "Gender";

CREATE TABLE "EmploymentType" (
    "id" SERIAL NOT NULL, "code" INTEGER NOT NULL, "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true, "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "EmploymentType_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmploymentType_code_key" ON "EmploymentType"("code");
CREATE UNIQUE INDEX "EmploymentType_title_key" ON "EmploymentType"("title");

CREATE TABLE "EducationLevel" (
    "id" SERIAL NOT NULL, "code" INTEGER NOT NULL, "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true, "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "EducationLevel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EducationLevel_code_key" ON "EducationLevel"("code");
CREATE UNIQUE INDEX "EducationLevel_title_key" ON "EducationLevel"("title");

CREATE TABLE "TerminationReason" (
    "id" SERIAL NOT NULL, "code" INTEGER NOT NULL, "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true, "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "TerminationReason_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TerminationReason_code_key" ON "TerminationReason"("code");
CREATE UNIQUE INDEX "TerminationReason_title_key" ON "TerminationReason"("title");

CREATE TABLE "Position" (
    "id" SERIAL NOT NULL, "code" INTEGER NOT NULL, "title" TEXT NOT NULL, "orgUnitId" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false, "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Position_code_key" ON "Position"("code");
CREATE UNIQUE INDEX "Position_title_key" ON "Position"("title");
-- دقیقاً یک پست پیش‌فرض (Prisma ایندکس جزئی را مدل نمی‌کند)
CREATE UNIQUE INDEX "Position_single_default" ON "Position"("isDefault") WHERE "isDefault" = true;
ALTER TABLE "Position" ADD CONSTRAINT "Position_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Employee" (
    "id" SERIAL NOT NULL, "personnelCode" TEXT NOT NULL, "partyId" INTEGER NOT NULL,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE', "employmentTypeId" INTEGER,
    "fatherName" TEXT, "birthCertificateNumber" TEXT, "birthPlace" TEXT, "issuePlace" TEXT,
    "maritalStatus" "MaritalStatus", "educationLevelId" INTEGER, "educationField" TEXT,
    "militaryStatus" "MilitaryStatus", "insuranceNumber" TEXT,
    "hasDisability" BOOLEAN NOT NULL DEFAULT false, "isVeteran" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT, "salaryBankAccountId" INTEGER, "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Employee_personnelCode_key" ON "Employee"("personnelCode");
CREATE UNIQUE INDEX "Employee_partyId_key" ON "Employee"("partyId");
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_employmentTypeId_fkey" FOREIGN KEY ("employmentTypeId") REFERENCES "EmploymentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_educationLevelId_fkey" FOREIGN KEY ("educationLevelId") REFERENCES "EducationLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_salaryBankAccountId_fkey" FOREIGN KEY ("salaryBankAccountId") REFERENCES "PartyBankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "EmployeePhoto" (
    "employeeId" INTEGER NOT NULL, "mimeType" TEXT NOT NULL, "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "EmployeePhoto_pkey" PRIMARY KEY ("employeeId")
);
ALTER TABLE "EmployeePhoto" ADD CONSTRAINT "EmployeePhoto_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EmploymentPeriod" (
    "id" SERIAL NOT NULL, "employeeId" INTEGER NOT NULL, "startDate" DATE NOT NULL, "endDate" DATE,
    "terminationReasonId" INTEGER, "note" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmploymentPeriod_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmploymentPeriod_employeeId_idx" ON "EmploymentPeriod"("employeeId");
-- حداکثر یک دوره‌ی باز برای هر کارمند
CREATE UNIQUE INDEX "EmploymentPeriod_one_open" ON "EmploymentPeriod"("employeeId") WHERE "endDate" IS NULL;
ALTER TABLE "EmploymentPeriod" ADD CONSTRAINT "EmploymentPeriod_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmploymentPeriod" ADD CONSTRAINT "EmploymentPeriod_terminationReasonId_fkey" FOREIGN KEY ("terminationReasonId") REFERENCES "TerminationReason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "EmployeeAssignment" (
    "id" SERIAL NOT NULL, "employeeId" INTEGER NOT NULL, "positionId" INTEGER NOT NULL, "orgUnitId" INTEGER NOT NULL,
    "costCenterId" INTEGER, "projectId" INTEGER, "fromDate" DATE NOT NULL, "toDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmployeeAssignment_employeeId_idx" ON "EmployeeAssignment"("employeeId");
-- حداکثر یک انتصاب فعال برای هر کارمند
CREATE UNIQUE INDEX "EmployeeAssignment_one_open" ON "EmployeeAssignment"("employeeId") WHERE "toDate" IS NULL;
ALTER TABLE "EmployeeAssignment" ADD CONSTRAINT "EmployeeAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeAssignment" ADD CONSTRAINT "EmployeeAssignment_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeAssignment" ADD CONSTRAINT "EmployeeAssignment_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeAssignment" ADD CONSTRAINT "EmployeeAssignment_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeAssignment" ADD CONSTRAINT "EmployeeAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "EmployeeDependent" (
    "id" SERIAL NOT NULL, "employeeId" INTEGER NOT NULL, "relation" "DependentRelation" NOT NULL,
    "firstName" TEXT NOT NULL, "lastName" TEXT NOT NULL, "nationalId" TEXT, "birthDate" DATE, "gender" "Gender",
    "eligibleForChildAllowance" BOOLEAN NOT NULL DEFAULT false, "isStudent" BOOLEAN NOT NULL DEFAULT false,
    "hasDisability" BOOLEAN NOT NULL DEFAULT false, "note" TEXT,
    CONSTRAINT "EmployeeDependent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmployeeDependent_employeeId_idx" ON "EmployeeDependent"("employeeId");
ALTER TABLE "EmployeeDependent" ADD CONSTRAINT "EmployeeDependent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
