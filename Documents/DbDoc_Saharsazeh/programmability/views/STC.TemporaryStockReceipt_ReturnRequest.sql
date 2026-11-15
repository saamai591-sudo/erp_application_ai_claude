
/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 06/09/95 11:19:14 صبح
 ************************************************************/

CREATE VIEW [STC].[TemporaryStockReceipt_ReturnRequest]
AS 

SELECT  TemporaryStockReceiptItemID,rri.ReturnRequestItemID
  FROM REQ.ReturnRequestItem AS rri
WHERE rri.TemporaryStockReceiptItemID IS NOT NULL
