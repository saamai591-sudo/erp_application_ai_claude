-- PurchaseInvoiceOtherCostLine جدول (۰ رکورد) با مدل جدید مشترک PurchaseCostLine جایگزین می‌شود؛ حذف
-- امن است چون هیچ رکوردی در آن ثبت نشده.
DROP TABLE "PurchaseInvoiceOtherCostLine";

-- ServicePurchaseInvoiceLine -> PurchaseCostLine (حالا بین فاکتور خرید کالا و فاکتور خرید خدمات مشترک است)
ALTER TABLE "ServicePurchaseInvoiceLine" RENAME TO "PurchaseCostLine";
ALTER TABLE "PurchaseCostLine" RENAME CONSTRAINT "ServicePurchaseInvoiceLine_pkey" TO "PurchaseCostLine_pkey";
ALTER TABLE "PurchaseCostLine" RENAME CONSTRAINT "ServicePurchaseInvoiceLine_serviceId_fkey" TO "PurchaseCostLine_serviceId_fkey";
ALTER TABLE "PurchaseCostLine" RENAME CONSTRAINT "ServicePurchaseInvoiceLine_servicePurchaseInvoiceId_fkey" TO "PurchaseCostLine_servicePurchaseInvoiceId_fkey";
ALTER TABLE "PurchaseCostLine" RENAME CONSTRAINT "ServicePurchaseInvoiceLine_sourceReceiptDocumentId_fkey" TO "PurchaseCostLine_sourceReceiptDocumentId_fkey";
ALTER SEQUENCE "ServicePurchaseInvoiceLine_id_seq" RENAME TO "PurchaseCostLine_id_seq";

-- servicePurchaseInvoiceId اختیاری می‌شود؛ purchaseInvoiceId اضافه می‌شود — دقیقاً یکی از این دو در
-- سطح اپلیکیشن (nested-create هر روت فقط FK والد خودش را ست می‌کند) پر می‌شود، نه CHECK دیتابیس.
ALTER TABLE "PurchaseCostLine" ALTER COLUMN "servicePurchaseInvoiceId" DROP NOT NULL;
ALTER TABLE "PurchaseCostLine" ADD COLUMN "purchaseInvoiceId" INTEGER;
ALTER TABLE "PurchaseCostLine" ADD CONSTRAINT "PurchaseCostLine_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- ServicePurchaseInvoiceLineAllocation -> PurchaseCostAllocation
ALTER TABLE "ServicePurchaseInvoiceLineAllocation" RENAME TO "PurchaseCostAllocation";
ALTER TABLE "PurchaseCostAllocation" RENAME COLUMN "servicePurchaseInvoiceLineId" TO "purchaseCostLineId";
ALTER TABLE "PurchaseCostAllocation" RENAME CONSTRAINT "ServicePurchaseInvoiceLineAllocation_pkey" TO "PurchaseCostAllocation_pkey";
ALTER TABLE "PurchaseCostAllocation" RENAME CONSTRAINT "ServicePurchaseInvoiceLineAllocation_inventoryDocumentLine_fkey" TO "PurchaseCostAllocation_inventoryDocumentLineId_fkey";
ALTER TABLE "PurchaseCostAllocation" RENAME CONSTRAINT "ServicePurchaseInvoiceLineAllocation_servicePurchaseInvoic_fkey" TO "PurchaseCostAllocation_purchaseCostLineId_fkey";
ALTER INDEX "ServicePurchaseInvoiceLineAllocation_servicePurchaseInvoice_key" RENAME TO "PurchaseCostAllocation_purchaseCostLineId_inventoryDocumen_key";
ALTER SEQUENCE "ServicePurchaseInvoiceLineAllocation_id_seq" RENAME TO "PurchaseCostAllocation_id_seq";

-- DocumentItemAmount.servicePurchaseInvoiceAllocationId -> purchaseCostAllocationId (همان جدول تخصیص، حالا مشترک)
ALTER TABLE "DocumentItemAmount" RENAME COLUMN "servicePurchaseInvoiceAllocationId" TO "purchaseCostAllocationId";
ALTER TABLE "DocumentItemAmount" RENAME CONSTRAINT "DocumentItemAmount_servicePurchaseInvoiceAllocationId_fkey" TO "DocumentItemAmount_purchaseCostAllocationId_fkey";
