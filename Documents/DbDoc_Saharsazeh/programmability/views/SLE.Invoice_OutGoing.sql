


/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 01/08/95 03:47:53 عصر
 ************************************************************/

CREATE   VIEW [SLE].[Invoice_OutGoing]
AS 

SELECT ii.InvoiceItemID,
       oi.OutgoingItemID
FROM   sle.InvoiceItem             AS ii
       Inner JOIN STC.OutgoingItem  AS oi
            ON  oi.OutgoingItemID = ii.OutgoingItemId

UNION
                                  
SELECT oi2.InvoiceItemID,
       oi2.OutgoingItemID
FROM   stc.OutgoingItem AS oi2
WHERE oi2.InvoiceItemID IS NOT null
                          
UNION           

SELECT ri.InvoiceItemID,
       oi3.OutgoingItemID
FROM   sle.RemittanceItem           AS ri
       INNER JOIN STC.OutgoingItem  AS oi3
            ON  oi3.RemittanceItemID = ri.RemittanceItemID
WHERE ri.InvoiceItemID IS NOT null

