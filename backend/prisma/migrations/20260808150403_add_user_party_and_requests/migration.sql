-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'REVIEWED', 'APPROVED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupplyRequestBasis" AS ENUM ('FROM_GOODS_REQUEST', 'NO_BASIS');

-- CreateEnum
CREATE TYPE "SupplyRoute" AS ENUM ('TRANSFER', 'PURCHASE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "partyId" INTEGER;

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsRequest" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "requestTypeId" INTEGER NOT NULL,
    "orgUnitId" INTEGER NOT NULL,
    "description" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewerId" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "approverId" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsRequestLine" (
    "id" SERIAL NOT NULL,
    "goodsRequestId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "goodsItemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL,
    "approvedQuantity" DECIMAL(36,10),
    "costCenterId" INTEGER,
    "projectId" INTEGER,
    "partyId" INTEGER,
    "description" TEXT,
    "approvalDescription" TEXT,

    CONSTRAINT "GoodsRequestLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyRequest" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "basis" "SupplyRequestBasis" NOT NULL,
    "route" "SupplyRoute" NOT NULL,
    "orgUnitId" INTEGER NOT NULL,
    "description" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewerId" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "approverId" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyRequestLine" (
    "id" SERIAL NOT NULL,
    "supplyRequestId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceGoodsRequestLineId" INTEGER,
    "goodsItemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL,
    "description" TEXT,

    CONSTRAINT "SupplyRequestLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Project_title_key" ON "Project"("title");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsRequest_fiscalPeriodId_number_key" ON "GoodsRequest"("fiscalPeriodId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "SupplyRequest_fiscalPeriodId_number_key" ON "SupplyRequest"("fiscalPeriodId", "number");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsRequest" ADD CONSTRAINT "GoodsRequest_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsRequest" ADD CONSTRAINT "GoodsRequest_requestTypeId_fkey" FOREIGN KEY ("requestTypeId") REFERENCES "GoodsRequestType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsRequest" ADD CONSTRAINT "GoodsRequest_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsRequest" ADD CONSTRAINT "GoodsRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsRequest" ADD CONSTRAINT "GoodsRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsRequestLine" ADD CONSTRAINT "GoodsRequestLine_goodsRequestId_fkey" FOREIGN KEY ("goodsRequestId") REFERENCES "GoodsRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsRequestLine" ADD CONSTRAINT "GoodsRequestLine_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsRequestLine" ADD CONSTRAINT "GoodsRequestLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsRequestLine" ADD CONSTRAINT "GoodsRequestLine_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsRequestLine" ADD CONSTRAINT "GoodsRequestLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsRequestLine" ADD CONSTRAINT "GoodsRequestLine_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyRequest" ADD CONSTRAINT "SupplyRequest_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyRequest" ADD CONSTRAINT "SupplyRequest_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyRequest" ADD CONSTRAINT "SupplyRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyRequest" ADD CONSTRAINT "SupplyRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyRequestLine" ADD CONSTRAINT "SupplyRequestLine_supplyRequestId_fkey" FOREIGN KEY ("supplyRequestId") REFERENCES "SupplyRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyRequestLine" ADD CONSTRAINT "SupplyRequestLine_sourceGoodsRequestLineId_fkey" FOREIGN KEY ("sourceGoodsRequestLineId") REFERENCES "GoodsRequestLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyRequestLine" ADD CONSTRAINT "SupplyRequestLine_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyRequestLine" ADD CONSTRAINT "SupplyRequestLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
