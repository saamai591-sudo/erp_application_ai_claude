
--------------------------------------------------------------
CREATE   PROCEDURE [AST].GetChangePositionList
(
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
	        @ViewRelatedToUser int,
	        @ViewRelatedToOthers NVARCHAR(MAX),
	        @Culture varchar(25)	,
			@CultureNo varchar(5),
		@UnauthorizedUsers NVARCHAR(MAX);
	
	
	SET @UserID = cfg.GetuserID()
	SET @Culture = cfg.GetuserCulture()
	
	select @CultureNo = CultureNo
	from cfg.CultureInfo
	where Culture = @Culture

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
	
	SELECT @ViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'ChangePosition'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'ChangePosition'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

	IF @Sort IS NULL OR @Sort=''
		SET @Sort='Number'
	DECLARE @Query NVARCHAR(MAX)    
	SET @Query = 
	    'WITH Query_Result 
			(ChangePositionID,
		     Number,
		     [Date],
		     BranchID,
			 Description,
			 Description2,
			 Date_Date,
			 BranchCode,
			 BranchName,
		     [Version],
		     Creator,
		     CreationDate,	
			 LastEditionDate,
		     CreateDateString ,
		     EditionDateString,
		     CreatorUserName,
		     EditorName)
			AS (
			SELECT	t.ChangePositionID,
				t.Number,
				t.[Date],
				t.BranchID,
				t.Description,
				t.Description2,
				CFG.GetCLRSaturnDate(t.[Date], @DateFormat,0,@DateType) AS Date_Date,
				b.Code AS BranchCode,
				case when @CultureNo = 1 then b.Title else b.Title2 end AS BranchName,
				t.[Version],
				t.Creator,
				t.CreationDate,
				t.LastEditionDate,
				CFG.GetCLRSaturnDate(t.CreationDate, @DateFormat, 1, @DateType) AS CreateDateString, 
				CFG.GetCLRSaturnDate(t.LastEditionDate, @DateFormat , 1, @DateType) AS EditionDateString, 				
				u.Name AS CreatorUserName, 
				u2.Name AS EditorName
								
			FROM AST.[ChangePosition] t
			JOIN cfg.Branch b ON t.BranchID = b.BranchID
			JOIN CFG.[User] AS u ON u.UserID = t.Creator 
			JOIN CFG.[User] AS u2 ON u2.UserID = t.LastEditor		
			WHERE (@UserID = -1 
				or  (@ViewRelatedToUser is not null and t.Creator = @UserID)
				or  (@ViewRelatedToOthers IS not NULL and t.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)
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
	--PRINT @Query
	
	EXECUTE sp_executesql @Query,
	     N'@UserID int,@DateType tinyint,@DateFormat varchar(10),
		   @ViewRelatedToUser int,@ViewRelatedToOthers NVARCHAR(MAX),@CultureNo varchar(5),@UnauthorizedUsers NVARCHAR(MAX)',
		@UserID = @UserID,
		@DateType = @DateType,
		@DateFormat = @DateFormat,
		@ViewRelatedToUser = @ViewRelatedToUser,
	    @ViewRelatedToOthers = @ViewRelatedToOthers,
		@CultureNo = @CultureNo,
		@UnauthorizedUsers = @UnauthorizedUsers

	DECLARE @Count INT
	
	EXEC ('select * from ' + @tableName +' ORDER BY _RN');
	
	SET @Query = 'select top 1 @Count=  r_count from ' + @tableName 
	EXECUTE sp_executesql @Query,
	     N'@count int out',
	     @Count = @Count OUT
	
	RETURN ISNULL(@Count, 0);
