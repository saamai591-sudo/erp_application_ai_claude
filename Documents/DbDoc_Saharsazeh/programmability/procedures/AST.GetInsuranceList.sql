
-------------------------------------
CREATE    PROCEDURE [AST].GetInsuranceList
(
    @FinancialPeriodID int,
    @PageNumber int,
    @RowspPage int,
    @Sort nvarchar(MAX) = NULL,
    @Filter nvarchar(MAX) = NULL
)
--WITH ENCRYPTION
AS
	DECLARE @UserID int,
	        @DateType tinyint,
	        @DateFormat varchar(10),
	        @Submit nvarchar(100),
	        @Voucher nvarchar(100),
	        @PreVoucher nvarchar(100),
	        @ViewRelatedToUser int,
	        @ViewRelatedToOthers NVARCHAR(MAX),
	        @Culture varchar(25),
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
	WHERE EntityName = 'Insurance'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'Insurance'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

	IF @Sort IS NULL OR @Sort=''
		SET @Sort='Number'
	DECLARE @Query NVARCHAR(MAX)    
	SET @Query = 
	    '
		select * 
		into #VWVoucherPrevoucher
		from acc.VWVoucherPrevoucher
		where engname = ''Insurance''
		and FinancialPeriodID = @FinancialPeriodID

		;WITH Query_Result 
			AS (
			SELECT *,
				CAST(CASE WHEN T.VoucherID IS not null  THEN @Voucher 
				WHEN T.PreVoucherID IS not null  THEN @PreVoucher
				ELSE @Submit END AS NVARCHAR(512)
					)AS StatusString	 
			FROM 
				(SELECT i.InsuranceID,
						i.FinancialPeriodID,
						i.PreVoucherID,
						i.Number,
						i.[Date],
						i.PartyID,
						d.Code PartyCode,
						CAST(CASE WHEN p.[Type] = 1 or p.[Type] = 2 THEN p.Title
								  WHEN p.[Type] = 0 THEN p.Title+'' ''+p.LastName
						END AS NVARCHAR(512))AS PartyName,
						CAST(CASE WHEN p.[Type] = 1 or p.[Type] = 2 THEN p.Title2
								  WHEN p.[Type] = 0 THEN p.Title2+'' ''+p.LastName2
						END AS NVARCHAR(512))AS PartyName2,
						i.InsuranceTypeID,
						it.Title InsuranceTypeTitle,
						it.Title2 InsuranceTypeTitle2,
						i.FromDate,
						i.EndDate,
						i.Price,
						i.BranchID,
						b.Code AS BranchCode,
						b.Title AS BranchName,
						b.Title2 AS BranchName2,
						i.PurchaseInvoiceItemID,
						pi.Number PurchaseInvoiceNumber,
						i.[Version],
						i.Creator,
						i.CreationDate,
						i.LastEditor,
						i.LastEditionDate,
						CFG.GetCLRSaturnDate(i.[Date],@DateFormat  , 0,@DateType) AS Date_Date, 
						CFG.GetCLRSaturnDate(i.CreationDate,@DateFormat  , 1,@DateType) AS CreateDateString, 
						CFG.GetCLRSaturnDate(i.LastEditionDate,@DateFormat , 1,@DateType) AS EditionDateString, 
						u1.Name AS CreatorUserName,
						u2.Name AS EditorName,
						v.VoucherID AS VoucherID,
						v.ReferenceNumber AS VoucherNumber,
						v.Date VoucherDate,
						CFG.GetCLRSaturnDate(v.Date, @DateFormat  ,0, @DateType) AS Date_VoucherDate			
				FROM AST.Insurance i
				JOIN cfg.Branch b ON b.BranchID = i.BranchID
				JOIN CFG.Party p on i.PartyID = p.PartyID
				JOIN AST.InsuranceType it on i.InsuranceTypeID = it.InsuranceTypeID
				JOIN CFG.[User] u1 ON u1.UserID = i.Creator
				JOIN CFG.[User] u2 ON u2.UserID = i.LastEditor
				LEFT JOIN ACC.DL d on p.DlID = d.DLID
				LEFT JOIN VND.PurchaseInvoiceItem pu on i.PurchaseInvoiceItemID = pu.PurchaseInvoiceItemID
				LEFT JOIN VND.PurchaseInvoice pi on PU.PurchaseInvoiceID = pi.PurchaseInvoiceID
				left join #VWVoucherPrevoucher v on v.PreVoucherID = i.PreVoucherID
				WHERE i.FinancialPeriodID = @FinancialPeriodID
					and (@UserID = -1 
						or  (@ViewRelatedToUser is not null and i.Creator = @UserID)
						or  (@ViewRelatedToOthers IS Not NULL AND i.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)
					)
				)
			)T)'
	
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
	--PRINT @Query
	
	EXECUTE sp_executesql @Query,
	    N'
		@FinancialPeriodID int,
		@UserID int,
		@DateType tinyint,
		@DateFormat varchar(10),
		@Submit nvarchar(100),
		@Voucher nvarchar(100),
		@PreVoucher nvarchar(100),
		@ViewRelatedToUser int,
		@ViewRelatedToOthers NVARCHAR(MAX),
		@UnauthorizedUsers NVARCHAR(MAX),
		@Culture varchar(25)
		',
		@FinancialPeriodID = @FinancialPeriodID,
		@UserID = @UserID,
		@DateType = @DateType,
		@DateFormat = @DateFormat,
	    @Submit = @Submit,
	    @Voucher = @Voucher,
	    @PreVoucher = @PreVoucher,
		@ViewRelatedToUser = @ViewRelatedToUser,
	    @ViewRelatedToOthers = @ViewRelatedToOthers,
	    @UnauthorizedUsers = @UnauthorizedUsers,
	    @Culture = @Culture

	DECLARE @Count INT
	
	EXEC ('select * from ' + @tableName +' ORDER BY _RN');
	
	SET @Query = 'select top 1 @Count=  r_count from ' + @tableName 
	EXECUTE sp_executesql @Query,
	     N'@count int out',
	     @Count = @Count OUT
	
	RETURN ISNULL(@Count, 0)

