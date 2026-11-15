
create    view NOC.VwDebitCreditNote
	as

	select		  
		d.DebitCreditNoteID,
		DebitCreditNoteItemID,
		c.SlID,
		case when pcf.PaymentCheqeFlowID IS NOT NULL then pcf.date
			 when pr.PaymentReceiptID is not null then pr.Date
			else d.Date end  EffectiveDate,
		d.Number DocumentNumber,
		ReferenceNumber,
		VoucherID,
		VoucherDate,
		a.CurrencyID,
		a.CurrencyRate,
		a.PaymentTypeID,
		a.ReceiptTypeID,
		a.PurchaseInvoiceID,
		a.ReturnInvoiceID,
		a.ContractID,
		a.ConfirmStatementID,
		a.ConfirmStatementItemID,
		a.ContractStatementID,
		a.CalculationResultID,
		a.ConfirmPurchaseInvoiceID,
		a.ConfirmPurchaseInvoiceItemID,
		case when a.Type = 0 then 1 else -1 end * a.Amount CurrencyAmount,
		case when a.Type = 0 then 1 else -1 end *
	    case when Currency.IsBaseCurrencyBasis = 0 then 
							ROUND(a.Amount * a.CurrencyRate / Currency.ExchangeUnit,[CFG].[GetBaseCurrencyPrecision]()) 
						when Currency.IsBaseCurrencyBasis = 1 then 
							ROUND(a.Amount * Currency.ExchangeUnit / a.CurrencyRate,[CFG].[GetBaseCurrencyPrecision]()) 
				   end Amount,
		pa.DlID,
		a.Description,
		a.[Type],
		d.PreVoucherID,
		d.Date
	from cfg.DebitCreditNoteItem a
	join cfg.Currency 
		on Currency.CurrencyID = a.CurrencyID
	left join fin.PaymentType b
		on a.PaymentTypeID = b.PaymentTypeID
	left join fin.ReceiptType rt
		on a.ReceiptTypeID = rt.ReceiptTypeID
	join cfg.DebitCreditNote d
		on d.DebitCreditNoteID = a.DebitCreditNoteID
	join cfg.Party pa
		on pa.PartyID = a.PartyID
	join
	(
		select A.PrevoucherID,A.VoucherID,B.ReferenceNumber,B.Date VoucherDate
		from acc.VoucherPrevoucher A
		JOIN ACC.Voucher B
			ON A.VoucherID = B.VoucherID
		group by A.PrevoucherID,A.VoucherID,B.ReferenceNumber,B.Date 
	)vp
		on vp.PrevoucherID = d.PreVoucherID
	left join NOC.ReportHeadline c
		on c.SlID = case when a.PaymentTypeID is not null then b.SLID 
						 when a.ReceiptTypeID is not null then rt.SLID end
	left join fin.paymentsubject ps on ps.PaymentSubjectID = a.PaymentSubjectID
	left join fin.PaymentReceipt pr on pr.PaymentReceiptID = ps.PaymentReceiptID
	left join fin.PaymentCheqeFlowItem  pcfi
		on pcfi.PaymentCheqeID = ps.PaymentCheqeID  
	left join fin.PaymentCheqeFlow pcf
		on pcf.PaymentCheqeFlowID = pcfi.PaymentCheqeFlowID 
		and pcf.Type = 0
	where
	 (
	c.SlID is not null
	or a.PurchaseInvoiceID is not null
	or a.ContractID is not null
	or a.ConfirmStatementID is not null
	or a.ConfirmStatementItemID is not null
	or a.ContractStatementID is not null
	or a.CalculationResultID is not null
	or a.ReturnInvoiceID is not null
	or a.ConfirmPurchaseInvoiceID  is not null
	or a.ConfirmPurchaseInvoiceItemID  is not null
		)
	and d.Date >= (select top 1 StartDate from noc.ReportagePeriod order by StartDate)
