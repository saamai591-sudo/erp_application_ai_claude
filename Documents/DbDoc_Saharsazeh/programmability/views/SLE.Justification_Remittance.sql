
CREATE VIEW [SLE].[Justification_Remittance]
AS
    SELECT  ri.JustificationItemID ,
            ri.RemittanceItemID
    FROM    SLE.RemittanceItem ri
    WHERE   ri.JustificationItemID IS NOT NULL
    UNION
    SELECT  qi.JustificationItemID ,
            ri2.RemittanceItemID
    FROM    SLE.QuotationItem AS qi
            INNER JOIN STC.OutgoingItem AS oi ON oi.QuotationItemID = qi.QuotationItemID
            INNER JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi.OutgoingItemID
            INNER JOIN SLE.RemittanceItem AS ri2 ON ri2.InvoiceItemID = ii.InvoiceItemID
    WHERE   qi.JustificationItemID IS NOT NULL
    UNION
    SELECT  qi2.JustificationItemID ,
            ri3.RemittanceItemID
    FROM    SLE.QuotationItem AS qi2
            INNER JOIN SLE.RemittanceItem AS ri3 ON ri3.QuotationItemID = qi2.QuotationItemID
    WHERE   qi2.JustificationItemID IS NOT NULL
    UNION
    SELECT  qi3.JustificationItemID ,
            ri4.RemittanceItemID
    FROM    SLE.QuotationItem AS qi3
            INNER JOIN SLE.InvoiceItem AS ii2 ON ii2.QuotationItemID = qi3.QuotationItemID
            INNER JOIN SLE.RemittanceItem AS ri4 ON ri4.InvoiceItemID = ii2.InvoiceItemID
    WHERE   qi3.JustificationItemID IS NOT NULL
    UNION
    SELECT  ii3.JustificationItemID ,
            ri5.RemittanceItemID
    FROM    SLE.InvoiceItem AS ii3
            INNER JOIN SLE.RemittanceItem AS ri5 ON ri5.InvoiceItemID = ii3.InvoiceItemID
    WHERE   ii3.JustificationItemID IS NOT NULL
    UNION
    SELECT  oi2.JustificationItemID ,
            ri6.RemittanceItemID
    FROM    STC.OutgoingItem AS oi2
            INNER JOIN SLE.InvoiceItem AS ii4 ON ii4.OutgoingItemId = oi2.OutgoingItemID
            INNER JOIN SLE.RemittanceItem AS ri6 ON ri6.InvoiceItemID = ii4.InvoiceItemID
    WHERE   oi2.JustificationItemID IS NOT NULL
	----------
    UNION
    SELECT  qi.JustificationItemID ,
            ri.RemittanceItemID
    FROM    SLE.QuotationItem AS qi
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
    UNION
    SELECT  qi.JustificationItemID ,
            ri.RemittanceItemID
    FROM    SLE.QuotationItem AS qi
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.SaleContractItemID = sci.SaleContractItemID
            JOIN SLE.RemittanceItem AS ri ON ri.RemittanceItemID = ii.RemittanceItemID


