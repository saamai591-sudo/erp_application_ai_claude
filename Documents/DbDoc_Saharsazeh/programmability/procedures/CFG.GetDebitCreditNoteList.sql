
------------------------------------- START #8493
CREATE    PROCEDURE [CFG].GetDebitCreditNoteList
(
    @FinancialPeriodID     INT,
    @PageNumber            INT,
    @RowspPage             INT,
    @Sort                  NVARCHAR(MAX) = NULL,
    @Filter                NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
	DECLARE @UserID                  INT,
	        @DateType                TINYINT,
	        @DateFormat              VARCHAR(10),
	        @Submit                  NVARCHAR(100),
	        @Voucher                 NVARCHAR(100),
	        @PreVoucher              NVARCHAR(100),
	        @ViewRelatedToUser       INT,
	        @ViewRelatedToOthers     NVARCHAR(MAX),
	        @Culture                 VARCHAR(25),
            @UnauthorizedUsers NVARCHAR(MAX);	
		
	SET @UserID = cfg.GetuserID()
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
	
	
	SELECT @Submit = LV.Value
	FROM   cfg.LocalizeEnum L
	       JOIN cfg.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'Statuses'
	       AND L.Item = 'Submit'
	       AND LV.Culture = @Culture
	
	SELECT @Voucher = LV.Value
	FROM   cfg.LocalizeEnum L
	       JOIN cfg.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'PreVoucherStatuses'
	       AND L.Item = 'Voucher'
	       AND LV.Culture = @Culture
	
	SELECT @PreVoucher = LV.Value
	FROM   cfg.LocalizeEnum L
	       JOIN cfg.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'PreVoucherStatuses'
	       AND L.Item = 'PreVoucher'
	       AND LV.Culture = @Culture
	
	SELECT @ViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'DebitCreditNote'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'DebitCreditNote'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

	declare @BaseCurrencyPrecision int
	set @BaseCurrencyPrecision = CFG.GetBaseCurrencyPrecision()

	select i.DebitCreditNoteID,
	       sum(i.DebitAmountInBaseCurrency) DebitAmountInBaseCurrency 
	into #items
	from (
		select DebitCreditNoteID,
		       case when c.IsBaseCurrencyBasis = 0 then
			                round(Amount * CurrencyRate / c.ExchangeUnit,@BaseCurrencyPrecision)
		                when c.IsBaseCurrencyBasis = 1 then
			                round(Amount * c.ExchangeUnit / CurrencyRate,@BaseCurrencyPrecision)
	           end as DebitAmountInBaseCurrency			
		from CFG.DebitCreditNoteItem i
		join CFG.Currency c on i.CurrencyID = c.CurrencyID
		where Type = 0	
	) i
	group by i.DebitCreditNoteID


	IF @Sort IS NULL OR @Sort=''
		SET @Sort='Number'
		
		SELECT * INTO #vwBranchAccess
		FROM cfg.vwBranchAccess AS vba

	DECLARE @Query NVARCHAR(MAX)    

	SET @Query = '  
	    WITH Query_Result 
			AS (
        SELECT d.DebitCreditNoteID,
			   d.FinancialPeriodID,
			   d.Number,
			   d.Date,
			   d.BranchID,				
			   b.Code BranchCode,
			   b.Title BranchTitle,
			   b.Title2 BranchTitle2,
			   d.Description,
			   d.Description2,
			   d.PreVoucherID,
			   d.Version,
			   d.Creator,
			   d.CreationDate,
			   d.LastEditor,
			   d.LastEditionDate,
			   CFG.GetCLRSaturnDate(d.Date, @DateFormat , 0, @DateType) PersianDate,
				CFG.GetCLRSaturnDate(d.CreationDate, @DateFormat , 1, @DateType) AS CreateDateString, 
				CFG.GetCLRSaturnDate(d.LastEditionDate, @DateFormat , 1, @DateType) AS EditionDateString,
				u.[Name] AS CreatorUserName,
				u2.[Name] AS EditorName,
				vp.VoucherID AS VoucherID,
				v.ReferenceNumber AS VoucherNumber,
				CFG.GetCLRSaturnDate(v.[Date], @DateFormat ,0, @DateType) AS VoucherDate,	
				CAST(CASE WHEN vp.VoucherID IS NOT NULL THEN @Voucher
                          WHEN d.PreVoucherID IS NOT NULL THEN @PreVoucher
                          ELSE @Submit 
					 END AS NVARCHAR(512)) AS StatusString,   				
				isnull(i.DebitAmountInBaseCurrency,0) DebitAmountInBaseCurrency
		FROM CFG.DebitCreditNote d
		JOIN CFG.Branch b ON d.BranchID = b.BranchID
		JOIN cfg.[User] u ON u.UserID = d.Creator
		JOIN cfg.[User] u2 ON u2.UserID = d.LastEditor
		LEFT JOIN (select PrevoucherID,VoucherID from ACC.VoucherPrevoucher 
		           group by PrevoucherID,VoucherID
				  ) vp on d.PreVoucherID = vp.PrevoucherID
		LEFT JOIN ACC.voucher v on vp.VoucherID = v.VoucherID	
		Left join #items i on d.DebitCreditNoteID = i.DebitCreditNoteID
		INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = d.BranchID					
		WHERE d.FinancialPeriodID = @FinancialPeriodID and	
		      (@UserID = -1 or  
				  (@ViewRelatedToUser is not null and d.Creator = @UserID) or 
				  (@ViewRelatedToOthers IS NOT NULL AND d.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)
			   )
		)
	)'


	DECLARE @selectQuery NVARCHAR(MAX)
	
	IF @Filter IS NULL
	   OR @Filter = ''
	    SET @Filter = ''
	ELSE
	    SET @Filter = 'Where (' + @Filter + ')'
	
	
	DECLARE @tableName VARCHAR(100)
	SET @tableName = cfg.getTempTableName(1)
		
	SET @Query = Cfg.ApplyPaging (
	        @tableName,
	        @Query,
	        @PageNumber,
	        @RowspPage,
	        @Filter,
	        @Sort
	    )
	
	EXECUTE sp_executesql @Query,
	     N'@dateFormat varchar(10),
		   @dateType int,
		   @ViewRelatedToOthers NVARCHAR(MAX),
		   @UnauthorizedUsers NVARCHAR(MAX),
		   @FinancialPeriodID int,
           @UserID int,
		   @ViewRelatedToUser int,
		   @Submit NVARCHAR(100),
		   @Voucher NVARCHAR(100),
		   @PreVoucher NVARCHAR(100),
		   @Culture varchar(25)',
	       @Submit = @Submit,
	       @Voucher = @Voucher,
	       @PreVoucher = @PreVoucher,
	       @Culture = @Culture,
	       @DateType = @DateType,
	       @FinancialPeriodID = @FinancialPeriodID,
	       @DateFormat = @DateFormat,
	       @ViewRelatedToUser = @ViewRelatedToUser,
	       @ViewRelatedToOthers = @ViewRelatedToOthers,
	       @UnauthorizedUsers = @UnauthorizedUsers,
	       @UserID = @UserID;
		
	DECLARE @Count INT
		
	EXEC ('select * from ' + @tableName +' ORDER BY _RN')
	
	SET @Query = 'select top 1 @Count=  r_count from ' + @tableName 
	EXECUTE sp_executesql @Query,
	     N'@count int out',
	     @Count = @Count OUT
	
	RETURN ISNULL(@Count, 0)
