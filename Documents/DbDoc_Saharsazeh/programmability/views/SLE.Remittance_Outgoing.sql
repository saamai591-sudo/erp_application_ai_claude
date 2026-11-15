
/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 10/08/95 09:08:13 صبح
 ************************************************************/

CREATE VIEW [SLE].[Remittance_Outgoing]
AS 


SELECT oi.RemittanceItemID,
       oi.OutgoingItemID
FROM   stc.OutgoingItem AS oi
WHERE  oi.RemittanceItemID IS NOT null       
        Union                  
SELECT ii.RemittanceItemID,
       oi2.OutgoingItemID
FROM   SLE.InvoiceItem             AS ii
       INNER JOIN STC.OutgoingItem  AS oi2
            ON  oi2.InvoiceItemID = ii.InvoiceItemID
  WHERE  ii.RemittanceItemID IS NOT null   
   UNION
                          
SELECT ri2.RemittanceItemID,
       oi3.OutgoingItemID
FROM   sle.RemittanceItem           AS ri2
       INNER JOIN SLE.InvoiceItem   AS ii
            ON  ii.InvoiceItemID = ri2.InvoiceItemID
       INNER JOIN STC.OutgoingItem  AS oi3
            ON  oi3.OutgoingItemID = ii.OutgoingItemId
                          
WHERE  ri2.RemittanceItemID IS NOT null  

