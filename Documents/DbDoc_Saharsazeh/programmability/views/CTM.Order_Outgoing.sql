CREATE VIEW [CTM].[Order_Outgoing]
AS
    SELECT  oi.OrderItemID ,
            oi2.OutgoingItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.JustificationItemID = ji.JustificationItemID
    UNION
    SELECT  oi.OrderItemID ,
            oi2.OutgoingItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.InvoiceItem AS ii ON ii.JustificationItemID = ji.JustificationItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.InvoiceItemID = ii.InvoiceItemID
    UNION
    SELECT  oi.OrderItemID ,
            oi2.OutgoingItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.InvoiceItem AS ii ON ii.JustificationItemID = ji.JustificationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.InvoiceItemID = ii.InvoiceItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.RemittanceItemID = ri.RemittanceItemID
    UNION
    SELECT  oi.OrderItemID ,
            oi2.OutgoingItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.RemittanceItem AS ri ON ri.JustificationItemID = ji.JustificationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.RemittanceItemID = ri.RemittanceItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.InvoiceItemID = ii.InvoiceItemID
    UNION
    SELECT  oi.OrderItemID ,
            oi2.OutgoingItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.RemittanceItem AS ri ON ri.JustificationItemID = ji.JustificationItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.RemittanceItemID = ri.RemittanceItemID
    UNION
    SELECT  oi.OrderItemID ,
            oi2.OutgoingItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.QuotationItemID = qi.QuotationItemID
    UNION
    SELECT  oi.OrderItemID ,
            oi2.OutgoingItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.QuotationItemID = qi.QuotationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.RemittanceItemID = ri.RemittanceItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.InvoiceItemID = ii.InvoiceItemID
    UNION
    SELECT  oi.OrderItemID ,
            oi2.OutgoingItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.QuotationItemID = qi.QuotationItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.RemittanceItemID = ri.RemittanceItemID
    UNION
    SELECT  oi.OrderItemID ,
            oi2.OutgoingItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.SaleContractItemID = sci.SaleContractItemID
    UNION
    SELECT  oi.OrderItemID ,
            oi2.OutgoingItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.SaleContractItemID = sci.SaleContractItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.InvoiceItemID = ii.InvoiceItemID
    UNION
    SELECT  oi.OrderItemID ,
            oi2.OutgoingItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
            JOIN SLE.InvoiceItem AS ii ON ii.RemittanceItemID = ri.RemittanceItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.InvoiceItemID = ii.InvoiceItemID
    UNION
    SELECT  oi.OrderItemID ,
            oi2.OutgoingItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.RemittanceItemID = ri.RemittanceItemID
    UNION
    SELECT  oi.OrderItemID ,
            oi2.OutgoingItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.QuotationItemID = qi.QuotationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.InvoiceItemID = ii.InvoiceItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.RemittanceItemID = ri.RemittanceItemID
    UNION
    SELECT  oi.OrderItemID ,
            oi2.OutgoingItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.QuotationItemID = qi.QuotationItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.InvoiceItemID = ii.InvoiceItemID
	UNION 
	--- quotation
	  SELECT  oi.OrderItemID ,
            oi2.OutgoingItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.QuotationItem AS qi ON qi.OrderItemID = oi.OrderItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.QuotationItemID = qi.QuotationItemID
    UNION
    SELECT  oi.OrderItemID ,
            oi2.OutgoingItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.QuotationItem AS qi ON qi.OrderItemID = oi.OrderItemID
            JOIN SLE.RemittanceItem AS ri ON ri.QuotationItemID = qi.QuotationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.InvoiceItemID = ri.InvoiceItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.OutgoingItemID = ii.OutgoingItemId
    UNION
    SELECT  oi.OrderItemID ,
            oi2.OutgoingItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.QuotationItem AS qi ON qi.OrderItemID = oi.OrderItemID
            JOIN SLE.RemittanceItem AS ri ON ri.QuotationItemID = qi.QuotationItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.RemittanceItemID = ri.RemittanceItemID
    UNION
    SELECT  oi.OrderItemID ,
            oi2.OutgoingItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.QuotationItem AS qi ON qi.OrderItemID = oi.OrderItemID
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.SaleContractItemID = sci.SaleContractItemID
    UNION
    SELECT  oi.OrderItemID ,
            oi2.OutgoingItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.QuotationItem AS qi ON qi.OrderItemID = oi.OrderItemID
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.SaleContractItemID = sci.SaleContractItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.InvoiceItemID = ii.InvoiceItemID
    UNION
    SELECT  oi.OrderItemID ,
            oi2.OutgoingItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.QuotationItem AS qi ON qi.OrderItemID = oi.OrderItemID
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
            JOIN SLE.InvoiceItem AS ii ON ii.RemittanceItemID = ri.RemittanceItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.InvoiceItemID = ii.InvoiceItemID
    UNION
    SELECT  oi.OrderItemID ,
            oi2.OutgoingItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.QuotationItem AS qi ON  qi.OrderItemID = oi.OrderItemID
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.RemittanceItemID = ri.RemittanceItemID
    UNION
    SELECT  oi.OrderItemID ,
            oi2.OutgoingItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.QuotationItem AS qi ON  qi.OrderItemID = oi.OrderItemID
            JOIN SLE.InvoiceItem AS ii ON ii.QuotationItemID = qi.QuotationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.InvoiceItemID = ii.InvoiceItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.RemittanceItemID = ri.RemittanceItemID
    UNION
    SELECT  oi.OrderItemID ,
            oi2.OutgoingItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.QuotationItem AS qi ON  qi.OrderItemID = oi.OrderItemID
            JOIN SLE.InvoiceItem AS ii ON ii.QuotationItemID = qi.QuotationItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.InvoiceItemID = ii.InvoiceItemID

