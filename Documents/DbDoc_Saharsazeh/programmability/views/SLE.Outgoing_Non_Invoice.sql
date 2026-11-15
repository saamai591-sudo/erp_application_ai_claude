
------------------------------------------------
CREATE   VIEW [SLE].Outgoing_Non_Invoice
AS 

SELECT oi.OutgoingItemID,
       MainQuantity,
       SubQuantity,
       T.DoMainQuantity,
       T.DoSubQuantity,
       CASE 
            WHEN s.[Type] = 1 OR MainQuantity < DoMainQuantity THEN 0
            ELSE MainQuantity -DoMainQuantity
       END                          AS Non,
       CASE 
            WHEN s.[Type] = 1 OR SubQuantity < DoSubQuantity THEN 0
            ELSE SubQuantity -DoSubQuantity
       END                          AS SubNon
FROM   (
           SELECT oi.OutgoingItemID,
                  ISNULL(ii.MainQuantity, 0) + ISNULL(ii2.MainQuantity, 0) +
                  ISNULL(ii3.MainQuantity, 0) AS DoMainQuantity,
                  ISNULL(ii.SubQuantity, 0) + ISNULL(ii2.SubQuantity, 0) +
                  ISNULL(ii3.SubQuantity, 0) AS DoSubQuantity
           FROM   stc.OutgoingItem AS oi
                  --
                  
                  LEFT JOIN (
                           SELECT OutgoingItemId,
                                  SUM(ii.MainQuantity) AS MainQuantity,
                                  SUM(ii.SubQuantity) AS SubQuantity
                           FROM   sle.InvoiceItem AS ii
                           JOIN sle.Invoice AS i ON i.InvoiceID = ii.InvoiceID
                           WHERE i.SaleInvoiceStatus<> 5 
                           GROUP BY
                                  ii.OutgoingItemId
                       ) ii
                       ON  oi.OutgoingItemID = ii.OutgoingItemID
                  LEFT JOIN (
                           SELECT oi2.OutgoingItemId,
                                  SUM(ii2.MainQuantity) AS MainQuantity,
                                  SUM(ii2.SubQuantity) AS SubQuantity
                           FROM   stc.OutgoingItem AS oi2
                                  INNER JOIN sle.InvoiceItem AS ii2
                                       ON  ii2.InvoiceItemID = oi2.InvoiceItemID
                                       JOIN sle.Invoice AS i ON i.InvoiceID = ii2.InvoiceID
                           WHERE i.SaleInvoiceStatus<>5
                           GROUP BY
                                  oi2.OutgoingItemId
                       ) ii2
                       ON  oi.OutgoingItemID = ii2.OutgoingItemID
                  LEFT JOIN (
                           SELECT oi2.OutgoingItemId,
                                  SUM(ii.MainQuantity) AS MainQuantity,
                                  SUM(ii.SubQuantity) AS SubQuantity
                           FROM   stc.OutgoingItem AS oi2
                                  INNER JOIN sle.RemittanceItem AS ri
                                       ON  ri.RemittanceItemID = oi2.RemittanceItemID
                                  INNER JOIN sle.InvoiceItem AS ii
                                       ON  ii.InvoiceItemID = ri.InvoiceItemID
                           GROUP BY
                                  oi2.OutgoingItemId
                       ) ii3
                       ON  oi.OutgoingItemID = ii3.OutgoingItemID
       )T
       INNER JOIN stc.OutgoingItem  AS oi
            ON  oi.OutgoingItemID = T.OutgoingItemID
       INNER JOIN STF.[Stuff]       AS s
            ON  s.StuffID = oi.StuffID
            
