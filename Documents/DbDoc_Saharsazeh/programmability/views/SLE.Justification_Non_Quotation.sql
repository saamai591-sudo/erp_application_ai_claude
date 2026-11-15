/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 01/08/95 03:45:14 عصر
 ************************************************************/

CREATE VIEW [SLE].[Justification_Non_Quotation]
AS 

SELECT oi.JustificationItemID,
       MainQuantity,
       SubQuantity,
       T.DoMainQuantity,
       T.DoSubQuantity,
       CASE 
            WHEN s.[Type] = 1 OR MainQuantity < DoMainQuantity THEN 0
            ELSE MainQuantity -DoMainQuantity
       END                               AS Non,
       CASE 
            WHEN s.[Type] = 1 OR SubQuantity < DoSubQuantity THEN 0
            ELSE SubQuantity -DoSubQuantity
       END                               AS SubNon
FROM   (
           SELECT ji.JustificationItemID,
                  SUM(qi.MainQuantity)   AS DoMainQuantity,
                  SUM(qi.SubQuantity)    AS DoSubQuantity
           FROM   sle.JustificationItem  AS ji
                  LEFT JOIN SLE.QuotationItem AS qi
                       ON  qi.JustificationItemID = ji.JustificationItemID
           GROUP BY
                  ji.JustificationItemID
       )T
       INNER JOIN Sle.JustificationItem  AS oi
            ON  oi.JustificationItemID = T.JustificationItemID
       INNER JOIN STF.[Stuff]            AS s
            ON  s.StuffID = oi.StuffID
