CREATE   PROCEDURE [CFG].[GetCurrencyRateList](
    @PageNumber            INT,
    @RowspPage             INT,
    @Sort                  NVARCHAR(MAX) = NULL,
    @Filter                NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
	DECLARE @UserID INT,
	        @DateType TINYINT,
	        @DateFormat VARCHAR(10),			
	        @ViewRelatedToUser INT,
	        @ViewRelatedToOthers NVARCHAR(MAX),
	        @Culture VARCHAR(25),
            @UnauthorizedUsers NVARCHAR(MAX);	
	
	SET  @UserID=cfg.GetuserID()

	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
		   AND us.UserID = @UserID
	IF @DateType IS NULL
	SET @DateType = CASE cfg.GetuserCulture() WHEN 'fa' THEN 0	
											  WHEN 'en' THEN 1
											  WHEN 'ar' THEN 2 END

	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
		   AND us.UserID =  @UserID
	       
	IF @DateFormat IS NULL
	SET @DATEFORMAT = 'YY/MM/DD'
		
	SELECT @ViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'CurrencyRate'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'CurrencyRate'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

	IF @Sort IS NULL OR @Sort=''
		SET @Sort='Date'

	DECLARE @Query NVARCHAR(MAX)    
	SET @Query = 'WITH Query_Result 
			AS (
        SELECT cr.CurrencyRateID as ViewModelId, cr.CurrencyRateID,
                cr.Rate,
                cr.CurrencyID,
                cr.Date,
                cr.CreationDate,
                cr.Creator,
                cr.LastEditor,
                cr.LastEditionDate,
                cr.Version,
				c.PrecisionTitle CurrencyPrecisionTitle,
                c.PrecisionTitle2 CurrencyPrecisionTitle2,
                c.Title CurrencyTitle,
                c.Title2 CurrencyTitle2,
                CFG.GetCLRSaturnDate(cr.[Date], @DateFormat , 0, @DateType) AS Date_Date,
				CFG.GetCLRSaturnDate(cr.CreationDate, @DateFormat , 1, @DateType) AS CreateDateString, 
				CFG.GetCLRSaturnDate(cr.LastEditionDate, @DateFormat , 1, @DateType) AS EditionDateString,
				u.[Name] AS CreatorUserName,
				u2.[Name] AS EditorName
		FROM CFG.CurrencyRate as cr
		JOIN cfg.Currency c ON cr.CurrencyID = c.CurrencyID
		JOIN cfg.[User] u ON u.UserID = cr.Creator
		JOIN cfg.[User] u2 ON u2.UserID = cr.LastEditor		
		WHERE (@UserID = -1 or  
			  (@ViewRelatedToUser is not null and cr.Creator = @UserID) or 
			  (@ViewRelatedToOthers IS NOT NULL AND cr.Creator not in ( SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)
			)
		)
	)';
	    
	
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
	     N'@UserID INT,
		 @DateType TINYINT,
		 @DateFormat VARCHAR(10),
		 @ViewRelatedToUser INT,
		 @ViewRelatedToOthers NVARCHAR(MAX),
		 @UnauthorizedUsers NVARCHAR(MAX),
		 @Culture VARCHAR(25)',
	     @UserID = @UserID,
	     @DateType = @DateType,
	     @DateFormat = @DateFormat,
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
