-----------------------------------
--Justification_Non_Outgoing.sql:

Create   VIEW [SLE].Justification_Non_Outgoing
AS
    SELECT  ji.JustificationItemID ,
			ji.StuffID,
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
                        ISNULL(oi.MainQuantity, 0) + 
						ISNULL(oi2.MainQuantity, 0) + 
						ISNULL(oi3.MainQuantity, 0) + 
                        ISNULL(oi4.MainQuantity, 0) + 
                        ISNULL(oi5.MainQuantity, 0) + 
                        ISNULL(oi6.MainQuantity, 0) + 
                        ISNULL(oi7.MainQuantity, 0) + 
                        ISNULL(oi8.MainQuantity, 0) + 
                        ISNULL(oi9.MainQuantity, 0) + 
                        ISNULL(oi10.MainQuantity, 0) + 

                        ISNULL(ii9.MainQuantity, 0) + 
                        ISNULL(ii10.MainQuantity, 0) + 
                        ISNULL(ii11.MainQuantity, 0) + 
                        ISNULL(ii12.MainQuantity, 0) + 
                        ISNULL(ii13.MainQuantity, 0) AS DoMainQuantity ,

                        ISNULL(oi.SubQuantity, 0) + 
						ISNULL(oi2.SubQuantity, 0) + 
						ISNULL(oi3.SubQuantity, 0) + 
						ISNULL(oi4.SubQuantity, 0)+ 
						ISNULL(oi5.SubQuantity, 0) + 
						ISNULL(oi6.SubQuantity,0) + 
						ISNULL(oi7.SubQuantity, 0) + 
						ISNULL(oi8.SubQuantity,0) + 
						ISNULL(oi9.SubQuantity, 0) + 
						ISNULL(oi10.SubQuantity, 0) +

                        ISNULL(ii9.SubQuantity, 0) + 
                        ISNULL(ii10.SubQuantity, 0) + 
                        ISNULL(ii11.SubQuantity, 0) + 
                        ISNULL(ii12.SubQuantity, 0) + 
                        ISNULL(ii13.SubQuantity, 0) AS DoSubQuantity
              FROM      SLE.JustificationItem AS ji
                        LEFT JOIN ( SELECT  qi.JustificationItemID ,
                                            SUM(oi.MainQuantity) AS MainQuantity ,
                                            SUM(oi.SubQuantity) AS SubQuantity
                                    FROM    SLE.QuotationItem AS qi
                                            LEFT JOIN STC.OutgoingItem AS oi ON oi.QuotationItemID = qi.QuotationItemID
									WHERE qi.JustificationItemID IS NOT NULL 
                                    GROUP BY qi.JustificationItemID
                                  ) oi ON ji.JustificationItemID = oi.JustificationItemID
                        LEFT JOIN ( SELECT  qi2.JustificationItemID ,
                                            SUM(oi2.MainQuantity) AS MainQuantity ,
                                            SUM(oi2.SubQuantity) AS SubQuantity
                                    FROM    SLE.QuotationItem AS qi2
                                            LEFT JOIN SLE.RemittanceItem AS ri ON ri.QuotationItemID = qi2.QuotationItemID
                                            LEFT JOIN SLE.InvoiceItem AS ii ON ii.RemittanceItemID = ri.RemittanceItemID
                                            LEFT JOIN STC.OutgoingItem AS oi2 ON oi2.InvoiceItemID = ii.InvoiceItemID
									WHERE qi2.JustificationItemID IS NOT NULL 
                                    GROUP BY qi2.JustificationItemID
                                  ) oi2 ON ji.JustificationItemID = oi2.JustificationItemID
                        LEFT JOIN ( SELECT  qi3.JustificationItemID ,
                                            SUM(oi3.MainQuantity) AS MainQuantity ,
                                            SUM(oi3.SubQuantity) AS SubQuantity
                                    FROM    SLE.QuotationItem AS qi3
                                            LEFT JOIN SLE.RemittanceItem AS ri2 ON ri2.QuotationItemID = qi3.QuotationItemID
                                            LEFT JOIN STC.OutgoingItem AS oi3 ON oi3.RemittanceItemID = ri2.RemittanceItemID
									WHERE qi3.JustificationItemID IS NOT NULL 
                                    GROUP BY qi3.JustificationItemID
                                  ) oi3 ON ji.JustificationItemID = oi3.JustificationItemID
                        LEFT JOIN ( SELECT  qi4.JustificationItemID ,
                                            SUM(oi4.MainQuantity) AS MainQuantity ,
                                            SUM(oi4.SubQuantity) AS SubQuantity
                                    FROM    SLE.QuotationItem AS qi4
                                            LEFT JOIN SLE.InvoiceItem AS ii2 ON ii2.QuotationItemID = qi4.QuotationItemID
                                            LEFT JOIN SLE.RemittanceItem AS ri3 ON ri3.InvoiceItemID = ii2.InvoiceItemID
                                            LEFT JOIN STC.OutgoingItem AS oi4 ON oi4.RemittanceItemID = ri3.RemittanceItemID
									WHERE qi4.JustificationItemID IS NOT NULL 
                                    GROUP BY qi4.JustificationItemID
                                  ) oi4 ON ji.JustificationItemID = oi4.JustificationItemID
                        LEFT JOIN ( SELECT  qi5.JustificationItemID ,
                                            SUM(oi5.MainQuantity) AS MainQuantity ,
                                            SUM(oi5.SubQuantity) AS SubQuantity
                                    FROM    SLE.QuotationItem AS qi5
                                            LEFT JOIN SLE.InvoiceItem AS ii3 ON ii3.QuotationItemID = qi5.QuotationItemID
                                            LEFT JOIN STC.OutgoingItem AS oi5 ON oi5.InvoiceItemID = ii3.InvoiceItemID
									WHERE qi5.JustificationItemID IS NOT NULL 
                                    GROUP BY qi5.JustificationItemID
                                  ) oi5 ON ji.JustificationItemID = oi5.JustificationItemID
                        LEFT JOIN ( SELECT  ri4.JustificationItemID ,
                                            SUM(oi6.MainQuantity) AS MainQuantity ,
                                            SUM(oi6.SubQuantity) AS SubQuantity
                                    FROM    SLE.RemittanceItem AS ri4
                                            LEFT JOIN STC.OutgoingItem AS oi6 ON oi6.RemittanceItemID = ri4.RemittanceItemID
									WHERE ri4.JustificationItemID IS NOT NULL 
                                    GROUP BY ri4.JustificationItemID
                                  ) oi6 ON ji.JustificationItemID = oi6.JustificationItemID
                        LEFT JOIN ( SELECT  ri5.JustificationItemID ,
                                            SUM(oi7.MainQuantity) AS MainQuantity ,
                                            SUM(oi7.SubQuantity) AS SubQuantity
                                    FROM    SLE.RemittanceItem AS ri5
                                            LEFT JOIN SLE.InvoiceItem AS ii4 ON ii4.RemittanceItemID = ri5.RemittanceItemID
                                            LEFT JOIN STC.OutgoingItem AS oi7 ON oi7.InvoiceItemID = ii4.InvoiceItemID
									WHERE ri5.JustificationItemID IS NOT NULL 
                                    GROUP BY ri5.JustificationItemID
                                  ) oi7 ON ji.JustificationItemID = oi7.JustificationItemID
                        LEFT JOIN ( SELECT  ii5.JustificationItemID ,
                                            SUM(oi8.MainQuantity) AS MainQuantity ,
                                            SUM(oi8.SubQuantity) AS SubQuantity
                                    FROM    SLE.InvoiceItem AS ii5
                                            LEFT JOIN STC.OutgoingItem AS oi8 ON oi8.InvoiceItemID = ii5.InvoiceItemID
									WHERE ii5.JustificationItemID IS NOT NULL 
                                    GROUP BY ii5.JustificationItemID
                                  ) oi8 ON ji.JustificationItemID = oi8.JustificationItemID
                        LEFT JOIN ( SELECT  ii6.JustificationItemID ,
                                            SUM(oi9.MainQuantity) AS MainQuantity ,
                                            SUM(oi9.SubQuantity) AS SubQuantity
                                    FROM    SLE.InvoiceItem AS ii6
                                            LEFT JOIN SLE.RemittanceItem AS ri6 ON ri6.InvoiceItemID = ii6.InvoiceItemID
                                            LEFT JOIN STC.OutgoingItem AS oi9 ON oi9.RemittanceItemID = ri6.RemittanceItemID
									WHERE ii6.JustificationItemID IS NOT NULL 
                                    GROUP BY ii6.JustificationItemID
                                  ) oi9 ON ji.JustificationItemID = oi9.JustificationItemID
                        LEFT JOIN ( SELECT  JustificationItemID ,
                                            SUM(MainQuantity) AS MainQuantity ,
                                            SUM(SubQuantity) AS SubQuantity
                                    FROM    STC.OutgoingItem
									WHERE JustificationItemID IS NOT NULL 
                                    GROUP BY JustificationItemID
                                  ) oi10 ON ji.JustificationItemID = oi10.JustificationItemID
						--------------------------------------
						LEFT JOIN ( SELECT  qi5.JustificationItemID ,
                                            SUM(oi11.MainQuantity) AS MainQuantity ,
                                            SUM(oi11.SubQuantity) AS SubQuantity
                                    FROM    SLE.QuotationItem AS qi5
                                            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi5.QuotationItemID
                                            JOIN SLE.InvoiceItem AS ii12 ON ii12.SaleContractItemID = sci.SaleContractItemID
											JOIN STC.OutgoingItem AS oi11 ON oi11.OutgoingItemID = ii12.OutgoingItemId
									WHERE qi5.JustificationItemID IS NOT NULL 
                                    GROUP BY qi5.JustificationItemID
                                  ) ii9 ON ji.JustificationItemID = ii9.JustificationItemID

                        LEFT JOIN ( SELECT  qi5.JustificationItemID ,
                                            SUM(oi5.MainQuantity) AS MainQuantity ,
                                            SUM(oi5.SubQuantity) AS SubQuantity
                                    FROM    SLE.QuotationItem AS qi5
                                            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi5.QuotationItemID
                                            JOIN STC.OutgoingItem AS oi5 ON oi5.SaleContractItemID = sci.SaleContractItemID
									WHERE qi5.JustificationItemID IS NOT NULL 
                                    GROUP BY qi5.JustificationItemID
                                  ) ii10 ON ji.JustificationItemID = ii10.JustificationItemID

                        LEFT JOIN ( SELECT  qi5.JustificationItemID ,
                                            SUM(oi5.MainQuantity) AS MainQuantity ,
                                            SUM(oi5.SubQuantity) AS SubQuantity
                                    FROM    SLE.QuotationItem AS qi5
                                            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi5.QuotationItemID
                                            JOIN SLE.RemittanceItem AS ri5 ON ri5.SaleContractItemID = sci.SaleContractItemID
                                            JOIN STC.OutgoingItem AS oi5 ON oi5.RemittanceItemID = ri5.RemittanceItemID
									WHERE qi5.JustificationItemID IS NOT NULL 
                                    GROUP BY qi5.JustificationItemID
                                  ) ii11 ON ji.JustificationItemID = ii11.JustificationItemID
                        LEFT JOIN ( SELECT  qi5.JustificationItemID ,
                                            SUM(oi12.MainQuantity) AS MainQuantity ,
                                            SUM(oi12.SubQuantity) AS SubQuantity
                                    FROM    SLE.QuotationItem AS qi5
                                            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi5.QuotationItemID
                                            JOIN SLE.RemittanceItem AS ri5 ON ri5.SaleContractItemID = sci.SaleContractItemID
                                            JOIN SLE.InvoiceItem AS ii12 ON ii12.RemittanceItemID = ri5.RemittanceItemID
											JOIN STC.OutgoingItem AS oi12 ON oi12.OutgoingItemID = ii12.OutgoingItemId
									WHERE qi5.JustificationItemID IS NOT NULL 
                                    GROUP BY qi5.JustificationItemID
                                  ) ii12 ON ji.JustificationItemID = ii12.JustificationItemID

						LEFT JOIN ( SELECT  qi5.JustificationItemID ,
                                            SUM(oi11.MainQuantity) AS MainQuantity ,
                                            SUM(oi11.SubQuantity) AS SubQuantity
                                    FROM    SLE.QuotationItem AS qi5
                                            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi5.QuotationItemID
                                            JOIN SLE.InvoiceItem AS ii12 ON ii12.SaleContractItemID = sci.SaleContractItemID
											JOIN SLE.RemittanceItem AS ri7 ON ri7.InvoiceItemID = ii12.InvoiceItemID
											JOIN STC.OutgoingItem AS oi11 ON oi11.RemittanceItemID = ri7.RemittanceItemID
									WHERE qi5.JustificationItemID IS NOT NULL 
                                    GROUP BY qi5.JustificationItemID
                                  ) ii13 ON ji.JustificationItemID = ii13.JustificationItemID

            ) T
            INNER JOIN SLE.JustificationItem AS ji ON ji.JustificationItemID = T.JustificationItemID
            INNER JOIN STF.[Stuff] AS s ON s.StuffID = ji.StuffID;

