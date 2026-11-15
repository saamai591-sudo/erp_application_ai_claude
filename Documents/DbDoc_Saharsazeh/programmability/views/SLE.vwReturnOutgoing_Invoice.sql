
--------------Start of #9160

CREATE   VIEW SLE.vwReturnOutgoing_Invoice
as 

----------Invoice/ReturnedSaleInvoice/ReturnedOutgoing

SELECT roi.ReturnedOutgoingItemID,ro.ReturnedOutgoingID ,ro.[Date] ReturnDate,ro.DlDeliverID,i.CurrencyID,i.CustomerID,i.SaleTypeID,i.SaleAreaID,i.BranchID,i.[Date] InvoiceDate,roi.StuffID,
roi.MainQuantity ReturnOutgoingQuantity,ii.InvoiceItemID,ii.SaleModelID,ii.MainQuantity InvoiceMainQuantity,ii.Price,ii.Discount,ii.Fee
FROM stc.ReturnedOutgoingItem AS roi
join stc.ReturnedOutgoing AS ro on ro.ReturnedOutgoingID = roi.ReturnedOutgoingID
join sle.ReturnedSaleInvoiceItem AS rsii on rsii.ReturnedSaleInvoiceItemID = roi.ReturnedSaleInvoiceItemID
join sle.InvoiceItem AS ii on ii.InvoiceItemID = rsii.InvoiceItemID
join sle.Invoice AS i on i.InvoiceID = ii.InvoiceID

UNION ALL
---Invoice/ReturnedSaleJustification/ReturnedOutgoing
SELECT roi.ReturnedOutgoingItemID,ro.ReturnedOutgoingID ,ro.[Date] ReturnDate,ro.DlDeliverID,i.CurrencyID,i.CustomerID,i.SaleTypeID,i.SaleAreaID,i.BranchID,i.[Date] InvoiceDate,roi.StuffID,
roi.MainQuantity ReturnOutgoingQuantity,ii.InvoiceItemID,ii.SaleModelID,ii.MainQuantity InvoiceMainQuantity,ii.Price,ii.Discount,ii.Fee
FROM stc.ReturnedOutgoingItem AS roi
join stc.ReturnedOutgoing AS ro on ro.ReturnedOutgoingID = roi.ReturnedOutgoingID
join sle.ReturnedSaleJustificationItem AS rsji on rsji.ReturnedSaleJustificationItemID = roi.ReturnedSaleJustificationItemID
join sle.InvoiceItem AS ii on ii.InvoiceItemID = rsji.InvoiceItemID
join sle.Invoice AS i on i.InvoiceID = ii.InvoiceID

UNION ALL
-----Invoice/Outgoing/ReturnedOutgoing
SELECT roi.ReturnedOutgoingItemID,ro.ReturnedOutgoingID ,ro.[Date] ReturnDate,ro.DlDeliverID,i.CurrencyID,i.CustomerID,i.SaleTypeID,i.SaleAreaID,i.BranchID,i.[Date] InvoiceDate,roi.StuffID,
roi.MainQuantity ReturnOutgoingQuantity,ii.InvoiceItemID,ii.SaleModelID,ii.MainQuantity InvoiceMainQuantity,ii.Price,ii.Discount,ii.Fee
FROM stc.ReturnedOutgoingItem AS roi
join stc.ReturnedOutgoing AS ro on ro.ReturnedOutgoingID = roi.ReturnedOutgoingID
join stc.OutgoingItem AS oi on oi.OutgoingItemID = roi.OutgoingItemID
join sle.InvoiceItem AS ii on ii.InvoiceItemID = oi.InvoiceItemID
join sle.Invoice AS i on i.InvoiceID = ii.InvoiceID

UNION ALL


--------Outgoing/Invoice
--------Otugoing/ReturnInvoice
SELECT roi.ReturnedOutgoingItemID,ro.ReturnedOutgoingID ,ro.[Date] ReturnDate,ro.DlDeliverID,i.CurrencyID,i.CustomerID,i.SaleTypeID,i.SaleAreaID,i.BranchID,i.[Date] InvoiceDate,roi.StuffID,
roi.MainQuantity ReturnOutgoingQuantity,ii.InvoiceItemID,ii.SaleModelID,ii.MainQuantity InvoiceMainQuantity,ii.Price,ii.Discount,ii.Fee
FROM stc.ReturnedOutgoingItem AS roi
join stc.ReturnedOutgoing AS ro on ro.ReturnedOutgoingID = roi.ReturnedOutgoingID
join stc.OutgoingItem AS oi on oi.OutgoingItemID = roi.OutgoingItemID
join sle.InvoiceItem AS ii on oi.OutgoingItemID = ii.OutgoingItemId
join sle.Invoice AS i on i.InvoiceID = ii.InvoiceID

UNION ALL
----Invoie/Remittance/Outgoing/ReturnedOutgoing

SELECT roi.ReturnedOutgoingItemID,ro.ReturnedOutgoingID ,ro.[Date] ReturnDate,ro.DlDeliverID,i.CurrencyID,i.CustomerID,i.SaleTypeID,i.SaleAreaID,i.BranchID,i.[Date] InvoiceDate,roi.StuffID,
roi.MainQuantity ReturnOutgoingQuantity,ii.InvoiceItemID,ii.SaleModelID,ii.MainQuantity InvoiceMainQuantity,ii.Price,ii.Discount,ii.Fee
FROM stc.ReturnedOutgoingItem AS roi
join stc.ReturnedOutgoing AS ro on ro.ReturnedOutgoingID = roi.ReturnedOutgoingID
join stc.OutgoingItem AS oi on oi.OutgoingItemID = roi.OutgoingItemID
join sle.RemittanceItem AS ri on ri.RemittanceItemID = oi.RemittanceItemID
join sle.InvoiceItem AS ii on oi.RemittanceItemID = ii.RemittanceItemID
join sle.Invoice AS i on i.InvoiceID = ii.InvoiceID

