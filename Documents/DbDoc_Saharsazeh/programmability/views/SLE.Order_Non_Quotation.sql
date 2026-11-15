/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 01/08/95 03:42:09 عصر
 ************************************************************/

CREATE VIEW [SLE].[Order_Non_Quotation]
AS 

SELECT oi.OrderItemID,
       MainQuantity,
       SubQuantity,
       T.DoMainQuantity,
       T.DoSubQuantity,
       CASE 
            WHEN s.[Type] = 1 OR MainQuantity < DoMainQuantity THEN 0
            ELSE MainQuantity -DoMainQuantity
       END                       AS Non,
       CASE 
            WHEN s.[Type] = 1 OR SubQuantity < DoSubQuantity THEN 0
            ELSE SubQuantity -DoSubQuantity
       END                       AS SubNon
FROM   (
           SELECT oi.OrderItemID,
                  SUM(qi.MainQuantity)  AS DoMainQuantity,
                  SUM(qi.SubQuantity)   AS DoSubQuantity
           FROM   CTM.OrderItem         AS oi
                  LEFT JOIN SLE.QuotationItem AS qi
                       ON  qi.OrderItemID = oi.OrderItemID
           GROUP BY
                  oi.OrderItemID
       )T
       INNER JOIN CTM.OrderItem  AS oi
            ON  oi.OrderItemID = T.OrderItemID
       INNER JOIN STF.[Stuff]    AS s
            ON  s.StuffID = oi.StuffID
