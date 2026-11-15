
----------------------------------------------------------------- START #8209
CREATE    proc [FOS].GetBillOfLadingList
(
    @FinancialPeriodID     INT,
    @PageNumber            INT,
    @RowspPage             INT,
    @Sort                  NVARCHAR(MAX) = NULL,
    @Filter                NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
as
	DECLARE @UserID                  INT,
	        @DateType                TINYINT,
	        @DateFormat              VARCHAR(10),
	        @Submit               NVARCHAR(150),
	        @Voucher                 NVARCHAR(150),
	        @PreVoucher              NVARCHAR(150),
	        @ViewRelatedToUser       INT,
	        @ViewRelatedToOthers     NVARCHAR(MAX),
	        @Culture                 VARCHAR(25),
            @UnauthorizedUsers NVARCHAR(MAX);			
	
	SET @UserID = cfg.GetuserID()
	SET @Culture = CFG.GetuserCulture()
	
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

	select c.BillOfLadingID
	into #Prices
	from FOS.OrderPricing a 
	join FOS.ClearanceItem b on a.ClearanceID = b.ClearanceID
	join FOS.BillOfLadingItem c on b.BillOfLadingItemID = c.BillOfLadingItemID
	group by c.BillOfLadingID

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
	
	SELECT @Submit = LV.Value
	FROM   cfg.LocalizeEnum L
	       JOIN cfg.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'Statuses'
	       AND L.Item = 'Submit'
	       AND LV.Culture = @Culture
	
	SELECT @ViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'BillOfLading'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'BillOfLading'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;
	       
	SELECT * INTo #vwEnums FROM cfg.VwEnums AS ve
	WHERE enum = 'ShareDividingBaseTypes'
	and ve.KeyValue is NOT NULL
		
	declare @Query NVARCHAR(MAX)

	IF @Sort IS NULL OR @Sort=''
		SET @Sort=' Number '

	SET @Query = N'
	
				select *
				into #Voucher
				from acc.vwVoucherPrevoucher
				where engname = ''BillOfLading''
				and FinancialPeriodID = @FinancialPeriodID
	
				select *
				into #vwBranchAccess
				from cfg.vwBranchAccess
	
		;with Query_Result as (
		SELECT       
			bl.BillOfLadingID, 
			bl.FinancialPeriodID, 
			bl.BranchID, 
			b.Code BranchCode, 
			b.Title BranchName,
			b.Title2 BranchName2,
			bl.Number, 
			bl.Date, 
			CFG.GetCLRSaturnDate(bl.[Date], @DateFormat, 0, @DateType) Date_Date,
			bl.PartyID,
			dl.Code PartyCode,
			dl.Title PartyName,
			dl.Title2 PartyName2,
			bl.PurchaseInvoiceItemID, 
			pi.Number PurchaseInvoiceNumber,
			pii.Price PurchaseInvoicePrice,
			bl.BillNumber,
			bl.ShareDividingBase,
			ve.Value AS ShareDividingBaseTitle,
			bl.IssueDate, 
			CFG.GetCLRSaturnDate(bl.IssueDate, @DateFormat, 0, @DateType) PersianIssueDate,
			bl.StartDateOfLading, 
			CFG.GetCLRSaturnDate(bl.StartDateOfLading, @DateFormat, 0, @DateType) PersianStartDateOfLading,
			bl.LadingTypeID, 
			lt.Title LadingTypeTitle,
			lt.Title2 LadingTypeTitle2,
			bl.PreVoucherID, 
			bl.Creator, 
			bl.CreationDate, 
			bl.LastEditor, 
			bl.LastEditionDate, 
			CFG.GetCLRSaturnDate(bl.CreationDate, @DateFormat, 0, @DateType) CreateDateString,
			CFG.GetCLRSaturnDate(bl.LastEditionDate, @DateFormat, 0, @DateType) EditionDateString,
			u1.Name CreatorUserName,
			u2.Name EditorName,
			case when #Voucher.voucherid is not null then @voucher
					when bl.prevoucherid is not null then @prevoucher
					else @submit end Status,
			#Voucher.VoucherID VoucherID,
			#Voucher.ReferenceNumber VoucherNumber,
			#Voucher.Date VoucherDate,
			CFG.GetCLRSaturnDate(#Voucher.Date, @DateFormat, 0, @DateType) Date_VoucherDate,
			bl.Version,
			cast(case when pr.BillOfLadingID is not null then 1	                 
					  else 0
	            end as bit) as Priced,
			bl.PurchaseInvoiceItemNon
	FROM   FOS.BillOfLading AS bl 
		INNER JOIN FOS.LadingType lt on lt.LadingTypeID = bl.LadingTypeID
		INNER JOIN CFG.Branch AS b ON b.BranchID = bl.BranchID
		left join #vwEnums ve on bl.ShareDividingBase = ve.keyValue
		LEFT JOIN vnd.PurchaseInvoiceItem pii on pii.PurchaseInvoiceItemID = bl.PurchaseInvoiceItemID
		LEFT JOIN vnd.PurchaseInvoice pi on pii.PurchaseInvoiceID = pi.PurchaseInvoiceID
		INNER JOIN CFG.Party pa on pa.PartyID = bl.PartyID
		LEFT JOIN acc.dl on dl.DLID = pa.DlID
		INNER JOIN cfg.[user] u1 on u1.UserID = bl.Creator
		INNER JOIN cfg.[user] u2 on u2.UserID = bl.LastEditor
		left join #Prices pr on bl.BillOfLadingID = pr.BillOfLadingID
		INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = b.BranchID
		LEFT  JOIN #Voucher on #Voucher.prevoucherid = bl.prevoucherid
	WHERE bl.FinancialPeriodID = @FinancialPeriodID            
		AND (@UserID = -1
			OR (@ViewRelatedToUser IS NOT NULL AND bl.Creator = @UserID)
			OR (@ViewRelatedToOthers IS NOT NULL AND bl.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)
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
	     N'@FinancialPeriodID int,
		   @UserID            INT,
	       @DateType          TINYINT,
	       @DateFormat        VARCHAR(10),
	       @Submit            NVARCHAR(150),
	       @Voucher           NVARCHAR(150),
	       @PreVoucher        NVARCHAR(150),
	       @ViewRelatedToUser INT,
	       @ViewRelatedToOthers NVARCHAR(MAX),
	       @UnauthorizedUsers	NVARCHAR(MAX),
	       @Culture           VARCHAR(25)',
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

	DROP TABLE IF EXISTS #Prices
	DROP TABLE IF EXISTS #Voucher
	
	RETURN ISNULL(@Count, 0)
