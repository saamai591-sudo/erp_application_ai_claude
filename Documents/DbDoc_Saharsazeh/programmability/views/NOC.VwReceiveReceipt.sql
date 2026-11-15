

	create     view [NOC].[VwReceiveReceipt]
	as

	select		  
		d.ReceiveReceiptID,
		ReceiveSubjectID,
		c.SlID,
		case when pcf.ReceiptCheqeFlowID IS NOT NULL then pcf.date
					else d.Date end EffectiveDate,
		d.Number DocumentNumber,
		vp.ReferenceNumber,
		vp.VoucherID,
		vp.VoucherDate,
		a.CurrencyID,
		a.CurrencyRate,
		a.ReceiptTypeID,
		a.PurchaseInvoiceID,
		a.ReturnInvoiceID,
		a.ContractID,
		a.ConfirmStatementID,
		a.ConfirmStatementItemID,
		a.ContractStatementID,
		-1 *
		case when Currency.IsBaseCurrencyBasis = 0 then 
							ROUND(a.Amount * a.CurrencyRate / Currency.ExchangeUnit,[CFG].[GetBaseCurrencyPrecision]()) 
						when Currency.IsBaseCurrencyBasis = 1 then 
							ROUND(a.Amount * Currency.ExchangeUnit / a.CurrencyRate,[CFG].[GetBaseCurrencyPrecision]()) 
					end Amount,
		a.DLID,
		a.Description,
		d.PreVoucherID,
		vp1.VoucherID BaseVoucherID

	from fin.ReceiveSubject a
	join cfg.Currency 
		on Currency.CurrencyID = a.CurrencyID
	join fin.ReceiptType b
		on a.ReceiptTypeID = b.ReceiptTypeID
	join fin.ReceiveReceipt d
		on d.ReceiveReceiptID = a.ReceiveReceiptID
	left join NOC.ReportHeadline c
		on c.SlID = b.SLID
	left join fin.ReceivedCheqe pch
		on pch.ReceivedCheqeID = a.ReceivedCheqeID
	left join fin.ReceiptCheqeFlowItem pcfi
		on pcfi.ReceivedCheqeID = pch.ReceivedCheqeID and pcfi.State in (3,4,6)
	left join fin.ReceiptCheqeFlow pcf
		on pcf.ReceiptCheqeFlowID = pcfi.ReceiptCheqeFlowID 
	join
	(
		select A.PrevoucherID,A.VoucherID,B.ReferenceNumber,B.Date VoucherDate
		from acc.VoucherPrevoucher A
		JOIN ACC.Voucher B
			ON A.VoucherID = B.VoucherID
		group by A.PrevoucherID,A.VoucherID,B.ReferenceNumber,B.Date 
	)vp
		on case when pcf.ReceiptCheqeFlowID is not null then pcf.PreVoucherID else d.PreVoucherID end = vp.PrevoucherID 
	join
	(
		select A.PrevoucherID,A.VoucherID,B.ReferenceNumber,B.Date VoucherDate
		from acc.VoucherPrevoucher A
		JOIN ACC.Voucher B
			ON A.VoucherID = B.VoucherID
		group by A.PrevoucherID,A.VoucherID,B.ReferenceNumber,B.Date 
	)vp1
		on d.PreVoucherID = vp1.PrevoucherID 
	where
	 (
	c.SlID is not null
	or a.PurchaseInvoiceID is not null
	or a.ContractID is not null
	or a.ConfirmStatementID is not null
	or a.ConfirmStatementItemID is not null
	or a.ContractStatementID is not null
		)
	and d.Date >= (select top 1 StartDate from noc.ReportagePeriod order by StartDate)
	AND
	(
	A.ReceivedBankDraftID IS NOT NULL
	OR A.ReceivedCashID  IS NOT NULL
	OR (A.ReceivedCheqeID  IS NOT NULL AND pcf.ReceiptCheqeFlowID IS NOT NULL)
	)


