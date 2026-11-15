
create   view NOC.VwPaymentReceipt
	as

	select		  
		d.PaymentReceiptID,
		PaymentSubjectID,
		c.SlID,
		case when pcf.PaymentCheqeFlowID IS NOT NULL then pcf.date
					else d.Date end EffectiveDate,
		d.Number DocumentNumber,
		vp.ReferenceNumber,
		vp.VoucherID,
		vp2.VoucherID BaseVoucherID,
		vp.VoucherDate,
		a.CurrencyID,
		a.CurrencyRate,
		a.PaymentTypeID,
		a.PurchaseInvoiceID,
		a.ContractID,
		a.ConfirmStatementID,
		a.ConfirmStatementItemID,
		a.ContractStatementID,
		a.CalculationResultID,
		a.PayPreparingID,
		a.ConfirmPurchaseInvoiceID,
		a.ConfirmPurchaseInvoiceItemID,
		a.Amount CurrencyAmount,
		case when Currency.IsBaseCurrencyBasis = 0 then 
							ROUND(a.Amount * a.CurrencyRate / Currency.ExchangeUnit,[CFG].[GetBaseCurrencyPrecision]()) 
						when Currency.IsBaseCurrencyBasis = 1 then 
							ROUND(a.Amount * Currency.ExchangeUnit / a.CurrencyRate,[CFG].[GetBaseCurrencyPrecision]()) 
					end Amount,
		a.DLID,
		a.Description,
		d.PreVoucherID,
		pch.Number CheqeNumber
	from fin.PaymentSubject a
	join cfg.Currency 
		on Currency.CurrencyID = a.CurrencyID
	join fin.PaymentType b
		on a.PaymentTypeID = b.PaymentTypeID
	join fin.PaymentReceipt d
		on d.PaymentReceiptID = a.PaymentReceiptID
	left join NOC.ReportHeadline c
		on c.SlID = b.SLID
	left join fin.PaymentCheqe pch
		on pch.PaymentCheqeID = a.PaymentCheqeID
	left join fin.PaymentCheqeFlowItem pcfi
		on pcfi.PaymentCheqeID = pch.PaymentCheqeID 
	left join fin.PaymentCheqeFlow pcf
		on pcf.PaymentCheqeFlowID = pcfi.PaymentCheqeFlowID 
		and pcf.Type = 0
	left join fin.PaymentCheqeType pct 
		on pct.PaymentCheqeTypeID = pch.PaymentCheqeTypeID
	join
	(
		select A.PrevoucherID,A.VoucherID,B.ReferenceNumber,B.Date VoucherDate
		from acc.VoucherPrevoucher A
		JOIN ACC.Voucher B
			ON A.VoucherID = B.VoucherID
		group by A.PrevoucherID,A.VoucherID,B.ReferenceNumber,B.Date 
	)vp
		on case when pcf.PaymentCheqeFlowID is not null then pcf.PreVoucherID else d.PreVoucherID end = vp.PrevoucherID 
	join
	(
		select A.PrevoucherID,A.VoucherID,B.ReferenceNumber,B.Date VoucherDate
		from acc.VoucherPrevoucher A
		JOIN ACC.Voucher B
			ON A.VoucherID = B.VoucherID
		group by A.PrevoucherID,A.VoucherID,B.ReferenceNumber,B.Date 
	)vp2
		on d.PreVoucherID = vp2.PrevoucherID 
	where
	 (
	c.SlID is not null
	or a.PurchaseInvoiceID is not null
	or a.ContractID is not null
	or a.ConfirmStatementID is not null
	or a.ConfirmStatementItemID is not null
	or a.ContractStatementID is not null
	or a.CalculationResultID is not null
	or a.PayPreparingID is not null
	or a.ConfirmPurchaseInvoiceID  is not null
	or a.ConfirmPurchaseInvoiceItemID  is not null
		)
	and d.Date >= (select top 1 StartDate from noc.ReportagePeriod order by StartDate)
	AND
	(
	A.PaymentBankDraftID IS NOT NULL
	OR A.PaymentCashID  IS NOT NULL
	OR (A.PaymentCheqeID  IS NOT NULL AND (pcf.PaymentCheqeFlowID IS NOT NULL or pct.Today = 1))
	)
