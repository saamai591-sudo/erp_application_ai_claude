
-- #65577 Expose parameter DataEntryType on constant-value list for HHH:mm display.

CREATE   PROCEDURE [PAY].[GetParameterConstantDataList](
    @PageNumber     INT,
    @RowspPage      INT,
    @Sort           NVARCHAR(MAX) = NULL,
    @Filter         NVARCHAR(MAX) = NULL
)
AS
	DECLARE @UserID                  INT,
	        @DateType                TINYINT,
	        @ViewRelatedToUser       INT,
	        @ViewRelatedToOthers     NVARCHAR(MAX),
	        @DateFormat              VARCHAR(10),
            @UnauthorizedUsers NVARCHAR(MAX);
	
	SET @UserID = cfg.GetuserID()
	
	CREATE TABLE #ValidPersonel(personelId int)
	
	INSERT INTO #ValidPersonel
	EXEC Hrm.GetValidPersonelWithBranchAccess null
	
	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID
	
	IF @DateType IS NULL
	    SET @DateType = CASE cfg.GetuserCulture()
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
	WHERE EntityName = 'ParameterConstantData'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'ParameterConstantData'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

	IF @Sort IS NULL OR @Sort=''
		SET @Sort='PersonelCode '
		
	DECLARE @Query NVARCHAR(MAX)    
	SET @Query = '
	WITH Query_Result 
	(
		ParameterConstantDataID ,
		ParameterTitle ,
		ParameterTitle2,
		PersonelCode ,
		PersonelName ,
		PersonelName2,
		[Year] ,
		[MonthName] ,
		Value ,
		PersonnelID ,
		ParameterID ,
		CalendarMonthID ,			
		[Version] ,
		Creator,
		CreationDate ,
		LastEditionDate,
		PersianDate ,
		CreateDateString,
		EditionDateString ,
		CreatorUserName ,
		EditorName,
		MASK,
		DataEntryType
		)
	AS 
	(
		SELECT		p.ParameterConstantDataID,
				pa.Title AS ParameterTitle,
				pa.Title2 AS ParameterTitle2,
				pe.Code AS PersonelCode,
				par.Title + '' '' + isnull(par.LastName, '''') as PersonelName,
				par.Title2 + '' '' + isnull(par.LastName2, '''') as PersonelName2, 
				c.[Year] AS [Year],
				cm.[MonthName] AS [MonthName],
				p.Value,
				p.PersonnelID,
				p.ParameterID,
				p.CalendarMonthID,
				p.[Version],
				p.Creator,
				p.CreationDate,	
				p.LastEditionDate,
				null as PersianDate,--CFG.GetCLRSaturnDate(p.CreationDate,@DateFormat  , 0,@DateType) AS PersianDate,
				CFG.GetCLRSaturnDate(p.CreationDate,@DateFormat  , 1,@DateType) AS CreateDateString, 
				CFG.GetCLRSaturnDate(p.LastEditionDate,@DateFormat , 1,@DateType) AS EditionDateString, 
				u.Name AS CreatorUserName,
				u2.Name AS EditorName,
				'''' AS MASK,
				pa.DataEntryType
			FROM PAY.ParameterConstantData p
				Inner join #ValidPersonel on #ValidPersonel.PersonelID=p.PersonnelID
				JOIN CFG.[User] AS u ON u.UserID = p.Creator 
				JOIN CFG.[User] AS u2 ON u2.UserID = p.LastEditor
				JOIN PAY.Parameter pa ON pa.ParameterID = p.ParameterID
				join hrm.Personel pe on pe.PersonelID=p.PersonnelID
				join cfg.party par on par.partyID = pe.partyID
				join hrm.CalendarMonth cm on cm.CalendarMonthID= p.CalendarMonthID
				join hrm.Calendar c on c.CalendarID = cm.CalendarID					
			WHERE (@UserID = -1 
				or(@ViewRelatedToUser is not null   and p.Creator = @UserID)
				or(@ViewRelatedToOthers IS NOT NULL AND p.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)
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
	
	SET @Query =Cfg.ApplyPaging (@tableName,@Query, @PageNumber,@RowspPage,@Filter,@Sort)
	--PRINT @Query
	
	EXECUTE sp_executesql @Query,
	     N'
		 @dateFormat varchar(10),
		 @dateType int,
		 @ViewRelatedToOthers NVARCHAR(MAX),
		 @UnauthorizedUsers NVARCHAR(MAX),
		 @UserID int,
		 @ViewRelatedToUser int
		 ',
	     @DateType = @DateType,
	     @DateFormat = @DateFormat,
	     @ViewRelatedToUser = @ViewRelatedToUser,
	     @ViewRelatedToOthers = @ViewRelatedToOthers,
	     @UnauthorizedUsers = @UnauthorizedUsers,
	     @UserID = @UserID;
	
	DECLARE @Count INT
	
	EXEC ('select * from ' + @tableName + ' ORDER BY _RN');
	
	SET @Query = 'select top 1 @Count=  r_count from ' + @tableName 
	EXECUTE sp_executesql @Query,
	     N'@count int out',
	     @Count = @Count OUT
	
	RETURN ISNULL(@Count, 0)
