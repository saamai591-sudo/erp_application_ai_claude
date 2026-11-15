CREATE VIEW [SLE].[Remittance_ReturnedSaleInvoice]
AS
SELECT ri.RemittanceItemID,
       rsii.ReturnedSaleInvoiceItemID
FROM SLE.RemittanceItem AS ri
    JOIN SLE.InvoiceItem AS ii
        ON ii.RemittanceItemID = ri.RemittanceItemID
    JOIN SLE.ReturnedSaleInvoiceItem AS rsii
        ON rsii.InvoiceItemID = ii.InvoiceItemID
UNION
SELECT ri.RemittanceItemID,
       rsii.ReturnedSaleInvoiceItemID
FROM SLE.RemittanceItem AS ri
    JOIN SLE.InvoiceItem AS ii
        ON ii.RemittanceItemID = ri.RemittanceItemID
    JOIN SLE.ReturnedSaleJustificationItem AS rsji
        ON rsji.InvoiceItemID = ii.InvoiceItemID
    JOIN SLE.ReturnedSaleInvoiceItem AS rsii
        ON rsii.ReturnedSaleJustificationItemID = rsji.ReturnedSaleJustificationItemID
UNION
SELECT ri.RemittanceItemID,
       rsii.ReturnedSaleInvoiceItemID
FROM SLE.RemittanceItem AS ri
    JOIN STC.OutgoingItem AS oi
        ON oi.RemittanceItemID = ri.RemittanceItemID
    JOIN SLE.InvoiceItem AS ii
        ON ii.OutgoingItemId = oi.OutgoingItemID
    JOIN SLE.ReturnedSaleInvoiceItem AS rsii
        ON rsii.InvoiceItemID = ii.InvoiceItemID
UNION
SELECT ri.RemittanceItemID,
       rsii.ReturnedSaleInvoiceItemID
FROM SLE.RemittanceItem AS ri
    JOIN STC.OutgoingItem AS oi
        ON oi.RemittanceItemID = ri.RemittanceItemID
    JOIN SLE.InvoiceItem AS ii
        ON ii.OutgoingItemId = oi.OutgoingItemID
    JOIN SLE.ReturnedSaleJustificationItem AS rsji
        ON rsji.InvoiceItemID = ii.InvoiceItemID
    JOIN SLE.ReturnedSaleInvoiceItem AS rsii
        ON rsii.ReturnedSaleJustificationItemID = rsji.ReturnedSaleJustificationItemID;
