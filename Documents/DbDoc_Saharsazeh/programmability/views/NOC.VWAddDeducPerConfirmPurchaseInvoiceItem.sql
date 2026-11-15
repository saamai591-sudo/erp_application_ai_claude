
create    view NOC.VWAddDeducPerConfirmPurchaseInvoiceItem
as


select a.ConfirmPurchaseInvoiceItemID,
	   b.SlID,
	   b.Share,
	   VoucherID,
	   b.AccruePreVoucherID
from VND.ConfirmPurchaseInvoiceItem a
join NOC.VWTraceOfPurchaseInvoice_Net b
	on a.ConfirmPurchaseInvoiceID = b.ConfirmPurchaseInvoiceID
