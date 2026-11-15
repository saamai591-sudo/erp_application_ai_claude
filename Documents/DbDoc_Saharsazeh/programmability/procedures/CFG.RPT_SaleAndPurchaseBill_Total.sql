
---------------------------------------------------------
CREATE    PROC [CFG].RPT_SaleAndPurchaseBill_Total
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
				   @OpeningBalance NVARCHAR(MAX),
				   @TableName  NVARCHAR(MAX),
				   @Query nvarchar(max),
				   @FTableName  NVARCHAR(MAX)

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

	SET @UserID = CFG.GetuserID()
	SET @Culture = cfg.GetuserCulture()

	exec CFG.SpSaleAndPurchaseSummaryDataSource null,@FromDate,@PartyID,@CurrencyID,@FTableName,@Type,0
	PRINT 'FirstBalance'
	exec CFG.SpSaleAndPurchaseDataSource @FromDate,@ToDate,@PartyID,@CurrencyID,@TableName,@Type
	PRINT 'DataSource'
	
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

	SELECT @OpeningBalance = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'SaleAndPurchaseBill'
	       AND le.Item = 'OpeningBalance'
	       AND lev.Culture = @Culture

		set @Query = N'
		select  A.*,
				cfg.GetCLRSaturnDate(a.Date,@DateFormat,0,@DateType) Date_Date,
				b.Title Currency,
				sum(debit-credit) over(Partition by a.CurrencyID order by  RowIndex) RemainInLine
		from
		(
				SELECT      null DocumentID,
							null EngName,
							@FromDate CreationDate,
							1 [RowIndex],
							null [Date],
							@OpeningBalance [Description], 
							null [Number],
							case when Sum(OpeningBalance+Price+Discount+Vat+Returned+Received+Payed)>=0 then Sum(OpeningBalance+Price+Discount+Vat+Returned+Received+Payed) else 0 end [Debit], 
							case when Sum(OpeningBalance+Price+Discount+Vat+Returned+Received+Payed)<0 then -Sum(OpeningBalance+Price+Discount+Vat+Returned+Received+Payed) else 0 end [Credit], 
							CurrencyID
				from '+@FTableName+' A
				where 
					((@Type = ''Customer'' and ReportType = ''Customer'')
					or
					(@Type = ''Vendor'' and ReportType = ''Vendor'')
					or
					@Type = ''Party'' 
					)

				group by CurrencyID

				union all

				SELECT		A.DocumentID,
							A.EngName,
							a.CreationDate,
							ROW_NUMBER() over(order by max(a.Date),max(a.CreationDate)) + 1,
							max(a.Date),
							max(HeaderDescription), 
							Number, 
							sum(Debit), 
							sum(Credit) ,
							CurrencyID 
				from '+@TableName+' A
				where
					((@Type = ''Customer'' and Type = ''Customer'')
					or
					(@Type = ''Vendor'' and Type = ''Vendor'')
					or
					@Type = ''Party'' 
					)
					group by A.EngName,A.DocumentID,Number,CurrencyID, a.CreationDate

		)A
		join cfg.currency b on a.CurrencyID = b.CurrencyID
		order by a.date, a.creationdate'
	
	EXECUTE sp_executeSQL     
				@Query,
				N'@DateFormat VARCHAR(10),@DateType TINYINT,@OpeningBalance NVARCHAR(MAX),@Type varchar(25),@FromDate dateTime',
				@DateFormat = @DateFormat,
				@DateType = @DateType,
				@OpeningBalance = @OpeningBalance,
				@Type = @Type,
				@FromDate = @FromDate;
