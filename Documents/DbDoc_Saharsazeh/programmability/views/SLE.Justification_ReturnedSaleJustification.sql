 CREATE VIEW [SLE].[Justification_ReturnedSaleJustification]
 AS
    SELECT  ji.JustificationItemID ,
            rsji.ReturnedSaleJustificationItemID
    FROM    SLE.JustificationItem AS ji
            JOIN STC.OutgoingItem AS oi ON oi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi.OutgoingItemID
            JOIN SLE.ReturnedSaleJustificationItem AS rsji ON rsji.InvoiceItemID = ii.InvoiceItemID
    UNION
 ----------------------------------------
    SELECT  ji.JustificationItemID ,
            rsji.ReturnedSaleJustificationItemID
    FROM    SLE.JustificationItem AS ji
            JOIN SLE.InvoiceItem AS ii ON ii.JustificationItemID = ji.JustificationItemID
            JOIN SLE.ReturnedSaleJustificationItem AS rsji ON rsji.InvoiceItemID = ii.InvoiceItemID
    UNION
 ----------------------------------------
    SELECT  ji.JustificationItemID ,
            rsji.ReturnedSaleJustificationItemID
    FROM    SLE.JustificationItem AS ji
            JOIN SLE.RemittanceItem AS ri ON ri.JustificationItemID = ji.JustificationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.RemittanceItemID = ri.RemittanceItemID
            JOIN SLE.ReturnedSaleJustificationItem AS rsji ON rsji.InvoiceItemID = ii.InvoiceItemID
    UNION
 ----------------------------------------
    SELECT  ji.JustificationItemID ,
            rsji.ReturnedSaleJustificationItemID
    FROM    SLE.JustificationItem AS ji
            JOIN SLE.RemittanceItem AS ri ON ri.JustificationItemID = ji.JustificationItemID
            JOIN STC.OutgoingItem AS oi ON oi.RemittanceItemID = ri.RemittanceItemID
            JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi.OutgoingItemID
            JOIN SLE.ReturnedSaleJustificationItem AS rsji ON rsji.InvoiceItemID = ii.InvoiceItemID
    UNION
 ----------------------------------------
    SELECT  ji.JustificationItemID ,
            rsji.ReturnedSaleJustificationItemID
    FROM    SLE.JustificationItem AS ji
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN STC.OutgoingItem AS oi ON oi.QuotationItemID = qi.QuotationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi.OutgoingItemID
            JOIN SLE.ReturnedSaleJustificationItem AS rsji ON rsji.InvoiceItemID = ii.InvoiceItemID
    UNION
 ----------------------------------------
    SELECT  ji.JustificationItemID ,
            rsji.ReturnedSaleJustificationItemID
    FROM    SLE.JustificationItem AS ji
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.QuotationItemID = qi.QuotationItemID
            JOIN SLE.ReturnedSaleJustificationItem AS rsji ON rsji.InvoiceItemID = ii.InvoiceItemID
    UNION
 ----------------------------------------
    SELECT  ji.JustificationItemID ,
            rsji.ReturnedSaleJustificationItemID
    FROM    SLE.JustificationItem AS ji
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.QuotationItemID = qi.QuotationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.RemittanceItemID = ri.RemittanceItemID
            JOIN SLE.ReturnedSaleJustificationItem AS rsji ON rsji.InvoiceItemID = ii.InvoiceItemID
    UNION
 ----------------------------------------
    SELECT  ji.JustificationItemID ,
            rsji.ReturnedSaleJustificationItemID
    FROM    SLE.JustificationItem AS ji
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.QuotationItemID = qi.QuotationItemID
            JOIN STC.OutgoingItem AS oi ON oi.RemittanceItemID = ri.RemittanceItemID
            JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi.OutgoingItemID
            JOIN SLE.ReturnedSaleJustificationItem AS rsji ON rsji.InvoiceItemID = ii.InvoiceItemID
    UNION
 ----------------------------------------
    SELECT  ji.JustificationItemID ,
            rsji.ReturnedSaleJustificationItemID
    FROM    SLE.JustificationItem AS ji
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.SaleContractItemID = sci.SaleContractItemID
            JOIN SLE.ReturnedSaleJustificationItem AS rsji ON rsji.InvoiceItemID = ii.InvoiceItemID
    UNION
 ----------------------------------------
    SELECT  ji.JustificationItemID ,
            rsji.ReturnedSaleJustificationItemID
    FROM    SLE.JustificationItem AS ji
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN STC.OutgoingItem AS oi ON oi.SaleContractItemID = sci.SaleContractItemID
            JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi.OutgoingItemID
            JOIN SLE.ReturnedSaleJustificationItem AS rsji ON rsji.InvoiceItemID = ii.InvoiceItemID
    UNION
 ----------------------------------------
    SELECT  ji.JustificationItemID ,
            rsji.ReturnedSaleJustificationItemID
    FROM    SLE.JustificationItem AS ji
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
            JOIN STC.OutgoingItem AS oi ON oi.RemittanceItemID = ri.RemittanceItemID
            JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi.OutgoingItemID
            JOIN SLE.ReturnedSaleJustificationItem AS rsji ON rsji.InvoiceItemID = ii.InvoiceItemID
    UNION
 ----------------------------------------
    SELECT  ji.JustificationItemID ,
            rsji.ReturnedSaleJustificationItemID
    FROM    SLE.JustificationItem AS ji
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
            JOIN SLE.InvoiceItem AS ii ON ii.RemittanceItemID = ri.RemittanceItemID
            JOIN SLE.ReturnedSaleJustificationItem AS rsji ON rsji.InvoiceItemID = ii.InvoiceItemID;
		
