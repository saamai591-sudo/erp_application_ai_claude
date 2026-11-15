CREATE VIEW [CTM].[Order_ReturnedSaleInvoice]
AS
    SELECT  oi.OrderItemID ,
            rsii.ReturnedSaleInvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.JustificationItemID = ji.JustificationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi2.OutgoingItemID
            JOIN SLE.ReturnedSaleInvoiceItem AS rsii ON rsii.InvoiceItemID = ii.InvoiceItemID
    UNION
    SELECT  oi.OrderItemID ,
            rsii.ReturnedSaleInvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.JustificationItemID = ji.JustificationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi2.OutgoingItemID
            JOIN SLE.ReturnedSaleJustificationItem AS rsji ON rsji.InvoiceItemID = ii.InvoiceItemID
            JOIN SLE.ReturnedSaleInvoiceItem AS rsii ON rsii.ReturnedSaleJustificationItemID = rsji.ReturnedSaleJustificationItemID
    UNION
  -----------------------------------------------
    SELECT  oi.OrderItemID ,
            rsii.ReturnedSaleInvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.InvoiceItem AS ii ON ii.JustificationItemID = ji.JustificationItemID
            JOIN SLE.ReturnedSaleInvoiceItem AS rsii ON rsii.InvoiceItemID = ii.InvoiceItemID
    UNION
    SELECT  oi.OrderItemID ,
            rsii.ReturnedSaleInvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.InvoiceItem AS ii ON ii.JustificationItemID = ji.JustificationItemID
            JOIN SLE.ReturnedSaleJustificationItem AS rsji ON rsji.InvoiceItemID = ii.InvoiceItemID
            JOIN SLE.ReturnedSaleInvoiceItem AS rsii ON rsii.ReturnedSaleJustificationItemID = rsji.ReturnedSaleJustificationItemID
    UNION
  ----------------------------------------
    SELECT  oi.OrderItemID ,
            rsii.ReturnedSaleInvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.RemittanceItem AS ri ON ri.JustificationItemID = ji.JustificationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.RemittanceItemID = ri.RemittanceItemID
            JOIN SLE.ReturnedSaleInvoiceItem AS rsii ON rsii.InvoiceItemID = ii.InvoiceItemID
    UNION
    SELECT  oi.OrderItemID ,
            rsii.ReturnedSaleInvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.RemittanceItem AS ri ON ri.JustificationItemID = ji.JustificationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.RemittanceItemID = ri.RemittanceItemID
            JOIN SLE.ReturnedSaleJustificationItem AS rsji ON rsji.InvoiceItemID = ii.InvoiceItemID
            JOIN SLE.ReturnedSaleInvoiceItem AS rsii ON rsii.ReturnedSaleJustificationItemID = rsji.ReturnedSaleJustificationItemID
    UNION
  -----------------------------------------
    SELECT  oi.OrderItemID ,
            rsii.ReturnedSaleInvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.RemittanceItem AS ri ON ri.JustificationItemID = ji.JustificationItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.RemittanceItemID = ri.RemittanceItemID
            JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi2.OutgoingItemID
            JOIN SLE.ReturnedSaleInvoiceItem AS rsii ON rsii.InvoiceItemID = ii.InvoiceItemID
    UNION
    SELECT  oi.OrderItemID ,
            rsii.ReturnedSaleInvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.RemittanceItem AS ri ON ri.JustificationItemID = ji.JustificationItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.RemittanceItemID = ri.RemittanceItemID
            JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi2.OutgoingItemID
            JOIN SLE.ReturnedSaleJustificationItem AS rsji ON rsji.InvoiceItemID = ii.InvoiceItemID
            JOIN SLE.ReturnedSaleInvoiceItem AS rsii ON rsii.ReturnedSaleJustificationItemID = rsji.ReturnedSaleJustificationItemID
    UNION
  -----------------------------------------
    SELECT  oi.OrderItemID ,
            rsii.ReturnedSaleInvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.QuotationItemID = qi.QuotationItemID
            JOIN SLE.ReturnedSaleInvoiceItem AS rsii ON rsii.InvoiceItemID = ii.InvoiceItemID
    UNION
    SELECT  oi.OrderItemID ,
            rsii.ReturnedSaleInvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.QuotationItemID = qi.QuotationItemID
            JOIN SLE.ReturnedSaleJustificationItem AS rsji ON rsji.InvoiceItemID = ii.InvoiceItemID
            JOIN SLE.ReturnedSaleInvoiceItem AS rsii ON rsii.ReturnedSaleJustificationItemID = rsji.ReturnedSaleJustificationItemID
    UNION
  -----------------------------------------
    SELECT  oi.OrderItemID ,
            rsii.ReturnedSaleInvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.QuotationItemID = qi.QuotationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi2.OutgoingItemID
            JOIN SLE.ReturnedSaleInvoiceItem AS rsii ON rsii.InvoiceItemID = ii.InvoiceItemID
    UNION
    SELECT  oi.OrderItemID ,
            rsii.ReturnedSaleInvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.QuotationItemID = qi.QuotationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi2.OutgoingItemID
            JOIN SLE.ReturnedSaleJustificationItem AS rsji ON rsji.InvoiceItemID = ii.InvoiceItemID
            JOIN SLE.ReturnedSaleInvoiceItem AS rsii ON rsii.ReturnedSaleJustificationItemID = rsji.ReturnedSaleJustificationItemID
    UNION
  -----------------------------------------
    SELECT  oi.OrderItemID ,
            rsii.ReturnedSaleInvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.SaleContractItemID = sci.SaleContractItemID
            JOIN SLE.ReturnedSaleInvoiceItem AS rsii ON rsii.InvoiceItemID = ii.InvoiceItemID
    UNION
    SELECT  oi.OrderItemID ,
            rsii.ReturnedSaleInvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.SaleContractItemID = sci.SaleContractItemID
            JOIN SLE.ReturnedSaleJustificationItem AS rsji ON rsji.InvoiceItemID = ii.InvoiceItemID
            JOIN SLE.ReturnedSaleInvoiceItem AS rsii ON rsii.ReturnedSaleJustificationItemID = rsji.ReturnedSaleJustificationItemID
    UNION
  -----------------------------------------
    SELECT  oi.OrderItemID ,
            rsii.ReturnedSaleInvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.SaleContractItemID = sci.SaleContractItemID
            JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi2.OutgoingItemID
            JOIN SLE.ReturnedSaleInvoiceItem AS rsii ON rsii.InvoiceItemID = ii.InvoiceItemID
    UNION
    SELECT  oi.OrderItemID ,
            rsii.ReturnedSaleInvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.SaleContractItemID = sci.SaleContractItemID
            JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi2.OutgoingItemID
            JOIN SLE.ReturnedSaleJustificationItem AS rsji ON rsji.InvoiceItemID = ii.InvoiceItemID
            JOIN SLE.ReturnedSaleInvoiceItem AS rsii ON rsii.ReturnedSaleJustificationItemID = rsji.ReturnedSaleJustificationItemID
    UNION
  -----------------------------------------
    SELECT  oi.OrderItemID ,
            rsii.ReturnedSaleInvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.RemittanceItemID = ri.RemittanceItemID
            JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi2.OutgoingItemID
            JOIN SLE.ReturnedSaleInvoiceItem AS rsii ON rsii.InvoiceItemID = ii.InvoiceItemID
    UNION
    SELECT  oi.OrderItemID ,
            rsii.ReturnedSaleInvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.RemittanceItemID = ri.RemittanceItemID
            JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi2.OutgoingItemID
            JOIN SLE.ReturnedSaleJustificationItem AS rsji ON rsji.InvoiceItemID = ii.InvoiceItemID
            JOIN SLE.ReturnedSaleInvoiceItem AS rsii ON rsii.ReturnedSaleJustificationItemID = rsji.ReturnedSaleJustificationItemID
    UNION
  -----------------------------------------
    SELECT  oi.OrderItemID ,
            rsii.ReturnedSaleInvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
            JOIN SLE.InvoiceItem AS ii ON ii.RemittanceItemID = ri.RemittanceItemID
            JOIN SLE.ReturnedSaleInvoiceItem AS rsii ON rsii.InvoiceItemID = ii.InvoiceItemID
    UNION
    SELECT  oi.OrderItemID ,
            rsii.ReturnedSaleInvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.SaleContractItem AS sci ON sci.QuotationItemID = qi.QuotationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.SaleContractItemID = sci.SaleContractItemID
            JOIN SLE.InvoiceItem AS ii ON ii.RemittanceItemID = ri.RemittanceItemID
            JOIN SLE.ReturnedSaleJustificationItem AS rsji ON rsji.InvoiceItemID = ii.InvoiceItemID
            JOIN SLE.ReturnedSaleInvoiceItem AS rsii ON rsii.ReturnedSaleJustificationItemID = rsji.ReturnedSaleJustificationItemID
    UNION
  -----------------------------------------
    SELECT  oi.OrderItemID ,
            rsii.ReturnedSaleInvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.QuotationItemID = qi.QuotationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.RemittanceItemID = ri.RemittanceItemID
            JOIN SLE.ReturnedSaleInvoiceItem AS rsii ON rsii.InvoiceItemID = ii.InvoiceItemID
    UNION
    SELECT  oi.OrderItemID ,
            rsii.ReturnedSaleInvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.QuotationItemID = qi.QuotationItemID
            JOIN SLE.InvoiceItem AS ii ON ii.RemittanceItemID = ri.RemittanceItemID
            JOIN SLE.ReturnedSaleJustificationItem AS rsji ON rsji.InvoiceItemID = ii.InvoiceItemID
            JOIN SLE.ReturnedSaleInvoiceItem AS rsii ON rsii.ReturnedSaleJustificationItemID = rsji.ReturnedSaleJustificationItemID
    UNION
  -----------------------------------------
    SELECT  oi.OrderItemID ,
            rsii.ReturnedSaleInvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.QuotationItemID = qi.QuotationItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.RemittanceItemID = ri.RemittanceItemID
            JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi2.OutgoingItemID
            JOIN SLE.ReturnedSaleInvoiceItem AS rsii ON rsii.InvoiceItemID = ii.InvoiceItemID
    UNION
    SELECT  oi.OrderItemID ,
            rsii.ReturnedSaleInvoiceItemID
    FROM    CTM.OrderItem AS oi
            JOIN SLE.JustificationItem AS ji ON ji.OrderItemID = oi.OrderItemID
            JOIN SLE.QuotationItem AS qi ON qi.JustificationItemID = ji.JustificationItemID
            JOIN SLE.RemittanceItem AS ri ON ri.QuotationItemID = qi.QuotationItemID
            JOIN STC.OutgoingItem AS oi2 ON oi2.RemittanceItemID = ri.RemittanceItemID
            JOIN SLE.InvoiceItem AS ii ON ii.OutgoingItemId = oi2.OutgoingItemID
            JOIN SLE.ReturnedSaleJustificationItem AS rsji ON rsji.InvoiceItemID = ii.InvoiceItemID
            JOIN SLE.ReturnedSaleInvoiceItem AS rsii ON rsii.ReturnedSaleJustificationItemID = rsji.ReturnedSaleJustificationItemID;
