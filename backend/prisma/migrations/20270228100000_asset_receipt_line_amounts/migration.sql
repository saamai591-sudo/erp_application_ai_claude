-- Asset receipt line cost moves to its own table (like DocumentItemAmount); AssetReceiptLine.amount is dropped
CREATE TYPE "AssetAmountType" AS ENUM ('WAREHOUSE_PRICING', 'PURCHASE_INVOICE', 'RELATED_COST');

CREATE TABLE "AssetReceiptLineAmount" (
    "id" SERIAL NOT NULL,
    "assetReceiptLineId" INTEGER NOT NULL,
    "priceType" "AssetAmountType" NOT NULL,
    "amount" DECIMAL(36,10) NOT NULL,
    "difference" DECIMAL(36,10) NOT NULL,
    "purchaseInvoiceLineId" INTEGER,
    "createdById" INTEGER,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetReceiptLineAmount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssetReceiptLineAmount_assetReceiptLineId_idx" ON "AssetReceiptLineAmount"("assetReceiptLineId");

ALTER TABLE "AssetReceiptLineAmount" ADD CONSTRAINT "AssetReceiptLineAmount_assetReceiptLineId_fkey" FOREIGN KEY ("assetReceiptLineId") REFERENCES "AssetReceiptLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssetReceiptLineAmount" ADD CONSTRAINT "AssetReceiptLineAmount_purchaseInvoiceLineId_fkey" FOREIGN KEY ("purchaseInvoiceLineId") REFERENCES "PurchaseInvoiceLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- existing amounts become one record each
INSERT INTO "AssetReceiptLineAmount" ("assetReceiptLineId", "priceType", "amount", "difference", "purchaseInvoiceLineId")
SELECT l."id",
       CASE WHEN r."basis" = 'WAREHOUSE_ISSUE' THEN 'WAREHOUSE_PRICING'::"AssetAmountType" ELSE 'PURCHASE_INVOICE'::"AssetAmountType" END,
       l."amount", l."amount",
       (SELECT pil."id" FROM "PurchaseInvoiceLine" pil WHERE pil."sourceAssetReceiptLineId" = l."id")
FROM "AssetReceiptLine" l
JOIN "AssetReceipt" r ON r."id" = l."assetReceiptId"
WHERE l."amount" IS NOT NULL;

ALTER TABLE "AssetReceiptLine" DROP COLUMN "amount";
