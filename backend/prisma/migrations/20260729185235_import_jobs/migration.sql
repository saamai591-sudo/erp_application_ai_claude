-- CreateEnum
CREATE TYPE "RateDirection" AS ENUM ('TO_BASE', 'FROM_BASE');

-- CreateEnum
CREATE TYPE "GeoLevel" AS ENUM ('COUNTRY', 'PROVINCE', 'CITY');

-- CreateEnum
CREATE TYPE "PartyCategory" AS ENUM ('INDIVIDUAL', 'LEGAL');

-- CreateEnum
CREATE TYPE "LegalPartyType" AS ENUM ('LEGAL', 'SPECIAL_PARTNERSHIP', 'BANK');

-- CreateEnum
CREATE TYPE "Nationality" AS ENUM ('LOCAL', 'FOREIGN');

-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('HEAD_OFFICE', 'FACTORY', 'WAREHOUSE', 'HOME');

-- CreateEnum
CREATE TYPE "PhoneType" AS ENUM ('MOBILE', 'HEAD_OFFICE', 'FACTORY', 'WAREHOUSE', 'HOME');

-- CreateEnum
CREATE TYPE "CostCenterType" AS ENUM ('OPERATIONAL', 'SUPPORT', 'SERVICE', 'ADMIN');

-- CreateEnum
CREATE TYPE "AccountNatureGroup" AS ENUM ('BALANCE_SHEET', 'PROFIT_LOSS', 'MEMORANDUM');

-- CreateEnum
CREATE TYPE "AccountNatureDetail" AS ENUM ('ASSET', 'LIABILITY', 'REVENUE', 'EXPENSE', 'MEMORANDUM');

-- CreateEnum
CREATE TYPE "BalanceNature" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED');

-- CreateEnum
CREATE TYPE "OpeningClosingType" AS ENUM ('OPENING', 'CLOSING');

-- CreateTable
CREATE TABLE "Permission" (
    "id" SERIAL NOT NULL,
    "module" TEXT NOT NULL,
    "form" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "mobile" VARCHAR(10) NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "Currency" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "decimalPlaces" INTEGER NOT NULL DEFAULT 2,
    "isBase" BOOLEAN NOT NULL DEFAULT false,
    "rateDirection" "RateDirection",
    "baseVolume" INTEGER NOT NULL DEFAULT 1,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "currencyId" INTEGER NOT NULL,
    "rate" DECIMAL(18,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalPeriod" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title" VARCHAR(4) NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiscalPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgStructure" (
    "id" SERIAL NOT NULL,
    "parentId" INTEGER,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "OrgStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoRegion" (
    "id" SERIAL NOT NULL,
    "parentId" INTEGER,
    "level" "GeoLevel" NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "GeoRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetailType" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "codeLength" INTEGER NOT NULL DEFAULT 5,
    "startNumber" INTEGER NOT NULL,
    "endNumber" INTEGER NOT NULL,
    "manualEntry" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DetailType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetailCodeUsage" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "detailTypeId" INTEGER NOT NULL,
    "entityTable" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DetailCodeUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" SERIAL NOT NULL,
    "detailCode" TEXT NOT NULL,
    "category" "PartyCategory" NOT NULL,
    "nationality" "Nationality" NOT NULL DEFAULT 'LOCAL',
    "nationalId" TEXT,
    "foreignId" TEXT,
    "economicCode" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "legalType" "LegalPartyType",
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyAddress" (
    "id" SERIAL NOT NULL,
    "partyId" INTEGER NOT NULL,
    "type" "AddressType" NOT NULL,
    "cityId" INTEGER NOT NULL,
    "address" TEXT,
    "postalCode" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PartyAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyPhone" (
    "id" SERIAL NOT NULL,
    "partyId" INTEGER NOT NULL,
    "type" "PhoneType" NOT NULL,
    "number" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PartyPhone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyBankAccount" (
    "id" SERIAL NOT NULL,
    "partyId" INTEGER NOT NULL,
    "bankPartyId" INTEGER,
    "accountNumber" TEXT,
    "iban" TEXT,
    "cardNumber" TEXT,

    CONSTRAINT "PartyBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccountType" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "hasChequeBook" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BankAccountType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankBranch" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "bankPartyId" INTEGER NOT NULL,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BankBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" SERIAL NOT NULL,
    "detailCode" TEXT NOT NULL,
    "accountTypeId" INTEGER NOT NULL,
    "bankBranchId" INTEGER NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "currencyId" INTEGER,
    "bankPartyId" INTEGER,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCenter" (
    "id" SERIAL NOT NULL,
    "detailCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "CostCenterType" NOT NULL DEFAULT 'ADMIN',
    "orgUnitId" INTEGER NOT NULL,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgUnit" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "orgStructureId" INTEGER NOT NULL,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OrgUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashBox" (
    "id" SERIAL NOT NULL,
    "detailCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CashBox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportingLevel" (
    "id" SERIAL NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "codeLength" INTEGER NOT NULL,

    CONSTRAINT "ReportingLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" SERIAL NOT NULL,
    "parentId" INTEGER,
    "levelId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "natureGroup" "AccountNatureGroup",
    "natureDetail" "AccountNatureDetail",
    "balanceNature" "BalanceNature",
    "isCurrency" BOOLEAN NOT NULL DEFAULT false,
    "isRevaluable" BOOLEAN NOT NULL DEFAULT false,
    "detailType1Id" INTEGER,
    "detailType2Id" INTEGER,
    "detailType3Id" INTEGER,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentType" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "systemKey" TEXT,

    CONSTRAINT "DocumentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "referenceNumber" INTEGER NOT NULL,
    "dailyNumber" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "documentTypeId" INTEGER NOT NULL,
    "description" TEXT,
    "status" "JournalEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "issuingSystem" TEXT NOT NULL DEFAULT 'حسابداری',
    "isManual" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntrySource" (
    "id" SERIAL NOT NULL,
    "journalEntryId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntrySource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntryLine" (
    "id" SERIAL NOT NULL,
    "journalEntryId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "detail1Code" TEXT,
    "detail2Code" TEXT,
    "detail3Code" TEXT,
    "currencyId" INTEGER NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "fxRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "baseDebit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "baseCredit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JournalEntryLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountClosing" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "destinationAccountId" INTEGER NOT NULL,
    "detail1Code" TEXT,
    "detail2Code" TEXT,
    "detail3Code" TEXT,
    "description" TEXT NOT NULL,
    "totalDebit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalCredit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "difference" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "journalEntryId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountClosing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountClosingLine" (
    "id" SERIAL NOT NULL,
    "closingId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "detail1Code" TEXT,
    "detail2Code" TEXT,
    "detail3Code" TEXT,
    "currencyId" INTEGER NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "fxRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "baseDebit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "baseCredit" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "AccountClosingLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningClosingEntry" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "type" "OpeningClosingType" NOT NULL,
    "description" TEXT NOT NULL,
    "journalEntryId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpeningClosingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" SERIAL NOT NULL,
    "entityType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "resultData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Role_title_key" ON "Role"("title");

-- CreateIndex
CREATE UNIQUE INDEX "User_code_key" ON "User"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_mobile_key" ON "User"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "Currency_code_key" ON "Currency"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Currency_title_key" ON "Currency"("title");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_date_currencyId_key" ON "ExchangeRate"("date", "currencyId");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalPeriod_code_key" ON "FiscalPeriod"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalPeriod_title_key" ON "FiscalPeriod"("title");

-- CreateIndex
CREATE UNIQUE INDEX "OrgStructure_parentId_code_key" ON "OrgStructure"("parentId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "GeoRegion_parentId_code_key" ON "GeoRegion"("parentId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "DetailType_code_key" ON "DetailType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DetailType_title_key" ON "DetailType"("title");

-- CreateIndex
CREATE UNIQUE INDEX "DetailCodeUsage_code_key" ON "DetailCodeUsage"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Party_detailCode_key" ON "Party"("detailCode");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccountType_code_key" ON "BankAccountType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccountType_title_key" ON "BankAccountType"("title");

-- CreateIndex
CREATE UNIQUE INDEX "BankBranch_title_key" ON "BankBranch"("title");

-- CreateIndex
CREATE UNIQUE INDEX "BankBranch_bankPartyId_code_key" ON "BankBranch"("bankPartyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_detailCode_key" ON "BankAccount"("detailCode");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_bankPartyId_accountNumber_key" ON "BankAccount"("bankPartyId", "accountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_detailCode_key" ON "CostCenter"("detailCode");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_title_key" ON "CostCenter"("title");

-- CreateIndex
CREATE UNIQUE INDEX "OrgUnit_code_key" ON "OrgUnit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "OrgUnit_title_key" ON "OrgUnit"("title");

-- CreateIndex
CREATE UNIQUE INDEX "CashBox_detailCode_key" ON "CashBox"("detailCode");

-- CreateIndex
CREATE UNIQUE INDEX "CashBox_title_key" ON "CashBox"("title");

-- CreateIndex
CREATE UNIQUE INDEX "ReportingLevel_order_key" ON "ReportingLevel"("order");

-- CreateIndex
CREATE UNIQUE INDEX "ReportingLevel_title_key" ON "ReportingLevel"("title");

-- CreateIndex
CREATE UNIQUE INDEX "Account_parentId_code_key" ON "Account"("parentId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentType_code_key" ON "DocumentType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentType_title_key" ON "DocumentType"("title");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentType_systemKey_key" ON "DocumentType"("systemKey");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_fiscalPeriodId_number_key" ON "JournalEntry"("fiscalPeriodId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "AccountClosing_journalEntryId_key" ON "AccountClosing"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountClosing_fiscalPeriodId_number_key" ON "AccountClosing"("fiscalPeriodId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "OpeningClosingEntry_journalEntryId_key" ON "OpeningClosingEntry"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "OpeningClosingEntry_fiscalPeriodId_type_key" ON "OpeningClosingEntry"("fiscalPeriodId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "OpeningClosingEntry_fiscalPeriodId_number_key" ON "OpeningClosingEntry"("fiscalPeriodId", "number");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgStructure" ADD CONSTRAINT "OrgStructure_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrgStructure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoRegion" ADD CONSTRAINT "GeoRegion_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "GeoRegion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetailCodeUsage" ADD CONSTRAINT "DetailCodeUsage_detailTypeId_fkey" FOREIGN KEY ("detailTypeId") REFERENCES "DetailType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyAddress" ADD CONSTRAINT "PartyAddress_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyAddress" ADD CONSTRAINT "PartyAddress_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "GeoRegion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyPhone" ADD CONSTRAINT "PartyPhone_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyBankAccount" ADD CONSTRAINT "PartyBankAccount_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankBranch" ADD CONSTRAINT "BankBranch_bankPartyId_fkey" FOREIGN KEY ("bankPartyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_accountTypeId_fkey" FOREIGN KEY ("accountTypeId") REFERENCES "BankAccountType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_bankBranchId_fkey" FOREIGN KEY ("bankBranchId") REFERENCES "BankBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_bankPartyId_fkey" FOREIGN KEY ("bankPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_orgStructureId_fkey" FOREIGN KEY ("orgStructureId") REFERENCES "OrgStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "ReportingLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_detailType1Id_fkey" FOREIGN KEY ("detailType1Id") REFERENCES "DetailType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_detailType2Id_fkey" FOREIGN KEY ("detailType2Id") REFERENCES "DetailType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_detailType3Id_fkey" FOREIGN KEY ("detailType3Id") REFERENCES "DetailType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "DocumentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntrySource" ADD CONSTRAINT "JournalEntrySource_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountClosing" ADD CONSTRAINT "AccountClosing_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountClosing" ADD CONSTRAINT "AccountClosing_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountClosing" ADD CONSTRAINT "AccountClosing_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountClosingLine" ADD CONSTRAINT "AccountClosingLine_closingId_fkey" FOREIGN KEY ("closingId") REFERENCES "AccountClosing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountClosingLine" ADD CONSTRAINT "AccountClosingLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountClosingLine" ADD CONSTRAINT "AccountClosingLine_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningClosingEntry" ADD CONSTRAINT "OpeningClosingEntry_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningClosingEntry" ADD CONSTRAINT "OpeningClosingEntry_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
