
------------------------------------- START #8347
CREATE   VIEW [SLE].vwInvoice_ReturnedSaleInvoice
AS 
---Invoice/Outgoing/ReturnOutGoing/ReturnSaleInvoice
SELECT rsii.ReturnedSaleInvoiceID,
       ii.InvoiceID,
       rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceItemID
FROM   sle.InvoiceItem AS ii
JOIN stc.OutgoingItem AS oi ON oi.InvoiceItemID = ii.InvoiceItemID
JOIN stc.ReturnedOutgoingItem AS roi ON roi.OutgoingItemID = oi.OutgoingItemID
JOIN sle.ReturnedSaleInvoiceItem AS rsii ON rsii.ReturnedOutgoingItemID = roi.ReturnedOutgoingItemID

GROUP BY
       rsii.ReturnedSaleInvoiceID,
       ii.InvoiceID,
       rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceItemID


UNION ALL
---Invoice/Remmitance/Outgoing/ReturnOutGoing/ReturnSaleInvoice

SELECT rsii.ReturnedSaleInvoiceID,
       ii.InvoiceID,
       rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceItemID
FROM   sle.InvoiceItem AS ii 
JOIN sle.RemittanceItem AS ri ON ri.InvoiceItemID = ii.InvoiceItemID
JOIN stc.OutgoingItem AS oi ON ri.RemittanceItemID = oi.RemittanceItemID
JOIN stc.ReturnedOutgoingItem AS roi ON oi.OutgoingItemID = roi.OutgoingItemID
JOIN sle.ReturnedSaleInvoiceItem AS rsii ON roi.ReturnedOutgoingItemID = rsii.ReturnedOutgoingItemID
GROUP BY
       rsii.ReturnedSaleInvoiceID,
       ii.InvoiceID,
       rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceItemID


UNION ALL

--Outgoing/Invoice/ReturnOutGoing/ReturnSaleInvoice
SELECT rsii.ReturnedSaleInvoiceID,
       ii.InvoiceID,
       rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceItemID
FROM   sle.InvoiceItem AS ii
JOIN stc.OutgoingItem AS oi ON oi.OutgoingItemID = ii.OutgoingItemId
JOIN stc.ReturnedOutgoingItem AS roi ON roi.OutgoingItemID = oi.OutgoingItemID
JOIN sle.ReturnedSaleInvoiceItem AS rsii ON roi.ReturnedOutgoingItemID = rsii.ReturnedOutgoingItemID
GROUP BY
       rsii.ReturnedSaleInvoiceID,
       ii.InvoiceID,
       rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceItemID

UNION ALL

--Invoice/ReturnSaleInvoice
SELECT rsii.ReturnedSaleInvoiceID,
       ii.InvoiceID,
       rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceItemID
FROM sle.InvoiceItem AS ii
JOIN sle.ReturnedSaleInvoiceItem AS rsii ON rsii.InvoiceItemID = ii.InvoiceItemID
GROUP BY
       rsii.ReturnedSaleInvoiceID,
       ii.InvoiceID,
       rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceItemID

UNION ALL

--Invoice\JustificationReturnInvoice\ReturnSaleInvoice
SELECT rsii.ReturnedSaleInvoiceID,
       ii.InvoiceID,
       rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceItemID
FROM   sle.InvoiceItem AS ii 
JOIN sle.ReturnedSaleJustificationItem AS rsji ON rsji.InvoiceItemID = ii.InvoiceItemID
JOIN sle.ReturnedSaleInvoiceItem AS rsii ON rsji.ReturnedSaleJustificationItemID = rsii.ReturnedSaleJustificationItemID
GROUP BY
       rsii.ReturnedSaleInvoiceID,
       ii.InvoiceID,
       rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceItemID
