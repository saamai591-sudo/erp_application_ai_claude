
--------------------------------------------------------------
CREATE   PROCEDURE [PAY].[GetPostponeList]
    (
      @PageNumber INT ,
      @RowspPage INT ,
      @Sort NVARCHAR(MAX) = NULL ,
      @Filter NVARCHAR(MAX) = NULL
    )
 --WITH ENCRYPTION
AS
    BEGIN
        DECLARE @UserID INT ,
            @DateType TINYINT ,
            @ViewRelatedToUser INT ,
            @ViewRelatedToOthers NVARCHAR(MAX) ,
            @DateFormat VARCHAR(10),
            @UnauthorizedUsers NVARCHAR(MAX);
					
        SET @UserID = CFG.GetuserID();

        SELECT  @DateType = us.SettingValue
        FROM    CFG.UserSetting us
        WHERE   us.SettingKey = 'Date_Type'
                AND us.UserID = @UserID;
        IF @DateType IS NULL
            SET @DateType = CASE CFG.GetuserCulture()
                              WHEN 'fa' THEN 0
                              WHEN 'en' THEN 1
                              WHEN 'ar' THEN 2
                            END;
	
        SELECT  @DateFormat = us.SettingValue
        FROM    CFG.UserSetting us
        WHERE   us.SettingKey = 'Date_Format'
                AND us.UserID = @UserID;
	       
        IF @DateFormat IS NULL
            SET @DateFormat = 'YY/MM/DD';
	
		SELECT @ViewRelatedToUser = UserID
		FROM CFG.vwOperationLevelAccess
		WHERE EntityName = 'Postpone'
			  AND AccessKey = 'ViewRelatedToUser'
			  AND UserID = @UserID;

		SELECT @ViewRelatedToOthers = UserID ,
			   @UnauthorizedUsers = Users
		FROM CFG.vwOperationLevelAccess
		WHERE EntityName = 'Postpone'
			  AND AccessKey = 'ViewRelatedToOthers'
			  AND UserID = @UserID;

	
        IF @Sort IS NULL
            OR @Sort = ''
            SET @Sort = 'Number ';
	
        DECLARE @Query NVARCHAR(MAX);    
        SET @Query = N'
 		WITH Query_Result 
		(
			PostponeID,
			Number,
			[Date],
			StartCalendarMonthID,
			EndCalendarMonthID,
			[Version],
			Creator,
			CreationDate,
			LastEditionDate,
			StartCalendarYear,
			EndCalendarYear,
			StartCalendarMonthName,
			EndCalendarMonthName	,	
			PersianDate,
			CreateDateString, 
			EditionDateString,
			CreatorUserName, 
			EditorName
		)
		as
		(
			SELECT  p.PostponeID,
				p.Number,
				p.[Date],
				p.StartCalendarMonthID,
				p.EndCalendarMonthID,
				p.[Version],
				p.Creator,
				p.CreationDate,
				p.LastEditionDate,
				cs.[Year] AS StartCalendarYear,
				ce.[Year] AS EndCalendarYear,
				c.[MonthName] AS StartCalendarMonthName,
				cal.[MonthName] AS EndCalendarMonthName,
				CFG.GetCLRSaturnDate(p.[Date], @DateFormat  , 0, @DateType) AS PersianDate, 
				CFG.GetCLRSaturnDate(p.CreationDate, @DateFormat  , 1, @DateType) AS CreateDateString, 
				CFG.GetCLRSaturnDate(p.LastEditionDate, @DateFormat  , 1, @DateType) AS EditionDateString,
				u.Name AS CreatorUserName, 
				u2.Name AS EditorName	
			FROM PAY.Postpone p
			INNER JOIN CFG.[User] AS u ON u.UserID = p.Creator 
			INNER JOIN CFG.[User] AS u2 ON u2.UserID = p.LastEditor
			INNER JOIN HRM.CalendarMonth c ON c.CalendarMonthID = p.StartCalendarMonthID		
			INNER JOIN HRM.Calendar cs ON cs.CalendarID = c.CalendarID
		
			INNER JOIN HRM.CalendarMonth cal ON cal.CalendarMonthID = p.EndCalendarMonthID
			INNER JOIN HRM.Calendar ce ON cal.CalendarID = ce.CalendarID
		
			WHERE (@UserID = -1 
				or(@ViewRelatedToUser is not null   and p.Creator = @UserID)
				or(@ViewRelatedToOthers IS NOT NULL AND p.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)
			)
		)
	)
	';
	
        PRINT @Query;
        DECLARE @selectQuery NVARCHAR(MAX);
	
        IF @Filter IS NULL
            OR @Filter = ''
            SET @Filter = '';
        ELSE
            SET @Filter = 'Where (' + @Filter + ')';
	
	
        DECLARE @tableName VARCHAR(100);
        SET @tableName = CFG.getTempTableName(1);
	
        SET @Query = CFG.ApplyPaging(@tableName, @Query, @PageNumber,
                                     @RowspPage, @Filter, @Sort);
	--PRINT @Query
	
        EXECUTE sp_executesql @Query, N'
			@UserID INT,
			@DateType TINYINT,
			@ViewRelatedToUser INT,
			@ViewRelatedToOthers NVARCHAR(MAX),
			@UnauthorizedUsers	 NVARCHAR(MAX),
			@DateFormat VARCHAR(10)
		',
		@UserID = @UserID,
		@DateType = @DateType,
		@DateFormat = @DateFormat,
		@ViewRelatedToOthers = @ViewRelatedToOthers,
		@UnauthorizedUsers = @UnauthorizedUsers,
		@ViewRelatedToUser = @ViewRelatedToUser;

        DECLARE @Count INT;
	
        EXEC ('select * from ' + @tableName + ' ORDER BY _RN');
	
        SET @Query = 'select top 1 @Count=  r_count from ' + @tableName; 
        EXECUTE sp_executesql @Query, N'@count int out', @Count = @Count OUT;
	
        RETURN ISNULL(@Count, 0);
    END;
