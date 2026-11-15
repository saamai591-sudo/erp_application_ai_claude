


/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 01/08/95 03:53:00 عصر
 ************************************************************/

CREATE VIEW [SLE].[Invoice_Remittance]
AS 


SELECT ii.InvoiceItemID,
       ri.RemittanceItemID
FROM   sle.InvoiceItem ii
       INNER  JOIN SLE.RemittanceItem AS ri
            ON  ri.RemittanceItemID = ii.RemittanceItemID
                          
                          UNION
                      
SELECT InvoiceItemID,
       RemittanceItemID
FROM   SLE.RemittanceItem
WHERE InvoiceItemID IS NOT null
                     UNION
                     
SELECT ii.InvoiceItemID,
       ri.RemittanceItemID
FROM   sle.InvoiceItem ii
       INNER JOIN STC.OutgoingItem    AS oi
            ON  oi.OutgoingItemID = ii.OutgoingItemID
       INNER JOIN SLE.RemittanceItem  AS ri
            ON  oi.RemittanceItemID = ri.RemittanceItemID
                       
                      

