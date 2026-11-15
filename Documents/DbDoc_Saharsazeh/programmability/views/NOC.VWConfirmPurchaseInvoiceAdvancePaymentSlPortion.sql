
create    view NOC.VWConfirmPurchaseInvoiceAdvancePaymentSlPortion
as


select  a.ConfirmPurchaseInvoiceAdvancePaymentID,
		a.ConfirmPurchaseInvoiceID,
		b.SlID ,
		convert (float ,b.Share  ) / convert (float ,s.Share ) Share,
		b.VoucherID,
		b.AccruePreVoucherID,
		a.AdditionDeductionSlID
from NOC.VWConfirmPurchaseInvoiceAdvancePayment a
join  NOC.VWTraceOfPurchaseInvoice_Net b
	on a.ConfirmPurchaseInvoiceID = b.ConfirmPurchaseInvoiceID
join 
	(
	select ConfirmPurchaseInvoiceID,sum(Share) Share
	from NOC.VWTraceOfPurchaseInvoice_Net
	group by ConfirmPurchaseInvoiceID
	) s
	on s.ConfirmPurchaseInvoiceID = a.ConfirmPurchaseInvoiceID
