    	
CREATE   VIEW [SLE].Quotation_Non_Remittance
AS

SELECT 
q.QuotationID,
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
FROM   (
           SELECT qi.QuotationItemID,
                  ISNULL(ri.MainQuantity, 0) + ISNULL(ri2.MainQuantity, 0)
                  + ISNULL(ri4.MainQuantity, 0)
                  + ISNULL(ri6.MainQuantity, 0)
                  + ISNULL(ri3.MainQuantity, 0) AS DoMainQuantity,
                  ISNULL(ri.SubQuantity, 0) + ISNULL(ri2.SubQuantity, 0)
                  + ISNULL(ri4.SubQuantity, 0) + ISNULL(ri6.SubQuantity, 0)
                  + ISNULL(ri3.SubQuantity, 0) AS DoSubQuantity
           FROM   SLE.QuotationItem AS qi
                  LEFT JOIN (
                           SELECT oi.QuotationItemID,
                                  SUM(ri.MainQuantity) AS MainQuantity,
                                  SUM(ri.SubQuantity) AS SubQuantity
                           FROM   STC.OutgoingItem AS oi
                                  LEFT JOIN SLE.InvoiceItem AS ii
                                       ON  ii.OutgoingItemId = oi.OutgoingItemID
                                  LEFT JOIN SLE.RemittanceItem AS ri
                                       ON  ri.InvoiceItemID = ii.InvoiceItemID
                           GROUP BY
                                  oi.QuotationItemID
                       ) ri
                       ON  qi.QuotationItemID = ri.QuotationItemID
                  LEFT JOIN (
                           SELECT ri2.QuotationItemID,
                                  SUM(ri2.MainQuantity) AS MainQuantity,
                                  SUM(ri2.SubQuantity) AS SubQuantity
                           FROM   SLE.RemittanceItem AS ri2
                           GROUP BY
                                  ri2.QuotationItemID
                       ) ri2
                       ON  ri2.QuotationItemID = qi.QuotationItemID
                  LEFT JOIN (
                           SELECT ii2.QuotationItemID,
                                  SUM(ri3.MainQuantity) AS MainQuantity,
                                  SUM(ri3.SubQuantity) AS SubQuantity
                           FROM   SLE.InvoiceItem AS ii2
                                  LEFT JOIN SLE.RemittanceItem AS ri3
                                       ON  ri3.InvoiceItemID = ii2.InvoiceItemID
                           GROUP BY
                                  ii2.QuotationItemID
                       ) ri3
                       ON  qi.QuotationItemID = ri3.QuotationItemID
                  LEFT JOIN (
                           SELECT sci.QuotationItemID,
                                  SUM(ri4.MainQuantity) AS MainQuantity,
                                  SUM(ri4.SubQuantity) AS SubQuantity
                           FROM   SLE.SaleContractItem AS sci
                                  JOIN SLE.RemittanceItem AS ri4
                                       ON  ri4.SaleContractItemID = sci.SaleContractItemID
                           GROUP BY
                                  sci.QuotationItemID
                       ) ri4
                       ON  ri4.QuotationItemID = qi.QuotationItemID
                  LEFT JOIN (
                           SELECT sci.QuotationItemID,
                                  SUM(ri5.MainQuantity) AS MainQuantity,
                                  SUM(ri5.SubQuantity) AS SubQuantity
                           FROM   SLE.SaleContractItem AS sci
                                  JOIN SLE.InvoiceItem AS ii3
                                       ON  ii3.SaleContractItemID = sci.SaleContractItemID
                                  JOIN SLE.RemittanceItem AS ri5
                                       ON  ii3.InvoiceItemID = ri5.InvoiceItemID
                           GROUP BY
                                  sci.QuotationItemID
                       ) ri6
                       ON  ri6.QuotationItemID = qi.QuotationItemID
       ) T
       INNER JOIN SLE.QuotationItem  AS qi
            ON  qi.QuotationItemID = T.QuotationItemID
       Inner join sle.Quotation AS q on q.QuotationID = qi.QuotationID     
       INNER JOIN STF.[Stuff]        AS s
            ON  s.StuffID = qi.StuffID;
