
CREATE   PROCEDURE [AST].[GetRevaluationList](
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
	
	SELECT * into #vwEnum 
	FROM   cfg.VwEnums AS ve
	WHERE ve.Enum IN('Status')

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
	WHERE EntityName = 'Revaluation'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'Revaluation'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

	IF @Sort IS NULL OR @Sort=''
		SET @Sort='Number'
	DECLARE @Query NVARCHAR(MAX)    
	SET @Query = 
	    'WITH Query_Result 
			(RevaluationID,
			FinancialPeriodID,
			Number,
			[Date],
			[Description],
			Description2,
			PreVoucherID,
			BranchID,
			BranchCode,
			BranchName,
			BranchName2,
			[Version],
			Creator,
			CreationDate,
			LastEditionDate,
			Date_Date,
			CreateDateString,
			EditionDateString,
			CreatorUserName,
			EditorName,
			VoucherID,
			VoucherNumber,
			VoucherDate,
			Date_VoucherDate,
			[Status],
			StatusString,
			VoucherStatusString)
			AS (
			SELECT *,CAST( CASE WHEN T.VoucherID IS not null  THEN @Voucher 
							WHEN T.PreVoucherID IS not null  THEN @PreVoucher
							ELSE @Submit END AS NVARCHAR(512))AS VoucherStatusString

		   FROM(
		   SELECT r.RevaluationID,
			   r.FinancialPeriodID,
			   r.Number,
			   r.[Date],
			   r.[Description],
			   r.Description2,
			   r.PreVoucherID,	
			   r.BranchID,
			   b.Code AS BranchCode,
			   b.Title AS BranchName,	
			   b.Title2 AS BranchName2,					
			   r.[Version],
			   r.Creator,
			   r.CreationDate,	
			   r.LastEditionDate,
			   CFG.GetCLRSaturnDate(r.[Date], @DateFormat  , 0, @DateType) AS Date_Date,				
			   CFG.GetCLRSaturnDate(r.CreationDate, @DateFormat  , 1, @DateType) AS CreateDateString, 
			   CFG.GetCLRSaturnDate(r.LastEditionDate, @DateFormat , 1, @DateType) AS EditionDateString, 				
			   u.Name AS CreatorUserName, 
			   u2.Name AS EditorName,
			   vp.VoucherID AS VoucherID,
		       v.ReferenceNumber AS VoucherNumber,
			   v.[Date] VoucherDate,
			   CFG.GetCLRSaturnDate(v.[Date], @DateFormat  ,0, @DateType) AS Date_VoucherDate,
			   r.[Status] AS [Status],
			   CAST(ve.Value AS NVARCHAR(512)) AS StatusString
					
			FROM AST.Revaluation r
				JOIN cfg.Branch b ON b.BranchID = r.BranchID
				JOIN CFG.[User] AS u ON u.UserID = r.Creator 
				JOIN CFG.[User] AS u2 ON u2.UserID = r.LastEditor
				LEFT JOIN (SELECT PrevoucherID, VoucherID FROM acc.VoucherPrevoucher GROUP BY PrevoucherID, VoucherID) vp ON vp.PrevoucherID = r.PreVoucherID
				LEFT JOIN acc.voucher v ON v.VoucherID = vp.VoucherID
				INNER JOIN #vwEnum ve ON r.[Status] = ve.KeyValue
			WHERE     (r.FinancialPeriodID = @FinancialPeriodID)
				and (@UserID = -1 
					or  (@ViewRelatedToUser is not null and r.Creator = @UserID)
					or  (@ViewRelatedToOthers IS NOT NULL AND r.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)
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

