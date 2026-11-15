
------------Start of #7537
CREATE   VIEW Stc.vwFindOutgoingItemByReturnSaleID
as
with cte AS 
(
    SELECT *
    FROM   [SLE].[Outgoing_Invoice]
) 

SELECT rsii.ReturnedSaleInvoiceItemID,
       null                                 ReturnedSaleJustificationItemID,
       OutgoingItemId
FROM   cte
       JOIN sle.ReturnedSaleInvoiceItem  AS rsii
            ON  rsii.InvoiceItemID = cte.InvoiceItemID
UNION ALL
SELECT null,
       rsji.ReturnedSaleJustificationItemID,
       OutgoingItemId
FROM   cte
       JOIN sle.ReturnedSaleJustificationItem AS rsji
            ON  rsji.InvoiceItemID = cte.InvoiceItemID
UNION ALL
SELECT rsii.ReturnedSaleInvoiceItemID,
       null,
       OutgoingItemId
FROM   cte
       JOIN sle.ReturnedSaleJustificationItem AS rsji
            ON  rsji.InvoiceItemID = cte.InvoiceItemID
       JOIN sle.ReturnedSaleInvoiceItem AS rsii
            ON  rsji.ReturnedSaleJustificationItemID = rsii.ReturnedSaleJustificationItemID
