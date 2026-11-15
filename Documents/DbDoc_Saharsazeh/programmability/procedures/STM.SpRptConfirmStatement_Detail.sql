
------------------------------------- START #64857
CREATE   proc [STM].SpRptConfirmStatement_Detail
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

	drop table if exists ##Statement

	set @Query= N'
	create table ##Statement
	(
	ContractID int,
	CurrencyRate decimal(36,10),
	Description nvarchar(max),
	Number int,
	Amount decimal(36,10),
	Tax decimal(36,10),
	Duty decimal(36,10),
	Net decimal(36,10),
	ReferenceNumber int,
	VoucherDate nvarchar(50),
	DepPrepaymentInPurchase decimal(36,10)
	'+@CreateColumns+'
	'+@CreatePColumns+'
	)	'
	
	exec(@Query)



	set @Query= N'
	insert into ##Statement
	SELECT 
			d.ContractID,
			d.CurrencyRate,
		    N''صورت وضعیت شماره ''+cast(b.Number as varchar(50))+'' از تاریخ '' + 
			cfg.GetCLRSaturnDate(b.FromDate,'''+@DateFormat+''',0,'+@DateType+') + '' تا تاریخ '' +
			cfg.GetCLRSaturnDate(b.EndDate,'''+@DateFormat+''',0,'+@DateType+') Description,
			b.Number ,
			d.Amount,
			isnull(item.Tax,0) Tax,
			isnull(item.Duty,0) Duty,
			d.Amount +  isnull(Net.Amount,0) Net,
			v.ReferenceNumber,
			cfg.GetCLRSaturnDate(v.Date,'''+@DateFormat+''',0,'+@DateType+') VoucherDate,
			null DepPrepaymentInPurchase,
			'+@ColumnsInSelect+',
			'+@ColumnsInSelect+'
	FROM CNT.ConfirmStatement d 
	JOIN CNT.ContractStatement b 
		ON b.ContractStatementID=d.ContractStatementID
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
		select *
		from
		(
			select  ConfirmStatementID,
					AdditionDeductionTypeID,
					case when Addition <> 0 then Addition
						 else Deduction end as [Value]
			from CNT.ConfirmStatementItem
		)x
		pivot
		(
		 max([Value])
		for AdditionDeductionTypeID in (' + @Columns + ')
		)p
	)ad on ad.ConfirmStatementID = d.ConfirmStatementID
	left join
	(
		select *
		from
		(
			select  ConfirmStatementID,
					AdditionDeductionTypeID,
					paid as [Value]
			from CNT.ConfirmStatementItem
		)x
		pivot
		(
		 max([Value])
		for AdditionDeductionTypeID in (' + @Columns + ')
		)p
	)payed on payed.ConfirmStatementID = d.ConfirmStatementID
	left join acc.VWVoucherPrevoucher v on v.prevoucherid = d.prevoucherid
	order by b.number'

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
			d.CurrencyRate,
			N''صورتحساب شماره '' + cast( isnull(d.invoicenumber,d.number) as varchar(50))+
			'' در تاریخ ''+
			cfg.GetCLRSaturnDate(isnull(d.invoiceDate,d.Date) ,'''+@DateFormat+''',0,'+@DateType+') Description,
			d.Number ,
			item.Amount,
			isnull(item.Tax,0) Tax,
			isnull(item.Duty,0) Duty,
			item.Amount +  isnull(Net.Amount,0) Net,
			v.ReferenceNumber,
			cfg.GetCLRSaturnDate(v.Date,'''+@DateFormat+''',0,'+@DateType+') VoucherDate,
			isnull(DepPrepayment,0) DepPrepaymentInPurchase,
			'+@ColumnsInSelect+',
			'+@ColumnsInSelect+'
	FROM VND.PurchaseInvoice d 
	left join vnd.ConfirmPurchaseInvoice cpi on cpi.PurchaseInvoiceId = d.PurchaseInvoiceId
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
		select *
		from
		(
			select  PurchaseInvoiceID,
					AdditionDeductionTypeID,
					case when Addition <> 0 then Addition else Deduction end as [Value]
			from CNT.ConfirmStatementItem
			where PurchaseInvoiceID is not null
			union all
			select PurchaseInvoiceID,
					AdditionDeductionTypeID,
					case when Addition <> 0 then Addition else Deduction end as [Value]
			from vnd.ConfirmPurchaseInvoiceItem i
			join vnd.ConfirmPurchaseInvoice h on i.ConfirmPurchaseInvoiceID = h.ConfirmPurchaseInvoiceID
		)x
		pivot
		(
		 max([Value])
		for AdditionDeductionTypeID in (' + @Columns + ')
		)p
	)ad on ad.PurchaseInvoiceID = d.PurchaseInvoiceID
	left join acc.VWVoucherPrevoucher v on v.prevoucherid = isnull(d.prevoucherid,cpi.prevoucherid)
	left join
	(
		select a.PurchaseInvoiceID,sum(a.Price) DepPrepayment
		from vnd.PurchaseInvoicePrePayment a
		group by a.PurchaseInvoiceID
	) DP on DP.PurchaseInvoiceID = d.PurchaseInvoiceID 
	'
	

	exec(@Query)

	select * from ##Statement
	order by number
