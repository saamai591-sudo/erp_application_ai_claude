
	create   view [NOC].[VwDepreciatedDeductionInConfirmStatement]
	as

	select		  
		a.ConfirmStatementID,
		B.ConfirmStatementItemID,
		a.Date EffectiveDate,
		a.Number DocumentNumber,
		v.ReferenceNumber,
		v.VoucherID,
		v.Date VoucherDate,
		case when Currency.IsBaseCurrencyBasis = 0 then 
						ROUND(b.Deduction * a.CurrencyRate / Currency.ExchangeUnit,[CFG].[GetBaseCurrencyPrecision]()) 
			 when Currency.IsBaseCurrencyBasis = 1 then 
						ROUND(b.Deduction * Currency.ExchangeUnit /	 a.CurrencyRate,[CFG].[GetBaseCurrencyPrecision]()) 
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
	join cnt.AdditionDeductionType c
		ON C.AdditionDeductionTypeID = B.AdditionDeductionTypeID
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

	where  c.Type = 2
	and c.Criterion = 1
	and c.Payable = 0


