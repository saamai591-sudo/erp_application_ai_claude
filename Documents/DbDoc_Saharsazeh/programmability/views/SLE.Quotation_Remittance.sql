
CREATE VIEW [SLE].[Quotation_Remittance]
AS
    SELECT  oi.QuotationItemID ,
            ri.RemittanceItemID
    FROM    STC.OutgoingItem AS oi
            INNER JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi.OutgoingItemID
            INNER JOIN SLE.RemittanceItem AS ri ON ri.InvoiceItemID = ii.InvoiceItemID
    WHERE   oi.QuotationItemID IS NOT NULL
    UNION
    SELECT  ri2.QuotationItemID ,
            ri2.RemittanceItemID
    FROM    SLE.RemittanceItem AS ri2
    WHERE   ri2.QuotationItemID IS NOT NULL
    UNION
    SELECT  ii2.QuotationItemID ,
            ri3.RemittanceItemID
    FROM    SLE.InvoiceItem AS ii2
            INNER JOIN SLE.RemittanceItem AS ri3 ON ri3.InvoiceItemID = ii2.InvoiceItemID
    WHERE   ii2.QuotationItemID IS NOT NULL
    UNION
    SELECT  sci.QuotationItemID ,
            ri.RemittanceItemID
    FROM    SLE.SaleContractItem AS sci
            JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
    WHERE   sci.QuotationItemID IS NOT NULL
    UNION
    SELECT  sci.QuotationItemID ,
            ri.RemittanceItemID
    FROM    SLE.SaleContractItem AS sci
            JOIN SLE.InvoiceItem AS ii ON ii.SaleContractItemID = sci.SaleContractItemID
            JOIN SLE.RemittanceItem AS ri ON ri.InvoiceItemID = ii.InvoiceItemID
    WHERE   sci.QuotationItemID IS NOT NULL;

