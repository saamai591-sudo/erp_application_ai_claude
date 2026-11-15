
-------------------------------------
CREATE   PROCEDURE [AST].GetSalvageList
(
    @FinancialPeriodID     INT,
    @EngName               NVARCHAR(25),
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
            @UnauthorizedUsers		 NVARCHAR(MAX);
	
	
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
		  
	declare @AccessKey NVARCHAR(200) = @EngName +'_ViewRelatedToOthers'

	IF @Sort IS NULL
	   OR @Sort = ''
	    SET @Sort = 'Number'
	
			    
	  SELECT * INTO #vwBranchAccess
	  FROM cfg.vwBranchAccess AS vba

	
	
	DECLARE @Query NVARCHAR(MAX)    
	SET @Query = 
	    'WITH Query_Result 
			(SalvageID,
		     FinancialPeriodID,
		     Number,
		     [Date],
		     PreVoucherID,
			 BranchID,
			 BranchCode,
			 BranchName,
			 BranchName2,
		     [Version],
		     Creator,
		     CreationDate,
			 LastEditionDate,
			 SalvageStatus,
		     Date_Date,
		     CreateDateString ,
		     EditionDateString,
		     CreatorUserName,
		     EditorName,
		     VoucherID,
		     VoucherNumber,
			 VoucherDate,
		     Date_VoucherDate,
		     [Status])
			AS (
			SELECT *,CAST( CASE WHEN T.VoucherID IS not null  THEN @Voucher 
						WHEN T.PreVoucherID IS not null  THEN @PreVoucher
						ELSE @Submit END AS NVARCHAR(512))AS [Status]
			FROM(SELECT	s.SalvageID,
				s.FinancialPeriodID,
				s.Number,
				s.[Date],
				s.PreVoucherID,		
				s.BranchID,
				b.Code AS BranchCode,
				b.Title AS BranchName,
				b.Title2 AS BranchName2,				
				s.[Version],
				s.Creator,
				s.CreationDate,	
				s.LastEditionDate,
				s.SalvageStatus,
				CFG.GetCLRSaturnDate(s.[Date], @DateFormat  , 0, @DateType) AS Date_Date,				
				CFG.GetCLRSaturnDate(s.CreationDate, @DateFormat  , 1, @DateType) AS CreateDateString, 
				CFG.GetCLRSaturnDate(s.LastEditionDate, @DateFormat , 1, @DateType) AS EditionDateString, 				
				u.Name AS CreatorUserName, 
				u2.Name AS EditorName,
				vp.VoucherID AS VoucherID,
				v.ReferenceNumber AS VoucherNumber,
				v.[Date] VoucherDate,
				CFG.GetCLRSaturnDate(v.[Date], @DateFormat  ,0, @DateType) AS Date_VoucherDate						
				
			FROM AST.Salvage s
				JOIN cfg.Branch b ON b.BranchID = s.BranchID
				JOIN CFG.[User] AS u ON u.UserID = s.Creator 
				JOIN CFG.[User] AS u2 ON u2.UserID = s.LastEditor
				left join ( select PrevoucherID , VoucherID from acc.VoucherPrevoucher group by PrevoucherID , VoucherID)vp on vp.PrevoucherID = s.PreVoucherID
				left join acc.voucher v on v.VoucherID = vp.VoucherID
				INNER JOIN #vwBranchAccess AS vba on s.BranchID=vba.BranchID
		
			WHERE (s.FinancialPeriodID = @FinancialPeriodID)
				and (@UserID = -1 
					or  (@ViewRelatedToUser is not null and s.Creator = @UserID)
					or  (@ViewRelatedToOthers IS NOT NULL AND s.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)
				)
			)
		)T
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
		@Culture varchar(25),
		@AccessKey NVARCHAR(200)
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
	    @Culture = @Culture,
		@AccessKey = @AccessKey
	
	DECLARE @Count INT
	
	EXEC ('select * from ' + @tableName + ' ORDER BY _RN');
	
	SET @Query = 'select top 1 @Count=  r_count from ' + @tableName 
	EXECUTE sp_executesql @Query,
	     N'@count int out',
	     @Count = @Count OUT
	
	RETURN ISNULL(@Count, 0)
