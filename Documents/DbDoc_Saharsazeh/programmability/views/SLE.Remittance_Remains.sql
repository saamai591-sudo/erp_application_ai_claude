




/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 01/08/95 04:16:50 عصر
 ************************************************************/

CREATE VIEW [SLE].[Remittance_Remains]
AS 

SELECT ri.RemittanceItemID,
       MainQuantity,
       T.DoMainQuantity,
       T.DoSubQuantity,
       CASE 
            WHEN s.[Type] = 10  THEN 0
            ELSE MainQuantity -DoMainQuantity
       END                            AS Non,
       CASE 
            WHEN s.[Type] = 10 THEN 0
            ELSE SubQuantity -DoSubQuantity
       END                            AS NonSub
FROM   (
           SELECT ri.RemittanceItemID,
                  SUM(ISNULL(ii.MainQuantity, 0) + ISNULL(oi.MainQuantity, 0)) AS 
                  DoMainQuantity,
                  SUM(ISNULL(ii.SubQuantity, 0) + ISNULL(oi.SubQuantity, 0)) AS 
                  DoSubQuantity
           FROM   sle.RemittanceItem  AS ri
                  LEFT JOIN (
                           SELECT RemittanceItemID,
                                  SUM(MainQuantity) AS MainQuantity,
                                  SUM(SubQuantity) AS SubQuantity
                           FROM   SLE.InvoiceItem
                           GROUP BY
                                  RemittanceItemID
                       )              AS ii
                       ON  ii.RemittanceItemID = ri.RemittanceItemID
                  LEFT JOIN (
                           SELECT RemittanceItemID,
                                  SUM(MainQuantity) AS MainQuantity,
                                  SUM(SubQuantity) AS SubQuantity
                           FROM   STC.OutgoingItem
                           GROUP BY
                                  RemittanceItemID
                       )              AS oi
                       ON  oi.RemittanceItemID = ri.RemittanceItemID
           GROUP BY
                  ri.RemittanceItemID
       )T
       INNER JOIN sle.RemittanceItem  AS ri
            ON  ri.RemittanceItemID = T.RemittanceItemID
       INNER JOIN STF.[Stuff]         AS s
            ON  s.StuffID = ri.StuffID




