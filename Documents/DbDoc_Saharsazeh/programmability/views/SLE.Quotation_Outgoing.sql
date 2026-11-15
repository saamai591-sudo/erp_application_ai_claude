

CREATE   VIEW [SLE].Quotation_Outgoing
AS
    SELECT  oi.QuotationItemID ,			
            oi.OutgoingItemID,
            qi.QuotationID,
            oi.OutgoingID
    FROM    STC.OutgoingItem oi
    join sle.QuotationItem AS qi on qi.QuotationItemID = oi.QuotationItemID
   
    UNION
    SELECT  ri.QuotationItemID ,
            oi.OutgoingItemID,
            qi.QuotationID,
            oi.OutgoingID
    FROM    SLE.RemittanceItem AS ri
            INNER JOIN SLE.InvoiceItem AS ii ON ii.RemittanceItemID = ri.RemittanceItemID
            INNER JOIN STC.OutgoingItem AS oi ON oi.InvoiceItemID = ii.InvoiceItemID
            join sle.QuotationItem AS qi on qi.QuotationItemID = ri.QuotationItemID
    UNION
    SELECT  ri.QuotationItemID ,
            oi.OutgoingItemID,
            qi.QuotationID,
            oi.OutgoingID
    FROM    SLE.RemittanceItem AS ri
            INNER JOIN STC.OutgoingItem AS oi ON oi.RemittanceItemID = ri.RemittanceItemID
            join sle.QuotationItem AS qi on qi.QuotationItemID = ri.QuotationItemID
    UNION
    SELECT  ii.QuotationItemID ,
            oi.OutgoingItemID,
            qi.QuotationID,
            oi.OutgoingID
    FROM    SLE.InvoiceItem AS ii
            INNER JOIN STC.OutgoingItem AS oi ON oi.InvoiceItemID = ii.InvoiceItemID
            join sle.QuotationItem AS qi on qi.QuotationItemID = ii.QuotationItemID
    UNION
    SELECT  ii.QuotationItemID ,
            oi.OutgoingItemID,
            qi.QuotationID,
            oi.OutgoingID
    FROM    SLE.InvoiceItem AS ii
            INNER JOIN SLE.RemittanceItem AS ri ON ri.InvoiceItemID = ii.InvoiceItemID
            INNER JOIN STC.OutgoingItem AS oi ON oi.RemittanceItemID = ri.RemittanceItemID
            join sle.QuotationItem AS qi on ii.QuotationItemID = qi.QuotationItemID
    UNION
    SELECT  sci.QuotationItemID ,
            oi.OutgoingItemID,
            qi.QuotationID,
            oi.OutgoingID
    FROM    SLE.SaleContractItem AS sci
            JOIN STC.OutgoingItem AS oi ON oi.SaleContractItemID = sci.SaleContractItemID
            join sle.QuotationItem AS qi on qi.QuotationItemID = sci.QuotationItemID
    UNION
    SELECT  sci.QuotationItemID ,
            oi.OutgoingItemID,
            qi.QuotationID,
            oi.OutgoingID
    FROM    SLE.SaleContractItem AS sci
            JOIN SLE.InvoiceItem AS ii ON ii.SaleContractItemID = sci.SaleContractItemID
            JOIN STC.OutgoingItem AS oi ON oi.InvoiceItemID = ii.InvoiceItemID
            join sle.QuotationItem AS qi on qi.QuotationItemID = sci.QuotationItemID
    UNION
    SELECT  sci.QuotationItemID ,
            oi.OutgoingItemID,
            qi.QuotationID,
            oi.OutgoingID
    FROM    SLE.SaleContractItem AS sci
            JOIN SLE.InvoiceItem AS ii ON ii.SaleContractItemID = sci.SaleContractItemID
            JOIN SLE.RemittanceItem AS ri ON ri.InvoiceItemID = ii.InvoiceItemID
            JOIN STC.OutgoingItem AS oi ON oi.RemittanceItemID = ri.RemittanceItemID
            join sle.QuotationItem AS qi on qi.QuotationItemID = sci.QuotationItemID
    UNION
    SELECT  sci.QuotationItemID ,
            oi.OutgoingItemID,
            qi.QuotationID,
            oi.OutgoingID
    FROM    SLE.SaleContractItem AS sci
            JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
            JOIN STC.OutgoingItem AS oi ON oi.RemittanceItemID = ri.RemittanceItemID
            join sle.QuotationItem AS qi on qi.QuotationItemID = sci.QuotationItemID
    UNION
    SELECT  sci.QuotationItemID ,
            oi.OutgoingItemID,
            qi.QuotationID,
            oi.OutgoingID
    FROM    SLE.SaleContractItem AS sci
            JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
            JOIN SLE.InvoiceItem AS ii ON ii.InvoiceItemID = ri.InvoiceItemID
            JOIN STC.OutgoingItem AS oi ON oi.InvoiceItemID = ii.InvoiceItemID
            join sle.QuotationItem AS qi on qi.QuotationItemID = sci.QuotationItemID;

