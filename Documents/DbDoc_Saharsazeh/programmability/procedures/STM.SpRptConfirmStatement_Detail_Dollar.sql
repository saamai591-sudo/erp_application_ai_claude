
-------------------------------------
create   proc [STM].SpRptConfirmStatement_Detail_Dollar
@ID nvarchar(max)
--WITH ENCRYPTION 
AS
	declare @Columns nvarchar(max),
			@ColumnsInSelect nvarchar(max),
			@Query  nvarchar(max),
			@UserID INT,
	        @DateType VARCHAR(10),
	        @DateFormat VARCHAR(10),
	        @Culture VARCHAR(10)
	
	
	SET @UserID = CFG.GetuserID()
	SET @Culture = cfg.GetuserCulture()
	
	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID
	
	IF @DateType IS NULL
	    SET @DateType = CASE @Culture
	                         WHEN 'fa' THEN 0
	                         WHEN 'en' THEN 1
	                         WHEN 'ar' THEN 2
	                    END
	
	
	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	       AND us.UserID = @UserID
	
	IF @DateFormat IS NULL
	    SET @DATEFORMAT = 'YY/MM/DD' 

	SELECT @Columns = STUFF((SELECT DISTINCT ',' + QUOTENAME(AdditionDeductionTypeID)
	            FROM   CNT.AdditionDeductionType	               
	            FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
	                      
	IF(@Columns is null)								   
		SET @Columns = '[-1]'	

	SELECT @ColumnsInSelect = STUFF((SELECT DISTINCT ',ad.' + QUOTENAME(AdditionDeductionTypeID) 
	            FROM   CNT.AdditionDeductionType	               
	            FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')

	declare @CreateColumns nvarchar(max),
			@CreatePColumns nvarchar(max)

	SELECT @CreateColumns = STUFF((SELECT DISTINCT ',' + QUOTENAME(AdditionDeductionTypeID)+'  decimal(36,10)'
	            FROM   CNT.AdditionDeductionType	               
	            FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,0,'')

	SELECT @CreatePColumns = STUFF((SELECT DISTINCT ',p' +  cast (AdditionDeductionTypeID as varchar(50))+'  decimal(36,10)'
	            FROM   CNT.AdditionDeductionType	               
	            FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,0,'')
	                      

	select [CFG].[GetStringPartBySpliter](value,1,'|') ContractID,
		[CFG].[GetStringPartBySpliter](value,2,'|') CurrencyID
		into #Contracts
	from [CFG].[Split] (@ID,',')

	select  h.ConfirmStatementID,
			AdditionDeductionTypeID,
			case when Currency.code = 'usd' then case when Addition <> 0 then Addition else Deduction end
				else
					ROUND(
							case when Currency.IsBaseCurrencyBasis = 0 
									then ROUND((case when Addition <> 0 then Addition else Deduction end) 
									* h.CurrencyRate / Currency.ExchangeUnit , CFG.GetBaseCurrencyPrecision())
								when Currency.IsBaseCurrencyBasis = 1
									then ROUND((case when Addition <> 0 then Addition else Deduction end) 
									* Currency.ExchangeUnit / h.CurrencyRate , CFG.GetBaseCurrencyPrecision())
						END
					/
					[CFG].[GetReportCurrencyRate](h.Date) ,2) end  Amount,
			case when Currency.code = 'usd' then paid
				else
					ROUND(
							case when Currency.IsBaseCurrencyBasis = 0 
									then ROUND(paid
									* h.CurrencyRate / Currency.ExchangeUnit , CFG.GetBaseCurrencyPrecision())
								when Currency.IsBaseCurrencyBasis = 1
									then ROUND(paid
									* Currency.ExchangeUnit / h.CurrencyRate , CFG.GetBaseCurrencyPrecision())
						END
					/
					[CFG].[GetReportCurrencyRate](h.Date) ,2) end  paid
		into #AdditionDeduction
	from CNT.ConfirmStatementItem i
	join CNT.ConfirmStatement h
		on h.ConfirmStatementID = i.ConfirmStatementID
	join cnt.ContractStatement cs
		on h.ContractStatementID = cs.ContractStatementID
	join CFG.Currency
		on Currency.CurrencyID = cs.CurrencyID

	select *
		into #PAdditionDeduction

	from
	(
	select  h.PurchaseInvoiceID,
			AdditionDeductionTypeID,
			case when Currency.code = 'usd' then case when Addition <> 0 then Addition else Deduction end
				else
					ROUND(
							case when Currency.IsBaseCurrencyBasis = 0 
									then ROUND((case when Addition <> 0 then Addition else Deduction end) 
									* h.CurrencyRate / Currency.ExchangeUnit , CFG.GetBaseCurrencyPrecision())
								when Currency.IsBaseCurrencyBasis = 1
									then ROUND((case when Addition <> 0 then Addition else Deduction end) 
									* Currency.ExchangeUnit / h.CurrencyRate , CFG.GetBaseCurrencyPrecision())
						END
					/
					[CFG].[GetReportCurrencyRate](h.Date) ,2) end  Amount
	from CNT.ConfirmStatementItem i
	join vnd.PurchaseInvoice h
		on h.PurchaseInvoiceID = i.PurchaseInvoiceID
	join CFG.Currency
		on Currency.CurrencyID = h.CurrencyID

		union all

	select  h.PurchaseInvoiceID,
			AdditionDeductionTypeID,
			case when Currency.code = 'usd' then case when Addition <> 0 then Addition else Deduction end
				else
					ROUND(
							case when Currency.IsBaseCurrencyBasis = 0 
									then ROUND((case when Addition <> 0 then Addition else Deduction end) 
									* pin.CurrencyRate / Currency.ExchangeUnit , CFG.GetBaseCurrencyPrecision())
								when Currency.IsBaseCurrencyBasis = 1
									then ROUND((case when Addition <> 0 then Addition else Deduction end) 
									* Currency.ExchangeUnit / pin.CurrencyRate , CFG.GetBaseCurrencyPrecision())
						END
					/
					[CFG].[GetReportCurrencyRate](h.Date) ,2) end  Amount
	from vnd.ConfirmPurchaseInvoiceItem i
	join vnd.ConfirmPurchaseInvoice h
		on h.ConfirmPurchaseInvoiceID = i.ConfirmPurchaseInvoiceID
	join vnd.PurchaseInvoice pin on pin.PurchaseInvoiceID = h.PurchaseInvoiceID
	join CFG.Currency
		on Currency.CurrencyID = pin.CurrencyID
		)a

	drop table if exists ##Statement

	set @Query= N'
	create table ##Statement
	(
	ContractID int,
	Description nvarchar(max),
	Number int,
	DollarRate decimal(36,10),
	Amount decimal(36,10),
	Tax decimal(36,10),
	Duty decimal(36,10),
	Net decimal(36,10),
	ReferenceNumber int,
	VoucherDate nvarchar(50)
	'+@CreateColumns+'
	'+@CreatePColumns+'
	)	'
	
	exec(@Query)




	set @Query= N'
	insert into ##Statement
	SELECT 
		d.ContractID,
		N''صورت وضعیت شماره ''+cast(b.Number as varchar(50))+'' از تاریخ '' + 
			cfg.GetCLRSaturnDate(b.FromDate,'''+@DateFormat+''',0,'+@DateType+') + '' تا تاریخ '' +
			cfg.GetCLRSaturnDate(b.EndDate,'''+@DateFormat+''',0,'+@DateType+') Description,
		b.Number ,
		case when Currency.code = ''usd'' then 1 else [CFG].[GetReportCurrencyRate](d.Date) end DollarRate,
		case when Currency.code = ''usd'' then d.amount 
			else
				ROUND(
					 case when Currency.IsBaseCurrencyBasis = 0 
						     then ROUND(d.Amount * d.CurrencyRate / Currency.ExchangeUnit , CFG.GetBaseCurrencyPrecision())
						  when Currency.IsBaseCurrencyBasis = 1
							 then ROUND(d.Amount * Currency.ExchangeUnit / d.CurrencyRate , CFG.GetBaseCurrencyPrecision())
					END
				/
				[CFG].[GetReportCurrencyRate](d.Date) ,2) end Amount,
		ROUND(item.Tax / [CFG].[GetReportCurrencyRate](d.Date) ,2)  Tax,
		ROUND(item.Duty / [CFG].[GetReportCurrencyRate](d.Date) ,2)  Duty,
		case when Currency.code = ''usd'' then d.Amount +  isnull(Net.Amount,0) 
			else
				ROUND(
					 case when Currency.IsBaseCurrencyBasis = 0 
						     then ROUND((d.Amount +  isnull(Net.Amount,0)) * d.CurrencyRate / Currency.ExchangeUnit , CFG.GetBaseCurrencyPrecision())
						  when Currency.IsBaseCurrencyBasis = 1
							 then ROUND((d.Amount +  isnull(Net.Amount,0)) * Currency.ExchangeUnit / d.CurrencyRate , CFG.GetBaseCurrencyPrecision())
					END
				/
				[CFG].[GetReportCurrencyRate](d.Date) ,2) end Net,
		v.ReferenceNumber,
		cfg.GetCLRSaturnDate(v.Date,'''+@DateFormat+''',0,'+@DateType+') VoucherDate,
		'+@ColumnsInSelect+',
		'+@ColumnsInSelect+'
	FROM CNT.ConfirmStatement d 
	JOIN CNT.ContractStatement b 
		ON b.ContractStatementID=d.ContractStatementID
	join CFG.Currency
		ON Currency.CurrencyID = b.CurrencyID
	join #Contracts Contracts on Contracts.ContractID = d.ContractID and Contracts.CurrencyID = b.CurrencyID
	join
	(
		select ContractStatementID,SUM(Amount) Amount,sum(tax) Tax,sum(duty) Duty
		from CNT.ContractStatementItem
		group by ContractStatementID
	)item on item.ContractStatementID = b.ContractStatementID
	left join
	(
		select ConfirmStatementID,sum(Addition - Deduction ) Amount
		from  CNT.ConfirmStatementItem
		group by ConfirmStatementID
	)Net on Net.ConfirmStatementID = d.ConfirmStatementID
	left join
	(
		select  ConfirmStatementID,AdditionDeductionTypeID,Amount  from #AdditionDeduction
	)x
	pivot
	(
		max([Amount])
	for AdditionDeductionTypeID in (' + @Columns + ')
	)ad on ad.ConfirmStatementID = d.ConfirmStatementID
	left join
	(
	select  ConfirmStatementID,AdditionDeductionTypeID,Paid  from #AdditionDeduction
	)x
	pivot
	(
		max([Paid])
	for AdditionDeductionTypeID in (' + @Columns + ')
	)payed on payed.ConfirmStatementID = d.ConfirmStatementID
	left join acc.VWVoucherPrevoucher v on v.prevoucherid = d.prevoucherid
	order by b.number
		'
	exec(@Query)

	set @Query= N'
	with cte 
	as
	(
		select PurchaseInvoiceID,b.ContractID,SUM(a.Price - Discount) Amount,sum(tax) Tax,sum(duty) Duty
		from VND.PurchaseInvoiceItem a
		join cnt.VWContractSubject b on a.contractsubjectid = b.contractsubjectid
		join #Contracts Contracts on Contracts.ContractID = b.ContractID
		group by PurchaseInvoiceID,b.ContractID
		
		union all

		select PurchaseInvoiceID,b.ContractID,SUM(a.Price - Discount) Amount,sum(tax) Tax,sum(duty) Duty
		from VND.PurchaseInvoiceItem a
		join stc.StockReceiptItem sri on sri.StockReceiptItemID = a.StockReceiptItemID
		join cnt.VWContractSubject b on sri.contractsubjectid = b.contractsubjectid
		join #Contracts Contracts on Contracts.ContractID = b.ContractID
		group by PurchaseInvoiceID,b.ContractID

		union all

		select PurchaseInvoiceID,b.ContractID,SUM(a.Price - Discount) Amount,sum(tax) Tax,sum(duty) Duty
		from VND.PurchaseInvoiceItem a
		join stc.StockReceiptItem sri on sri.StockReceiptItemID = a.StockReceiptItemID
		join stc.JustificationInputItem jii on jii.JustificationInputItemID = sri.JustificationInputItemID
		join stc.TemporaryStockReceiptItem tsri on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID
		join cnt.VWContractSubject b on tsri.contractsubjectid = b.contractsubjectid
		join #Contracts Contracts on Contracts.ContractID = b.ContractID
		group by PurchaseInvoiceID,b.ContractID
	)

	insert into ##Statement
	SELECT 
			ContractID,
			N''صورتحساب شماره '' + cast( isnull(d.invoicenumber,d.number) as varchar(50))+
				'' در تاریخ ''+cfg.GetCLRSaturnDate(isnull(d.invoiceDate,d.Date) ,'''+@DateFormat+''',0,'+@DateType+') Description,
			d.Number ,
			[CFG].[GetReportCurrencyRate](d.Date) DollarRate,
			case when Currency.code = ''usd'' then item.amount 
				else
					ROUND(
						 case when Currency.IsBaseCurrencyBasis = 0 
								 then ROUND(item.Amount * d.CurrencyRate / Currency.ExchangeUnit , CFG.GetBaseCurrencyPrecision())
							  when Currency.IsBaseCurrencyBasis = 1
								 then ROUND(item.Amount * Currency.ExchangeUnit / d.CurrencyRate , CFG.GetBaseCurrencyPrecision())
						END
					/
					[CFG].[GetReportCurrencyRate](d.Date) ,2) end Amount,
			ROUND(item.Tax / [CFG].[GetReportCurrencyRate](d.Date) ,2)  Tax,
			ROUND(item.Duty / [CFG].[GetReportCurrencyRate](d.Date) ,2)  Duty,
			case when Currency.code = ''usd'' then item.Amount +  isnull(Net.Amount,0) 
				else
					ROUND(
						 case when Currency.IsBaseCurrencyBasis = 0 
								 then ROUND((item.Amount +  isnull(Net.Amount,0)) * d.CurrencyRate / Currency.ExchangeUnit , CFG.GetBaseCurrencyPrecision())
							  when Currency.IsBaseCurrencyBasis = 1
								 then ROUND((item.Amount +  isnull(Net.Amount,0)) * Currency.ExchangeUnit / d.CurrencyRate , CFG.GetBaseCurrencyPrecision())
						END
					/
					[CFG].[GetReportCurrencyRate](d.Date) ,2) end Net,
			v.ReferenceNumber,
			cfg.GetCLRSaturnDate(v.Date,'''+@DateFormat+''',0,'+@DateType+') VoucherDate,
			'+@ColumnsInSelect+',
			'+@ColumnsInSelect+'
	FROM VND.PurchaseInvoice d 
	left join vnd.ConfirmPurchaseInvoice cpi on cpi.PurchaseInvoiceId = d.PurchaseInvoiceId
	join CFG.Currency
		ON Currency.CurrencyID = d.CurrencyID
	join cte item on item.PurchaseInvoiceID = d.PurchaseInvoiceID
	left join
	(
		select PurchaseInvoiceID,sum(Addition - Deduction ) Amount
		from  CNT.ConfirmStatementItem
		where PurchaseInvoiceID is not null
		group by PurchaseInvoiceID
		union all
		select PurchaseInvoiceID,sum(Addition - Deduction ) Amount
		from vnd.ConfirmPurchaseInvoiceItem i
		join vnd.ConfirmPurchaseInvoice h on i.ConfirmPurchaseInvoiceID = h.ConfirmPurchaseInvoiceID
		group by PurchaseInvoiceID
	)Net on Net.PurchaseInvoiceID = d.PurchaseInvoiceID
	left join
	(
	select  PurchaseInvoiceID,AdditionDeductionTypeID,Amount  from #pAdditionDeduction
	)x
	pivot
	(
		max([Amount])
	for AdditionDeductionTypeID in (' + @Columns + ')
	)ad on ad.PurchaseInvoiceID = d.PurchaseInvoiceID
	left join acc.VWVoucherPrevoucher v on v.prevoucherid = isnull(d.prevoucherid,cpi.prevoucherid)
	'
	exec(@Query)

	select * from ##Statement
	order by number
