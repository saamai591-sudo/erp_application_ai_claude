-- CreateEnum
CREATE TYPE "PurchaseRequestBasis" AS ENUM ('NO_BASIS', 'SUPPLY_REQUEST');

-- CreateEnum
CREATE TYPE "PurchaseOrderBasis" AS ENUM ('NO_BASIS', 'PRICE_INQUIRY');

-- CreateEnum
CREATE TYPE "DeliveryReceiptType" AS ENUM ('INSPECTED', 'TO_BE_INSPECTED');

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "basis" "PurchaseRequestBasis" NOT NULL,
    "orgUnitId" INTEGER NOT NULL,
    "description" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewerId" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "approverId" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequestLine" (
    "id" SERIAL NOT NULL,
    "purchaseRequestId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceSupplyRequestLineId" INTEGER,
    "goodsItemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL,
    "description" TEXT,

    CONSTRAINT "PurchaseRequestLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchasePlanning" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "neededDate" DATE,
    "purchaseGroupId" INTEGER NOT NULL,
    "description" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "purchaseExpertId" INTEGER,
    "purchaseRouteId" INTEGER,
    "allowMultiSupplierPerLine" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchasePlanning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchasePlanningStage1Row" (
    "id" SERIAL NOT NULL,
    "purchasePlanningId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "purchaseRequestLineId" INTEGER NOT NULL,
    "goodsItemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL,
    "description" TEXT,

    CONSTRAINT "PurchasePlanningStage1Row_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchasePlanningStage2Row" (
    "id" SERIAL NOT NULL,
    "purchasePlanningId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "goodsItemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL,
    "estimatedAmount" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "PurchasePlanningStage2Row_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InquiryAuthorization" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "purchasePlanningId" INTEGER NOT NULL,
    "description" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InquiryAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InquiryAuthorizationLine" (
    "id" SERIAL NOT NULL,
    "inquiryAuthorizationId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "supplierId" INTEGER NOT NULL,
    "description" TEXT,

    CONSTRAINT "InquiryAuthorizationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceInquiry" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "purchasePlanningId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "validUntil" DATE NOT NULL,
    "currencyId" INTEGER NOT NULL,
    "paymentDeadline" DATE,
    "description" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceInquiryItemLine" (
    "id" SERIAL NOT NULL,
    "priceInquiryId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "planningStage2RowId" INTEGER NOT NULL,
    "goodsItemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL,
    "unitPrice" DECIMAL(36,10) NOT NULL,
    "amount" DECIMAL(36,10) NOT NULL,
    "deliveryDate" DATE NOT NULL,
    "description" TEXT,

    CONSTRAINT "PriceInquiryItemLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceInquiryOtherCostLine" (
    "id" SERIAL NOT NULL,
    "priceInquiryId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "serviceId" INTEGER NOT NULL,
    "amount" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "PriceInquiryOtherCostLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InquiryEvaluation" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "purchasePlanningId" INTEGER NOT NULL,
    "description" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InquiryEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InquiryEvaluationQuoteRow" (
    "id" SERIAL NOT NULL,
    "inquiryEvaluationId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "priceInquiryId" INTEGER NOT NULL,
    "description" TEXT,

    CONSTRAINT "InquiryEvaluationQuoteRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InquiryEvaluationItemLine" (
    "id" SERIAL NOT NULL,
    "inquiryEvaluationId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "priceInquiryItemLineId" INTEGER NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,

    CONSTRAINT "InquiryEvaluationItemLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "basis" "PurchaseOrderBasis" NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "currencyId" INTEGER NOT NULL,
    "description" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" SERIAL NOT NULL,
    "purchaseOrderId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "priceInquiryItemLineId" INTEGER,
    "goodsItemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL,
    "unitPrice" DECIMAL(36,10) NOT NULL,
    "amount" DECIMAL(36,10) NOT NULL,
    "description" TEXT,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAuthorization" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "deliveryDate" DATE NOT NULL,
    "description" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAuthorizationLine" (
    "id" SERIAL NOT NULL,
    "deliveryAuthorizationId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "purchaseOrderLineId" INTEGER NOT NULL,
    "goodsItemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL,
    "receiptType" "DeliveryReceiptType" NOT NULL,
    "description" TEXT,

    CONSTRAINT "DeliveryAuthorizationLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_fiscalPeriodId_number_key" ON "PurchaseRequest"("fiscalPeriodId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PurchasePlanning_fiscalPeriodId_number_key" ON "PurchasePlanning"("fiscalPeriodId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PurchasePlanningStage2Row_purchasePlanningId_goodsItemId_key" ON "PurchasePlanningStage2Row"("purchasePlanningId", "goodsItemId");

-- CreateIndex
CREATE UNIQUE INDEX "InquiryAuthorization_purchasePlanningId_key" ON "InquiryAuthorization"("purchasePlanningId");

-- CreateIndex
CREATE UNIQUE INDEX "InquiryAuthorization_fiscalPeriodId_number_key" ON "InquiryAuthorization"("fiscalPeriodId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "InquiryAuthorizationLine_inquiryAuthorizationId_supplierId_key" ON "InquiryAuthorizationLine"("inquiryAuthorizationId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceInquiry_fiscalPeriodId_number_key" ON "PriceInquiry"("fiscalPeriodId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "InquiryEvaluation_purchasePlanningId_key" ON "InquiryEvaluation"("purchasePlanningId");

-- CreateIndex
CREATE UNIQUE INDEX "InquiryEvaluation_fiscalPeriodId_number_key" ON "InquiryEvaluation"("fiscalPeriodId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "InquiryEvaluationQuoteRow_inquiryEvaluationId_priceInquiryI_key" ON "InquiryEvaluationQuoteRow"("inquiryEvaluationId", "priceInquiryId");

-- CreateIndex
CREATE UNIQUE INDEX "InquiryEvaluationItemLine_inquiryEvaluationId_priceInquiryI_key" ON "InquiryEvaluationItemLine"("inquiryEvaluationId", "priceInquiryItemLineId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_fiscalPeriodId_number_key" ON "PurchaseOrder"("fiscalPeriodId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryAuthorization_fiscalPeriodId_number_key" ON "DeliveryAuthorization"("fiscalPeriodId", "number");

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestLine" ADD CONSTRAINT "PurchaseRequestLine_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestLine" ADD CONSTRAINT "PurchaseRequestLine_sourceSupplyRequestLineId_fkey" FOREIGN KEY ("sourceSupplyRequestLineId") REFERENCES "SupplyRequestLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestLine" ADD CONSTRAINT "PurchaseRequestLine_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestLine" ADD CONSTRAINT "PurchaseRequestLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePlanning" ADD CONSTRAINT "PurchasePlanning_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePlanning" ADD CONSTRAINT "PurchasePlanning_purchaseGroupId_fkey" FOREIGN KEY ("purchaseGroupId") REFERENCES "PurchaseGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePlanning" ADD CONSTRAINT "PurchasePlanning_purchaseExpertId_fkey" FOREIGN KEY ("purchaseExpertId") REFERENCES "PurchaseExpert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePlanning" ADD CONSTRAINT "PurchasePlanning_purchaseRouteId_fkey" FOREIGN KEY ("purchaseRouteId") REFERENCES "PurchaseRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePlanningStage1Row" ADD CONSTRAINT "PurchasePlanningStage1Row_purchasePlanningId_fkey" FOREIGN KEY ("purchasePlanningId") REFERENCES "PurchasePlanning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePlanningStage1Row" ADD CONSTRAINT "PurchasePlanningStage1Row_purchaseRequestLineId_fkey" FOREIGN KEY ("purchaseRequestLineId") REFERENCES "PurchaseRequestLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePlanningStage1Row" ADD CONSTRAINT "PurchasePlanningStage1Row_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePlanningStage1Row" ADD CONSTRAINT "PurchasePlanningStage1Row_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePlanningStage2Row" ADD CONSTRAINT "PurchasePlanningStage2Row_purchasePlanningId_fkey" FOREIGN KEY ("purchasePlanningId") REFERENCES "PurchasePlanning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePlanningStage2Row" ADD CONSTRAINT "PurchasePlanningStage2Row_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePlanningStage2Row" ADD CONSTRAINT "PurchasePlanningStage2Row_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryAuthorization" ADD CONSTRAINT "InquiryAuthorization_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryAuthorization" ADD CONSTRAINT "InquiryAuthorization_purchasePlanningId_fkey" FOREIGN KEY ("purchasePlanningId") REFERENCES "PurchasePlanning"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryAuthorizationLine" ADD CONSTRAINT "InquiryAuthorizationLine_inquiryAuthorizationId_fkey" FOREIGN KEY ("inquiryAuthorizationId") REFERENCES "InquiryAuthorization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryAuthorizationLine" ADD CONSTRAINT "InquiryAuthorizationLine_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceInquiry" ADD CONSTRAINT "PriceInquiry_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceInquiry" ADD CONSTRAINT "PriceInquiry_purchasePlanningId_fkey" FOREIGN KEY ("purchasePlanningId") REFERENCES "PurchasePlanning"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceInquiry" ADD CONSTRAINT "PriceInquiry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceInquiry" ADD CONSTRAINT "PriceInquiry_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceInquiryItemLine" ADD CONSTRAINT "PriceInquiryItemLine_priceInquiryId_fkey" FOREIGN KEY ("priceInquiryId") REFERENCES "PriceInquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceInquiryItemLine" ADD CONSTRAINT "PriceInquiryItemLine_planningStage2RowId_fkey" FOREIGN KEY ("planningStage2RowId") REFERENCES "PurchasePlanningStage2Row"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceInquiryItemLine" ADD CONSTRAINT "PriceInquiryItemLine_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceInquiryItemLine" ADD CONSTRAINT "PriceInquiryItemLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceInquiryOtherCostLine" ADD CONSTRAINT "PriceInquiryOtherCostLine_priceInquiryId_fkey" FOREIGN KEY ("priceInquiryId") REFERENCES "PriceInquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceInquiryOtherCostLine" ADD CONSTRAINT "PriceInquiryOtherCostLine_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryEvaluation" ADD CONSTRAINT "InquiryEvaluation_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryEvaluation" ADD CONSTRAINT "InquiryEvaluation_purchasePlanningId_fkey" FOREIGN KEY ("purchasePlanningId") REFERENCES "PurchasePlanning"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryEvaluationQuoteRow" ADD CONSTRAINT "InquiryEvaluationQuoteRow_inquiryEvaluationId_fkey" FOREIGN KEY ("inquiryEvaluationId") REFERENCES "InquiryEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryEvaluationQuoteRow" ADD CONSTRAINT "InquiryEvaluationQuoteRow_priceInquiryId_fkey" FOREIGN KEY ("priceInquiryId") REFERENCES "PriceInquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryEvaluationItemLine" ADD CONSTRAINT "InquiryEvaluationItemLine_inquiryEvaluationId_fkey" FOREIGN KEY ("inquiryEvaluationId") REFERENCES "InquiryEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryEvaluationItemLine" ADD CONSTRAINT "InquiryEvaluationItemLine_priceInquiryItemLineId_fkey" FOREIGN KEY ("priceInquiryItemLineId") REFERENCES "PriceInquiryItemLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_priceInquiryItemLineId_fkey" FOREIGN KEY ("priceInquiryItemLineId") REFERENCES "PriceInquiryItemLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAuthorization" ADD CONSTRAINT "DeliveryAuthorization_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAuthorization" ADD CONSTRAINT "DeliveryAuthorization_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAuthorizationLine" ADD CONSTRAINT "DeliveryAuthorizationLine_deliveryAuthorizationId_fkey" FOREIGN KEY ("deliveryAuthorizationId") REFERENCES "DeliveryAuthorization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAuthorizationLine" ADD CONSTRAINT "DeliveryAuthorizationLine_purchaseOrderLineId_fkey" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAuthorizationLine" ADD CONSTRAINT "DeliveryAuthorizationLine_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAuthorizationLine" ADD CONSTRAINT "DeliveryAuthorizationLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
