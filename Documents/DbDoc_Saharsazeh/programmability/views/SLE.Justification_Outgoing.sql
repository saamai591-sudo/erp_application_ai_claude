
CREATE VIEW [SLE].[Justification_Outgoing]
AS
    SELECT  qi.JustificationItemID ,
            oi.OutgoingItemID
    FROM    SLE.QuotationItem AS qi
            INNER JOIN STC.OutgoingItem AS oi ON oi.QuotationItemID = qi.QuotationItemID
    WHERE   qi.JustificationItemID IS NOT NULL
    UNION
    SELECT  qi2.JustificationItemID ,
            oi2.OutgoingItemID
    FROM    SLE.QuotationItem AS qi2
            INNER JOIN SLE.RemittanceItem AS ri ON ri.QuotationItemID = qi2.QuotationItemID
            INNER JOIN SLE.InvoiceItem AS ii ON ii.RemittanceItemID = ri.RemittanceItemID
            INNER JOIN STC.OutgoingItem AS oi2 ON oi2.InvoiceItemID = ii.InvoiceItemID
    WHERE   qi2.JustificationItemID IS NOT NULL
    UNION
    SELECT  qi3.JustificationItemID ,
            oi3.OutgoingItemID
    FROM    SLE.QuotationItem AS qi3
            INNER JOIN SLE.RemittanceItem AS ri2 ON ri2.QuotationItemID = qi3.QuotationItemID
            INNER JOIN STC.OutgoingItem AS oi3 ON oi3.RemittanceItemID = ri2.RemittanceItemID
    WHERE   qi3.JustificationItemID IS NOT NULL
    UNION
    SELECT  qi4.JustificationItemID ,
            oi4.OutgoingItemID
    FROM    SLE.QuotationItem AS qi4
            INNER JOIN SLE.InvoiceItem AS ii2 ON ii2.QuotationItemID = qi4.QuotationItemID
            INNER JOIN SLE.RemittanceItem AS ri3 ON ri3.InvoiceItemID = ii2.InvoiceItemID
            INNER JOIN STC.OutgoingItem AS oi4 ON oi4.RemittanceItemID = ri3.RemittanceItemID
    WHERE   qi4.JustificationItemID IS NOT NULL
    UNION
    SELECT  qi5.JustificationItemID ,
            oi5.OutgoingItemID
    FROM    SLE.QuotationItem AS qi5
            INNER JOIN SLE.InvoiceItem AS ii3 ON ii3.QuotationItemID = qi5.QuotationItemID
            INNER JOIN STC.OutgoingItem AS oi5 ON oi5.InvoiceItemID = ii3.InvoiceItemID
    WHERE   qi5.JustificationItemID IS NOT NULL
    UNION
    SELECT  ri4.JustificationItemID ,
            oi6.OutgoingItemID
    FROM    SLE.RemittanceItem AS ri4
            INNER JOIN STC.OutgoingItem AS oi6 ON oi6.RemittanceItemID = ri4.RemittanceItemID
    WHERE   ri4.JustificationItemID IS NOT NULL
    UNION
    SELECT  ri5.JustificationItemID ,
            oi7.OutgoingItemID
    FROM    SLE.RemittanceItem AS ri5
            INNER JOIN SLE.InvoiceItem AS ii4 ON ii4.RemittanceItemID = ri5.RemittanceItemID
            INNER JOIN STC.OutgoingItem AS oi7 ON oi7.InvoiceItemID = ii4.InvoiceItemID
    WHERE   ri5.JustificationItemID IS NOT NULL
    UNION
    SELECT  ii5.JustificationItemID ,
            oi8.OutgoingItemID
    FROM    SLE.InvoiceItem AS ii5
            INNER JOIN STC.OutgoingItem AS oi8 ON oi8.InvoiceItemID = ii5.InvoiceItemID
    WHERE   ii5.JustificationItemID IS NOT NULL
    UNION
    SELECT  ii6.JustificationItemID ,
            oi9.OutgoingItemID
    FROM    SLE.InvoiceItem AS ii6
            INNER JOIN SLE.RemittanceItem AS ri6 ON ri6.InvoiceItemID = ii6.InvoiceItemID
            INNER JOIN STC.OutgoingItem AS oi9 ON oi9.RemittanceItemID = ri6.RemittanceItemID
    WHERE   ii6.JustificationItemID IS NOT NULL
    UNION
    SELECT  JustificationItemID ,
            OutgoingItemID
    FROM    STC.OutgoingItem
    WHERE   JustificationItemID IS NOT NULL
    UNION
    SELECT  qi5.JustificationItemID ,
            oi11.OutgoingItemID
    FROM    SLE.QuotationItem AS qi5
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi5.QuotationItemID
            JOIN SLE.InvoiceItem AS ii12 ON ii12.SaleContractItemID = sci.SaleContractItemID
            JOIN STC.OutgoingItem AS oi11 ON oi11.OutgoingItemID = ii12.OutgoingItemId
    WHERE   qi5.JustificationItemID IS NOT NULL
    UNION
    SELECT  qi5.JustificationItemID ,
            oi5.OutgoingItemID
    FROM    SLE.QuotationItem AS qi5
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi5.QuotationItemID
            JOIN STC.OutgoingItem AS oi5 ON oi5.SaleContractItemID = sci.SaleContractItemID
    WHERE   qi5.JustificationItemID IS NOT NULL
    UNION
    SELECT  qi5.JustificationItemID ,
            oi5.OutgoingItemID
    FROM    SLE.QuotationItem AS qi5
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi5.QuotationItemID
            JOIN SLE.RemittanceItem AS ri5 ON ri5.SaleContractItemID = sci.SaleContractItemID
            JOIN STC.OutgoingItem AS oi5 ON oi5.RemittanceItemID = ri5.RemittanceItemID
    WHERE   qi5.JustificationItemID IS NOT NULL
    UNION
    SELECT  qi5.JustificationItemID ,
            oi12.OutgoingItemID
    FROM    SLE.QuotationItem AS qi5
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi5.QuotationItemID
            JOIN SLE.RemittanceItem AS ri5 ON ri5.SaleContractItemID = sci.SaleContractItemID
            JOIN SLE.InvoiceItem AS ii12 ON ii12.RemittanceItemID = ri5.RemittanceItemID
            JOIN STC.OutgoingItem AS oi12 ON oi12.OutgoingItemID = ii12.OutgoingItemId
    WHERE   qi5.JustificationItemID IS NOT NULL
    UNION
    SELECT  qi5.JustificationItemID ,
            oi11.OutgoingItemID
    FROM    SLE.QuotationItem AS qi5
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi5.QuotationItemID
            JOIN SLE.InvoiceItem AS ii12 ON ii12.SaleContractItemID = sci.SaleContractItemID
            JOIN SLE.RemittanceItem AS ri7 ON ri7.InvoiceItemID = ii12.InvoiceItemID
            JOIN STC.OutgoingItem AS oi11 ON oi11.RemittanceItemID = ri7.RemittanceItemID
    WHERE   qi5.JustificationItemID IS NOT NULL;

