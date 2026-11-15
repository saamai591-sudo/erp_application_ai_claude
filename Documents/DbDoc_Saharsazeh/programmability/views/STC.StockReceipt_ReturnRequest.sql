CREATE VIEW [STC].[StockReceipt_ReturnRequest]

AS 


SELECT rri.StockReceiptItemID,rri.ReturnRequestItemID
FROM req.ReturnRequestItem AS rri
WHERE rri.StockReceiptItemID IS NOT null

