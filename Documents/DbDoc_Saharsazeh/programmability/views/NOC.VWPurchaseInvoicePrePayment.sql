
create   view [NOC].[VWPurchaseInvoicePrePayment]
as
select  a.PurchaseInvoicePrePaymentID,
		a.PurchaseInvoiceID,
  case when Currency.IsBaseCurrencyBasis = 0 then 
						ROUND(a.Price 
						* 
		case when a.PaymentSubjectID is not null then ps.CurrencyRate
			 when a.DebitCreditNoteItemID is not null then dcni.CurrencyRate
			 when a.PettyCashCostItemID is not null then pcc.CurrencyRate
			end 
						/ Currency.ExchangeUnit,[CFG].[GetBaseCurrencyPrecision]()) 
			        when Currency.IsBaseCurrencyBasis = 1 then 
						ROUND(a.Price * Currency.ExchangeUnit 
						/
		case when a.PaymentSubjectID is not null then ps.CurrencyRate
			 when a.DebitCreditNoteItemID is not null then dcni.CurrencyRate
			 when a.PettyCashCostItemID is not null then pcc.CurrencyRate
			end 
						,[CFG].[GetBaseCurrencyPrecision]()) 
			   end Amount,
		case when a.PaymentSubjectID is not null then ps.PaymentTypeID
			 when a.DebitCreditNoteItemID is not null then dcni.PaymentTypeID
			 when a.PettyCashCostItemID is not null then pcci.PaymentTypeID
			end PaymentTypeID,
		--pi.Date EffectiveDate,
		case when a.PaymentSubjectID is not null then 		
			case when pcf.PaymentCheqeFlowID IS NOT NULL then pcf.date
					else pr.Date end
			 when a.DebitCreditNoteItemID is not null then dcn.Date
			 when a.PettyCashCostItemID is not null then pcc.Date
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
			 when a.PettyCashCostItemID is not null then pcci.Description
			end Description
from vnd.PurchaseInvoicePrePayment a
join vnd.PurchaseInvoice pi
	on pi.PurchaseInvoiceID = a.PurchaseInvoiceID
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
		on vp.PrevoucherID = pi.PreVoucherID
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
left join fin.PettyCashCostItem pcci
	on pcci.PettyCashCostItemID = a.PettyCashCostItemID
left join fin.PettyCashCost pcc
	on pcc.PettyCashCostID = pcci.PettyCashCostID


