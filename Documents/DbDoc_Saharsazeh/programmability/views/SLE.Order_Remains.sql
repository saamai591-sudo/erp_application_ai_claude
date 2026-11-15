



/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 01/08/95 04:17:38 عصر
 ************************************************************/

CREATE VIEW [SLE].[Order_Remains]
AS 

SELECT oi.OrderItemID,
       MainQuantity,
       T.DoMainQuantity,
       T.DoSubQuantity,
       CASE 
            WHEN s.[Type] = 10  THEN 0
            ELSE MainQuantity -DoMainQuantity
       END                       AS Non,
       CASE 
            WHEN s.[Type] = 10  THEN 0
            ELSE SubQuantity -DoSubQuantity
       END                       AS NonSub
FROM   (
           SELECT oi.OrderItemID,
                  SUM(ISNULL(ji.MainQuantity, 0) + ISNULL(qi.MainQuantity, 0)) AS 
                  DoMainQuantity,
                  SUM(ISNULL(ji.SubQuantity, 0) + ISNULL(qi.SubQuantity, 0)) AS 
                  DoSubQuantity
           FROM   ctm.OrderItem  AS oi
                  LEFT JOIN (
                           SELECT OrderItemID,
                                  SUM(MainQuantity) AS MainQuantity,
                                  SUM(ji.SubQuantity) AS SubQuantity
                           FROM   SLE.JustificationItem AS ji
                           GROUP BY
                                  ji.OrderItemID
                       )ji
                       ON  ji.OrderItemID = oi.OrderItemID
                  LEFT JOIN (
                           SELECT OrderItemID,
                                  SUM(MainQuantity) AS MainQuantity,
                                  SUM(qi.SubQuantity) AS SubQuantity
                           FROM   SLE.QuotationItem qi
                           GROUP BY
                                  qi.OrderItemID
                       )         AS qi
                       ON  qi.OrderItemID = oi.OrderItemID
           GROUP BY
                  oi.OrderItemID
       )T
       INNER JOIN ctm.OrderItem  AS oi
            ON  oi.OrderItemID = T.OrderItemID
       INNER JOIN STF.[Stuff]    AS s
            ON  s.StuffID = oi.StuffID



