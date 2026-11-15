/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 06/09/95 11:02:54 صبح
 ************************************************************/

CREATE VIEW [STC].[JustificationInput_StockReceipt]
AS 



SELECT sri.JustificationInputItemID,
       sri.StockReceiptItemID
FROM   stc.StockReceiptItem AS sri
WHERE  sri.JustificationInputItemID IS NOT NULL


