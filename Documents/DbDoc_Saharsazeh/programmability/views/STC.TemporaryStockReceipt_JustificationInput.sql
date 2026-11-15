
/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 06/09/95 11:19:14 صبح
 ************************************************************/

CREATE VIEW [STC].[TemporaryStockReceipt_JustificationInput]
AS 

SELECT jii.TemporaryStockReceiptItemID,jii.JustificationInputItemID
  FROM STC.JustificationInputItem AS jii
WHERE jii.TemporaryStockReceiptItemID IS NOT null
