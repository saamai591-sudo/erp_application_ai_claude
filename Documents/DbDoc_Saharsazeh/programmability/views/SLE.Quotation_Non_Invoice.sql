
-----------------------------------------------------------------------
CREATE   VIEW [SLE].Quotation_Non_Invoice
AS
    SELECT qi.QuotationItemID ,
    q.QuotationID,
           q.CurrencyID ,
           q.SaleAreaID,
           q.BranchID,
           q.SaleTypeID,
           q.[Date],
           q.CustomerID,
           p.DlID,
           MainQuantity ,
           SubQuantity ,
           qi.Fee ,
           T.DoMainQuantity ,
           T.DoSubQuantity ,
           CASE WHEN s.[Type] = 10
                     OR MainQuantity < DoMainQuantity THEN 0
                ELSE MainQuantity - DoMainQuantity
           END AS Non ,
           CASE WHEN s.[Type] = 10
                     OR SubQuantity < DoSubQuantity THEN 0
                ELSE SubQuantity - DoSubQuantity
           END AS SubNon ,
           qi.Price ,
           qi.Discount ,
           qi.StuffID,
           qi.Price - T.DoPrice AS NonPrice ,
           qi.Discount - T.DoDiscount AS NonDiscount,
           q.[Status]
    FROM   (   SELECT qi.QuotationItemID ,
                      ISNULL(ii.MainQuantity, 0) + ISNULL(ii2.MainQuantity, 0)
                      + ISNULL(ii3.MainQuantity, 0)
                      + ISNULL(ii4.MainQuantity, 0)
                      + ISNULL(sc.MainQuantity, 0)
                      + ISNULL(sc1.MainQuantity, 0)
                      + ISNULL(sc2.MainQuantity, 0)
                      + ISNULL(sc3.MainQuantity, 0) AS DoMainQuantity ,
                      ISNULL(ii.SubQuantity, 0) + ISNULL(ii2.SubQuantity, 0)
                      + ISNULL(ii3.SubQuantity, 0) + ISNULL(ii4.SubQuantity, 0)
                      + ISNULL(sc.SubQuantity, 0) + ISNULL(sc1.SubQuantity, 0)
                      + ISNULL(sc2.SubQuantity, 0) + ISNULL(sc3.SubQuantity, 0) AS DoSubQuantity ,
                      ISNULL(ii.Price, 0) + ISNULL(ii2.Price, 0)
                      + ISNULL(ii3.Price, 0) + ISNULL(ii4.Price, 0)
                      + ISNULL(sc.Price, 0) + ISNULL(sc1.Price, 0)
                      + ISNULL(sc2.Price, 0) + ISNULL(sc3.Price, 0) AS DoPrice ,
                      ISNULL(ii.Discount, 0) + ISNULL(ii2.Discount, 0)
                      + ISNULL(ii3.Discount, 0) + ISNULL(ii4.Discount, 0)
                      + ISNULL(sc.Discount, 0) + ISNULL(sc1.Discount, 0)
                      + ISNULL(sc2.Discount, 0) + ISNULL(sc3.Discount, 0) AS DoDiscount
               FROM   SLE.QuotationItem AS qi               
                      LEFT JOIN (   SELECT   ii.QuotationItemID ,
                                             SUM(ii.MainQuantity) AS MainQuantity ,
                                             SUM(ii.SubQuantity) AS SubQuantity ,
                                             SUM(ii.Price) AS Price ,
                                             SUM(ii.Discount) AS Discount
                                    FROM     SLE.InvoiceItem ii
                                    GROUP BY ii.QuotationItemID ) ii ON qi.QuotationItemID = ii.QuotationItemID
                      LEFT JOIN (   SELECT   sci.QuotationItemID ,
                                             SUM(ii5.MainQuantity) AS MainQuantity ,
                                             SUM(ii5.SubQuantity) AS SubQuantity ,
                                             SUM(ii5.Price) AS Price ,
                                             SUM(ii5.Discount) AS Discount
                                    FROM     SLE.SaleContractItem AS sci
                                             JOIN SLE.InvoiceItem AS ii5 ON ii5.SaleContractItemID = sci.SaleContractItemID
                                    GROUP BY sci.QuotationItemID ) sc ON sc.QuotationItemID = qi.QuotationItemID
                      LEFT JOIN (   SELECT   sci.QuotationItemID ,
                                             SUM(ii6.MainQuantity) AS MainQuantity ,
                                             SUM(ii6.SubQuantity) AS SubQuantity ,
                                             SUM(ii6.Price) AS Price ,
                                             SUM(ii6.Discount) AS Discount
                                    FROM     SLE.SaleContractItem AS sci
                                             JOIN STC.OutgoingItem AS oi ON oi.SaleContractItemID = sci.SaleContractItemID
                                             JOIN SLE.InvoiceItem AS ii6 ON ii6.InvoiceItemID = oi.InvoiceItemID
                                    GROUP BY sci.QuotationItemID ) sc1 ON sc1.QuotationItemID = qi.QuotationItemID
                      LEFT JOIN (   SELECT   sci.QuotationItemID ,
                                             SUM(ii7.MainQuantity) AS MainQuantity ,
                                             SUM(ii7.SubQuantity) AS SubQuantity ,
                                             SUM(ii7.Price) AS Price ,
                                             SUM(ii7.Discount) AS Discount
                                    FROM     SLE.SaleContractItem AS sci
                                             JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
                                             JOIN STC.OutgoingItem AS oi2 ON oi2.RemittanceItemID = ri.RemittanceItemID
                                             JOIN SLE.InvoiceItem AS ii7 ON ii7.OutgoingItemID = oi2.OutgoingItemID
                                    GROUP BY sci.QuotationItemID ) sc2 ON sc2.QuotationItemID = qi.QuotationItemID
                      LEFT JOIN (   SELECT   sci.QuotationItemID ,
                                             SUM(ii7.MainQuantity) AS MainQuantity ,
                                             SUM(ii7.SubQuantity) AS SubQuantity ,
                                             SUM(ii7.Price) AS Price ,
                                             SUM(ii7.Discount) AS Discount
                                    FROM     SLE.SaleContractItem AS sci
                                             JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
                                             JOIN SLE.InvoiceItem AS ii7 ON ii7.InvoiceItemID = ri.InvoiceItemID
                                    GROUP BY sci.QuotationItemID ) sc3 ON sc3.QuotationItemID = qi.QuotationItemID
                      LEFT JOIN (   SELECT   oi.QuotationItemID ,
                                             SUM(ii2.MainQuantity) AS MainQuantity ,
                                             SUM(ii2.SubQuantity) AS SubQuantity ,
                                             SUM(ii2.Price) AS Price ,
                                             SUM(ii2.Discount) AS Discount
                                    FROM     STC.OutgoingItem AS oi
                                             LEFT JOIN SLE.InvoiceItem AS ii2 ON ii2.OutgoingItemID = oi.OutgoingItemID
                                    GROUP BY oi.QuotationItemID ) ii2 ON qi.QuotationItemID = ii2.QuotationItemID
                      LEFT JOIN (   SELECT   ri.QuotationItemID ,
                                             SUM(ii3.MainQuantity) AS MainQuantity ,
                                             SUM(ii3.SubQuantity) AS SubQuantity ,
                                             SUM(ii3.Price) AS Price ,
                                             SUM(ii3.Discount) AS Discount
                                    FROM     SLE.RemittanceItem AS ri
                                             LEFT JOIN SLE.InvoiceItem AS ii3 ON ii3.RemittanceItemID = ri.RemittanceItemID
                                    GROUP BY ri.QuotationItemID ) ii3 ON qi.QuotationItemID = ii3.QuotationItemID
                      LEFT JOIN (   SELECT   ri2.QuotationItemID ,
                                             SUM(ii4.MainQuantity) AS MainQuantity ,
                                             SUM(ii4.SubQuantity) AS SubQuantity ,
                                             SUM(ii4.Price) AS Price ,
                                             SUM(ii4.Discount) AS Discount
                                    FROM     SLE.RemittanceItem AS ri2
                                             LEFT JOIN STC.OutgoingItem AS oi2 ON oi2.RemittanceItemID = ri2.RemittanceItemID
                                             LEFT JOIN SLE.InvoiceItem AS ii4 ON ii4.OutgoingItemID = oi2.OutgoingItemID
                                    GROUP BY ri2.QuotationItemID ) ii4 ON qi.QuotationItemID = ii4.QuotationItemID ) T
           INNER JOIN SLE.QuotationItem AS qi ON qi.QuotationItemID = T.QuotationItemID
           JOIN SLE.Quotation AS q ON q.QuotationID = qi.QuotationID
           join cfg.Party AS p on p.PartyID = q.CustomerID
           INNER JOIN STF.[Stuff] AS s ON s.StuffID = qi.StuffID;
