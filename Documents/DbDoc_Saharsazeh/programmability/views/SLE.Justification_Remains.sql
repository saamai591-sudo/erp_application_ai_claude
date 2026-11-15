



/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 01/08/95 04:15:59 عصر
 ************************************************************/

CREATE VIEW [SLE].[Justification_Remains]
AS 

SELECT ji.JustificationItemID,
       MainQuantity,
       T.DoMainQuantity,
       T.DoSubQuantity,
       CASE 
            WHEN s.[Type] = 10  THEN 0
            ELSE MainQuantity -DoMainQuantity
       END                               AS Non,
       CASE 
            WHEN s.[Type] = 10  THEN 0
            ELSE SubQuantity -DoSubQuantity
       END                               AS NonSub
FROM   (
           SELECT ji.JustificationItemID,
                  SUM(
                      ISNULL(qi.MainQuantity, 0) + ISNULL(ri.MainQuantity, 0) +
                      ISNULL(ii.MainQuantity, 0)
                      + ISNULL(oi.MainQuantity, 0)
                  )                      AS DoMainQuantity,
                  SUM(
                      ISNULL(qi.SubQuantity, 0) + ISNULL(ri.SubQuantity, 0) +
                      ISNULL(ii.SubQuantity, 0)
                      + ISNULL(oi.SubQuantity, 0)
                  )                      AS DoSubQuantity
           FROM   sle.JustificationItem  AS ji
                  LEFT JOIN (
                           SELECT JustificationItemID,
                                  SUM(MainQuantity) AS MainQuantity,
                                  SUM(SubQuantity) AS SubQuantity
                           FROM   SLE.QuotationItem
                           GROUP BY
                                  JustificationItemID
                       )                 AS qi
                       ON  qi.JustificationItemID = ji.JustificationItemID
                  LEFT JOIN (
                           SELECT JustificationItemID,
                                  SUM(MainQuantity) AS MainQuantity,
                                  SUM(SubQuantity) AS SubQuantity
                           FROM   SLE.RemittanceItem
                           GROUP BY
                                  JustificationItemID
                       )                 AS ri
                       ON  ri.JustificationItemID = ji.JustificationItemID
                  LEFT JOIN (
                           SELECT JustificationItemID,
                                  SUM(MainQuantity) AS MainQuantity,
                                  SUM(SubQuantity) AS SubQuantity
                           FROM   SLE.InvoiceItem
                           GROUP BY
                                  JustificationItemID
                       )                 AS ii
                       ON  ii.JustificationItemID = ji.JustificationItemID
                  LEFT JOIN (
                           SELECT JustificationItemID,
                                  SUM(MainQuantity) AS MainQuantity,
                                  SUM(SubQuantity) AS SubQuantity
                           FROM   STC.OutgoingItem
                           GROUP BY
                                  JustificationItemID
                       )                 AS oi
                       ON  oi.JustificationItemID = ji.JustificationItemID
           GROUP BY
                  ji.JustificationItemID
       )T
       INNER JOIN sle.JustificationItem  AS ji
            ON  ji.JustificationItemID = T.JustificationItemID
       INNER JOIN STF.[Stuff]            AS s
            ON  s.StuffID = ji.StuffID



