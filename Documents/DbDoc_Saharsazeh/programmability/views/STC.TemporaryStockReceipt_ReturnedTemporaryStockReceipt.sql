

/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 06/09/95 11:19:14 صبح
 ************************************************************/

Create VIEW [STC].[TemporaryStockReceipt_ReturnedTemporaryStockReceipt]
AS 


SELECT  rtsri.TemporaryStockReceiptItemID,rtsri.ReturnedTemporaryStockReceiptItemID
  FROM STC.ReturnedTemporaryStockReceiptItem AS rtsri
WHERE rtsri.TemporaryStockReceiptItemID IS NOT NULL

UNION 


SELECT  rri.TemporaryStockReceiptItemID,rtsri.ReturnedTemporaryStockReceiptItemID
  FROM REQ.ReturnRequestItem AS rri
INNER JOIN STC.ReturnedTemporaryStockReceiptItem AS rtsri
          ON rtsri.ReturnRequestItemID = rri.ReturnRequestItemID
WHERE rri.TemporaryStockReceiptItemID IS NOT null

