
CREATE VIEW [CTM].[Order_Quotation]
AS
SELECT ji.OrderItemID,
       qi.QuotationItemID
FROM CTM.OrderItem AS oi
    JOIN SLE.JustificationItem AS ji
        ON ji.OrderItemID = oi.OrderItemID
    JOIN SLE.QuotationItem AS qi
        ON qi.JustificationItemID = ji.JustificationItemID
UNION
SELECT qi.OrderItemID,
       qi.QuotationItemID
FROM SLE.QuotationItem AS qi
WHERE qi.OrderItemID IS NOT NULL;

