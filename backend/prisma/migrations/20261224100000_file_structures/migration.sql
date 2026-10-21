-- ساختار فایل (فایل‌های بانک‌ها و سازمان‌ها)

CREATE TYPE "FileSourceKind" AS ENUM ('PAYROLL_LIST');
CREATE TYPE "FileFormat" AS ENUM ('DELIMITED', 'DBF');
CREATE TYPE "FileEncoding" AS ENUM ('UTF8', 'UTF8_BOM', 'IRAN_SYSTEM');
CREATE TYPE "FileLineEnding" AS ENUM ('LF', 'CRLF');
CREATE TYPE "FileRowKind" AS ENUM ('PER_EMPLOYEE', 'SINGLE');
CREATE TYPE "FileFieldType" AS ENUM ('TEXT', 'NUMBER');
CREATE TYPE "FileFieldSource" AS ENUM ('CONSTANT', 'EMPLOYEE_FIELD', 'FACTOR_SUM', 'AGGREGATE', 'PARAM', 'EXPR', 'EMPTY');
CREATE TYPE "FileAggFunc" AS ENUM ('SUM', 'COUNT');

CREATE TABLE "FileStructure" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sourceKind" "FileSourceKind" NOT NULL DEFAULT 'PAYROLL_LIST',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "zipNameTemplate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FileStructure_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FileStructure_code_key" ON "FileStructure"("code");
CREATE UNIQUE INDEX "FileStructure_title_key" ON "FileStructure"("title");

CREATE TABLE "FileStructureFile" (
    "id" SERIAL NOT NULL,
    "structureId" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "nameTemplate" TEXT NOT NULL,
    "format" "FileFormat" NOT NULL,
    "rowKind" "FileRowKind" NOT NULL DEFAULT 'PER_EMPLOYEE',
    "delimiter" TEXT NOT NULL DEFAULT ',',
    "encoding" "FileEncoding" NOT NULL DEFAULT 'UTF8',
    "lineEnding" "FileLineEnding" NOT NULL DEFAULT 'LF',
    "trailingNewline" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "FileStructureFile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FileStructureFile_structureId_seq_key" ON "FileStructureFile"("structureId", "seq");
ALTER TABLE "FileStructureFile" ADD CONSTRAINT "FileStructureFile_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "FileStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FileStructureField" (
    "id" SERIAL NOT NULL,
    "fileId" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dataType" "FileFieldType" NOT NULL DEFAULT 'TEXT',
    "length" INTEGER,
    "decimals" INTEGER NOT NULL DEFAULT 0,
    "zeroPad" BOOLEAN NOT NULL DEFAULT false,
    "source" "FileFieldSource" NOT NULL,
    "constantValue" TEXT,
    "systemField" TEXT,
    "paramKey" TEXT,
    "aggFunc" "FileAggFunc",
    "aggFileSeq" INTEGER,
    "aggFieldName" TEXT,
    "exprText" TEXT,
    CONSTRAINT "FileStructureField_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FileStructureField_fileId_seq_key" ON "FileStructureField"("fileId", "seq");
ALTER TABLE "FileStructureField" ADD CONSTRAINT "FileStructureField_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileStructureFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FileStructureFieldRef" (
    "id" SERIAL NOT NULL,
    "fieldId" INTEGER NOT NULL,
    "payrollComponentId" INTEGER,
    "decreeComponentId" INTEGER,
    "netCalcTypeId" INTEGER,
    CONSTRAINT "FileStructureFieldRef_pkey" PRIMARY KEY ("id"),
    -- مرجع دقیقاً یکی از سه مورد است
    CONSTRAINT "FileStructureFieldRef_one_ref" CHECK (
      (("payrollComponentId" IS NOT NULL)::int + ("decreeComponentId" IS NOT NULL)::int + ("netCalcTypeId" IS NOT NULL)::int) = 1
    )
);
CREATE INDEX "FileStructureFieldRef_fieldId_idx" ON "FileStructureFieldRef"("fieldId");
CREATE UNIQUE INDEX "FileStructureFieldRef_fieldId_payrollComponentId_key" ON "FileStructureFieldRef"("fieldId", "payrollComponentId");
CREATE UNIQUE INDEX "FileStructureFieldRef_fieldId_decreeComponentId_key" ON "FileStructureFieldRef"("fieldId", "decreeComponentId");
CREATE UNIQUE INDEX "FileStructureFieldRef_fieldId_netCalcTypeId_key" ON "FileStructureFieldRef"("fieldId", "netCalcTypeId");
ALTER TABLE "FileStructureFieldRef" ADD CONSTRAINT "FileStructureFieldRef_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "FileStructureField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileStructureFieldRef" ADD CONSTRAINT "FileStructureFieldRef_payrollComponentId_fkey" FOREIGN KEY ("payrollComponentId") REFERENCES "PayrollComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FileStructureFieldRef" ADD CONSTRAINT "FileStructureFieldRef_decreeComponentId_fkey" FOREIGN KEY ("decreeComponentId") REFERENCES "DecreeComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FileStructureFieldRef" ADD CONSTRAINT "FileStructureFieldRef_netCalcTypeId_fkey" FOREIGN KEY ("netCalcTypeId") REFERENCES "PayrollCalcType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "FileStructureFieldMap" (
    "id" SERIAL NOT NULL,
    "fieldId" INTEGER NOT NULL,
    "sourceValue" TEXT NOT NULL,
    "targetValue" TEXT NOT NULL,
    CONSTRAINT "FileStructureFieldMap_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FileStructureFieldMap_fieldId_sourceValue_key" ON "FileStructureFieldMap"("fieldId", "sourceValue");
ALTER TABLE "FileStructureFieldMap" ADD CONSTRAINT "FileStructureFieldMap_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "FileStructureField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
