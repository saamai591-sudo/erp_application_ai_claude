
CREATE   VIEW SLE.vwReturnSaleInvoice_Invoice
AS 
---Invoice/Outgoing/ReturnOutGoing/ReturnSaleInvoice
SELECT rsi.ReturnedSaleInvoiceID,
       i.InvoiceID,
       rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceItemID
FROM   sle.ReturnedSaleInvoice           AS rsi
       JOIN sle.ReturnedSaleInvoiceItem  AS rsii
            ON  rsii.ReturnedSaleInvoiceID = rsi.ReturnedSaleInvoiceID
       JOIN stc.ReturnedOutgoingItem     AS roi
            ON  roi.ReturnedOutgoingItemID = rsii.ReturnedOutgoingItemID
       JOIN stc.OutgoingItem             AS oi
            ON  oi.OutgoingItemID = roi.OutgoingItemID
       JOIN sle.InvoiceItem              AS ii
            ON  ii.InvoiceItemID = oi.InvoiceItemID
       JOIN sle.Invoice                  AS i
            ON  i.InvoiceID = ii.InvoiceID
GROUP BY
       rsi.ReturnedSaleInvoiceID,
       i.InvoiceID,
       rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceItemID


UNION ALL
---Invoice/Remmitance/Outgoing/ReturnOutGoing/ReturnSaleInvoice

SELECT rsi.ReturnedSaleInvoiceID,
       i.InvoiceID,
       rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceItemID
FROM   sle.ReturnedSaleInvoice           AS rsi
       JOIN sle.ReturnedSaleInvoiceItem  AS rsii
            ON  rsii.ReturnedSaleInvoiceID = rsi.ReturnedSaleInvoiceID
       JOIN stc.ReturnedOutgoingItem     AS roi
            ON  roi.ReturnedOutgoingItemID = rsii.ReturnedOutgoingItemID
       JOIN stc.OutgoingItem             AS oi
            ON  oi.OutgoingItemID = roi.OutgoingItemID
       JOIN sle.RemittanceItem           AS ri
            ON  ri.RemittanceItemID = oi.RemittanceItemID
       JOIN sle.InvoiceItem              AS ii
            ON  ii.InvoiceItemID = ri.InvoiceItemID
       JOIN sle.Invoice                  AS i
            ON  i.InvoiceID = ii.InvoiceID
GROUP BY
       rsi.ReturnedSaleInvoiceID,
       i.InvoiceID,
       rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceItemID


UNION ALL

--Outgoing/Invoice/ReturnOutGoing/ReturnSaleInvoice

SELECT rsi.ReturnedSaleInvoiceID,
       i.InvoiceID,
       rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceItemID
FROM   sle.ReturnedSaleInvoice           AS rsi
       JOIN sle.ReturnedSaleInvoiceItem  AS rsii
            ON  rsii.ReturnedSaleInvoiceID = rsi.ReturnedSaleInvoiceID
       JOIN stc.ReturnedOutgoingItem     AS roi
            ON  roi.ReturnedOutgoingItemID = rsii.ReturnedOutgoingItemID
       JOIN stc.OutgoingItem             AS oi
            ON  oi.OutgoingItemID = roi.OutgoingItemID
       JOIN sle.InvoiceItem              AS ii
            ON  ii.OutgoingItemId = oi.OutgoingItemID
       JOIN sle.Invoice                  AS i
            ON  i.InvoiceID = ii.InvoiceID
GROUP BY
       rsi.ReturnedSaleInvoiceID,
       i.InvoiceID,
       rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceItemID

UNION ALL

--Invoice/ReturnSaleInvoice


SELECT rsi.ReturnedSaleInvoiceID,
       i.InvoiceID,
       rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceItemID
FROM   sle.ReturnedSaleInvoice           AS rsi
       JOIN sle.ReturnedSaleInvoiceItem  AS rsii
            ON  rsii.ReturnedSaleInvoiceID = rsi.ReturnedSaleInvoiceID
       JOIN sle.InvoiceItem              AS ii
            ON  ii.InvoiceItemID = rsii.InvoiceItemID
       JOIN sle.Invoice                  AS i
            ON  i.InvoiceID = ii.InvoiceID
GROUP BY
       rsi.ReturnedSaleInvoiceID,
       i.InvoiceID,
       rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceItemID

UNION ALL

--Invoice\JustificationReturnInvoice\ReturnSaleInvoice

SELECT rsi.ReturnedSaleInvoiceID,
       i.InvoiceID,
       rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceItemID
FROM   sle.ReturnedSaleInvoice           AS rsi
       JOIN sle.ReturnedSaleInvoiceItem  AS rsii
            ON  rsii.ReturnedSaleInvoiceID = rsi.ReturnedSaleInvoiceID
       JOIN sle.ReturnedSaleJustificationItem AS rsji
            ON  rsji.ReturnedSaleJustificationItemID = rsii.ReturnedSaleJustificationItemID
       JOIN sle.InvoiceItem              AS ii
            ON  ii.InvoiceItemID = rsji.InvoiceItemID
       JOIN sle.Invoice                  AS i
            ON  i.InvoiceID = ii.InvoiceID
GROUP BY
       rsi.ReturnedSaleInvoiceID,
       i.InvoiceID,
       rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceItemID
       
UNION ALL

--Invoice\JustificationReturnInvoice\ReturnedOutgoing\ReturnSaleInvoice

SELECT rsi.ReturnedSaleInvoiceID,
       i.InvoiceID,
       rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceItemID
FROM   sle.ReturnedSaleInvoice           AS rsi
       JOIN sle.ReturnedSaleInvoiceItem  AS rsii
            ON  rsii.ReturnedSaleInvoiceID = rsi.ReturnedSaleInvoiceID
       join stc.ReturnedOutgoingItem AS roi on roi.ReturnedOutgoingItemID = rsii.ReturnedOutgoingItemID     
       JOIN sle.ReturnedSaleJustificationItem AS rsji
            ON rsji.ReturnedSaleJustificationItemID = roi.ReturnedSaleJustificationItemID
       JOIN sle.InvoiceItem              AS ii
            ON  ii.InvoiceItemID = rsji.InvoiceItemID
       JOIN sle.Invoice                  AS i
            ON  i.InvoiceID = ii.InvoiceID
GROUP BY
       rsi.ReturnedSaleInvoiceID,
       i.InvoiceID,
       rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceItemID    
       
       
