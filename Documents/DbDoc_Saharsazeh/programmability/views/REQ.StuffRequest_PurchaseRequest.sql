

CREATE VIEW [REQ].[StuffRequest_PurchaseRequest]
AS 


SELECT pri.StuffRequestItemID,pri.PurchaseRequestItemID
  FROM req.PurchaseRequestItem AS pri

WHERE StuffRequestItemID IS NOT null
