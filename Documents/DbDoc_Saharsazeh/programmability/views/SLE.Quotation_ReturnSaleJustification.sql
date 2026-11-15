CREATE VIEW [SLE].[Quotation_ReturnSaleJustification]
AS
SELECT qi.QuotationItemID,
       rsji.ReturnedSaleJustificationItemID
FROM SLE.QuotationItem AS qi
    JOIN SLE.InvoiceItem AS ii
        ON ii.QuotationItemID = qi.QuotationItemID
    JOIN SLE.ReturnedSaleJustificationItem AS rsji
        ON rsji.InvoiceItemID = ii.InvoiceItemID
----------------
UNION
SELECT qi.QuotationItemID,
       rsji.ReturnedSaleJustificationItemID
FROM SLE.QuotationItem AS qi
    JOIN STC.OutgoingItem AS oi
        ON oi.QuotationItemID = qi.QuotationItemID
    JOIN SLE.InvoiceItem AS ii
        ON ii.OutgoingItemId = oi.OutgoingItemID
    JOIN SLE.ReturnedSaleJustificationItem AS rsji
        ON rsji.InvoiceItemID = ii.InvoiceItemID
----------------
UNION
SELECT qi.QuotationItemID,
       rsji.ReturnedSaleJustificationItemID
FROM SLE.QuotationItem AS qi
    JOIN SLE.RemittanceItem AS ri
        ON ri.QuotationItemID = qi.QuotationItemID
    JOIN STC.OutgoingItem AS oi
        ON oi.RemittanceItemID = ri.RemittanceItemID
    JOIN SLE.InvoiceItem AS ii
        ON ii.OutgoingItemId = oi.OutgoingItemID
    JOIN SLE.ReturnedSaleJustificationItem AS rsji
        ON rsji.InvoiceItemID = ii.InvoiceItemID
----------------
UNION
SELECT qi.QuotationItemID,
       rsji.ReturnedSaleJustificationItemID
FROM SLE.QuotationItem AS qi
    JOIN SLE.RemittanceItem AS ri
        ON ri.QuotationItemID = qi.QuotationItemID
    JOIN SLE.InvoiceItem AS ii
        ON ii.RemittanceItemID = ri.RemittanceItemID
    JOIN SLE.ReturnedSaleJustificationItem AS rsji
        ON rsji.InvoiceItemID = ii.InvoiceItemID
----------------
UNION
SELECT qi.QuotationItemID,
       rsji.ReturnedSaleJustificationItemID
FROM SLE.QuotationItem AS qi
    JOIN SLE.SaleContractItem AS sci
        ON sci.QuotationItemID = qi.QuotationItemID
    JOIN SLE.InvoiceItem AS ii
        ON ii.SaleContractItemID = sci.SaleContractItemID
    JOIN SLE.ReturnedSaleJustificationItem AS rsji
        ON rsji.InvoiceItemID = ii.InvoiceItemID
----------------
UNION
SELECT qi.QuotationItemID,
       rsji.ReturnedSaleJustificationItemID
FROM SLE.QuotationItem AS qi
    JOIN SLE.SaleContractItem AS sci
        ON sci.QuotationItemID = qi.QuotationItemID
    JOIN STC.OutgoingItem AS oi
        ON oi.SaleContractItemID = sci.SaleContractItemID
    JOIN SLE.InvoiceItem AS ii
        ON ii.OutgoingItemId = oi.OutgoingItemID
    JOIN SLE.ReturnedSaleJustificationItem AS rsji
        ON rsji.InvoiceItemID = ii.InvoiceItemID
----------------
UNION
SELECT qi.QuotationItemID,
       rsji.ReturnedSaleJustificationItemID
FROM SLE.QuotationItem AS qi
    JOIN SLE.SaleContractItem AS sci
        ON sci.QuotationItemID = qi.QuotationItemID
    JOIN SLE.RemittanceItem AS ri
        ON ri.SaleContractItemID = sci.SaleContractItemID
    JOIN SLE.InvoiceItem AS ii
        ON ii.RemittanceItemID = ri.RemittanceItemID
    JOIN SLE.ReturnedSaleJustificationItem AS rsji
        ON rsji.InvoiceItemID = ii.InvoiceItemID
----------------
UNION
SELECT qi.QuotationItemID,
       rsji.ReturnedSaleJustificationItemID
FROM SLE.QuotationItem AS qi
    JOIN SLE.SaleContractItem AS sci
        ON sci.QuotationItemID = qi.QuotationItemID
    JOIN SLE.RemittanceItem AS ri
        ON ri.SaleContractItemID = sci.SaleContractItemID
    JOIN STC.OutgoingItem AS oi
        ON oi.RemittanceItemID = ri.RemittanceItemID
    JOIN SLE.InvoiceItem AS ii
        ON ii.OutgoingItemId = oi.OutgoingItemID
    JOIN SLE.ReturnedSaleJustificationItem AS rsji
        ON rsji.InvoiceItemID = ii.InvoiceItemID



