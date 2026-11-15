

CREATE    proc [NOC].[GetCashAndExchanges]
( 
 @Slid int
,@VoucherItemID int 
,@AccruePreVoucherID int = null
)
as


	declare @AccrueVoucherID int,
			@SumAccrue decimal(30,4),
			@Accure  decimal(30,4)

	select  @AccrueVoucherID = VoucherID,
			@Accure = Debit - Credit
	from acc.VoucherItem
	where VoucherItemID = @VoucherItemID


	select * into #CashAnalysingitem
	from
	(
	select	v.ReferenceNumber,
			BaseCurrencyDebitCash,
			BaseCurrencyCreditCash,
			a.ReportCurrencyRate,
			ReportCurrencyDebitCash,
			ReportCurrencyCreditCash,
			ReportCurrencyDebitExchange,
			ReportCurrencyCreditExchange,
			null CashAnalysingItemID
	from noc.Modification a
	join
	(
	select VoucherID,PrevoucherID
	from acc.VoucherPrevoucher a
	group by VoucherID,PrevoucherID
	)b
		on a.PreVoucherID = b.PrevoucherID
	join noc.ModifiedTopic c
		on c.ModificationID = a.ModificationID
	join acc.Voucher v
		on b.VoucherID = v.VoucherID
	where b.VoucherID = @AccrueVoucherID
	and c.SlID = @Slid

	union all

	select 
		d.ReferenceNumber,
		case when a.BaseCurrencyAmount > 0 then a.BaseCurrencyAmount else 0 end BaseCurrencyDebitCash,
		case when a.BaseCurrencyAmount < 0 then a.BaseCurrencyAmount else 0 end BaseCurrencyCreditCash,
		b.ReportCurrencyRate,
		case when a.Amount > 0 then a.Amount else 0 end ReportCurrencyDebitCash,
		case when a.Amount < 0 then a.Amount else 0 end ReportCurrencyCreditCash,
		case when e.Value > 0 then e.Value else 0 end ReportCurrencyDebitExchange,
		case when e.Value < 0 then e.Value else 0 end ReportCurrencyCreditExchange,
		a.CashAnalysingItemID
	from noc.CashAnalysingitem a
	join noc.CashAnalysing b
		on a.CashAnalysingID = b.CashAnalysingID
	join noc.CashDataCollection c
		on c.CashDataCollectionID = b.CashDataCollectionID
	join acc.Voucher d
		on d.VoucherID = c.VoucherID
	left join noc.CurrencyExchange e
		on e.CashVoucherID = c.VoucherID
		and e.SlID = @Slid
		and a.AccruePreVoucherID = e.AccruePreVoucherID
		and a.AccrueVoucherID = e.AccrueVoucherID
	where a.AccrueVoucherID = @AccrueVoucherID
	and a.SlID = @Slid
	and b.Status = 1
	and (@AccruePreVoucherID is null or a.AccruePreVoucherID = @AccruePreVoucherID)
	)a


	select @SumAccrue = sum(a.Debit - a.Credit)
	from acc.VoucherItem a
	join noc.AccrueAnalysing b
		on a.VoucherItemID = b.VoucherItemID
	where a.VoucherID = @AccrueVoucherID
	and b.Status = 1
	and a.SlID = @Slid


	if @AccruePreVoucherID is null
	select 
		ReferenceNumber,
		case when isnull(@SumAccrue,0) = 0 then BaseCurrencyDebitCash else BaseCurrencyDebitCash * @Accure /@SumAccrue end  BaseCurrencyDebitCash,
		case when isnull(@SumAccrue,0) = 0 then BaseCurrencyCreditCash else  BaseCurrencyCreditCash * @Accure /@SumAccrue end BaseCurrencyCreditCash,
		ReportCurrencyRate, 
		case when isnull(@SumAccrue,0) = 0 then ReportCurrencyDebitCash else ReportCurrencyDebitCash * @Accure /@SumAccrue end ReportCurrencyDebitCash,
		case when isnull(@SumAccrue,0) = 0 then ReportCurrencyCreditCash else ReportCurrencyCreditCash * @Accure /@SumAccrue end ReportCurrencyCreditCash,
		case when isnull(@SumAccrue,0) = 0 then ReportCurrencyDebitExchange else ReportCurrencyDebitExchange * @Accure /@SumAccrue end ReportCurrencyDebitExchange,
		case when isnull(@SumAccrue,0) = 0 then ReportCurrencyCreditExchange else ReportCurrencyCreditExchange * @Accure /@SumAccrue end ReportCurrencyCreditExchange,
		CashAnalysingItemID
	from #CashAnalysingitem

	if @AccruePreVoucherID is not null
	select 
		ReferenceNumber,
		BaseCurrencyDebitCash,
		BaseCurrencyCreditCash,
		ReportCurrencyRate, 
		ReportCurrencyDebitCash,
		ReportCurrencyCreditCash,
		ReportCurrencyDebitExchange,
		ReportCurrencyCreditExchange,
		CashAnalysingItemID
	from #CashAnalysingitem