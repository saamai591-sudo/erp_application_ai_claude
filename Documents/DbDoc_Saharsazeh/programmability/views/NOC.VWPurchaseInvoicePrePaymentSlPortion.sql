
create    view NOC.VWPurchaseInvoicePrePaymentSlPortion
as


select  a.PurchaseInvoicePrePaymentID,
a.PurchaseInvoiceID,
		b.SlID ,
		convert (float ,b.Share  ) / convert (float ,s.Share ) Share,
		b.VoucherID,
		b.AccruePreVoucherID
from NOC.VWPurchaseInvoicePrePayment a
join  NOC.VWTraceOfPurchaseInvoice_Net b
	on a.PurchaseInvoiceID = b.PurchaseInvoiceID
join 
	(
	select PurchaseInvoiceID,sum(Share) Share
	from NOC.VWTraceOfPurchaseInvoice_Net
	group by PurchaseInvoiceID
	) s
	on s.PurchaseInvoiceID = a.PurchaseInvoiceID
