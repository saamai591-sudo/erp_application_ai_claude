CREATE VIEW [CTM].[Order_Remittance]
AS
    SELECT  oi.OrderItemID ,
            ri.RemittanceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.RemittanceItem AS ri ON ri.JustificationItemID = ji.JustificationItemID
    UNION
    SELECT  oi.OrderItemID ,
            ri.RemittanceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.InvoiceItem AS ii ON ii.JustificationItemID = ji.JustificationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.InvoiceItemID = ii.InvoiceItemID
    UNION
    SELECT  oi.OrderItemID ,
            ri.RemittanceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.QuotationItemID = qi.QuotationItemID
    UNION
    SELECT  oi.OrderItemID ,
            ri.RemittanceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.QuotationItem AS qi ON qi.OrderItemID = oi.OrderItemID
            JOIN SLE.RemittanceItem AS ri ON ri.QuotationItemID = qi.QuotationItemID
    UNION
    SELECT  oi.OrderItemID ,
            ri.RemittanceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
    UNION
    SELECT  oi.OrderItemID ,
            ri.RemittanceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.QuotationItemID = qi.QuotationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.InvoiceItemID = ii.InvoiceItemID; 


