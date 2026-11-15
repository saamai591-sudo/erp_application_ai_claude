
CREATE   view STC.vwReturnOutgoing_Outgoing
as
--Outgoing>ReturnOutgoing
SELECT roi.ReturnedOutgoingItemID,
       roi.OutgoingItemID,
       oi.Fee
FROM   stc.ReturnedOutgoingItem  AS roi
       JOIN stc.OutgoingItem     AS oi
            ON  oi.OutgoingItemID = roi.OutgoingItemID
UNION ALL
--Outgoing>Invoice>ReturnInvioce>ReturnOutgoing
SELECT roi.ReturnedOutgoingItemID,
       ii.OutgoingItemId,
       oi.Fee
FROM   stc.ReturnedOutgoingItem          AS roi
       JOIN sle.ReturnedSaleInvoiceItem  AS rsii
            ON  rsii.ReturnedSaleInvoiceItemID = roi.ReturnedSaleInvoiceItemID
       JOIN sle.InvoiceItem              AS ii
            ON  ii.InvoiceItemID = rsii.InvoiceItemID
       JOIN stc.OutgoingItem             AS oi
            ON  ii.OutgoingItemId = oi.OutgoingItemId

UNION ALL 
--Invoice>ReturnInvoice>ReturnOutgoing
SELECT roi.ReturnedOutgoingItemID,
       oi.OutgoingItemID,
       oi.Fee
FROM   stc.ReturnedOutgoingItem          AS roi
       JOIN sle.ReturnedSaleInvoiceItem  AS rsii
            ON  rsii.ReturnedSaleInvoiceItemID = roi.ReturnedSaleInvoiceItemID
       JOIN sle.InvoiceItem              AS ii
            ON  ii.InvoiceItemID = rsii.InvoiceItemID
       JOIN stc.OutgoingItem             AS oi
            ON  ii.InvoiceItemID = oi.InvoiceItemID
UNION ALL
--Invoice>Remittance>Outgoint
--Invoice>ReturnInvoice>ReturnOutgoing
SELECT roi.ReturnedOutgoingItemID,
       oi.OutgoingItemID,
       oi.Fee
FROM   stc.ReturnedOutgoingItem          AS roi
       JOIN sle.ReturnedSaleInvoiceItem  AS rsii
            ON  rsii.ReturnedSaleInvoiceItemID = roi.ReturnedSaleInvoiceItemID
       JOIN sle.InvoiceItem              AS ii
            ON  ii.InvoiceItemID = rsii.InvoiceItemID
       JOIN sle.RemittanceItem           AS ri
            ON  ri.RemittanceItemID = ii.RemittanceItemID
       JOIN stc.OutgoingItem             AS oi
            ON  oi.RemittanceItemID = ri.RemittanceItemID
