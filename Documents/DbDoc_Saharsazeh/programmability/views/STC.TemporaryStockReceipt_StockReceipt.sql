

/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 06/09/95 11:19:14 صبح
 ************************************************************/

CREATE VIEW [STC].[TemporaryStockReceipt_StockReceipt]
AS 

SELECT jii.TemporaryStockReceiptItemID,
       sri.StockReceiptItemID
FROM   STC.JustificationInputItem       AS jii
       INNER JOIN STC.StockReceiptItem  AS sri
            ON  sri.JustificationInputItemID = jii.JustificationInputItemID
WHERE  jii.TemporaryStockReceiptItemID IS NOT NULL

