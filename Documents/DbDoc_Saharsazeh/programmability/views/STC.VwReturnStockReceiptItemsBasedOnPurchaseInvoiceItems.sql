------------------------------------- START #7690
CREATE   VIEW STC.VwReturnStockReceiptItemsBasedOnPurchaseInvoiceItems AS 
SELECT rsri.ReturnStockReceiptItemID,
       pii.PurchaseInvoiceItemID,
       rsri.Fee,
       rsri.StuffID,
       pii.Discount
FROM   stc.ReturnStockReceiptItem    AS rsri
       JOIN stc.StockReceiptItem     AS sri
            ON  sri.StockReceiptItemID = rsri.StockReceiptItemID
       JOIN vnd.PurchaseInvoiceItem  AS pii
            ON  sri.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
UNION ALL

SELECT rsri.ReturnStockReceiptItemID,
       pii.PurchaseInvoiceItemID,
       rsri.Fee,
       rsri.StuffID,
       pii.Discount
FROM   stc.ReturnStockReceiptItem    AS rsri
       JOIN stc.StockReceiptItem     AS sri
            ON  sri.StockReceiptItemID = rsri.StockReceiptItemID
       JOIN vnd.PurchaseInvoiceItem  AS pii
            ON  sri.StockReceiptItemID = pii.StockReceiptItemID
UNION ALL

SELECT rsri.ReturnStockReceiptItemID,
       pii.PurchaseInvoiceItemID,
       rsri.Fee,
       rsri.StuffID,
       pii.Discount
FROM   stc.ReturnStockReceiptItem    AS rsri
       JOIN stc.StockReceiptItem     AS sri
            ON  sri.StockReceiptItemID = rsri.StockReceiptItemID
       JOIN req.ReturnRequestItem    AS rri
            ON  rri.StockReceiptItemID = sri.StockReceiptItemID
       JOIN vnd.PurchaseInvoiceItem  AS pii
            ON  sri.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
UNION ALL
SELECT rsri.ReturnStockReceiptItemID,
       pii.PurchaseInvoiceItemID,
       rsri.Fee,
       rsri.StuffID,
       pii.Discount
FROM   stc.ReturnStockReceiptItem    AS rsri
       JOIN stc.StockReceiptItem     AS sri
            ON  sri.StockReceiptItemID = rsri.StockReceiptItemID
       JOIN req.ReturnRequestItem    AS rri
            ON  rri.StockReceiptItemID = sri.StockReceiptItemID
       JOIN vnd.PurchaseInvoiceItem  AS pii
            ON  sri.StockReceiptItemID = pii.StockReceiptItemID
