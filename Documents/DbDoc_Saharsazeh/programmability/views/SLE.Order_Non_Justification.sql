/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 01/08/95 04:07:46 عصر
 ************************************************************/

CREATE   VIEW [SLE].[Order_Non_Justification]
AS
    SELECT oi.OrderItemID ,
           MainQuantity ,
           SubQuantity ,
           T.DoMainQuantity ,
           T.DoSubQuantity ,
           CASE WHEN s.[Type] = 1
                     OR MainQuantity < DoMainQuantity THEN 0
                ELSE MainQuantity - ISNULL(DoMainQuantity, 0)
           END AS Non ,
           CASE WHEN s.[Type] = 1
                     OR SubQuantity < DoSubQuantity THEN 0
                ELSE SubQuantity - ISNULL(DoSubQuantity, 0)
           END AS SubNon
    FROM   (   SELECT   oi.OrderItemID ,
                        SUM(ji.MainQuantity) AS DoMainQuantity ,
                        SUM(ji.SubQuantity) AS DoSubQuantity
               FROM     CTM.OrderItem AS oi
                        LEFT JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
               GROUP BY oi.OrderItemID ) T
           INNER JOIN CTM.OrderItem AS oi ON oi.OrderItemID = T.OrderItemID
           INNER JOIN STF.[Stuff] AS s ON s.StuffID = oi.StuffID;
