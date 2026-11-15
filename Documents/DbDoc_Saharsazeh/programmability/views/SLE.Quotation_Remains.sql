
CREATE VIEW [SLE].[Quotation_Remains]
AS
    SELECT  qi.QuotationItemID ,
            MainQuantity ,
            T.DoMainQuantity ,
            T.DoSubQuantity ,
            CASE WHEN s.[Type] = 10 THEN 0
                 ELSE MainQuantity - DoMainQuantity
            END AS Non ,
            CASE WHEN s.[Type] = 10 THEN 0
                 ELSE SubQuantity - DoSubQuantity
            END AS NonSub
    FROM    ( SELECT    qi.QuotationItemID ,
                        SUM(ISNULL(ii.MainQuantity, 0)
                            + ISNULL(ri.MainQuantity, 0)
                            + ISNULL(sc.MainQuantity, 0)
                            + ISNULL(oi.MainQuantity, 0)) AS DoMainQuantity ,
                        SUM(ISNULL(ii.SubQuantity, 0) + ISNULL(ri.SubQuantity,0)
                            + ISNULL(sc.SubQuantity, 0)
                            + ISNULL(oi.SubQuantity, 0)) AS DoSubQuantity
              FROM      SLE.QuotationItem AS qi
                        LEFT JOIN ( SELECT  QuotationItemID ,
                                            SUM(MainQuantity) AS MainQuantity ,
                                            SUM(SubQuantity) AS SubQuantity
                                    FROM    SLE.InvoiceItem
                                    GROUP BY QuotationItemID
                                  ) AS ii ON ii.QuotationItemID = qi.QuotationItemID
                        LEFT JOIN ( SELECT  QuotationItemID ,
                                            SUM(MainQuantity) AS MainQuantity ,
                                            SUM(SubQuantity) AS SubQuantity
                                    FROM    SLE.RemittanceItem
                                    GROUP BY QuotationItemID
                                  ) AS ri ON ri.QuotationItemID = qi.QuotationItemID
                        LEFT JOIN ( SELECT  QuotationItemID ,
                                            SUM(MainQuantity) AS MainQuantity ,
                                            SUM(SubQuantity) AS SubQuantity
                                    FROM    STC.OutgoingItem
                                    GROUP BY QuotationItemID
                                  ) AS oi ON oi.QuotationItemID = qi.QuotationItemID
                        LEFT JOIN ( SELECT  sci.QuotationItemID ,
                                            SUM(MainQuantity) AS MainQuantity ,
                                            SUM(SubQuantity) AS SubQuantity
                                    FROM    SLE.SaleContractItem AS sci
                                    GROUP BY sci.QuotationItemID
                                  ) AS sc ON sc.QuotationItemID = qi.QuotationItemID
              GROUP BY  qi.QuotationItemID
            ) T
            INNER JOIN SLE.QuotationItem AS qi ON qi.QuotationItemID = T.QuotationItemID
            INNER JOIN STF.[Stuff] AS s ON s.StuffID = qi.StuffID;

