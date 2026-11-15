CREATE    VIEW [SLE].Quotation_Non_Outgoing
as
    SELECT q.QuotationID,
    qi.QuotationItemID,
	q.CurrencyID,
	q.SaleAreaID,
	q.BranchID,
	q.SaleTypeID,
	q.[Date],
	q.CustomerID,
	MainQuantity,
	SubQuantity,
	qi.Fee,
	T.DoMainQuantity,
	T.DoSubQuantity,
	CASE 
	     WHEN s.[Type] = 10
	          OR MainQuantity < DoMainQuantity THEN 0
	     ELSE MainQuantity - DoMainQuantity
	END                           AS Non,
	CASE 
	     WHEN s.[Type] = 10
	          OR SubQuantity < DoSubQuantity THEN 0
	     ELSE SubQuantity - DoSubQuantity
	END                           AS SubNon,
	qi.StuffID,
	q.[Status]     
    
    FROM   (   SELECT qi.QuotationItemID ,
                      ISNULL(oi.MainQuantity, 0) + ISNULL(oi2.MainQuantity, 0)
                      + ISNULL(oi3.MainQuantity, 0)
                      + ISNULL(oi4.MainQuantity, 0)
                      + ISNULL(oi5.MainQuantity, 0)
                      + ISNULL(oi6.MainQuantity, 0)
                      + ISNULL(oi8.MainQuantity, 0)
                      + ISNULL(oi9.MainQuantity, 0)
                      + ISNULL(oi10.MainQuantity, 0)
                      + ISNULL(oi11.MainQuantity, 0) AS DoMainQuantity ,
                      ISNULL(oi.SubQuantity, 0) + ISNULL(oi2.SubQuantity, 0)
                      + ISNULL(oi3.SubQuantity, 0) + ISNULL(oi4.SubQuantity, 0)
                      + ISNULL(oi5.SubQuantity, 0) + ISNULL(oi6.SubQuantity, 0)
                      + ISNULL(oi8.SubQuantity, 0) + ISNULL(oi9.SubQuantity, 0)
                      + ISNULL(oi10.SubQuantity, 0)
                      + ISNULL(oi11.SubQuantity, 0) AS DoSubQuantity
               FROM   SLE.QuotationItem AS qi
                      LEFT JOIN (   SELECT   oi.QuotationItemID ,
                                             SUM(oi.MainQuantity) AS MainQuantity ,
                                             SUM(oi.SubQuantity) AS SubQuantity
                                    FROM     STC.OutgoingItem oi
									WHERE  oi.QuotationItemID IS NOT NULL
                                    GROUP BY oi.QuotationItemID ) oi ON qi.QuotationItemID = oi.QuotationItemID
                      LEFT JOIN (   SELECT   ri2.QuotationItemID ,
                                             SUM(oi3.MainQuantity) AS MainQuantity ,
                                             SUM(oi3.SubQuantity) AS SubQuantity
                                    FROM     SLE.RemittanceItem AS ri2
                                              JOIN SLE.InvoiceItem AS ii ON ii.RemittanceItemID = ri2.RemittanceItemID
                                              JOIN STC.OutgoingItem AS oi3 ON oi3.InvoiceItemID = ii.InvoiceItemID
									WHERE ri2.QuotationItemID IS NOT NULL
                                    GROUP BY ri2.QuotationItemID ) oi2 ON qi.QuotationItemID = oi2.QuotationItemID
                      LEFT JOIN (   SELECT   ri.QuotationItemID ,
                                             SUM(oi2.MainQuantity) AS MainQuantity ,
                                             SUM(oi2.SubQuantity) AS SubQuantity
                                    FROM     SLE.RemittanceItem AS ri
                                              JOIN STC.OutgoingItem AS oi2 ON oi2.RemittanceItemID = ri.RemittanceItemID
									WHERE ri.QuotationItemID IS NOT NULL
                                    GROUP BY ri.QuotationItemID ) oi3 ON qi.QuotationItemID = oi3.QuotationItemID
                      LEFT JOIN (   SELECT   ii2.QuotationItemID ,
                                             SUM(oi4.MainQuantity) AS MainQuantity ,
                                             SUM(oi4.SubQuantity) AS SubQuantity
                                    FROM     SLE.InvoiceItem AS ii2
                                              JOIN STC.OutgoingItem AS oi4 ON oi4.InvoiceItemID = ii2.InvoiceItemID
									WHERE ii2.QuotationItemID IS NOT NULL
                                    GROUP BY ii2.QuotationItemID ) oi4 ON qi.QuotationItemID = oi4.QuotationItemID
                      LEFT JOIN (   SELECT   ii3.QuotationItemID ,
                                             SUM(oi5.MainQuantity) AS MainQuantity ,
                                             SUM(oi5.SubQuantity) AS SubQuantity
                                    FROM     SLE.InvoiceItem AS ii3
                                             JOIN SLE.RemittanceItem AS ri3 ON ri3.InvoiceItemID = ii3.InvoiceItemID
                                             JOIN STC.OutgoingItem AS oi5 ON oi5.RemittanceItemID = ri3.RemittanceItemID
									WHERE ii3.QuotationItemID IS NOT NULL
                                    GROUP BY ii3.QuotationItemID ) oi5 ON qi.QuotationItemID = oi5.QuotationItemID
                      LEFT JOIN (   SELECT   sci.QuotationItemID ,
                                             SUM(oit.MainQuantity) AS MainQuantity ,
                                             SUM(oit.SubQuantity) AS SubQuantity
                                    FROM     SLE.SaleContractItem AS sci
                                             JOIN STC.OutgoingItem AS oit ON oit.SaleContractItemID = sci.SaleContractItemID
									WHERE sci.QuotationItemID IS NOT NULL
                                    GROUP BY sci.QuotationItemID ) oi6 ON oi6.QuotationItemID = qi.QuotationItemID
                      LEFT JOIN (   SELECT   sci2.QuotationItemID ,
                                             SUM(oi7.MainQuantity) MainQuantity ,
                                             SUM(oi7.SubQuantity) SubQuantity
                                    FROM     SLE.SaleContractItem AS sci2
                                             JOIN SLE.InvoiceItem AS ii4 ON ii4.SaleContractItemID = sci2.SaleContractItemID
                                             JOIN STC.OutgoingItem AS oi7 ON oi7.InvoiceItemID = ii4.InvoiceItemID
									WHERE sci2.QuotationItemID IS NOT NULL
                                    GROUP BY sci2.QuotationItemID ) oi8 ON oi8.QuotationItemID = qi.QuotationItemID
                      LEFT JOIN (   SELECT   sci2.QuotationItemID ,
                                             SUM(oi7.MainQuantity) MainQuantity ,
                                             SUM(oi7.SubQuantity) SubQuantity
                                    FROM     SLE.SaleContractItem AS sci2
                                             JOIN SLE.InvoiceItem AS ii4 ON ii4.SaleContractItemID = sci2.SaleContractItemID
                                             JOIN SLE.RemittanceItem AS ri4 ON ri4.InvoiceItemID = ii4.InvoiceItemID
                                             JOIN STC.OutgoingItem AS oi7 ON oi7.RemittanceItemID = ri4.RemittanceItemID
									WHERE sci2.QuotationItemID IS NOT NULL
                                    GROUP BY sci2.QuotationItemID ) oi9 ON oi9.QuotationItemID = qi.QuotationItemID
                      LEFT JOIN (   SELECT   sci2.QuotationItemID ,
                                             SUM(oi7.MainQuantity) MainQuantity ,
                                             SUM(oi7.SubQuantity) SubQuantity
                                    FROM     SLE.SaleContractItem AS sci2
                                             JOIN SLE.RemittanceItem AS ri4 ON ri4.SaleContractItemID = sci2.SaleContractItemID
                                             JOIN STC.OutgoingItem AS oi7 ON oi7.RemittanceItemID = ri4.RemittanceItemID
									WHERE sci2.QuotationItemID IS NOT NULL
                                    GROUP BY sci2.QuotationItemID ) oi10 ON oi10.QuotationItemID = qi.QuotationItemID
                      LEFT JOIN (   SELECT   sci2.QuotationItemID ,
                                             SUM(oi7.MainQuantity) MainQuantity ,
                                             SUM(oi7.SubQuantity) SubQuantity
                                    FROM     SLE.SaleContractItem AS sci2
                                             JOIN SLE.RemittanceItem AS ri4 ON ri4.SaleContractItemID = sci2.SaleContractItemID
                                             JOIN SLE.InvoiceItem AS ii5 ON ii5.RemittanceItemID = ri4.RemittanceItemID
                                             JOIN STC.OutgoingItem AS oi7 ON oi7.InvoiceItemID = ii5.InvoiceItemID
									WHERE sci2.QuotationItemID IS NOT NULL
                                    GROUP BY sci2.QuotationItemID ) oi11 ON oi11.QuotationItemID = qi.QuotationItemID ) T
           INNER JOIN SLE.QuotationItem AS qi ON qi.QuotationItemID = T.QuotationItemID
           JOIN SLE.Quotation AS q ON q.QuotationID = qi.QuotationID
           INNER JOIN STF.[Stuff] AS s ON s.StuffID = qi.StuffID;

