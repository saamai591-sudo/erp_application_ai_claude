

CREATE   VIEW [SLE].Quotation_Invoice
AS
    SELECT  ii.QuotationItemID ,
            ii.InvoiceItemID
    FROM    SLE.InvoiceItem ii
    WHERE   QuotationItemID IS NOT NULL
    UNION
    SELECT  oi.QuotationItemID ,
            ii2.InvoiceItemID
    FROM    STC.OutgoingItem AS oi
            INNER JOIN SLE.InvoiceItem AS ii2 ON ii2.OutgoingItemId = oi.OutgoingItemID
    WHERE   oi.QuotationItemID IS NOT NULL
    UNION
    SELECT  ri.QuotationItemID ,
            ii3.InvoiceItemID
    FROM    SLE.RemittanceItem AS ri
            INNER JOIN SLE.InvoiceItem AS ii3 ON ii3.RemittanceItemID = ri.RemittanceItemID
    WHERE   ri.QuotationItemID IS NOT NULL
    UNION
    SELECT  ri2.QuotationItemID ,
            ii4.InvoiceItemID
    FROM    SLE.RemittanceItem AS ri2
            INNER JOIN STC.OutgoingItem AS oi2 ON oi2.RemittanceItemID = ri2.RemittanceItemID
            INNER JOIN SLE.InvoiceItem AS ii4 ON ii4.OutgoingItemId = oi2.OutgoingItemID
    WHERE   ri2.QuotationItemID IS NOT NULL
    UNION
    SELECT  sci.QuotationItemID ,
            ii.InvoiceItemID
    FROM    SLE.SaleContractItem AS sci
            INNER JOIN SLE.InvoiceItem AS ii ON ii.SaleContractItemID = sci.SaleContractItemID
    WHERE   sci.QuotationItemID IS NOT NULL
    UNION
    SELECT  sci.QuotationItemID ,
            ii.InvoiceItemID
    FROM    SLE.SaleContractItem AS sci
            JOIN STC.OutgoingItem AS oi ON oi.SaleContractItemID = sci.SaleContractItemID
            JOIN SLE.InvoiceItem AS ii ON ii.InvoiceItemID = oi.InvoiceItemID
    WHERE   sci.QuotationItemID IS NOT NULL
    UNION
    SELECT  sci.QuotationItemID ,
            ii.InvoiceItemID
    FROM    SLE.SaleContractItem AS sci
            JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
            JOIN SLE.InvoiceItem AS ii ON ii.InvoiceItemID = ri.InvoiceItemID
    WHERE   sci.QuotationItemID IS NOT NULL
    UNION
    SELECT  sci.QuotationItemID ,
            ii.InvoiceItemID
    FROM    SLE.SaleContractItem AS sci
            JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
            JOIN STC.OutgoingItem AS oi ON oi.RemittanceItemID = ri.RemittanceItemID
			JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi.OutgoingItemID
    WHERE   sci.QuotationItemID IS NOT NULL;
                         

