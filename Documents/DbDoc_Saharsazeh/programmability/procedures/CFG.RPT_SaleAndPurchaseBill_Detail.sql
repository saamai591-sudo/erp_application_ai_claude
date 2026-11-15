
CREATE   PROC [CFG].RPT_SaleAndPurchaseBill_Detail
(
	@FromDate Date,
	@ToDate Date,
	@PartyID bigint,
	@CurrencyID int,
	@Type varchar(25)
)
	--WITH ENCRYPTION 
	AS
	 DECLARE       @UserID            INT,
				   @DateType          TINYINT,
				   @Culture           VARCHAR(10),
				   @DateFormat        VARCHAR(10),
				   @TableName  NVARCHAR(MAX),
				   @FTableName  NVARCHAR(MAX),
				   @OpeningBalance NVARCHAR(MAX),
				   @Query nvarchar(max),
				   @CultureNo TinyInt

	SET @TableName = CFG.getTempTableName(1);
	SET @FTableName = CFG.getTempTableName(1);
		
	SET @Query = N'
			create table ' + @FTableName +
    '
		(
			CurrencyID int,
			PartyID bigint,			
			OpeningBalance decimal(30,4),
			Price          decimal(30,4),
			Discount       decimal(30,4),
			Vat            decimal(30,4),
			Returned       decimal(30,4),
			Received       decimal(30,4),
			Payed          decimal(30,4),
			ReportType     nvarchar(10),
			DataType       tinyint
		)'

	EXEC (@Query)
	
	exec CFG.SpSaleAndPurchaseSummaryDataSource null,@FromDate,@PartyID,@CurrencyID,@FTableName,@Type,0
	
	exec CFG.SpSaleAndPurchaseDataSource @FromDate,@ToDate,@PartyID,@CurrencyID,@TableName,@Type

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
	
	SELECT @CultureNo = CultureNo
	FROM cfg.CultureInfo
	WHERE Culture = @Culture

	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	       AND us.UserID = @UserID
	
	IF @DateFormat IS NULL
	    SET @DATEFORMAT = 'YY/MM/DD' 	

	SELECT @OpeningBalance = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'SaleAndPurchaseBill'
	       AND le.Item = 'OpeningBalance'
	       AND lev.Culture = @Culture

	declare @CurrencyTitle nvarchar(max)
	select @CurrencyTitle = title
	from cfg.Currency
	where CurrencyID  =@CurrencyID

	set @Query = N'
				select *,
				@CurrencyTitle Currency,
						cfg.GetCLRSaturnDate(a.Date,@DateFormat,0,@DateType) Date_Date,
						sum(Debit-Credit) over(order by RowIndex) RemainInLine
				from
				(
					SELECT   null DocumentID,
							null EngName,
							1 [RowIndex],
							null [Date],
							@OpeningBalance [Description], 
							null [Number],
							case when Sum(OpeningBalance+Price+Discount+Vat+Returned+Received+Payed)>=0 then Sum(OpeningBalance+Price+Discount+Vat+Returned+Received+Payed) else 0 end [Debit], 
							case when Sum(OpeningBalance+Price+Discount+Vat+Returned+Received+Payed)<0 then -Sum(OpeningBalance+Price+Discount+Vat+Returned+Received+Payed) else 0 end [Credit],
							null StuffCode,
							null StuffTitle,
							null MainQuantity,
							null SubQuantity,
							null MainUnit,
							null SubUnit,
							null Fee,
							null Price,
							null Discount,
							null Vat
				FROM  '+@FTableName+'  A
				WHERE (	
					(@Type = ''Customer'' AND ReportType = ''Customer'')
					OR
					(@Type = ''Vendor'' AND ReportType = ''Vendor'')
					OR
					@Type = ''Party'' 
				)
				union all

				SELECT A.DocumentID,
						A.EngName,
						ROW_NUMBER() over(order by a.Date,a.CreationDate) + 1,
						A.Date,
						A.Description, 
						A.Number, 
						A.Debit, 
						A.Credit, 
						A.StuffCode,
						A.StuffTitle,
						A.MainQuantity,
						A.SubQuantity SubQuantity,
						CASE @CultureNo WHEN 2 THEN s.MainMeasureUnit2 ELSE s.MainMeasureUnit END MainUnit,
						CASE @CultureNo WHEN 2 THEN s.SubMeasureUnit2 ELSE s.SubMeasureUnit END SubUnit,
						A.Fee,
						A.Price,
						A.Discount,
						A.Vat
				from  '+@TableName+'  A
				LEFT JOIN STF.VWStuff s ON A.StuffID = s.StuffID 
				where 
				((@Type = ''Customer'' and A.Type = ''Customer'')
				or
				(@Type = ''Vendor'' and A.Type = ''Vendor'')
				or
				@Type = ''Party'' 
				))A
				'
	EXECUTE sp_executeSQL @Query,
				N'@DateFormat VARCHAR(10),@DateType TINYINT,@OpeningBalance NVARCHAR(MAX),@Type varchar(25),@CurrencyTitle nvarchar(max), @CultureNo TinyInt',
				@DateFormat = @DateFormat,
				@DateType = @DateType,
				@OpeningBalance = @OpeningBalance,
				@Type = @Type,
				@CurrencyTitle = @CurrencyTitle,
				@CultureNo = @CultureNo
