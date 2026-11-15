
CREATE   PROC [STM].SpRptConfirmStatement_ReceiptAndPayment
@ID nvarchar(max)
--WITH ENCRYPTION 
AS
	 DECLARE       @UserID            INT,
				   @DateType          TINYINT,
				   @Culture           VARCHAR(10),
				   @DateFormat        VARCHAR(10),
				   @CultureNo int

	SET @UserID = CFG.GetuserID()
	SET @Culture = cfg.GetuserCulture()

	select @CultureNo = CultureNo
	from CFG.CultureInfo
	where Culture = @Culture

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

	select [CFG].[GetStringPartBySpliter](value,1,'|') ContractID,
		[CFG].[GetStringPartBySpliter](value,2,'|') CurrencyID
		into #Contract
	from [CFG].[Split] (@ID,',')

	select
		a.ContractID,
		a.CurrencyRate,
		ROW_NUMBER() over(order by a.Type,a.Number) Rno,
		case a.Type when 'payment'
						then N'پرداخت'
				  when 'Receive'
						then N'دریافت'
				  when 'CreditAllocation'
						then N'تخصیص اعتبار'
				  when 'DebitCreditNote'
						then N'اعلامیه بدهکار بستانکار'							
		end  	 TypeString,
		a.Type,
		a.DocID,
		a.Number,
		a.Date,
		cfg.GetCLRSaturnDate(a.Date,@DateFormat,0,@DateType) Date_Date,
		case when itemtype = 'Cheque' then N'چک شماره '+b.Number+ ' - ' else '' end
		 + 
		a.Description BaseDocument,
		a.Amount,
		a.Description,
		case when @CultureNo = 1 then Currency.Title else Currency.Title2 end Currency,
		case when @CultureNo = 1 then Cu.Title else Cu.Title2 end ItemCurrency,
		ItemCurrencyRate,
		ItemAmount
		
	from 
	(
		select 
			a.ContractID,
			a.CurrencyRate,
			a.itemtype,
			a.itemid,
			a.Type,
			a.Number,
			a.DocID,
			a.Date,
			case when @CultureNo = 1 then a.Description else a.Description2  end Description,
			a.CurrencyID,
			a.Amount,
			ItemCurrencyID,
			ItemCurrencyRate,
			ItemAmount
			--sum(a.Amount) Amount
		from CNT.VWReceiptAndPayment a
		join #Contract b on a.ContractID = b.ContractID and a.CurrencyID = b.CurrencyID
		--group by a.ContractID,
		--		 a.CurrencyRate,
		--		 a.itemtype,
		--		 a.itemid,
		--		 a.Type,
		--		 a.Number,
		--		 a.DocID,
		--		 a.Date,
		--		 case when @CultureNo = 1 then a.Description else a.Description2  end,
		--		 a.CurrencyID
	) a
	join cfg.Currency
		on Currency.CurrencyID = a.CurrencyID
	left join FIN.PaymentCheqe b
		on a.itemtype ='Cheque' and a.itemid = PaymentCheqeID
	left join cfg.Currency cu
		on Cu.CurrencyID = a.ItemCurrencyID
