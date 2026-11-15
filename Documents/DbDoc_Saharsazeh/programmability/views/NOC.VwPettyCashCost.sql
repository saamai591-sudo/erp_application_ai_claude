
CREATE    view NOC.VwPettyCashCost
as

	select		  
		d.PettyCashCostID,
		PettyCashCostItemID,
		c.SlID,
		d.Date  EffectiveDate,
		d.Number DocumentNumber,
		ReferenceNumber,
		VoucherID,
		VoucherDate,
		pc.CurrencyID,
		d.CurrencyRate,
		a.PaymentTypeID,
		a.PurchaseInvoiceID,
		a.ConfirmPurchaseInvoiceID,
		a.ConfirmPurchaseInvoiceItemID,
		a.PayPreparingID,
		a.Amount CurrencyAmount,
		case when Currency.IsBaseCurrencyBasis = 0 then 
							ROUND(a.Amount * d.CurrencyRate / Currency.ExchangeUnit,[CFG].[GetBaseCurrencyPrecision]()) 
						when Currency.IsBaseCurrencyBasis = 1 then 
							ROUND(a.Amount * Currency.ExchangeUnit / d.CurrencyRate,[CFG].[GetBaseCurrencyPrecision]()) 
				   end Amount,
		pa.DlID,
		a.Description,
		d.PreVoucherID
	from fin.PettyCashCostItem a
	join fin.PaymentType b
		on a.PaymentTypeID = b.PaymentTypeID
	join fin.PettyCashCost d
		on d.PettyCashCostID = a.PettyCashCostID
	join cfg.Party pa
		on pa.PartyID = a.PartyID
	join fin.PettyCash pc 
		on pc.PettyCashID = d.PettyCashID
	join cfg.Currency 
		on Currency.CurrencyID = pc.CurrencyID
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
		on c.SlID = b.SLID
	where
	 (
	c.SlID is not null
	or a.PurchaseInvoiceID is not null
	or a.ConfirmPurchaseInvoiceID is not null
	or a.ConfirmPurchaseInvoiceItemID is not null
	or a.PayPreparingID is not null
		)
	and d.Date >= (select top 1 StartDate from noc.ReportagePeriod order by StartDate)
