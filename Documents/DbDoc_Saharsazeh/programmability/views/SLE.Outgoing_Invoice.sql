


/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 01/08/95 04:05:46 عصر
 ************************************************************/

CREATE VIEW [SLE].[Outgoing_Invoice]
AS 


					
SELECT oi2.OutgoingItemId,
       ii.InvoiceItemID
FROM   SLE.InvoiceItem              AS ii
       INNER JOIN STC.OutgoingItem  AS oi2
            ON  oi2.InvoiceItemID = ii.InvoiceItemID
WHERE oi2.OutgoingItemId IS NOT null
UNION						
SELECT ii.OutgoingItemId,
      ii.InvoiceItemID
FROM   SLE.InvoiceItem       AS ii
WHERE ii.OutgoingItemId IS NOT null
UNION						
					
SELECT oi.OutgoingItemId,
      ii3.InvoiceItemID
FROM   STC.OutgoingItem oi
       INNER JOIN SLE.RemittanceItem  AS ri
            ON  ri.RemittanceItemID = oi.RemittanceItemID
       INNER JOIN SLE.InvoiceItem     AS ii3
            ON  ii3.InvoiceItemID = ri.InvoiceItemID
WHERE oi.OutgoingItemId IS NOT null						
                  
                  
      


