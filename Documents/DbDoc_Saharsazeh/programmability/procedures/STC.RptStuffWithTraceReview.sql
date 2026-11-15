	
CREATE   PROC [STC].RptStuffWithTraceReview
(
	@ReviewType TINYINT,
	@FromDate DATETIME = NULL,
	@ToDate DATETIME = NULL,
	@SelectedStocks NVARCHAR(MAX) = NULL,
	@SelectedStuff NVARCHAR(MAX) = NULL,
	@SelectedStuffGroup NVARCHAR(MAX) = NULL,
	@SelectedStuffAccountGroup NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION 
AS
DECLARE @Culture                   VARCHAR(10),
		@CultureNo                 TINYINT,
		@query                     NVARCHAR(MAX),
		@tableName                 NVARCHAR(255),
		@tableName1                NVARCHAR(255),
		@Columns                   NVARCHAR(MAX),
		@CodeAndTitleColumn        NVARCHAR(MAX),
		@LeftJoin                  NVARCHAR(MAX),
		@SelectColumns             NVARCHAR(MAX),
		@user                      INT,
		@DateType                  VARCHAR(10),
		@DateFormat                VARCHAR(10),
		@Ingredients               NVARCHAR(100),
		@SemiManufacturedStuff     NVARCHAR(100),
		@Product                   NVARCHAR(100),
		@Spoilages                 NVARCHAR(100),
		@FixedAssets               NVARCHAR(100),
		@OtherStuffs               NVARCHAR(100),
		@listLeftJoin              NVARCHAR(MAX),
		@CreateTable               NVARCHAR(MAX),
		@FinancialPeriodStartDate	DATE,
		@OpeningStockDocumentTypeID int,
		@StartDateFinancialPeriodID INT;
		
SELECT @OpeningStockDocumentTypeID = sdt.StockDocumentTypeID FROM stc.StockDocumentType AS sdt
WHERE sdt.[Type] = 1 AND sdt.DocumentType = 7;


BEGIN
	SELECT @Ingredients = lev.[Value]
	FROM   CFG.LocalizeEnum le
		   JOIN CFG.LocalizeEnumValue lev
				ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'StuffDetailTypes'
		   AND le.Item = 'Ingredients'
		   AND lev.Culture = @Culture;
	
	SELECT @SemiManufacturedStuff = lev.[Value]
	FROM   CFG.LocalizeEnum le
		   JOIN CFG.LocalizeEnumValue lev
				ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'StuffDetailTypes'
		   AND le.Item = 'SemiManufacturedStuff'
		   AND lev.Culture = @Culture;
	
	SELECT @Product = lev.[Value]
	FROM   CFG.LocalizeEnum le
		   JOIN CFG.LocalizeEnumValue lev
				ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'StuffDetailTypes'
		   AND le.Item = 'Product'
		   AND lev.Culture = @Culture;
	
	SELECT @Spoilages = lev.[Value]
	FROM   CFG.LocalizeEnum le
		   JOIN CFG.LocalizeEnumValue lev
				ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'StuffDetailTypes'
		   AND le.Item = 'Spoilages'
		   AND lev.Culture = @Culture;
	
	SELECT @FixedAssets = lev.[Value]
	FROM   CFG.LocalizeEnum le
		   JOIN CFG.LocalizeEnumValue lev
				ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'StuffDetailTypes'
		   AND le.Item = 'FixedAssets'
		   AND lev.Culture = @Culture;
	
	SELECT @OtherStuffs = lev.[Value]
	FROM   CFG.LocalizeEnum le
		   JOIN CFG.LocalizeEnumValue lev
				ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'StuffDetailTypes'
		   AND le.Item = 'OtherStuffs'
		   AND lev.Culture = @Culture;
END

SET @tableName = CFG.getTempTableName(1);
SET @tableName1 = CFG.getTempTableName(1);

SET @user = CFG.GetuserID();
SET @Culture = CFG.GetuserCulture();

SELECT @CultureNo = CultureNo
FROM   CFG.CultureInfo
WHERE  Culture = @Culture;


SELECT @DateType = us.SettingValue
FROM   CFG.UserSetting us
WHERE  us.SettingKey = 'Date_Type'
	   AND us.UserID = @user;

IF @DateType IS NULL
	SET @DateType = CASE @Culture
						 WHEN 'fa' THEN 0
						 WHEN 'en' THEN 1
						 WHEN 'ar' THEN 2
					END;

SELECT @DateFormat = us.SettingValue
FROM   CFG.UserSetting us
WHERE  us.SettingKey = 'Date_Format'
	   AND us.UserID = @user;

IF @DateFormat IS NULL
	SET @DateFormat = 'YY/MM/DD';
	
SELECT @Columns = STUFF(
		   (
			   SELECT DISTINCT
					  ',' + QUOTENAME(TraceID)
			   FROM   STF.Trace
			   WHERE case when  @ReviewType = 2 then pricingBase else  CheckInventory end = 1
					  FOR XML PATH(''),
					  TYPE
		   ).value('.', 'NVARCHAR(MAX)'),
		   1,
		   1,
		   ''
	   );

IF (@Columns IS NULL)
	SET @Columns = N'[-1]';
	
SELECT @CodeAndTitleColumn = STUFF(
		   (
			   SELECT DISTINCT
					  ' ,d' + CAST(TraceID AS VARCHAR(10)) + '.Code AS T' + CAST(TraceID AS VARCHAR(10)) + 'Code,d'
					  + CAST(TraceID AS VARCHAR(10)) + '.Title
					 AS T' + CAST(TraceID AS VARCHAR(10)) + 'Title'
			   FROM   STF.Trace
			   WHERE  DlTypeID IS NOT NULL
			   AND case when  @ReviewType = 2 then pricingBase else  CheckInventory end = 1
					  FOR XML PATH(''), TYPE
		   ).value('.', 'NVARCHAR(MAX)'),
		   1,
		   1,
		   ''
	   );

IF (@CodeAndTitleColumn IS NULL)
	SET @CodeAndTitleColumn = N'';
SELECT @SelectColumns = STUFF(
		   (
			   SELECT DISTINCT
					  ',items.' + QUOTENAME(TraceID) + ' AS T' + CAST(TraceID AS NVARCHAR(5))
					  + CASE 
							 WHEN AccountLevelTypeID = 6 THEN ',d' + CAST(TraceID AS VARCHAR(10)) + '.Item' + CASE 
																												   WHEN 
																														@CultureNo 
																														= 
																														2 THEN 
																														'2'
																												   ELSE 
																														''
																											  END + 
								  ' AS T' + CAST(TraceID AS NVARCHAR(5)) + 'Title'
							 ELSE ''
						END
			   FROM   STF.Trace
			   WHERE case when  @ReviewType = 2 then pricingBase else  CheckInventory end = 1
					  FOR XML PATH(''),
					  TYPE
		   ).value('.', 'NVARCHAR(MAX)'),
		   1,
		   1,
		   ''
	   );
	   
IF (@SelectColumns IS NULL)
	SET @SelectColumns = N'[-1]';
	
SELECT @LeftJoin
	= STUFF(
(
	SELECT DISTINCT
		   ' Left Join acc.dl d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10))
		   + '.DlID = items.' + QUOTENAME(TraceID)
	FROM STF.Trace
	WHERE DlTypeID IS NOT NULL
	AND case when  @ReviewType = 2 then pricingBase else  CheckInventory end = 1
	FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),
1   ,
1   ,
''
		   );

IF (@LeftJoin IS NULL)
	SET @LeftJoin = N'';
	
	SELECT @listLeftJoin
	= STUFF(
(
	SELECT DISTINCT
		   ' Left Join STF.TraceItem d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10))
		   + '.TraceItemID = items.' + QUOTENAME(TraceID)
	FROM STF.Trace
	WHERE AccountLevelTypeID = 6
	AND case when  @ReviewType = 2 then pricingBase else  CheckInventory end = 1
	FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),
1   ,
1   ,
''
		   );
				 
SELECT @FinancialPeriodStartDate = fp.StartDate,@StartDateFinancialPeriodID = FP.FinancialPeriodID
FROM   cfg.FinancialPeriod AS fp
WHERE  @FromDate BETWEEN fp.StartDate AND fp.EndDate

----Exec Data Source to generate OpeningBalance in case of report start date is not first day of financialperiod
IF (@listLeftJoin IS NULL)
BEGIN
		SET @listLeftJoin = N'';

END	    

IF @FromDate <> @FinancialPeriodStartDate
BEGIN

	DECLARE @StartDate DATE
	SET @StartDate = DATEADD(DAY,-1,@FromDate)
 
EXEC [STC].RptReviewDataSource 
	 @ReviewType = @ReviewType,
	 @FromDate = @FinancialPeriodStartDate,
	 @ToDate = @StartDate,
	 @TableName = @tableName,
	 @SelectedStocks = @SelectedStocks,
	 @SelectedStuffTrace = DEFAULT,
	 @SelectedStuffAccountGroup = @SelectedStuffAccountGroup,
	 @SelectedStuffGroup = @SelectedStuffGroup,
	 @SelectedStuff = @SelectedStuff,
	 @IsTraceTab = 1,
	 @Parameter = 'Stuff',
	 @StartDateFinancialPeriodID = @StartDateFinancialPeriodID
							
SET @query = N'Update '+@tableName + N' set StockDocumentTypeID = ' + CAST(@OpeningStockDocumentTypeID AS NVARCHAR(30))
EXEC (@query)
							
END
-------


 
EXEC [STC].RptReviewDataSource 
	 @ReviewType = @ReviewType,
	 @FromDate = @FromDate,
	 @ToDate = @ToDate,
	 @TableName = @tableName,
	 @SelectedStocks = @SelectedStocks,
	 @SelectedStuffTrace = DEFAULT,
	 @SelectedStuffAccountGroup = @SelectedStuffAccountGroup,
	 @SelectedStuffGroup = @SelectedStuffGroup,
	 @SelectedStuff = @SelectedStuff,
	 @IsTraceTab = 1,
	 @Parameter = 'Stuff',
	 @StartDateFinancialPeriodID = @StartDateFinancialPeriodID


SET @query = N'SELECT   A.ID ,	  
						SUM(case when sdt.Type = 1 and sdt.DocumentType = 7 then a.MainQuantity else 0 end) AS FirstMainQuantity ,
						SUM(case when sdt.Type = 1 and sdt.DocumentType = 7 then a.Price else 0 End) AS FirstPrice,
						SUM(case when sdt.Type = 1 and sdt.DocumentType = 7 then a.SubQuantity else 0 end) AS FirstSubQuantity ,
						SUM(case when sdt.Type = 1 and sdt.DocumentType <> 7 then a.MainQuantity else 0 end) AS InputMainQuantity ,
						SUM(case when sdt.Type = 1 and sdt.DocumentType <> 7 then a.Price else 0 End) AS InputPrice,
						SUM(case when sdt.Type = 1 and sdt.DocumentType <> 7 then a.SubQuantity else 0 end) AS InputSubQuantity ,
						SUM(case when sdt.Type = 2 THEN a.MainQuantity else 0 end) AS OutputMainQuantity ,
						SUM(case when sdt.Type = 2 THEN a.SubQuantity else 0 end) AS OutputSubQuantity ,
						SUM(case when sdt.Type = 2 THEN a.Price else 0 end) AS OutputPrice,
						SUM(case when sdt.Type = 1 and sdt.DocumentType = 7 then a.MainQuantity else 0 end)+
						SUM(case when sdt.Type = 1 and sdt.DocumentType <> 7 then a.MainQuantity else 0 end) +
						SUM(case when sdt.Type = 2 THEN a.MainQuantity else 0 end) AS MainQuantity ,
						SUM(case when sdt.Type = 1 and sdt.DocumentType = 7 then a.SubQuantity else 0 end)+
						SUM(case when sdt.Type = 1 and sdt.DocumentType <> 7 then a.SubQuantity else 0 end)+
						SUM(case when sdt.Type = 2 THEN a.SubQuantity else 0 end) AS SubQuantity ,
						SUM(case when sdt.Type = 1 and sdt.DocumentType = 7 then a.Price else 0 End)+
						SUM(case when sdt.Type = 1 and sdt.DocumentType <> 7 then a.Price else 0 End)+
						SUM(case when sdt.Type = 2 THEN a.Price else 0 end)  AS Price,					
					' + @Columns + N'
					into ' + @tableName1 + '
			FROM    ' + @tableName + N' A
			 join stc.StockDocumentType sdt on a.StockDocumentTypeID = sdt.StockDocumentTypeID	
			GROUP BY A.ID ,' + @Columns + N''
			
			


EXEC (@query)

SET @query = N'SELECT 
				items.ID StuffID,	
				s.Code AS StuffCode ,
				case when @CultureNo = 1 then s.Title else s.Title2 end as StuffTitle, 
				sd.TechnicalCode,
				case when @CultureNo = 1 then s2.Title else s2.Title2 end as StuffAccountGroupTitle,
				s2.Code StuffAccountGroupCode,
				CASE s2.StuffDetailType
				  WHEN 0 THEN @Ingredients
				  WHEN 1 THEN @SemiManufacturedStuff
				  WHEN 2 THEN @Product
				  WHEN 3 THEN @Spoilages
				  WHEN 4 THEN @FixedAssets
				  WHEN 5 THEN @OtherStuffs
				END StuffDetailType ,
				mu.Title AS MainMeasureUnit ,
				mu2.Title AS SubMeasureUnit ,
				items.FirstMainQuantity ,
				items.FirstSubQuantity ,
				items.FirstPrice,
				items.InputMainQuantity ,
				items.InputSubQuantity ,
				items.InputPrice,
				items.OutputMainQuantity ,
				items.OutputSubQuantity ,
				items.OutputPrice,
				items.MainQuantity ,
				items.SubQuantity ,
				items.Price,
				[STF].[StuffGroupFullCode](sg.StuffGroupID) AS StuffGroupCode ,
				STF.StuffGroupFullTitle(sg.StuffGroupID) AS GroupTitle ,
				' + @SelectColumns + ' ' + @CodeAndTitleColumn+ N'
			FROM ' + @tableName1 + ' items	
			JOIN STF.VWStuff s ON items.ID = s.StuffID
			JOIN STF.StuffDetail sd ON sd.StuffID = s.StuffID
			JOIN STF.MeasureUnit mu ON mu.MeasureUnitID = s.MainMeasureUnitID
			LEFT JOIN STF.MeasureUnit mu2 ON mu2.MeasureUnitID = sd.MeasureSubUnitID
			LEFT JOIN STF.StuffAccountGroup s2 ON sd.StuffAccountGroupID = s2.StuffAccountGroupID
			LEFT JOIN STF.StuffGroup sg ON sg.StuffGroupID = s.StuffGroupID ' + @LeftJoin + ' ' + @listLeftJoin 


EXECUTE sp_executesql @query,
	 N'  @Ingredients NVARCHAR(100),
		 @SemiManufacturedStuff NVARCHAR(100),
		 @Product NVARCHAR(100),
		 @Spoilages NVARCHAR(100),
		 @FixedAssets NVARCHAR(100),
		 @OtherStuffs NVARCHAR(100),
		 @CultureNo tinyint',
		 @Ingredients = @Ingredients,
		 @SemiManufacturedStuff = @SemiManufacturedStuff,
		 @Product = @Product,
		 @Spoilages = @Spoilages,
		 @FixedAssets = @FixedAssets,
		 @OtherStuffs = @OtherStuffs,
		 @CultureNo = @CultureNo
		 ;
