-------------------------------------
CREATE   PROCEDURE [CFG].GetEntityCustomeFieldList
(
    @installedModules ArrayInput READONLY,
    @PageNumber INT,
    @RowspPage INT,
    @Sort NVARCHAR(MAX) = NULL,
    @Filter NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
BEGIN

    -- declare properties Here
    DECLARE @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @Culture VARCHAR(10);

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

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
                            ELSE
                                0
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    DECLARE @string NVARCHAR(50),
            @Decimal NVARCHAR(50),
            @Date NVARCHAR(50),
            @Int NVARCHAR(50),
            @Boolean NVARCHAR(50),
            @Text NVARCHAR(50),
            @Time NVARCHAR(50);

    SELECT @Time = lev.[Value]
    FROM CFG.LocalizeEnumValue AS lev
        JOIN CFG.LocalizeEnum AS le
            ON le.LocalizeEnumID = lev.LocalizeEnumID
    WHERE le.Enum = 'ParameterType'
          AND lev.Culture = @Culture
          AND le.Item = 'Time';

    SELECT @string = lev.[Value]
    FROM CFG.LocalizeEnumValue AS lev
        JOIN CFG.LocalizeEnum AS le
            ON le.LocalizeEnumID = lev.LocalizeEnumID
    WHERE le.Enum = 'ParameterType'
          AND lev.Culture = @Culture
          AND le.Item = 'String';

    SELECT @Decimal = lev.[Value]
    FROM CFG.LocalizeEnumValue AS lev
        JOIN CFG.LocalizeEnum AS le
            ON le.LocalizeEnumID = lev.LocalizeEnumID
    WHERE le.Enum = 'ParameterType'
          AND lev.Culture = @Culture
          AND le.Item = 'Decimal';

    SELECT @Date = lev.[Value]
    FROM CFG.LocalizeEnumValue AS lev
        JOIN CFG.LocalizeEnum AS le
            ON le.LocalizeEnumID = lev.LocalizeEnumID
    WHERE le.Enum = 'ParameterType'
          AND lev.Culture = @Culture
          AND le.Item = 'Datetime';

    SELECT @Int = lev.[Value]
    FROM CFG.LocalizeEnumValue AS lev
        JOIN CFG.LocalizeEnum AS le
            ON le.LocalizeEnumID = lev.LocalizeEnumID
    WHERE le.Enum = 'ParameterType'
          AND lev.Culture = @Culture
          AND le.Item = 'Int';

    SELECT @Boolean = lev.[Value]
    FROM CFG.LocalizeEnumValue AS lev
        JOIN CFG.LocalizeEnum AS le
            ON le.LocalizeEnumID = lev.LocalizeEnumID
    WHERE le.Enum = 'ParameterType'
          AND lev.Culture = @Culture
          AND le.Item = 'Bool';


    SELECT @Text = lev.[Value]
    FROM CFG.LocalizeEnumValue AS lev
        JOIN CFG.LocalizeEnum AS le
            ON le.LocalizeEnumID = lev.LocalizeEnumID
    WHERE le.Enum = 'ParameterType'
          AND lev.Culture = @Culture
          AND le.Item = 'Text';

    IF @Sort IS NULL
       OR @Sort = ''
        SET @Sort = 'EntityCustomeFieldID ';

    SET @Sort = REPLACE(@Sort, 'CreateDateString', 'CreationDate');
    SET @Sort = REPLACE(@Sort, 'EditionDateString', 'LastEditionDate');
    SET @Sort = REPLACE(@Sort, 'Order', '[Order]');

    DECLARE @Query NVARCHAR(MAX);
    SET @Query
        = N'
 		WITH Query_Result 
		(
            ViewModelId,
			EntityCustomeFieldID,
			EntityName ,
			FieldName ,
			FieldTitle ,
			FieldTitle2 ,
			FieldType ,
			LookupDataID ,			
			[Order] ,
			Creator ,
			CreationDate ,
			LastEditor ,
			LastEditionDate ,
			Version ,
			IsRequired ,
			FieldTypeTitle,
			CreateDateString,
			EditionDateString,
			CreatorUserName,
			EditorName,
			EntityTitle,
            IsNotInFlow
		)
		as
		(
			SELECT CAST(src.EntityCustomeFieldID AS BIGINT) AS ViewModelId,
                   src.EntityCustomeFieldID ,
				   src.EntityName ,
				   src.FieldName ,
				   src.FieldTitle ,
				   src.FieldTitle2 ,
				   src.FieldType ,
				   src.LookupDataID ,
				   src.[Order] ,
				   src.Creator ,
				   src.CreationDate ,
				   src.LastEditor ,
				   src.LastEditionDate ,
				   src.Version ,
				   src.IsRequired ,
				   CASE WHEN ld.Title IS NOT NULL THEN ld.Title
				   ELSE  CASE src.FieldType 
						WHEN 0 THEN @string
						   WHEN 1 THEN @Decimal 
						   WHEN 2 THEN @Date 
						   WHEN 3 THEN @Int 
						   WHEN 4 THEN @Boolean
						   WHEN 5 THEN @Text
						   WHEN 6 THEN @Time
						   END  
				   END AS FieldTypeTitle,
				   CFG.GetCLRSaturnDate(src.CreationDate,@dateFormat,1,@dateType ) AS CreateDateString,
				   CFG.GetCLRSaturnDate(src.LastEditionDate,@dateFormat,1,@dateType ) AS EditionDateString ,
				   u.[Name] AS CreatorUserName,
				   u2.[Name] AS EditorName,
				   me.EntityTitle,
                   CAST(0 AS BIT) AS IsNotInFlow
			FROM   (   SELECT ecf.EntityCustomeFieldID ,
							  ecf.EntityName ,
							  ecf.FieldName ,
							  ecf.FieldTitle ,
							  ecf.FieldTitle2 ,
							  ecf.FieldType ,							 
							  ecf.[Order] ,
							  ecf.Version ,
							  ecf.Creator ,
							  ecf.CreationDate ,
							  ecf.LastEditor ,
							  ecf.LastEditionDate ,
							  ecf.LookupDataID ,
							  ecf.IsRequired ,
							  CASE ecf.EntityName
								   WHEN ''QuantityReceipt'' THEN ''StockReceipt''
								   WHEN ''ReturnQuantityReceipt'' THEN ''ReturnStockReceipt''
								   WHEN ''QuantityOutgoing''THEN ''Outgoing''
								   WHEN ''QuantityReturnedOutgoing'' THEN ''ReturnedOutgoing''
								   WHEN ''FirstInventoryQuantityReceipt'' THEN ''StockReceipt''
								   ELSE ecf.EntityName
							  END AS EngName
					   FROM   CFG.EntityCustomeField AS ecf ) AS src
				   LEFT JOIN (
						SELECT de.[Name] AS EntityName,
							   dti.[Value] AS EntityTitle,
							   dm.[Name] AS ModuleName
						FROM MDT.DmdEntity AS de
							JOIN MDT.DmdRelatedEntityTranslate AS dret
								ON dret.DmdEntityID = de.ID
							JOIN MDT.DmdTranslateItem AS dti
								ON dti.ID = dret.DmdTranslateItemID
							JOIN MDT.DmdModule AS dm
								ON dm.ID = de.DmdModuleID
						WHERE dti.Culture = @Culture
				   ) AS me ON me.EntityName = src.EngName
				   JOIN CFG.SaturnModule AS sm ON sm.EngName = me.ModuleName
				   LEFT JOIN CFG.LookupData AS ld ON ld.LookupDataID = src.LookupDataID
				   JOIN CFG.[User] AS u ON u.UserID = src.Creator
				   JOIN CFG.[User] AS u2 ON u2.UserID = src.LastEditor
			WHERE sm.SaturnModuleID IN (SELECT im.Val FROM @installedModules AS im)
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
    PRINT @Query;

    EXECUTE sp_executesql @Query,
                          N'	
		@DateFormat			VARCHAR(10) ,
		@DateType			TINYINT,
		@string				NVARCHAR(50) ,
        @Decimal			NVARCHAR(50) ,
        @Date				NVARCHAR(50) ,
        @Int				NVARCHAR(50) ,
        @Boolean			NVARCHAR(50) ,
        @Text				NVARCHAR(50),
        @Time				NVARCHAR(50),
		@Culture		    VARCHAR (25),
		@installedModules	ArrayInput READONLY',
                          @DateFormat = @DateFormat,
                          @DateType = @DateType,
                          @string = @string,
                          @Decimal = @Decimal,
                          @Date = @Date,
                          @Int = @Int,
                          @Boolean = @Boolean,
                          @Text = @Text,
                          @Culture = @Culture,
                          @installedModules = @installedModules,
                          @Time = @Time;

    DECLARE @Count INT;

    EXEC ('select * from ' + @tableName + ' ORDER BY _RN');

    SET @Query = N'select top 1 @Count=  r_count from ' + @tableName;
    EXECUTE sp_executesql @Query, N'@count int out', @Count = @Count OUT;

    RETURN ISNULL(@Count, 0);
END;
