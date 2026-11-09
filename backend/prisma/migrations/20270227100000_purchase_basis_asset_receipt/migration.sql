-- Purchase invoice basis «asset receipt» (enum value in its own migration: it can't be used in the same transaction)
ALTER TYPE "PurchaseInvoiceBasis" ADD VALUE 'ASSET_RECEIPT';
