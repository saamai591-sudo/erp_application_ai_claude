
-------------------------------------
CREATE   PROCEDURE [AST].[GetDestructionList](
    @FinancialPeriodID int,
	@EngName nvarchar(25),
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
	WHERE EntityName = @EngName
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = @EngName
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;
	
	IF @Sort IS NULL OR @Sort=''
		SET @Sort='Number'
	DECLARE @Query NVARCHAR(MAX)    
	SET @Query = 
	    '
			select *
			into #Voucher
			from acc.vwVoucherPrevoucher
			where engname = ''Destruction''
			and FinancialPeriodID = @FinancialPeriodID		
		
		;WITH Query_Result 
			(DestructionID,
		     Number,
		     [Date],
		     DestructionReasonID,	
		     DestructionReasonTitle,
			 DestructionReasonTitle2,
		     [Description],
		     Description2,
		     FinancialPeriodID,
		     PreVoucherID,
			 BranchID, 
			 BranchCode,
			 BranchName,	
			 BranchName2,
			 DestructionStatus,
 	         [Version],
		     Creator,
		     CreationDate,
		     LastEditor,
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
		     StatusString)
			AS (
			SELECT *,CAST(CASE	WHEN T.VoucherID IS not null  THEN @Voucher 
						WHEN T.PreVoucherID IS not null  THEN @PreVoucher
						ELSE @Submit END AS NVARCHAR(512))AS StatusString	 
			FROM 
			(SELECT d.DestructionID, 
					d.Number, 
					d.[Date], 
					d.DestructionReasonID, 
					dr.Title DestructionReasonTitle,
					dr.Title2 DestructionReasonTitle2,
					d.[Description],
					d.Description2,
					d.FinancialPeriodID,
					d.PreVoucherID,
					d.BranchID,
					b.Code AS BranchCode,
					b.Title AS BranchName,
					b.Title2 AS BranchName2,
					d.DestructionStatus,
					d.[Version],
					d.Creator,
					d.CreationDate,
					d.LastEditor,
					d.LastEditionDate,
					CFG.GetCLRSaturnDate(d.[Date],@DateFormat  ,0,@DateType) AS Date_Date, 
					CFG.GetCLRSaturnDate(d.CreationDate,@DateFormat  , 1,@DateType) AS CreateDateString, 
					CFG.GetCLRSaturnDate(d.LastEditionDate,@DateFormat , 1,@DateType) AS EditionDateString, 
					u1.Name AS CreatorUserName,
					u2.Name AS EditorName,
					vp.VoucherID AS VoucherID,
					vp.ReferenceNumber AS VoucherNumber,
					vp.Date VoucherDate,
					CFG.GetCLRSaturnDate(vp.Date, @DateFormat  ,0, @DateType) AS Date_VoucherDate
				FROM AST.Destruction d
					JOIN cfg.Branch b ON b.BranchID = d.BranchID
					JOIN AST.DestructionReason dr ON d.DestructionReasonID = dr.DestructionReasonID
					JOIN CFG.[User] AS u1 ON u1.UserID = d.Creator 
					JOIN CFG.[User] AS u2 ON u2.UserID = d.LastEditor
					left join #Voucher vp on vp.PrevoucherID = d.PreVoucherID

				WHERE d.FinancialPeriodID = @FinancialPeriodID
					and (@UserID = -1 
						or  (@ViewRelatedToUser is not null and d.Creator = @UserID)
						or  (@ViewRelatedToOthers IS Not NULL And d.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)
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
