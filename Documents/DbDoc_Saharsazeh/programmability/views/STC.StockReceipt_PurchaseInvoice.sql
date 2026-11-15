CREATE VIEW [STC].[StockReceipt_PurchaseInvoice]
AS
SELECT pii.StockReceiptItemID,
       pii.PurchaseInvoiceItemID,
       pii.PurchaseInvoiceID,
       sri.StockReceiptID
FROM VND.PurchaseInvoiceItem AS pii
    JOIN STC.StockReceiptItem AS sri
        ON sri.StockReceiptItemID = pii.StockReceiptItemID
UNION
SELECT sri.StockReceiptItemID,
       sri.PurchaseInvoiceItemID,
	   pii.PurchaseInvoiceID,
	   sri.StockReceiptID
FROM STC.StockReceiptItem AS sri
JOIN VND.PurchaseInvoiceItem AS pii ON pii.PurchaseInvoiceItemID = sri.PurchaseInvoiceItemID
