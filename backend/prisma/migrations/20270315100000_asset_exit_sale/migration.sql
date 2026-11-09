-- Asset exit of nature SALE without invoice: counter account on the type, sale amount per item
ALTER TABLE "AssetExitType" ADD COLUMN "counterAccountId" INTEGER;
ALTER TABLE "AssetExitItem" ADD COLUMN "saleAmount" DECIMAL(36,10);
ALTER TABLE "AssetExitType" ADD CONSTRAINT "AssetExitType_counterAccountId_fkey" FOREIGN KEY ("counterAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
