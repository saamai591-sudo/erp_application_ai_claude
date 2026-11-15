
-----------------------------------------------------------------------
CREATE   VIEW [SLE].Justification_Non_Invoice
AS
SELECT ji.JustificationItemID,
       j.CurrencyID,
       ji.MainQuantity,
       ji.SubQuantity,
       ji.Fee,
    ISNULL(ii.MainQuantity, 0)
    + ISNULL(ii2.MainQuantity, 0)
    + ISNULL(ii3.MainQuantity, 0)
    + ISNULL(ii4.MainQuantity, 0)
    + ISNULL(ii5.MainQuantity, 0)
    + ISNULL(ii6.MainQuantity, 0)
    + ISNULL(ii7.MainQuantity, 0)
    + ISNULL(ii8.MainQuantity, 0)
    + ISNULL(ii9.MainQuantity, 0)
    + ISNULL(ii10.MainQuantity, 0)
    + ISNULL(ii11.MainQuantity, 0)
    + ISNULL(ii12.MainQuantity, 0)   DoMainQuantity,
	ISNULL(ii.SubQuantity, 0)
	+ ISNULL(ii2.SubQuantity, 0)
	+ ISNULL(ii3.SubQuantity, 0)
	+ ISNULL(ii4.SubQuantity, 0)
	+ ISNULL(ii5.SubQuantity, 0)
	+ ISNULL(ii6.SubQuantity, 0)
	+ ISNULL(ii7.SubQuantity, 0)
	+ ISNULL(ii8.SubQuantity, 0)
	+ ISNULL(ii9.SubQuantity, 0)
	+ ISNULL(ii10.SubQuantity, 0)
	+ ISNULL(ii11.SubQuantity, 0)
	+ ISNULL(ii12.SubQuantity, 0) DoSubQuantity,
       ji.MainQuantity - (ISNULL(ii.MainQuantity, 0)
                               + ISNULL(ii2.MainQuantity, 0)
                               + ISNULL(ii3.MainQuantity, 0)
                               + ISNULL(ii4.MainQuantity, 0)
                               + ISNULL(ii5.MainQuantity, 0)
                               + ISNULL(ii6.MainQuantity, 0)
                               + ISNULL(ii7.MainQuantity, 0)
                               + ISNULL(ii8.MainQuantity, 0)
                               + ISNULL(ii9.MainQuantity, 0)
                               + ISNULL(ii10.MainQuantity, 0)
                               + ISNULL(ii11.MainQuantity, 0)
                               + ISNULL(ii12.MainQuantity, 0))  Non,
       0 SubNon,
       ji.Price,
       ji.Discount,
       ji.Price - (ISNULL(ii.Price, 0) + ISNULL(ii2.Price, 0)
                            + ISNULL(ii3.Price, 0) + ISNULL(ii4.Price, 0)
                            + ISNULL(ii5.Price, 0) + ISNULL(ii6.Price, 0)
                            + ISNULL(ii7.Price, 0) + ISNULL(ii8.Price, 0)
                            + ISNULL(ii9.Price, 0) + ISNULL(ii10.Price, 0)
                            + ISNULL(ii11.Price, 0) + ISNULL(ii12.Price, 0))        AS NonPrice,
       ji.Discount - (ISNULL(ii.Discount, 0) + ISNULL(ii2.Discount, 0)
                            + ISNULL(ii3.Discount, 0) + ISNULL(ii4.Discount, 0)
                            + ISNULL(ii5.Discount, 0) + ISNULL(ii6.Discount, 0)
                            + ISNULL(ii7.Discount, 0) + ISNULL(ii8.Discount, 0)
                            + ISNULL(ii9.Discount, 0) + ISNULL(ii10.Discount, 0)
                            + ISNULL(ii11.Discount, 0) + ISNULL(ii12.Discount, 0))  AS NonDiscount,
       ji.SaleModelID,
       j.CustomerID,
       j.SaleTypeID,
       ji.StuffID,
       p.DlID,
       j.[Date]
FROM   sle.JustificationItem       AS ji
       JOIN SLE.Justification      AS j
            ON  j.JustificationID = ji.JustificationID
       join stf.[Stuff] AS s on s.StuffID = ji.StuffID     
       JOIN cfg.Party              AS p
            ON  p.PartyID = j.CustomerID
       LEFT JOIN (
                SELECT ii.JustificationItemID,
                       SUM(ii.MainQuantity) AS MainQuantity,
                       SUM(ii.SubQuantity) AS SubQuantity,
                       SUM(ii.Price)     AS Price,
                       SUM(ii.Discount)  AS Discount
                FROM   SLE.InvoiceItem   AS ii
                WHERE ii.JustificationItemID is NOT NULL
                GROUP BY
                       ii.JustificationItemID
            ) ii
            ON  ji.JustificationItemID = ii.JustificationItemID
       LEFT JOIN (
                SELECT oi.JustificationItemID,
                       SUM(ii2.MainQuantity) AS MainQuantity,
                       SUM(ii2.SubQuantity) AS SubQuantity,
                       SUM(ii2.Price)     AS Price,
                       SUM(ii2.Discount)  AS Discount
                FROM   STC.OutgoingItem   AS oi
                       JOIN SLE.InvoiceItem AS ii2
                            ON  ii2.OutgoingItemID = oi.OutgoingItemID
                WHERE oi.JustificationItemID is NOT NULL
                GROUP BY
                       oi.JustificationItemID
            ) ii2
            ON  ji.JustificationItemID = ii2.JustificationItemID
       LEFT JOIN (
                SELECT ri.JustificationItemID,
                       SUM(ii3.MainQuantity) AS MainQuantity,
                       SUM(ii3.SubQuantity) AS SubQuantity,
                       SUM(ii3.Price)     AS Price,
                       SUM(ii3.Discount)  AS Discount
                FROM   SLE.RemittanceItem AS ri
                       JOIN SLE.InvoiceItem AS ii3
                            ON  ii3.RemittanceItemID = ri.RemittanceItemID
                WHERE ri.JustificationItemID is NOT NULL         
                GROUP BY
                       ri.JustificationItemID
            ) ii3
            ON  ji.JustificationItemID = ii3.JustificationItemID
       LEFT JOIN (
                SELECT ri2.JustificationItemID,
                       SUM(ii4.MainQuantity) AS MainQuantity,
                       SUM(ii4.SubQuantity) AS SubQuantity,
                       SUM(ii4.Price)     AS Price,
                       SUM(ii4.Discount)  AS Discount
                FROM   SLE.RemittanceItem AS ri2
                       JOIN STC.OutgoingItem AS oi2
                            ON  oi2.RemittanceItemID = ri2.RemittanceItemID
                       JOIN SLE.InvoiceItem AS ii4
                            ON  ii4.OutgoingItemID = oi2.OutgoingItemID
                WHERE ri2.JustificationItemID is NOT NULL           
                GROUP BY
                       ri2.JustificationItemID
            ) ii4
            ON  ji.JustificationItemID = ii4.JustificationItemID
       LEFT JOIN (
                SELECT qi.JustificationItemID,
                       SUM(ii5.MainQuantity) AS MainQuantity,
                       SUM(ii5.SubQuantity) AS SubQuantity,
                       SUM(ii5.Price)     AS Price,
                       SUM(ii5.Discount)  AS Discount
                FROM   SLE.QuotationItem  AS qi
                       JOIN STC.OutgoingItem AS oi3
                            ON  oi3.QuotationItemID = qi.QuotationItemID
                       JOIN SLE.InvoiceItem AS ii5
                            ON  ii5.OutgoingItemID = oi3.OutgoingItemID
                WHERE qi.JustificationItemID is NOT NULL           
                GROUP BY
                       qi.JustificationItemID
            ) ii5
            ON  ji.JustificationItemID = ii5.JustificationItemID
       LEFT JOIN (
                SELECT qi2.JustificationItemID,
                       SUM(ii6.MainQuantity) AS MainQuantity,
                       SUM(ii6.SubQuantity) AS SubQuantity,
                       SUM(ii6.Price)     AS Price,
                       SUM(ii6.Discount)  AS Discount
                FROM   SLE.QuotationItem  AS qi2
                       JOIN SLE.RemittanceItem AS ri3
                            ON  ri3.QuotationItemID = qi2.QuotationItemID
                       JOIN SLE.InvoiceItem AS ii6
                            ON  ii6.RemittanceItemID = ri3.RemittanceItemID
                WHERE qi2.JustificationItemID is NOT NULL
                GROUP BY
                       qi2.JustificationItemID
            ) ii6
            ON  ji.JustificationItemID = ii6.JustificationItemID
       LEFT JOIN (
                SELECT qi3.JustificationItemID,
                       SUM(ii7.MainQuantity) AS MainQuantity,
                       SUM(ii7.SubQuantity) AS SubQuantity,
                       SUM(ii7.Price)     AS Price,
                       SUM(ii7.Discount)  AS Discount
                FROM   SLE.QuotationItem  AS qi3
                       JOIN SLE.RemittanceItem AS ri4
                            ON  ri4.QuotationItemID = qi3.QuotationItemID
                       JOIN STC.OutgoingItem AS oi4
                            ON  oi4.RemittanceItemID = ri4.RemittanceItemID
                       JOIN SLE.InvoiceItem AS ii7
                            ON  ii7.OutgoingItemID = oi4.OutgoingItemID
                WHERE qi3.JustificationItemID is NOT NULL 
                GROUP BY
                       qi3.JustificationItemID
            ) ii7
            ON  ji.JustificationItemID = ii7.JustificationItemID
       LEFT JOIN (
                SELECT qi4.JustificationItemID,
                       SUM(ii8.MainQuantity) AS MainQuantity,
                       SUM(ii8.SubQuantity) AS SubQuantity,
                       SUM(ii8.Price)     AS Price,
                       SUM(ii8.Discount)  AS Discount
                FROM   SLE.QuotationItem  AS qi4
                       JOIN SLE.InvoiceItem AS ii8
                            ON  ii8.QuotationItemID = qi4.QuotationItemID
                WHERE qi4.JustificationItemID is NOT NULL            
                GROUP BY
                       qi4.JustificationItemID
            ) ii8
            ON  ji.JustificationItemID = ii8.JustificationItemID
                --------------
                
       LEFT JOIN (
                SELECT qi5.JustificationItemID,
                       SUM(ii12.MainQuantity) AS MainQuantity,
                       SUM(ii12.SubQuantity) AS SubQuantity,
                       SUM(ii12.Price)    AS Price,
                       SUM(ii12.Discount) AS Discount
                FROM   SLE.QuotationItem  AS qi5
                       JOIN SLE.SaleContractItem AS sci
                            ON  sci.QuotationItemID = qi5.QuotationItemID
                       JOIN SLE.InvoiceItem AS ii12
                            ON  ii12.SaleContractItemID = sci.SaleContractItemID
                WHERE qi5.JustificationItemID is NOT NULL
                GROUP BY
                       qi5.JustificationItemID
            ) ii9
            ON  ji.JustificationItemID = ii9.JustificationItemID
       LEFT JOIN (
                SELECT qi5.JustificationItemID,
                       SUM(ii12.MainQuantity) AS MainQuantity,
                       SUM(ii12.SubQuantity) AS SubQuantity,
                       SUM(ii12.Price)    AS Price,
                       SUM(ii12.Discount) AS Discount
                FROM   SLE.QuotationItem  AS qi5
                       JOIN SLE.SaleContractItem AS sci
                            ON  sci.QuotationItemID = qi5.QuotationItemID
                       JOIN STC.OutgoingItem AS oi5
                            ON  oi5.SaleContractItemID = sci.SaleContractItemID
                       JOIN SLE.InvoiceItem AS ii12
                            ON  ii12.OutgoingItemID = oi5.OutgoingItemID
                WHERE qi5.JustificationItemID is NOT NULL            
                GROUP BY
                       qi5.JustificationItemID
            ) ii10
            ON  ji.JustificationItemID = ii10.JustificationItemID
       LEFT JOIN (
                SELECT qi5.JustificationItemID,
                       SUM(ii12.MainQuantity) AS MainQuantity,
                       SUM(ii12.SubQuantity) AS SubQuantity,
                       SUM(ii12.Price)    AS Price,
                       SUM(ii12.Discount) AS Discount
                FROM   SLE.QuotationItem  AS qi5
                       JOIN SLE.SaleContractItem AS sci
                            ON  sci.QuotationItemID = qi5.QuotationItemID
                       JOIN SLE.RemittanceItem AS ri5
                            ON  ri5.SaleContractItemID = sci.SaleContractItemID
                       JOIN STC.OutgoingItem AS oi5
                            ON  oi5.RemittanceItemID = ri5.RemittanceItemID
                       JOIN SLE.InvoiceItem AS ii12
                            ON  ii12.OutgoingItemID = oi5.OutgoingItemID
                WHERE qi5.JustificationItemID is NOT NULL            
                GROUP BY
                       qi5.JustificationItemID
            ) ii11
            ON  ji.JustificationItemID = ii11.JustificationItemID
       LEFT JOIN (
                SELECT qi5.JustificationItemID,
                       SUM(ii12.MainQuantity) AS MainQuantity,
                       SUM(ii12.SubQuantity) AS SubQuantity,
                       SUM(ii12.Price)    AS Price,
                       SUM(ii12.Discount) AS Discount
                FROM   SLE.QuotationItem  AS qi5
                       JOIN SLE.SaleContractItem AS sci
                            ON  sci.QuotationItemID = qi5.QuotationItemID
                       JOIN SLE.RemittanceItem AS ri5
                            ON  ri5.SaleContractItemID = sci.SaleContractItemID
                       JOIN SLE.InvoiceItem AS ii12
                            ON  ii12.RemittanceItemID = ri5.RemittanceItemID
                WHERE qi5.JustificationItemID is NOT NULL            
                GROUP BY
                       qi5.JustificationItemID
            ) ii12
            ON  ji.JustificationItemID = ii12.JustificationItemID
