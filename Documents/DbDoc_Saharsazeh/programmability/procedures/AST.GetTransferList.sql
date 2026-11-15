
-------------------------------------
CREATE   PROCEDURE [AST].[GetTransferList](
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
		  
	declare @AccessKey NVARCHAR(200) = @EngName +'_ViewRelatedToOthers'

	IF @Sort IS NULL OR @Sort=''
		SET @Sort='Number'
	DECLARE @Query NVARCHAR(MAX)    
	SET @Query = 
	    'WITH Query_Result 
			(TransferID,
		     FinancialPeriodID,
		     Number,
		     [Date],
		     SourceBranchID,
		     DestinationBranchID,
			 Description,
			 Description2,
			 PreVoucherID,
			 Date_Date,
			 SourceBranchCode,
			 SourceBranchName,
			 SourceBranchName2,
			 DestinationBranchCode,
			 DestinationBranchName,
			 DestinationBranchName2,
		     [Version],
		     Creator,
		     CreationDate,	
			 LastEditionDate,	     
		     CreateDateString ,
		     EditionDateString,
		     CreatorUserName,
		     EditorName,
			 VoucherID,
			 VoucherNumber,
			 VoucherDate,
			 Date_VoucherDate,
			 TransferStatus,
			 StatusString)
			AS (
			SELECT *,CAST( CASE WHEN T.VoucherID IS not null  THEN @Voucher 
						WHEN T.PreVoucherID IS not null  THEN @PreVoucher
						ELSE @Submit END AS NVARCHAR(512))AS StatusString

			FROM(SELECT	t.TransferID,
				t.FinancialPeriodID,
				t.Number,
				t.[Date],
				t.SourceBranchID,
				t.DestinationBranchID,
				t.Description,
				t.Description2,
				t.PreVoucherID,
				CFG.GetCLRSaturnDate(t.[Date], @DateFormat,0,@DateType) AS Date_Date,
				b.Code AS SourceBranchCode,
				b.Title AS SourceBranchName,
				b.Title2 AS SourceBranchName2,
				b2.Code AS DestinationBranchCode,
				b2.Title AS DestinationBranchName,	
				b2.Title2 AS DestinationBranchName2,	
				t.[Version],
				t.Creator,
				t.CreationDate,
				t.LastEditionDate,
				CFG.GetCLRSaturnDate(t.CreationDate, @DateFormat, 1, @DateType) AS CreateDateString, 
				CFG.GetCLRSaturnDate(t.LastEditionDate, @DateFormat , 1, @DateType) AS EditionDateString, 				
				u.Name AS CreatorUserName, 
				u2.Name AS EditorName,	
				vp.VoucherID AS VoucherID,
				v.ReferenceNumber AS VoucherNumber,
				v.[Date] VoucherDate,			   
				CFG.GetCLRSaturnDate(v.[Date], @DateFormat , 0, @DateType) AS Date_VoucherDate,
				t.TransferStatus
								
			FROM AST.[Transfer] t
				JOIN cfg.Branch b ON t.SourceBranchID = b.BranchID
				JOIN cfg.Branch b2 ON t.DestinationBranchID = b2.BranchID
				JOIN CFG.[User] AS u ON u.UserID = t.Creator 
				JOIN CFG.[User] AS u2 ON u2.UserID = t.LastEditor
				left join 
					( select PrevoucherID , VoucherID from acc.VoucherPrevoucher
					group by PrevoucherID , VoucherID)vp on vp.PrevoucherID = t.PreVoucherID
				left join acc.voucher v on v.VoucherID = vp.VoucherID
		
			WHERE (t.FinancialPeriodID = @FinancialPeriodID)
				and (@UserID = -1 
					or  (@ViewRelatedToUser is not null and t.Creator = @UserID)
					or  (@ViewRelatedToOthers IS NOT NULL AND t.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)
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
	
	EXEC ('select * from ' + @tableName +' ORDER BY _RN');
	
	SET @Query = 'select top 1 @Count=  r_count from ' + @tableName 
	EXECUTE sp_executesql @Query,
	     N'@count int out',
	     @Count = @Count OUT
	
	RETURN ISNULL(@Count, 0)
