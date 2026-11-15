
CREATE    PROCEDURE [STF].[GetStoreProductions]
(
    @PageNumber INT,
    @RowspPage INT,
    @Sort NVARCHAR(MAX) = NULL,
    @Filter NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @ViewRelatedToUser INT,
            @ViewRelatedToOthers NVARCHAR(MAX),
            @Culture VARCHAR(5),
            @UnauthorizedUsers NVARCHAR(MAX);

    SET @Culture = CFG.GetuserCulture();
    SET @UserID = CFG.GetuserID();

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
                            WHEN 'fa' THEN
                                0
                            WHEN 'en' THEN
                                1
                            WHEN 'ar' THEN
                                2
                        END;

    SELECT @DateFormat = UPPER(us.SettingValue)
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

	SELECT @ViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'StoreProduction'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'StoreProduction'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;


    IF @Sort IS NULL
       OR @Sort = ''
        SET @Sort = 'Code ';

    SET @Sort = REPLACE(@Sort, 'CreateDateString', '[CreationDate]');
    SET @Sort = REPLACE(@Sort, 'EditionDateString', '[LastEditionDate]');

    DECLARE @Query NVARCHAR(MAX);
    SELECT StuffGroupID,
           STF.StuffGroupFullCode(StuffGroupID) FullCode,
           Title,
           Title2
    INTO #StuffGroup
    FROM STF.StuffGroup;

    SET @Query = N'WITH Query_Result 		
	AS
	(
		SELECT     s.StuffID, 
					s.[Type], 
                    '''' AS TypeString,
					s.Code, 
                    s.StuffGroupID,
					s.Title, 
					s.Title2, 
					s.ExemptOfPurchaseVat, 
					s.ExemptOfSellVat, 
                    s.MainMeasureUnitID,
					s.IsActive,
					s.Version,
					s.StockReceiptCostAgent,
					sg.FullCode AS StuffGroupFullCode,
					mu.Title AS  MainMeasureUnitTitle,
					mu.Title2 AS  MainMeasureUnitTitle2,
					sg.Title AS StuffGroupTitle	,
					sg.Title2 AS StuffGroupTitle2,
					sag.Title AS StuffAccountGroupTitle,
					sag.Title2 AS StuffAccountGroupTitle2,
                    '''' AS StuffTypeName,
					'''' AS MeasureSubUnitTitle,
					'''' AS MeasureSubUnitTitle2,
					sd.ConvertRatio,
					CFG.GetCLRSaturnDate(s.CreationDate,@DateFormat  , 1,@DateType) AS CreateDateString, 
					CFG.GetCLRSaturnDate(s.LastEditionDate,@DateFormat , 1,@DateType) AS EditionDateString, 
					u.Name AS CreatorUserName,
					u2.Name AS EditorName,
					sd.IranCode AS StuffIranCode,
					sd.Barcode AS StuffBarcode,
					CAST( 0  AS BIT) AS IsNotInFlow,
					sd.TechnicalCode,
	                s.CreationDate,
	                s.LastEditionDate,
                    s.UniqueTaxID,
                    s.WeightUnitID,
                    s.WeighRatio,
                    CAST(NULL AS NVARCHAR(50)) AS SlCode,
                    CAST(NULL AS NVARCHAR(50)) AS SlTitle                    
			FROM STF.Stuff AS s
				JOIN stf.MeasureUnit mu ON mu.MeasureUnitID = s.MainMeasureUnitID
				left JOIN stf.StuffDetail sd ON sd.StuffID = s.StuffID
				left JOIN stf.StuffAccountGroup sag ON sag.StuffAccountGroupID = sd.StuffAccountGroupID
				JOIN CFG.[User] AS u ON u.UserID = s.Creator 
				JOIN CFG.[User] AS u2 ON u2.UserID = s.LastEditor	
				LEFT JOIN #StuffGroup sg ON sg.StuffGroupID = s.StuffGroupID
			WHERE s.[type] = 2 and 
                (@UserID = -1 
				    or  (@ViewRelatedToUser is not null   and s.Creator = @UserID)
				    or  (@ViewRelatedToOthers IS NOT NULL AND s.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst )
                )
            )
		)';

    PRINT @Query;
    DECLARE @selectQuery NVARCHAR(MAX);

    IF @Filter IS NULL
       OR @Filter = ''
        SET @Filter = '';
    ELSE
        SET @Filter = 'Where (' + @Filter + ')';


    DECLARE @tableName VARCHAR(100);
    SET @tableName = CFG.getTempTableName(1);

    SET @Query = CFG.ApplyPaging(@tableName, @Query, @PageNumber, @RowspPage, @Filter, @Sort);



    EXECUTE sp_executesql @Query,
                          N'	
			@UserID INT ,
			@DateType TINYINT ,
			@DateFormat VARCHAR(10) ,
			@ViewRelatedToUser INT ,
			@ViewRelatedToOthers NVARCHAR(MAX),
			@UnauthorizedUsers NVARCHAR(MAX),
			@Culture VARCHAR(5)
	       ',
                          @UserID = @UserID,
                          @DateType = @DateType,
                          @DateFormat = @DateFormat,
                          @ViewRelatedToUser = @ViewRelatedToUser,
                          @ViewRelatedToOthers = @ViewRelatedToOthers,
                          @UnauthorizedUsers = @UnauthorizedUsers,
                          @Culture = @Culture;

    DECLARE @Count INT;

    EXEC ('SELECT * FROM ' + @tableName + ' ORDER BY _RN');

    SET @Query = N'select top 1 @Count=  r_count from ' + @tableName;
    EXECUTE sp_executesql @Query, N'@count int out', @Count = @Count OUT;

    RETURN ISNULL(@Count, 0);
END;

