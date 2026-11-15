CREATE VIEW [REQ].[ReturnRequest_ReturnedTemporaryStockReceipt]
AS 


SELECT    rtsri.ReturnRequestItemID,rtsri.ReturnedTemporaryStockReceiptItemID

  FROM stc.ReturnedTemporaryStockReceiptItem AS rtsri
WHERE rtsri.ReturnRequestItemID IS NOT null
