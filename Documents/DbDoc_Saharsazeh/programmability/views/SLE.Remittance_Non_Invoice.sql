
/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 01/08/95 04:06:08 عصر
 ************************************************************/

CREATE VIEW [SLE].[Remittance_Non_Invoice]
AS 

SELECT ri.RemittanceItemID,
       MainQuantity,
       SubQuantity,
       T.DoMainQuantity,
       T.DoSubQuantity,
       CASE 
            WHEN s.[Type] = 1 OR MainQuantity < DoMainQuantity THEN 0
            ELSE MainQuantity -DoMainQuantity
       END                            AS Non,
       CASE 
            WHEN s.[Type] = 1 OR SubQuantity < DoSubQuantity THEN 0
            ELSE SubQuantity -DoSubQuantity
       END                            AS SubNon
FROM   (
           SELECT ri.RemittanceItemID,
                  ISNULL(ii.MainQuantity, 0) + ISNULL(ii2.MainQuantity, 0) +
                  ISNULL(ii3.MainQuantity, 0) AS DoMainQuantity,
                  ISNULL(ii.SubQuantity, 0) + ISNULL(ii2.SubQuantity, 0) +
                  ISNULL(ii3.SubQuantity, 0) AS DoSubQuantity
           FROM   sle.RemittanceItem AS ri
                  LEFT JOIN (
                           SELECT ii.RemittanceItemID,
                                  SUM(ii.MainQuantity) AS MainQuantity,
                                  SUM(ii.SubQuantity) AS SubQuantity
                           FROM   sle.InvoiceItem AS ii
                           GROUP BY
                                  ii.RemittanceItemID
                       )ii
                       ON  ri.RemittanceItemID = ii.RemittanceItemID
                  LEFT JOIN (
                           SELECT ri2.RemittanceItemID,
                                  SUM(ii2.MainQuantity) AS MainQuantity,
                                  SUM(ii2.SubQuantity) AS SubQuantity
                           FROM   sle.RemittanceItem AS ri2
                                  INNER JOIN SLE.InvoiceItem AS ii2
                                       ON  ii2.InvoiceItemID = ri2.InvoiceItemID
                           GROUP BY
                                  ri2.RemittanceItemID
                       )ii2
                       ON  ri.RemittanceItemID = ii2.RemittanceItemID
                  LEFT JOIN (
                           SELECT oi.RemittanceItemID,
                                  SUM(ii3.MainQuantity) AS MainQuantity,
                                  SUM(ii3.SubQuantity) AS SubQuantity
                           FROM   STC.OutgoingItem AS oi
                                  LEFT JOIN SLE.InvoiceItem AS ii3
                                       ON  ii3.OutgoingItemId = oi.OutgoingItemID
                           GROUP BY
                                  oi.RemittanceItemID
                       )ii3
                       ON  ri.RemittanceItemID = ii3.RemittanceItemID
       )T
       INNER JOIN sle.RemittanceItem  AS ri
            ON  ri.RemittanceItemID = T.RemittanceItemID
       INNER JOIN STF.[Stuff]         AS s
            ON  s.StuffID = ri.StuffID
