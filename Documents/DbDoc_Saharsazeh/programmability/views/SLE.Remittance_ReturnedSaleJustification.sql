CREATE VIEW [SLE].[Remittance_ReturnedSaleJustification]
AS
SELECT ri.RemittanceItemID,
       rsji.ReturnedSaleJustificationItemID
FROM SLE.RemittanceItem AS ri
    JOIN SLE.InvoiceItem AS ii
        ON ii.RemittanceItemID = ri.RemittanceItemID
    JOIN SLE.ReturnedSaleJustificationItem AS rsji
        ON rsji.InvoiceItemID = ii.InvoiceItemID
UNION
SELECT ri.RemittanceItemID,
       rsji.ReturnedSaleJustificationItemID
FROM SLE.RemittanceItem AS ri
    JOIN STC.OutgoingItem AS oi
        ON oi.RemittanceItemID = ri.RemittanceItemID
    JOIN SLE.InvoiceItem AS ii
        ON ii.OutgoingItemId = oi.OutgoingItemID
    JOIN SLE.ReturnedSaleJustificationItem AS rsji
        ON rsji.InvoiceItemID = ii.InvoiceItemID
