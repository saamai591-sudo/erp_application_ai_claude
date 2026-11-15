create    view NOC.VWConfirmPurchaseInvoiceAdvancePayment
as

select  a.ConfirmPurchaseInvoiceAdvancePaymentID,
		b.ConfirmPurchaseInvoiceID,
		cpi.PurchaseInvoiceID,
		a.Price CurrencyAmount,
	    case when Currency.IsBaseCurrencyBasis = 0 then 
							ROUND(a.Price 
									* 
									case when a.PaymentSubjectID is not null then ps.CurrencyRate
										 when a.DebitCreditNoteItemID is not null then dcni.CurrencyRate
										end 
								/ Currency.ExchangeUnit,[CFG].[GetBaseCurrencyPrecision]()) 
			 when Currency.IsBaseCurrencyBasis = 1 then 
							ROUND(a.Price * Currency.ExchangeUnit 
									/
									case when a.PaymentSubjectID is not null then ps.CurrencyRate
										 when a.DebitCreditNoteItemID is not null then dcni.CurrencyRate
										end 
							,[CFG].[GetBaseCurrencyPrecision]()) 
				   end Amount,
		case when a.PaymentSubjectID is not null then ps.PaymentTypeID
				 when a.DebitCreditNoteItemID is not null then dcni.PaymentTypeID
				end PaymentTypeID,
		--pi.Date EffectiveDate,
		case when a.PaymentSubjectID is not null then 		
			case when pcf.PaymentCheqeFlowID IS NOT NULL then pcf.date
					else pr.Date end
			 when a.DebitCreditNoteItemID is not null then dcn.Date
			end EffectiveDate,
		pi.Number DocumentNumber,
		pi.CurrencyID,
		pi.CurrencyRate,
		ReferenceNumber,
		VoucherID,
		VoucherDate,
		pi.DlID,
		case when a.PaymentSubjectID is not null then ps.Description
			 when a.DebitCreditNoteItemID is not null then dcni.Description
			end Description,
		c.SlID AdditionDeductionSlID
from vnd.ConfirmPurchaseInvoiceAdvancePayment a
join vnd.ConfirmPurchaseInvoiceItem b on a.ConfirmPurchaseInvoiceItemID = b.ConfirmPurchaseInvoiceItemID
join cnt.AdditionDeductionTypeMethod c
	on b.AdditionDeductionTypeMethodID = c.AdditionDeductionTypeMethodID
join vnd.ConfirmPurchaseInvoice cpi on cpi.ConfirmPurchaseInvoiceID = b.ConfirmPurchaseInvoiceID
join vnd.PurchaseInvoice pi
	on pi.PurchaseInvoiceID = cpi.PurchaseInvoiceID
join cfg.Currency 
		on Currency.CurrencyID = pi.CurrencyID
join
(
	select A.PrevoucherID,A.VoucherID,B.ReferenceNumber,B.Date VoucherDate
	from acc.VoucherPrevoucher A
	JOIN ACC.Voucher B
		ON A.VoucherID = B.VoucherID
	group by A.PrevoucherID,A.VoucherID,B.ReferenceNumber,B.Date 
)vp
		on vp.PrevoucherID = cpi.PreVoucherID
left join fin.PaymentSubject ps
	on ps.PaymentSubjectID = a.PaymentSubjectID
left join fin.PaymentReceipt pr
		on pr.PaymentReceiptID = ps.PaymentReceiptID
left join fin.PaymentCheqe pch
	on pch.PaymentCheqeID = ps.PaymentCheqeID
left join fin.PaymentCheqeFlowItem pcfi
	on pcfi.PaymentCheqeID = pch.PaymentCheqeID 
left join fin.PaymentCheqeFlow pcf
	on pcf.PaymentCheqeFlowID = pcfi.PaymentCheqeFlowID 
	and pcf.Type = 0
left join cfg.DebitCreditNoteItem dcni
	on dcni.DebitCreditNoteItemID = a.DebitCreditNoteItemID
left join cfg.DebitCreditNote dcn
	on dcn.DebitCreditNoteID = dcni.DebitCreditNoteID
