
/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 10/08/95 09:07:15 صبح
 ************************************************************/

CREATE VIEW [SLE].[Remittance_Invoice]
AS 


SELECT ii.RemittanceItemID,
       ii.InvoiceItemID
FROM   sle.InvoiceItem AS ii
WHERE ii.RemittanceItemID IS NOT null
  UNION                        
SELECT ri2.RemittanceItemID,
       ii2.InvoiceItemID
FROM   sle.RemittanceItem          AS ri2
       INNER JOIN SLE.InvoiceItem  AS ii2
            ON  ii2.InvoiceItemID = ri2.InvoiceItemID
            WHERE ri2.RemittanceItemID IS NOT null
 UNION                        
SELECT oi.RemittanceItemID,
       ii3.InvoiceItemID
FROM   STC.OutgoingItem           AS oi
       INNER JOIN SLE.InvoiceItem  AS ii3
            ON  ii3.OutgoingItemId = oi.OutgoingItemID
                         
WHERE oi.RemittanceItemID IS NOT null

