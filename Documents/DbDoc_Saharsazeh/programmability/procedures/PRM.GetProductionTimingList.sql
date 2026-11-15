
----------------------------------- modify [PRM].GetProductionTimingList -----------------------------------------------------------
CREATE     PROCEDURE [PRM].GetProductionTimingList
(
    @PageNumber            INT,
    @RowspPage             INT,
    @Sort                  NVARCHAR(MAX) = NULL,
    @Filter                NVARCHAR(MAX) = NULL
)
AS
	DECLARE @UserID                  INT,
	        @DateType                TINYINT,
	        @ViewRelatedToUser       INT,
	        @ViewRelatedToOthers     NVARCHAR(MAX),
	        @DateFormat              VARCHAR(10),
			@CultureInfo  VARCHAR(10),
			@CultureNo VARCHAR(10),
            @UnauthorizedUsers NVARCHAR(MAX);
	
	SET @UserID = cfg.GetuserID()
	set @CultureInfo = cfg.GetuserCulture()

	select @CultureNo = CultureNo 
	from cfg.CultureInfo
	where Culture = @CultureInfo

	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID
	
	IF @DateType IS NULL
	    SET @DateType = CASE @CultureInfo
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
	WHERE EntityName = 'ProductionTiming'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'ProductionTiming'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;
	
	IF @Sort IS NULL
	   OR @Sort = ''
	    SET @Sort = 'CreateDateString '

	DECLARE @Query NVARCHAR(MAX)    
	SET @Query = N'WITH Query_Result 
	As (SELECT 
			v.ProductionTimingID,
			v.StuffID,
			v.ProductionTime,
			v.Quantity,
			v.LastEditor,
			v.CostCenterId,
			v.CostDriverID,
			v.Creator, 
			v.CreationDate, 
			v.LastEditionDate,
			v.[Version],
			CFG.GetCLRSaturnDate(v.CreationDate,@DateFormat  , 1,@DateType) AS CreateDateString, 
			CFG.GetCLRSaturnDate(v.LastEditionDate,@DateFormat , 1,@DateType) AS EditionDateString, 
			u.Name AS CreatorUserName, 
			u2.Name AS EditorName     ,
			Stuff.Code StuffCode,
			Stuff.Title StuffTitle,
			cc.Title CostCenterTitle,
			cd.Title AS CostDriverTitle
		FROM prm.ProductionTiming v
			join stf.Stuff on Stuff.Stuffid = v.Stuffid
			join cfg.CostCenter cc on cc.CostCenterID = v.CostCenterID
			join prm.CostDriver cd on cd.CostDriverId = v.CostDriverID
			JOIN CFG.[User] AS u ON u.UserID = v.Creator 
			JOIN CFG.[User] AS u2 ON u2.UserID = v.LastEditor
		WHERE (@UserID = -1 
				or  (@ViewRelatedToUser is not null and v.Creator = @UserID)
				or  (@ViewRelatedToOthers IS NOT NULL AND v.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)
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
	     @UserID = @UserID,
	     @ViewRelatedToOthers = @ViewRelatedToOthers,
	     @UnauthorizedUsers = @UnauthorizedUsers

	DECLARE @Count INT
	
	EXEC ('select * from ' + @tableName + ' order by _RN');
	
	SET @Query = 'select top 1 @Count=  r_count from ' + @tableName 
	EXECUTE sp_executesql @Query,
	     N'@count int out',
	     @Count = @Count OUT
	
	RETURN ISNULL(@Count, 0)
