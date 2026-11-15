CREATE VIEW [CTM].[Order_Invoice]
AS
    SELECT  oi.OrderItemID ,
            ii.InvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.JustificationItemID = ji.JustificationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi2.OutgoingItemID
    UNION
    SELECT  oi.OrderItemID ,
            ii.InvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.InvoiceItem AS ii ON ii.JustificationItemID = ji.JustificationItemID
    UNION
    SELECT  oi.OrderItemID ,
            ii.InvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.RemittanceItem AS ri ON ri.JustificationItemID = ji.JustificationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.RemittanceItemID = ri.RemittanceItemID
    UNION
    SELECT  oi.OrderItemID ,
            ii.InvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.RemittanceItem AS ri ON ri.JustificationItemID = ji.JustificationItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.RemittanceItemID = ri.RemittanceItemID
            JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi2.OutgoingItemID
    UNION
    SELECT  oi.OrderItemID ,
            ii.InvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.QuotationItemID = qi.QuotationItemID
    UNION
    SELECT  oi.OrderItemID ,
            ii.InvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.QuotationItemID = qi.QuotationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi2.OutgoingItemID
    UNION
    SELECT  oi.OrderItemID ,
            ii.InvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.SaleContractItemID = sci.SaleContractItemID
    UNION
    SELECT  oi.OrderItemID ,
            ii.InvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.SaleContractItemID = sci.SaleContractItemID
            JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi2.OutgoingItemID
    UNION
    SELECT  oi.OrderItemID ,
            ii.InvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.RemittanceItemID = ri.RemittanceItemID
            JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi2.OutgoingItemID
    UNION
    SELECT  oi.OrderItemID ,
            ii.InvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
            JOIN SLE.InvoiceItem AS ii ON ii.RemittanceItemID = ri.RemittanceItemID
    UNION
    SELECT  oi.OrderItemID ,
            ii.InvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.QuotationItemID = qi.QuotationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.RemittanceItemID = ri.RemittanceItemID
    UNION
    SELECT  oi.OrderItemID ,
            ii.InvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.QuotationItemID = qi.QuotationItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.RemittanceItemID = ri.RemittanceItemID
            JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi2.OutgoingItemID
