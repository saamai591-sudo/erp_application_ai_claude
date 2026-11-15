
	create   view [NOC].[VwConfirmStatementItem]
	as

	select		  
		a.ConfirmStatementID,
		B.ConfirmStatementItemID,
		c.ConfirmStatementPrePaymentID,
		--a.Date  EffectiveDate,
		case when C.PaymentSubjectID is not null then 		
			case when pcf.PaymentCheqeFlowID IS NOT NULL then pcf.date
					else pr.Date end
			 when C.DebitCreditNoteItemID is not null then dcn.Date
			end EffectiveDate,
		a.Number DocumentNumber,
		v.ReferenceNumber,
		v.VoucherID,
		v.Date VoucherDate,
		case when Currency.IsBaseCurrencyBasis = 0 then 
						ROUND(c.Price * 
						case when c.PaymentSubjectID is not null then ps.CurrencyRate
							 when c.DebitCreditNoteItemID is not null then dcni.CurrencyRate
							end
						/ Currency.ExchangeUnit,[CFG].[GetBaseCurrencyPrecision]()) 
			 when Currency.IsBaseCurrencyBasis = 1 then 
						ROUND(c.Price * Currency.ExchangeUnit /						
						case when c.PaymentSubjectID is not null then ps.CurrencyRate
							 when c.DebitCreditNoteItemID is not null then dcni.CurrencyRate
							end
						,[CFG].[GetBaseCurrencyPrecision]()) 
			   end Amount,
		pa.DlID,
		a.FinancialPeriodID,
		v.Description,
		a.PreVoucherID,
		cs1.CurrencyID,
		a.CurrencyRate
	from cnt.ConfirmStatement a
	join cnt.ConfirmStatementItem b
		on a.ConfirmStatementID = b.ConfirmStatementID
	join cnt.[ConfirmStatementPrePayment] c
		ON C.ConfirmStatementItemID = B.ConfirmStatementItemID
	join
	(
		select A.PrevoucherID,A.VoucherID
		from acc.VoucherPrevoucher A
		group by A.PrevoucherID,A.VoucherID
	)vp
		on vp.PrevoucherID = a.PreVoucherID
	join acc.Voucher v
		on v.VoucherID = vp.VoucherID
	join	 cnt.ContractStatement cs1
			on cs1.ContractStatementID = a.ContractStatementID
	join cfg.Currency 
		on Currency.CurrencyID = cs1.CurrencyID
	join cfg.Party pa
		on pa.PartyID = cs1.PartyID
	left join fin.PaymentSubject ps
		on ps.PaymentSubjectID = C.PaymentSubjectID
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
		on dcni.DebitCreditNoteItemID = C.DebitCreditNoteItemID
	left join cfg.DebitCreditNote dcn
		on dcn.DebitCreditNoteID = dcni.DebitCreditNoteID
	where  a.Date >= (select top 1 StartDate from noc.ReportagePeriod order by StartDate)


