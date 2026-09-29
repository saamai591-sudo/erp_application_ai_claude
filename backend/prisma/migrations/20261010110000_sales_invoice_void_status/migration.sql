-- اکشن «ابطال» فاکتور فروش (routes/salesInvoices.ts#void) — فعلاً فقط SalesInvoice این مقدار را
-- می‌نویسد؛ SalesQuote/SalesOrder/SalesReturnInvoice که همین enum را به اشتراک می‌گذارند دست‌نخورده می‌مانند.
ALTER TYPE "SalesDocStatus" ADD VALUE 'VOIDED';
