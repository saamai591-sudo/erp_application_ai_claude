CREATE   PROCEDURE [STF].[GetStuffList]
    ( 
		@ServiceOrStuff TINYINT = 1,
        @PageNumber INT ,
        @RowspPage INT ,
        @Sort NVARCHAR(MAX) = NULL ,
        @Filter NVARCHAR(MAX) = NULL
       
    )
--WITH ENCRYPTION
AS
    BEGIN
        DECLARE @ConfigValue BIT ,
                @FixedAssets NVARCHAR(100) ,
                @Ingredient NVARCHAR(100) ,
                @OtherStuff NVARCHAR(100) ,
                @Product NVARCHAR(100) ,
                @SemiManufacturedStuff NVARCHAR(100) ,
                @Spoilages NVARCHAR(100) ,
                @UserID INT ,
                @DateType TINYINT ,
                @DateFormat VARCHAR(10) ,
                @Stuff NVARCHAR(30) ,
                @ViewRelatedToUser INT ,
                @ViewRelatedToOthers NVARCHAR(MAX) ,
                @Service NVARCHAR(30) ,
                @Tradeable NVARCHAR(100) ,
                @Supllies NVARCHAR(100) ,
                @Order NVARCHAR(100) ,
                @Culture VARCHAR(5),
                @CultureNo TINYINT,
                @UnauthorizedUsers NVARCHAR(MAX);
        SET @Culture = CFG.GetuserCulture();
        SET @UserID = CFG.GetuserID();
        
        SELECT @CultureNo = ci.CultureNo FROM cfg.CultureInfo AS ci
        WHERE ci.Culture = @Culture
        
        if @CultureNo is NULL
        set @CultureNo = 1
        SELECT @DateType = us.SettingValue
        FROM   CFG.UserSetting us
        WHERE  us.SettingKey = 'Date_Type'
               AND us.UserID = @UserID;
        IF @DateType IS NULL
            SET @DateType = CASE @Culture
                                 WHEN 'fa' THEN 0
                                 WHEN 'en' THEN 1
                                 WHEN 'ar' THEN 2
                            END;
        SELECT @DateFormat = UPPER(us.SettingValue)
        FROM   CFG.UserSetting us
        WHERE  us.SettingKey = 'Date_Format'
               AND us.UserID = @UserID;
        IF @DateFormat IS NULL
            SET @DateFormat = 'YY/MM/DD';
 
			   SELECT * into #vwEnums
			    FROM cfg.VwEnums AS ve
			   WHERE enum = 'StuffDetailTypes'
SELECT * into #vwAccounts
FROM acc.vwaccounts AS v
        SELECT @Stuff = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'MeasureUnitTypes'
               AND L.Item = 'Stuff'
               AND LV.Culture = @Culture;
        SELECT @Service = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'MeasureUnitTypes'
               AND L.Item = 'Service'
               AND LV.Culture = @Culture;
     
        SELECT @Order = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'SaleDocumentBases'
               AND L.Item = 'order'
               AND LV.Culture = @Culture;
               
	    SELECT @ViewRelatedToUser = UserID
	    FROM CFG.vwOperationLevelAccess
	    WHERE EntityName = 'Stuff'
		      AND AccessKey = 'ViewRelatedToUser'
		      AND UserID = @UserID;
	    SELECT @ViewRelatedToOthers = UserID ,
               @UnauthorizedUsers = Users
	    FROM CFG.vwOperationLevelAccess
	    WHERE EntityName = 'Stuff'
		      AND AccessKey = 'ViewRelatedToOthers'
		      AND UserID = @UserID;
        IF @Sort IS NULL
           OR @Sort = ''
            SET @Sort = 'Code ';
        SET @Sort = REPLACE(@Sort, 'CreateDateString', '[CreationDate]');
        SET @Sort = REPLACE(@Sort, 'EditionDateString', '[LastEditionDate]');
	DECLARE @Seprator char 
	
	select @Seprator = ConfigValue
	 from [CFG].[Configuration] 
	 where [ConfigKey] = 'StuffGroupCodeSeprator';
	select @ConfigValue = case when ConfigValue = 'True' 
									then 1 
							  else 0 end
	from cfg.Configuration
	where ConfigType = 4
	and ConfigKey = 'IndependentStuffCoding'
	select StuffGroupID,stf.StuffGroupFullCode(StuffGroupID) FullCode,Title,Title2
	into #StuffGroup
	from  stf.StuffGroup
        DECLARE @Query NVARCHAR(MAX);
        SET @Query = '
	    WITH Query_Result 		
		AS
		(
			SELECT     s.StuffID, 
					   s.[Type], 
					   case when s.[Type] = 0 then @Stuff when s.[Type] = 1 then @Service else @Order end TypeString,
					   case when @ConfigValue = 1 then s.code
							else
								case when @Seprator is null or @Seprator = ''''
									then isnull(sg.FullCode ,'''')+ s.code
								else
									isnull(sg.FullCode + @Seprator,'''')+s.code
							end
						end Code,
					   s.StuffGroupID, 
					   isnull(s.StandardTitle + '' '','''') + isnull(s.Title,'''') Title, 
					   isnull(s.StandardTitle2 + '' '','''') + isnull(s.Title2,'''') Title2 , 
					   s.ExemptOfPurchaseVat, 
					   s.ExemptOfSellVat, 
					   s.MainMeasureUnitID, 
					   s.IsActive, 
					   s.[Version],           
					   s.StockReceiptCostAgent,
					   sg.FullCode AS StuffGroupFullCode,
					   mu.Title AS  MainMeasureUnitTitle,
					   mu.Title2 AS  MainMeasureUnitTitle2,
					   sg.Title AS StuffGroupTitle,
					   sg.Title2 AS StuffGroupTitle2,
					   sag.Title AS StuffAccountGroupTitle,
					   sag.Title2 AS StuffAccountGroupTitle2,
					   ve.[Value] AS  StuffTypeName,
					   mu2.Title AS MeasureSubUnitTitle,
					   mu2.Title2 AS MeasureSubUnitTitle2,
					   sd.ConvertRatio AS ConvertRatio,
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
                       s.WeighRatio	,
                       va.SlCode,
                       case when @CultureNo = 1 then va.SlTitle else va.SlTitle2 End SlTitle	           
				FROM STF.Stuff AS s
				    JOIN stf.MeasureUnit mu ON mu.MeasureUnitID = s.MainMeasureUnitID
				    left JOIN stf.StuffDetail sd ON sd.StuffID = s.StuffID
				    left JOIN stf.StuffAccountGroup sag ON sag.StuffAccountGroupID = sd.StuffAccountGroupID
				    left join #vwEnums ve on sag.StuffDetailtype = ve.KeyValue
				    LEFT JOIN #StuffGroup sg ON sg.StuffGroupID = s.StuffGroupID
				    LEFT JOIN stf.MeasureUnit mu2 ON mu2.MeasureUnitID = sd.MeasureSubUnitID
				    left join #vwAccounts va on sd.SlId = va.Slid
				    JOIN CFG.[User] AS u ON u.UserID = s.Creator 
				    JOIN CFG.[User] AS u2 ON u2.UserID = s.LastEditor		
				WHERE  ((@ServiceOrStuff = 1 and s.Type = 0) or (@ServiceOrStuff = 2 and S.Type = 1))
				and
                    (@UserID = -1 
				        or  (@ViewRelatedToUser is not null   and s.Creator = @UserID)
				        or  (@ViewRelatedToOthers IS NOT NULL AND s.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)
                    )
                )
		    )';
       -- PRINT @Query;
        DECLARE @selectQuery NVARCHAR(MAX);
        IF @Filter IS NULL
           OR @Filter = ''
            SET @Filter = '';
        ELSE
            SET @Filter = 'Where (' + @Filter + ')';
        DECLARE @tableName VARCHAR(100);
        SET @tableName = CFG.getTempTableName(1);
        SET @Query = CFG.ApplyPaging(
                         @tableName ,
                         @Query ,
                         @PageNumber ,
                         @RowspPage ,
                         @Filter ,
                         @Sort);
        EXECUTE sp_executesql @Query ,
                              N'@ConfigValue BIT ,
								@FixedAssets NVARCHAR(100) ,
								@Ingredient NVARCHAR(100) ,
								@OtherStuff NVARCHAR(100) ,
								@Product NVARCHAR(100) ,
								@SemiManufacturedStuff NVARCHAR(100) ,
								@Spoilages NVARCHAR(100) ,
								@UserID INT ,
								@DateType TINYINT ,
								@DateFormat VARCHAR(10) ,
								@Stuff NVARCHAR(30) ,
								@ViewRelatedToUser INT ,
								@ViewRelatedToOthers NVARCHAR(MAX) ,
								@UnauthorizedUsers NVARCHAR(MAX) ,
								@Service NVARCHAR(30) ,
								@Culture VARCHAR(5),
								@Tradeable NVARCHAR(100) ,
								@Supllies NVARCHAR(100),
								@Order NVARCHAR(100),
								@Seprator char,
								 @ServiceOrStuff tinyint,
								 @CultureNo tinyint' ,
                              @ConfigValue = @ConfigValue ,
                              @FixedAssets = @FixedAssets ,
                              @Ingredient = @Ingredient ,
                              @OtherStuff = @OtherStuff ,
                              @Product = @Product ,
                              @SemiManufacturedStuff = @SemiManufacturedStuff ,
                              @Spoilages = @Spoilages ,
                              @UserID = @UserID ,
                              @DateType = @DateType ,
                              @DateFormat = @DateFormat ,
                              @Stuff = @Stuff ,
                              @ViewRelatedToUser = @ViewRelatedToUser ,
                              @ViewRelatedToOthers = @ViewRelatedToOthers ,
                              @UnauthorizedUsers = @UnauthorizedUsers ,
                              @Service = @Service ,
                              @Culture = @Culture ,
                              @Tradeable = @Tradeable ,
                              @Supllies = @Supllies,
							  @Order = @Order,
							  @Seprator = @Seprator,
							  @ServiceOrStuff = @ServiceOrStuff,
							  @CultureNo = @CultureNo;
        DECLARE @Count INT;
        EXEC ( 'SELECT * FROM ' + @tableName + ' ORDER BY _RN' );
        SET @Query = 'select top 1 @Count=  r_count from ' + @tableName;
        EXECUTE sp_executesql @Query ,
                              N'@count int out' ,
                              @Count = @Count OUT;
        RETURN ISNULL(@Count, 0);
    END;
