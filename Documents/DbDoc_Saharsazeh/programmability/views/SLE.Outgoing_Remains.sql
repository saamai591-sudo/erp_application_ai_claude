
------------------------------------------------
CREATE   VIEW [SLE].Outgoing_Remains
AS
SELECT oi.OutgoingItemID,
       oi.MainQuantity,
       oi.SubQuantity,
       o.DeliverDlID,
       o.StockID,
       o.[Date],
       ISNULL(used1.MainQuantity, 0) + ISNULL(used2.MainQuantity, 0) DoMainQuantity,
       ISNULL(used1.SubQuantity, 0) + ISNULL(used2.SubQuantity, 0) DoSubQuantity,
       CASE 
            WHEN s.[Type] = 10 THEN 0
            ELSE oi.MainQuantity -(
                     ISNULL(used1.MainQuantity, 0) + ISNULL(used2.MainQuantity, 0)
                 )
       END                      AS Non,
       CASE 
            WHEN s.[Type] = 10 THEN 0
            ELSE oi.SubQuantity - ISNULL(used1.SubQuantity, 0) + ISNULL(used2.SubQuantity, 0)
       END                      AS NonSub
       
FROM   stc.OutgoingItem         AS oi
       left JOIN 
            (
                SELECT ii.OutgoingItemId,
                       SUM(MainQuantity)  AS MainQuantity,
                       SUM(SubQuantity)   AS SubQuantity
                FROM   SLE.InvoiceItem ii
                       LEFT JOIN SLE.Invoice i
                            ON  i.InvoiceID = ii.InvoiceID
                WHERE  ISNULL(i.SaleInvoiceStatus, 0) <> 5
                GROUP BY
                       ii.OutgoingItemId
            )                   AS used1
            ON  used1.OutgoingItemId = oi.OutgoingItemID
       LEFT JOIN (
                SELECT srcs.OutgoingItemID,
                       SUM(srcs.MainQuantity) AS MainQuantity,
                       SUM(srcs.SubQuantity) AS SubQuantity
                FROM   STC.StockReceiptChargingService AS srcs
                GROUP BY
                       srcs.OutgoingItemID
            )                   AS used2
            ON  used2.OutgoingItemID = oi.OutgoingItemID
       inner JOIN stc.Outgoing  AS o
            ON  o.OutgoingID = oi.OutgoingID
       INNER JOIN STF.[Stuff]   AS s
            ON  s.StuffID = oi.StuffID;

