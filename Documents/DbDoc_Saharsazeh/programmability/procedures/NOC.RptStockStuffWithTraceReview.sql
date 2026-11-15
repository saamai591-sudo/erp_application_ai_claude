
CREATE   PROC [NOC].[RptStockStuffWithTraceReview]
(
    @FromPeriod int,
    @ToPeriod int,
    @SelectedStocks NVARCHAR(MAX) = NULL,
    @SelectedStuff NVARCHAR(MAX) = NULL,
    @SelectedStuffAccountGroup NVARCHAR(MAX) = NULL,
    @SelectedStuffGroup NVARCHAR(MAX) = NULL,
    @SelectedDelivers NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
BEGIN

    DECLARE 
            @tableName NVARCHAR(20),
			@tableName1 NVARCHAR(20),
            @query NVARCHAR(MAX),
            @stuffTraceTableName NVARCHAR(15),
            @joinColumns NVARCHAR(MAX),
            @Culture VARCHAR(25),
            @CultureNo TINYINT;

    SET @tableName = CFG.getTempTableName(1);
	SET @tableName1 = CFG.getTempTableName(1);


	exec [NOC].[RptDollarCartexDataSource] 
										@FromPeriod,
										@ToPeriod,
										@tableName,
										@SelectedStuff,
										@SelectedStocks,
										null,
										@SelectedStuffAccountGroup,
										@SelectedStuffGroup

    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;


		DECLARE @Columns NVARCHAR(MAX),
				@CodeAndTitleColumn NVARCHAR(MAX),
				@LeftJoin NVARCHAR(MAX),
				@ColumnsInCreateTable NVARCHAR(MAX),
				@SelectColumns NVARCHAR(MAX)

		SELECT @Columns = STUFF(
		(
			SELECT DISTINCT
				   ',' + QUOTENAME(TraceID)
			FROM STF.Trace
			FOR XML PATH(''), TYPE
		).value('.', 'NVARCHAR(MAX)'),
		1   ,
		1   ,
		''
							   );

		IF (@Columns IS NULL)
			SET @Columns = N'[-1]';

		SELECT @ColumnsInCreateTable = STUFF(
		(
			SELECT DISTINCT
				   ',' + QUOTENAME(TraceID) + N' NVARCHAR(256)'
			FROM STF.Trace
			FOR XML PATH(''), TYPE
		).value('.', 'NVARCHAR(MAX)'),
		1   ,
		1   ,
		''
							   );

		IF (@ColumnsInCreateTable IS NULL)
			SET @ColumnsInCreateTable = N'[-1] NVARCHAR(256)';

    SET @query
        = N'CREATE TABLE ' + @tableName1
          + N'(
							StuffID		BIGINT,
							InputMainQuantity DECIMAL(36,10),
							InputSubQuantity DECIMAL(36,10),
							BaseCurrencyInput DECIMAL(36,10) ,
							Input			DECIMAL(30,4),
							OutputMainQuantity DECIMAL(36,10),
							OutputSubQuantity DECIMAL(36,10),
							BaseCurrencyOutput DECIMAL(36,10),
							Output			DECIMAL(30,4),
							'+@ColumnsInCreateTable+'
			  )';

    EXEC (@query);



    SET @query
        = N'INSERT ' + @tableName1
          + N'
			     SELECT ii.StuffID ,
                        SUM(case when Price > 0 then MainQuantity else 0 end) ,
                        SUM(case when Price > 0 then SubQuantity else 0 end) ,
						SUM(case when BaseCurrencyPrice > 0 then BaseCurrencyPrice else 0 end) ,
                        SUM(case when Price > 0 then Price else 0 end) ,
                        SUM(case when Price < 0 then MainQuantity else 0 end) ,
                        SUM(case when Price < 0 then SubQuantity else 0 end) ,
						SUM(case when BaseCurrencyPrice < 0 then BaseCurrencyPrice else 0 end) ,
                        SUM(case when Price < 0 then Price else 0 end) ,
						'+@Columns+'
                   FROM   '+@tableName+' ii 
					group by ii.StuffID,'+@Columns;

    EXEC sp_executesql @query
					   

DECLARE @Ingredients NVARCHAR(100),
        @SemiManufacturedStuff NVARCHAR(100),
        @Product NVARCHAR(100),
        @Spoilages NVARCHAR(100),
        @FixedAssets NVARCHAR(100),
        @OtherStuffs NVARCHAR(100);

SELECT @Ingredients = lev.[Value]
FROM CFG.LocalizeEnum le
    JOIN CFG.LocalizeEnumValue lev
        ON lev.LocalizeEnumID = le.LocalizeEnumID
WHERE le.Enum = 'StuffDetailTypes'
      AND le.Item = 'Ingredients'
      AND lev.Culture = @Culture;

SELECT @SemiManufacturedStuff = lev.[Value]
FROM CFG.LocalizeEnum le
    JOIN CFG.LocalizeEnumValue lev
        ON lev.LocalizeEnumID = le.LocalizeEnumID
WHERE le.Enum = 'StuffDetailTypes'
      AND le.Item = 'SemiManufacturedStuff'
      AND lev.Culture = @Culture;

SELECT @Product = lev.[Value]
FROM CFG.LocalizeEnum le
    JOIN CFG.LocalizeEnumValue lev
        ON lev.LocalizeEnumID = le.LocalizeEnumID
WHERE le.Enum = 'StuffDetailTypes'
      AND le.Item = 'Product'
      AND lev.Culture = @Culture;

SELECT @Spoilages = lev.[Value]
FROM CFG.LocalizeEnum le
    JOIN CFG.LocalizeEnumValue lev
        ON lev.LocalizeEnumID = le.LocalizeEnumID
WHERE le.Enum = 'StuffDetailTypes'
      AND le.Item = 'Spoilages'
      AND lev.Culture = @Culture;

SELECT @FixedAssets = lev.[Value]
FROM CFG.LocalizeEnum le
    JOIN CFG.LocalizeEnumValue lev
        ON lev.LocalizeEnumID = le.LocalizeEnumID
WHERE le.Enum = 'StuffDetailTypes'
      AND le.Item = 'FixedAssets'
      AND lev.Culture = @Culture;

SELECT @OtherStuffs = lev.[Value]
FROM CFG.LocalizeEnum le
    JOIN CFG.LocalizeEnumValue lev
        ON lev.LocalizeEnumID = le.LocalizeEnumID
WHERE le.Enum = 'StuffDetailTypes'
      AND le.Item = 'OtherStuffs'
      AND lev.Culture = @Culture;


DECLARE @listLeftJoin NVARCHAR(MAX);

SELECT @listLeftJoin
    = STUFF(
(
    SELECT DISTINCT
           ' Left Join STF.TraceItem d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10))
           + '.TraceItemID = items.' + QUOTENAME(TraceID)
    FROM STF.Trace
    WHERE AccountLevelTypeID = 6
    FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),
1   ,
1   ,
''
           );

IF (@listLeftJoin IS NULL)
    SET @listLeftJoin = N'';

SELECT @LeftJoin
    = STUFF(
(
    SELECT DISTINCT
           ' Left Join acc.dl d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10))
           + '.DlID = items.' + QUOTENAME(TraceID)
    FROM STF.Trace
    WHERE DlTypeID IS NOT NULL
    FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),
1   ,
1   ,
''
           );

IF (@LeftJoin IS NULL)
    SET @LeftJoin = N'';


SELECT @SelectColumns
    = STUFF(
(
    SELECT DISTINCT
           ',' + QUOTENAME(TraceID) + ' AS T' + CAST(TraceID AS NVARCHAR(5))
           + CASE
                 WHEN AccountLevelTypeID = 6 THEN
                     ',d' + CAST(TraceID AS VARCHAR(10)) + '.Item' + CASE
                                                                         WHEN @CultureNo = 2 THEN
                                                                             '2'
                                                                         ELSE
                                                                             ''
                                                                     END + ' AS T' + CAST(TraceID AS NVARCHAR(5))
                     + 'Title'
                 ELSE
                     ''
             END
    FROM STF.Trace
    FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),
1   ,
1   ,
''
           );

IF (@SelectColumns IS NULL)
    SET @SelectColumns = N'[-1]';

SELECT @CodeAndTitleColumn
    = STUFF(
(
    SELECT DISTINCT
           ' ,d' + CAST(TraceID AS VARCHAR(10)) + '.Code [T' + CAST(TraceID AS VARCHAR(10)) + 'Code],d'
           + CAST(TraceID AS VARCHAR(10)) + '.Title [T' + CAST(TraceID AS VARCHAR(10)) + 'Title]'
    FROM STF.Trace
    WHERE DlTypeID IS NOT NULL
    FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),
1   ,
1   ,
''
           );

IF (@CodeAndTitleColumn IS NULL)
    SET @CodeAndTitleColumn = N'';


	
	select *
	into #VwStuff
	from stf.VWStuff
	where type = 0

SET @query
    = N'						
    SELECT  items.StuffID ,
            s.Code AS StuffCode ,
			case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title else s.Title2 end as StuffTitle,
			s.TechnicalCode,
			S.StuffGroupCode,
            case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.StuffGroupTitle else s.StuffGroupTitle2 end as GroupTitle,
			case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.StuffAccountGroupTitle else s.StuffAccountGroupTitle2 end as StuffAccountGroupTitle,
			s.StuffAccountGroupCode,
            CASE s.StuffDetailType
              WHEN 0 THEN @Ingredients
              WHEN 1 THEN @SemiManufacturedStuff
              WHEN 2 THEN @Product
              WHEN 3 THEN @Spoilages
              WHEN 4 THEN @FixedAssets
              WHEN 5 THEN @OtherStuffs
			  END StuffDetailType ,
			case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.MainMeasureUnit else s.MainMeasureUnit2 end as MainMeasureUnit, 
			case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.SubMeasureUnit else s.SubMeasureUnit2 end as SubMeasureUnit, 
           items.InputMainQuantity ,
           items.InputSubQuantity ,
		   items.BaseCurrencyInput,
           items.Input  AS InputPrice,
           items.OutputMainQuantity ,
           items.OutputSubQuantity ,
		   items.BaseCurrencyOutput,
           items.Output  AS OutputPrice ,' + @SelectColumns + N'' + @CodeAndTitleColumn + N'
	FROM  ' + @tableName1 + N'  items
            JOIN #VwStuff s ON items.StuffID = s.StuffID
			' + @LeftJoin + N' ' + @listLeftJoin;



EXECUTE sp_executesql   @query,
                      N'@Ingredients NVARCHAR(100) ,
					    @SemiManufacturedStuff NVARCHAR(100) ,
					    @Product NVARCHAR(100) ,
					    @Spoilages NVARCHAR(100) ,
					    @FixedAssets NVARCHAR(100) ,
					    @OtherStuffs NVARCHAR(100)',
                        @Ingredients = @Ingredients,
                        @SemiManufacturedStuff = @SemiManufacturedStuff,
                        @Product = @Product,
                        @Spoilages = @Spoilages,
                        @FixedAssets = @FixedAssets,
                        @OtherStuffs = @OtherStuffs;



end
