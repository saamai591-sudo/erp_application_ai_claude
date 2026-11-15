
/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 06/09/95 11:02:54 صبح
 ************************************************************/

CREATE VIEW [STC].[JustificationInput_PurchaseInvoice]
AS 



SELECT sri.JustificationInputItemID,
       pii.PurchaseInvoiceItemID
FROM   stc.StockReceiptItem AS sri
INNER JOIN VND.PurchaseInvoiceItem AS pii
          ON pii.StockReceiptItemID = sri.StockReceiptItemID
WHERE  sri.JustificationInputItemID IS NOT NULL



