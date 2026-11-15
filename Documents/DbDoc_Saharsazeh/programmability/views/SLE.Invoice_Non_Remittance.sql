
------------------------------------------------
CREATE   VIEW [SLE].Invoice_Non_Remittance
AS
    SELECT  ii.InvoiceItemID ,
            MainQuantity ,
            SubQuantity ,
            CASE i.SaleInvoiceStatus
              WHEN 5 THEN MainQuantity
              ELSE T.DoMainQuantity
            END DoMainQuantity ,
            CASE i.SaleInvoiceStatus
              WHEN 5 THEN SubQuantity
              ELSE T.DoSubQuantity
            END DoSubQuantity ,
            CASE WHEN i.SaleInvoiceStatus = 5 THEN 0
                 WHEN s.[Type] = 1
                      OR MainQuantity < DoMainQuantity THEN 0
                 ELSE MainQuantity - DoMainQuantity
            END AS Non ,
            CASE WHEN i.SaleInvoiceStatus = 5 THEN 0
                 WHEN s.[Type] = 1
                      OR SubQuantity < DoSubQuantity THEN 0
                 ELSE SubQuantity - DoSubQuantity
            END AS SubNon
    FROM    ( SELECT    ii.InvoiceItemID ,
                        ISNULL(ri.MainQuantity, 0) + ISNULL(ri2.MainQuantity,
                                                            0)
                        + ISNULL(ri3.MainQuantity, 0) AS DoMainQuantity ,
                        ISNULL(ri.SubQuantity, 0) + ISNULL(ri2.SubQuantity, 0)
                        + ISNULL(ri3.SubQuantity, 0) AS DoSubQuantity
              FROM      SLE.InvoiceItem AS ii
                        LEFT JOIN ( SELECT  ii.InvoiceItemID ,
                                            SUM(ri.MainQuantity) AS MainQuantity ,
                                            SUM(ri.SubQuantity) AS SubQuantity
                                    FROM    SLE.InvoiceItem ii
                                            LEFT JOIN SLE.RemittanceItem AS ri ON ri.RemittanceItemID = ii.RemittanceItemID
                                    GROUP BY ii.InvoiceItemID
                                  ) ri ON ii.InvoiceItemID = ri.InvoiceItemID
                        LEFT JOIN ( SELECT  InvoiceItemID ,
                                            SUM(MainQuantity) AS MainQuantity ,
                                            SUM(SubQuantity) AS SubQuantity
                                    FROM    SLE.RemittanceItem
                                    GROUP BY InvoiceItemID
                                  ) ri2 ON ii.InvoiceItemID = ri2.InvoiceItemID
                        LEFT JOIN ( SELECT  ii.InvoiceItemID ,
                                            SUM(ri.MainQuantity) AS MainQuantity ,
                                            SUM(ri.SubQuantity) AS SubQuantity
                                    FROM    SLE.InvoiceItem ii
                                            INNER JOIN STC.OutgoingItem AS oi ON oi.OutgoingItemID = ii.OutgoingItemId
                                            INNER JOIN SLE.RemittanceItem AS ri ON oi.RemittanceItemID = ri.RemittanceItemID
                                    GROUP BY ii.InvoiceItemID
                                  ) ri3 ON ii.InvoiceItemID = ri3.InvoiceItemID
            ) T
            INNER JOIN SLE.InvoiceItem ii ON ii.InvoiceItemID = T.InvoiceItemID
            INNER JOIN STF.[Stuff] AS s ON s.StuffID = ii.StuffID
            INNER JOIN SLE.Invoice i ON i.InvoiceID = ii.InvoiceID;

