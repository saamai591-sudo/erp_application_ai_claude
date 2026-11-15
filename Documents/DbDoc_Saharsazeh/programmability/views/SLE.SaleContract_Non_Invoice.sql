
------------------------------------------------
CREATE    VIEW [SLE].SaleContract_Non_Invoice
AS
    SELECT sci2.SaleContractItemID ,
		   sc.CurrencyID,
           sci2.MainQuantity ,
           sci2.SubQuantity ,
		   sci2.Fee,
           T.DoMainQuantity ,
           T.DoSubQuantity ,
           CASE WHEN s.[Type] = 1
                     OR MainQuantity < DoMainQuantity THEN 0
                ELSE MainQuantity - DoMainQuantity
           END AS Non ,
           CASE WHEN s.[Type] = 1
                     OR SubQuantity < DoSubQuantity THEN 0
                ELSE SubQuantity - DoSubQuantity
           END AS SubNon ,
		   sci2.Price,
		   sci2.Discount,
           sci2.Price - T.DoPrice AS NonPrice ,
           sci2.Discount - T.DoDiscount AS NonDiscount,
           sc.CustomerID,p.DlID,sc.[Date],sc.SaleTypeID
    FROM   (   SELECT sci.SaleContractItemID ,
                      ISNULL(fl.MainQuantity, 0) + ISNULL(fl1.MainQuantity, 0) AS DoMainQuantity ,
                      ISNULL(fl.SubQuantity, 0) + ISNULL(fl1.SubQuantity, 0) AS DoSubQuantity ,
                      ISNULL(fl.Price, 0) + ISNULL(fl1.Price, 0) AS DoPrice ,
                      ISNULL(fl.Discount, 0) + ISNULL(fl1.Discount, 0) AS DoDiscount
               FROM   SLE.SaleContractItem AS sci
                      LEFT JOIN (   SELECT   ii2.SaleContractItemID ,
                                             SUM(ii2.MainQuantity) AS MainQuantity ,
                                             SUM(ii2.SubQuantity) AS SubQuantity ,
                                             SUM(ii2.Price) AS Price ,
                                             SUM(ii2.Discount) AS Discount
                                    FROM     SLE.InvoiceItem AS ii2
									join SLE.Invoice h
										on h.invoiceid = ii2.InvoiceID
									where h.SaleInvoiceStatus = 5
                                    GROUP BY ii2.SaleContractItemID ) fl ON fl.SaleContractItemID = sci.SaleContractItemID
                      LEFT JOIN (   SELECT   oi.SaleContractItemID ,
                                             SUM(ii.MainQuantity) AS MainQuantity ,
                                             SUM(ii.SubQuantity) AS SubQuantity ,
                                             SUM(ii.Price) AS Price ,
                                             SUM(ii.Discount) AS Discount
                                    FROM     STC.OutgoingItem AS oi
                                             JOIN SLE.InvoiceItem AS ii ON ii.InvoiceItemID = oi.InvoiceItemID
                                    GROUP BY oi.SaleContractItemID ) fl1 ON fl1.SaleContractItemID = sci.SaleContractItemID ) T
           INNER JOIN SLE.SaleContractItem AS sci2 ON sci2.SaleContractItemID = T.SaleContractItemID
		   JOIN SLE.SaleContract AS sc ON sc.SaleContractID = sci2.SaleContractID
		   join cfg.Party AS p on p.PartyID = sc.CustomerID
           INNER JOIN STF.[Stuff] AS s ON s.StuffID = sci2.StuffID;

