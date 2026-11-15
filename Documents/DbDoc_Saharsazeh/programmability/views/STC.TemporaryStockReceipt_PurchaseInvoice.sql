

/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 06/09/95 11:19:14 صبح
 ************************************************************/

CREATE VIEW [STC].[TemporaryStockReceipt_PurchaseInvoice]
AS 

SELECT jii.TemporaryStockReceiptItemID,
       pii.PurchaseInvoiceItemID
FROM   STC.JustificationInputItem       AS jii
       INNER JOIN STC.StockReceiptItem  AS sri
            ON  sri.JustificationInputItemID = jii.JustificationInputItemID
    INNER JOIN VND.PurchaseInvoiceItem AS pii
              ON pii.StockReceiptItemID = sri.StockReceiptItemID
WHERE  jii.TemporaryStockReceiptItemID IS NOT NULL

