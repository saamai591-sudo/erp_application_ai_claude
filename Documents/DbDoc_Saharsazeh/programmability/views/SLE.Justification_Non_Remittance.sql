
CREATE VIEW [SLE].[Justification_Non_Remittance]
AS
    SELECT  ji.JustificationItemID ,
            MainQuantity ,
            SubQuantity ,
            T.DoMainQuantity ,
            T.DoSubQuantity ,
            CASE WHEN s.[Type] = 1
                      OR MainQuantity < DoMainQuantity THEN 0
                 ELSE MainQuantity - DoMainQuantity
            END AS Non ,
            CASE WHEN s.[Type] = 1
                      OR SubQuantity < DoSubQuantity THEN 0
                 ELSE SubQuantity - DoSubQuantity
            END AS SubNon
    FROM    ( SELECT    ji.JustificationItemID ,
                        ISNULL(ri.MainQuantity, 0) + 
						ISNULL(ri2.MainQuantity, 0) + 
                        ISNULL(ri3.MainQuantity, 0) + 
                        ISNULL(ri4.MainQuantity, 0) + 
                        ISNULL(ri5.MainQuantity, 0) + 
                        ISNULL(ii1.MainQuantity, 0) + 
                        ISNULL(ii2.MainQuantity, 0) +  
                        ISNULL(ri6.MainQuantity, 0) AS DoMainQuantity ,
                        ISNULL(ri.SubQuantity, 0) + 
						ISNULL(ri2.SubQuantity, 0) + 
						ISNULL(ri3.SubQuantity, 0) + 
						ISNULL(ri4.SubQuantity, 0) + 
						ISNULL(ri5.SubQuantity, 0) + 
                        ISNULL(ii1.SubQuantity, 0) + 
                        ISNULL(ii2.SubQuantity, 0) +  
						ISNULL(ri6.SubQuantity, 0) AS DoSubQuantity
              FROM      SLE.JustificationItem AS ji
                        LEFT JOIN ( SELECT  ri.JustificationItemID ,
                                            SUM(ri.MainQuantity) AS MainQuantity ,
                                            SUM(ri.SubQuantity) AS SubQuantity
                                    FROM    SLE.RemittanceItem ri
                                    GROUP BY ri.JustificationItemID
                                  ) ri ON ji.JustificationItemID = ri.JustificationItemID
                        LEFT JOIN ( SELECT  qi.JustificationItemID ,
                                            SUM(ri2.MainQuantity) AS MainQuantity ,
                                            SUM(ri2.SubQuantity) AS SubQuantity
                                    FROM    SLE.QuotationItem AS qi
                                            LEFT JOIN STC.OutgoingItem AS oi ON oi.QuotationItemID = qi.QuotationItemID
                                            LEFT JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi.OutgoingItemID
                                            LEFT JOIN SLE.RemittanceItem AS ri2 ON ri2.InvoiceItemID = ii.InvoiceItemID
                                    GROUP BY qi.JustificationItemID
                                  ) ri2 ON ji.JustificationItemID = ri2.JustificationItemID
                        LEFT JOIN ( SELECT  qi2.JustificationItemID ,
                                            SUM(ri3.MainQuantity) AS MainQuantity ,
                                            SUM(ri3.SubQuantity) AS SubQuantity
                                    FROM    SLE.QuotationItem AS qi2
                                            LEFT JOIN SLE.RemittanceItem AS ri3 ON ri3.QuotationItemID = qi2.QuotationItemID
                                    GROUP BY qi2.JustificationItemID
                                  ) ri3 ON ji.JustificationItemID = ri3.JustificationItemID
                        LEFT JOIN ( SELECT  qi3.JustificationItemID ,
                                            SUM(ri4.MainQuantity) AS MainQuantity ,
                                            SUM(ri4.SubQuantity) AS SubQuantity
                                    FROM    SLE.QuotationItem AS qi3
                                            LEFT JOIN SLE.InvoiceItem AS ii2 ON ii2.QuotationItemID = qi3.QuotationItemID
                                            LEFT JOIN SLE.RemittanceItem AS ri4 ON ri4.InvoiceItemID = ii2.InvoiceItemID
                                    GROUP BY qi3.JustificationItemID
                                  ) ri4 ON ji.JustificationItemID = ri4.JustificationItemID
                        LEFT JOIN ( SELECT  ii3.JustificationItemID ,
                                            SUM(ri5.MainQuantity) AS MainQuantity ,
                                            SUM(ri5.SubQuantity) AS SubQuantity
                                    FROM    SLE.InvoiceItem AS ii3
                                            LEFT JOIN SLE.RemittanceItem AS ri5 ON ri5.InvoiceItemID = ii3.InvoiceItemID
                                    GROUP BY ii3.JustificationItemID
                                  ) ri5 ON ji.JustificationItemID = ri5.JustificationItemID
                        LEFT JOIN ( SELECT  oi2.JustificationItemID ,
                                            SUM(ri6.MainQuantity) AS MainQuantity ,
                                            SUM(ri6.SubQuantity) AS SubQuantity
                                    FROM    STC.OutgoingItem AS oi2
                                            LEFT JOIN SLE.InvoiceItem AS ii4 ON ii4.OutgoingItemId = oi2.OutgoingItemID
                                            LEFT JOIN SLE.RemittanceItem AS ri6 ON ri6.InvoiceItemID = ii4.InvoiceItemID
                                    GROUP BY oi2.JustificationItemID
                                  ) ri6 ON ji.JustificationItemID = ri6.JustificationItemID
							----------------
						LEFT JOIN (SELECT	qi4.JustificationItemID,
											SUM(ri7.MainQuantity) MainQuantity,
											SUM(ri7.SubQuantity)  SubQuantity
									FROM	SLE.QuotationItem AS qi4
											JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi4.QuotationItemID
											JOIN SLE.RemittanceItem AS ri7 ON ri7.SaleContractItemID = sci.SaleContractItemID
									GROUP BY qi4.JustificationItemID
						) ii1 ON ii1.JustificationItemID = ji.JustificationItemID
						LEFT JOIN (SELECT	qi4.JustificationItemID,
											SUM(ri7.MainQuantity) MainQuantity,
											SUM(ri7.SubQuantity)  SubQuantity
									FROM	SLE.QuotationItem AS qi4
											JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi4.QuotationItemID
											JOIN SLE.InvoiceItem AS ii5 ON ii5.SaleContractItemID = sci.SaleContractItemID
											JOIN SLE.RemittanceItem AS ri7 ON ri7.InvoiceItemID = ii5.InvoiceItemID
									GROUP BY qi4.JustificationItemID
						) ii2 ON ii2.JustificationItemID = ji.JustificationItemID

            ) T
            INNER JOIN SLE.JustificationItem AS ji ON ji.JustificationItemID = T.JustificationItemID
            INNER JOIN STF.[Stuff] AS s ON s.StuffID = ji.StuffID;

