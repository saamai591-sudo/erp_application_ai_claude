
CREATE VIEW [SLE].[Justification_Invoice]
AS
    SELECT  ii.JustificationItemID ,
            ii.InvoiceItemID
    FROM    SLE.InvoiceItem AS ii
    WHERE   ii.JustificationItemID IS NOT NULL
    UNION
    SELECT  oi.JustificationItemID ,
            ii2.InvoiceItemID
    FROM    STC.OutgoingItem AS oi
            INNER JOIN SLE.InvoiceItem AS ii2 ON ii2.OutgoingItemId = oi.OutgoingItemID
    WHERE   oi.JustificationItemID IS NOT NULL
    UNION
    SELECT  ri.JustificationItemID ,
            ii3.InvoiceItemID
    FROM    SLE.RemittanceItem AS ri
            INNER JOIN SLE.InvoiceItem AS ii3 ON ii3.RemittanceItemID = ri.RemittanceItemID
    WHERE   ri.JustificationItemID IS NOT NULL
    UNION
    SELECT  ri2.JustificationItemID ,
            ii4.InvoiceItemID
    FROM    SLE.RemittanceItem AS ri2
            INNER JOIN STC.OutgoingItem AS oi2 ON oi2.RemittanceItemID = ri2.RemittanceItemID
            INNER JOIN SLE.InvoiceItem AS ii4 ON ii4.OutgoingItemId = oi2.OutgoingItemID
    WHERE   ri2.JustificationItemID IS NOT NULL
    UNION
    SELECT  qi.JustificationItemID ,
            ii5.InvoiceItemID
    FROM    SLE.QuotationItem AS qi
            INNER JOIN STC.OutgoingItem AS oi3 ON oi3.QuotationItemID = qi.QuotationItemID
            INNER JOIN SLE.InvoiceItem AS ii5 ON ii5.OutgoingItemId = oi3.OutgoingItemID
    WHERE   qi.JustificationItemID IS NOT NULL
    UNION
    SELECT  qi2.JustificationItemID ,
            ii6.InvoiceItemID
    FROM    SLE.QuotationItem AS qi2
            INNER JOIN SLE.RemittanceItem AS ri3 ON ri3.QuotationItemID = qi2.QuotationItemID
            INNER JOIN SLE.InvoiceItem AS ii6 ON ii6.RemittanceItemID = ri3.RemittanceItemID
    WHERE   qi2.JustificationItemID IS NOT NULL
    UNION
    SELECT  qi3.JustificationItemID ,
            ii7.InvoiceItemID
    FROM    SLE.QuotationItem AS qi3
            INNER JOIN SLE.RemittanceItem AS ri4 ON ri4.QuotationItemID = qi3.QuotationItemID
            INNER JOIN STC.OutgoingItem AS oi4 ON oi4.RemittanceItemID = ri4.RemittanceItemID
            INNER JOIN SLE.InvoiceItem AS ii7 ON ii7.OutgoingItemId = oi4.OutgoingItemID
    WHERE   qi3.JustificationItemID IS NOT NULL
    UNION
    SELECT  qi4.JustificationItemID ,
            ii8.InvoiceItemID
    FROM    SLE.QuotationItem AS qi4
            INNER JOIN SLE.InvoiceItem AS ii8 ON ii8.QuotationItemID = qi4.QuotationItemID
    WHERE   qi4.JustificationItemID IS NOT NULL
    UNION
    SELECT  qi.JustificationItemID ,
            ii.InvoiceItemID
    FROM    SLE.QuotationItem AS qi
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.QuotationItemID = qi.QuotationItemID
    WHERE   qi.JustificationItemID IS NOT NULL
    UNION
    SELECT  qi.JustificationItemID ,
            ii.InvoiceItemID
    FROM    SLE.QuotationItem AS qi
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN STC.OutgoingItem AS oi ON oi.QuotationItemID = qi.QuotationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.InvoiceItemID = oi.InvoiceItemID
    WHERE   qi.JustificationItemID IS NOT NULL
    UNION
    SELECT  qi.JustificationItemID ,
            ii.InvoiceItemID
    FROM    SLE.QuotationItem AS qi
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
            JOIN SLE.InvoiceItem AS ii ON ii.InvoiceItemID = ri.InvoiceItemID
    WHERE   qi.JustificationItemID IS NOT NULL
    UNION
    SELECT  qi.JustificationItemID ,
            ii.InvoiceItemID
    FROM    SLE.QuotationItem AS qi
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.RemittanceItemID = ri.RemittanceItemID
            JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi2.OutgoingItemID
    WHERE   qi.JustificationItemID IS NOT NULL;

