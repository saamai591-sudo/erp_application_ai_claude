-- منابع انسانی › سازمان ذینفع، شعب سازمان ذینفع و مشمولیت کارمند

CREATE TYPE "BeneficiaryOrgType" AS ENUM ('SOCIAL_SECURITY', 'TAX', 'OTHER');

CREATE TABLE "BeneficiaryOrg" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "type" "BeneficiaryOrgType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BeneficiaryOrg_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BeneficiaryOrg_code_key" ON "BeneficiaryOrg"("code");
CREATE UNIQUE INDEX "BeneficiaryOrg_title_key" ON "BeneficiaryOrg"("title");

CREATE TABLE "BeneficiaryBranch" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "partyId" INTEGER NOT NULL,
    "fileNumber" TEXT NOT NULL,
    "contractRow" TEXT NOT NULL DEFAULT '',
    "employer" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BeneficiaryBranch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BeneficiaryBranch_organizationId_partyId_fileNumber_contractRow_key" ON "BeneficiaryBranch"("organizationId", "partyId", "fileNumber", "contractRow");
ALTER TABLE "BeneficiaryBranch" ADD CONSTRAINT "BeneficiaryBranch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "BeneficiaryOrg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BeneficiaryBranch" ADD CONSTRAINT "BeneficiaryBranch_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "EmployeeBeneficiary" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "isIncluded" BOOLEAN NOT NULL,
    "branchId" INTEGER,

    CONSTRAINT "EmployeeBeneficiary_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmployeeBeneficiary_employeeId_organizationId_key" ON "EmployeeBeneficiary"("employeeId", "organizationId");
ALTER TABLE "EmployeeBeneficiary" ADD CONSTRAINT "EmployeeBeneficiary_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeBeneficiary" ADD CONSTRAINT "EmployeeBeneficiary_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "BeneficiaryOrg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeBeneficiary" ADD CONSTRAINT "EmployeeBeneficiary_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "BeneficiaryBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
