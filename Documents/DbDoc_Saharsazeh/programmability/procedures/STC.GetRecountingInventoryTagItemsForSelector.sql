
---------------------------------------START #RAHA ABBASSI
CREATE   PROC [STC].GetRecountingInventoryTagItemsForSelector
    @RecountingInventoryTagID INT,
    @RecountingInventoryID INT,
    @RecountingTurn INT,
    @ValidationTempTable NVARCHAR(255) = NULL
--WITH ENCRYPTION
AS
SET NOCOUNT ON;

DECLARE @Columns NVARCHAR(MAX),
		@ColumnsForCreateTable NVARCHAR(MAX),
        @Query NVARCHAR(MAX),
        @Params NVARCHAR(MAX),
        @FinancialPeriodID INT,
        @Date DATE,
        @StockID INT,
        @ConditionalInnerJoin NVARCHAR(MAX),
        @TableName1 NVARCHAR(MAX),
		@TableName2 NVARCHAR(MAX),
        @SecondRecountableType TINYINT,
        @ThirdRecountableType TINYINT,
        @SourceTempTableName NVARCHAR(MAX),
        @TargetTempTableName NVARCHAR(MAX),
        @Culture NVARCHAR(100),
        @CultureNo TINYINT;

SET @Culture = CFG.GetuserCulture();

SELECT @CultureNo = CultureNo
FROM CFG.CultureInfo
WHERE Culture = @Culture;

SET @SourceTempTableName = CFG.getTempTableName(1);
SET @TargetTempTableName = CFG.getTempTableName(1);
SET @TableName1 = CFG.getTempTableName(1);
SET @TableName2 = CFG.getTempTableName(1);

SELECT @FinancialPeriodID = rip.FinancialPeriodID,
       @Date = rip.[Date],
       @StockID = rip.StockID,
       @SecondRecountableType = m.SecondRecountableType,
       @ThirdRecountableType = m.ThirdRecountableType
FROM STC.RecountingInventoryTag r
    JOIN STC.RecountingInventoryPeriod rip
        on r.RecountingInventoryPeriodID = rip.RecountingInventoryPeriodID
    JOIN STC.InventoryMethod m
        ON m.InventoryMethodID = rip.InventoryMethodID
WHERE RecountingInventoryTagID = @RecountingInventoryTagID;

SELECT @Columns = STUFF(
(
    SELECT DISTINCT
           ',' + QUOTENAME(TraceID)
    FROM STF.Trace
    WHERE CheckInventory = 1
    FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),
1   ,
1   ,
''
                       );

IF (@Columns IS NULL)
    SET @Columns = N'[-1]';

SELECT @ColumnsForCreateTable = STUFF(
(
    SELECT DISTINCT
           ',' + QUOTENAME(TraceID) + ' NVARCHAR(256)'
    FROM STF.Trace
    WHERE CheckInventory = 1
    FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),
1   ,
1   ,
''
                       );

IF (@ColumnsForCreateTable IS NULL)
    SET @ColumnsForCreateTable = N'[-1] NVARCHAR(256)';



        DECLARE @StartDate DATE;

        SELECT TOP (1)
                @StartDate = DATEADD(DAY, 1, a.EndDate)
        FROM CFG.FinancialPeriod a
        JOIN STC.StockClosingOperation b
            ON a.FinancialPeriodID = b.FinancialPeriodID
        WHERE b.StockID = @StockID
        ORDER BY a.EndDate DESC;

        IF @StartDate IS NULL
        BEGIN
            SELECT top 1 @StartDate = StartDate
            FROM CFG.FinancialPeriod
            ORDER BY StartDate ;
        END;

EXEC stc.spGetInventoryInDate
     @StuffId = Null,
     @stockID = @StockID,
     @ToDate = @Date,
     @FinalTable = @TargetTempTableName

	

SELECT @ConditionalInnerJoin
    = STUFF(
(
    SELECT DISTINCT
           ' AND ((source.' + QUOTENAME(TraceID) + ' is null and target.' + QUOTENAME(TraceID) + 'is null )  or target.'
           + QUOTENAME(TraceID) + '= source.' + QUOTENAME(TraceID) + ')'
    FROM STF.Trace
    WHERE CheckInventory = 1
    FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),
1   ,
1   ,
''
           );

IF (@ConditionalInnerJoin IS NULL)
    SET @ConditionalInnerJoin = N'';


IF @RecountingTurn = 1
   OR
   (
       @RecountingTurn = 2
       AND @SecondRecountableType = 0
   )
   OR
   (
       @RecountingTurn = 3
       AND @ThirdRecountableType = 0
   )
BEGIN
    SET @Query
        = N'
					select oi.[RecountingInventoryTagID]
						  ,oi.RecountingInventoryTagItemID
						  ,oi.[StuffID]
						  ,oi.[Version]
						  ,oi.[Creator]
						  ,oi.[CreationDate]
						  ,oi.[LastEditor]
						  ,oi.[LastEditionDate]
						  ,oi.[TagNumber],p.*
					into ' + @SourceTempTableName
          + N'
					from  stc.RecountingInventoryTagItem oi 
					LEFT JOIN(select RecountingInventoryTagItemid id ,TraceID,
						Case	When DLID IS NOT NULL THEN cast (DLID as nvarchar(max)) 
								When TraceItemID IS NOT NULL THEN cast (TraceItemID as nvarchar(max)) 
								else Value 
						end Value 
								from stc.RecountingInventoryTagItemTrace ) x
					pivot 
					( max(Value) for TraceID in ( ' + @Columns
          + N')
					) p on oi.RecountingInventoryTagItemid = p.id
					WHERE RecountingInventoryTagID = @pRecountingInventoryTagID
					and TagNumber > 0';

    SET @Params = N'@pRecountingInventoryTagID int';

    EXECUTE sp_executesql @Query,
                          @Params,
                          @pRecountingInventoryTagID = @RecountingInventoryTagID;



    IF @ValidationTempTable IS NULL
    BEGIN
        SET @Query
            = N'SELECT RecountingInventoryTagItemID,
					 RecountingInventoryTagID,
					 source.StuffID,
					 TagNumber as Number,
					 [STF].[GetStuffCode](s.StuffID) as StuffCode,
					 s.Barcode AS BarCode , 
					 s.IranCode,
					 case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	                      when ' + CAST(@CultureNo AS CHAR(1))
              + N' = 2 then s.Title2
	                 end as StuffTitle,
					 isnull(MainQuantity,0) as MainInventory,
					 SubQuantity as SubInventory,
					 TagNumber,
					 s.MainMeasureUnit MainUnit
				from ' + @SourceTempTableName
              + N' source
				join stf.vwstuff s on s.stuffid = source.stuffid
				left join ' + @TargetTempTableName + N' target on source.stuffid = target.stuffid ' + @ConditionalInnerJoin;
    END;
    ELSE
    BEGIN
        SET @Query
            = N'SELECT RecountingInventoryTagItemID,
					 RecountingInventoryTagID,
					 source.StuffID,
					 TagNumber as Number,
					  [STF].[GetStuffCode](s.StuffID) as StuffCode,
					 case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	                      when ' + CAST(@CultureNo AS CHAR(1))
              + N' = 2 then s.Title2
	                 end as StuffTitle,
					 isnull(MainQuantity,0) as MainInventory,
					 SubQuantity as SubInventory,
					 TagNumber
				INTO ' + @ValidationTempTable + N'
				from ' + @SourceTempTableName
              + N' source
				join stf.vwstuff s on s.stuffid = source.stuffid
				left join ' + @TargetTempTableName + N' target on source.stuffid = target.stuffid
							' + @ConditionalInnerJoin;
    END;

    EXEC (@Query);

    IF @ValidationTempTable IS NULL
    BEGIN

         SELECT r.RecountingInventoryTagItemTraceID,
               r.RecountingInventoryTagItemID,
               r.TraceID,
               r.DlID,
               CASE
                   WHEN r.TraceItemID IS NOT NULL THEN
                       CASE @CultureNo
                           WHEN 2 THEN
                               ti.Item2
                           ELSE
                               ti.Item
                       END
                   ELSE
                       r.[Value]
               END AS [Value],
               r.Version,
               r.Creator,
               r.CreationDate,
               r.LastEditor,
               r.LastEditionDate,
               r.TraceItemID,
               d.Code AS DlCode
        FROM STC.RecountingInventoryTagItemTrace r
            LEFT JOIN STF.TraceItem AS ti
                ON ti.TraceItemID = r.TraceItemID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = r.DlID
        WHERE r.RecountingInventoryTagItemID IN
              (
                  SELECT RecountingInventoryTagItemID
                  FROM STC.RecountingInventoryTagItem
                  WHERE RecountingInventoryTagID = @RecountingInventoryTagID
              );

    END;

END;

IF (
       @RecountingTurn = 2
       AND @SecondRecountableType = 1
   )
   OR
   (
       @RecountingTurn = 3
       AND @ThirdRecountableType = 1
   ) -- شمارش اول و موجودی
BEGIN

    SET @Query
        = N'
					SELECT  oi.[RecountingInventoryTagID] ,
							oi.RecountingInventoryTagItemID ,
							oi.[StuffID] ,
							oi.[Version] ,
							oi.[Creator] ,
							oi.[CreationDate] ,
							oi.[LastEditor] ,
							oi.[LastEditionDate] ,
							oi.[TagNumber] ,
							rii.MainQuantity,
							p.*
					into ' + @SourceTempTableName
          + N'
					FROM    STC.RecountingInventoryTagItem oi
							LEFT JOIN ( SELECT  RecountingInventoryTagItemID id ,
												TraceID ,
												CASE 
													 WHEN DlID IS NOT NULL THEN CAST (DlID AS NVARCHAR(MAX))
													 When TraceItemID IS NOT NULL THEN cast (TraceItemID as nvarchar(max)) 
													 ELSE Value
												END Value
										FROM    STC.RecountingInventoryTagItemTrace
									  ) x PIVOT ( MAX(Value) FOR TraceID IN ( ' + @Columns
          + N' ) ) p ON oi.RecountingInventoryTagItemID = p.id
			JOIN STC.RecountingInventoryItem rii ON rii.RecountingInventoryTagItemID = oi.RecountingInventoryTagItemID 
			and rii.[Type] = 1 
			and rii.RecountingInventoryID =@pRecountingInventoryID
					WHERE   RecountingInventoryTagID = @pRecountingInventoryTagID
							AND TagNumber > 0;
					';

    SET @Params = N'@pRecountingInventoryTagID int,@pRecountingInventoryID int';

    EXECUTE sp_executesql @Query,
                          @Params,
                          @pRecountingInventoryTagID = @RecountingInventoryTagID,
                          @pRecountingInventoryID = @RecountingInventoryID;

    DECLARE @tempTableName NVARCHAR(128) = CFG.getTempTableName(1);
    SET @Query
        = N'
			SELECT	RecountingInventoryTagItemID,
					RecountingInventoryTagID,
					source.StuffID,
					TagNumber as Number,
					 [STF].[GetStuffCode](s.StuffID) as StuffCode,
					case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	                      when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then s.Title2
	                 end as StuffTitle,
					s.Barcode AS BarCode ,
					s.IranCode,
					isnull(target.MainQuantity,0) as MainInventory,
					target.SubQuantity as SubInventory,
					TagNumber,
					s.MainMeasureUnit MainUnit
				into ' + @tempTableName + N'
			from ' + @SourceTempTableName
          + N' source
			join stf.vwstuff s on s.stuffid = source.stuffid
			left join ' + @TargetTempTableName + N' target on source.stuffid = target.stuffid ' + @ConditionalInnerJoin + N' 
			where source.MainQuantity <> isnull(target.MainQuantity,0)';

    EXEC (@Query);

    IF @ValidationTempTable IS NULL
    BEGIN
        SET @Query = N'
					SELECT  *
					FROM    ' + @tempTableName;
    END;
    ELSE
    BEGIN
        SET @Query
            = N'
					SELECT  RecountingInventoryTagItemID,
							RecountingInventoryTagID,
							StuffID,
							Number,
							StuffCode,
							StuffTitle,
							MainInventory,
							SubInventory,
							TagNumber
					into ' + @ValidationTempTable + N'
					FROM    ' + @tempTableName;

    END;
    EXEC (@Query);

    SET @Query
        = N' SELECT r.RecountingInventoryTagItemTraceID,
               r.RecountingInventoryTagItemID,
               r.TraceID,
               r.DlID,
               CASE
                   WHEN r.TraceItemID IS NOT NULL THEN
                       CASE '+CAST(@CultureNo AS NVARCHAR(1))+'
                           WHEN 2 THEN
                               ti.Item2
                           ELSE
                               ti.Item
                       END
                   ELSE
                       r.[Value]
               END AS [Value],
               r.Version,
               r.Creator,
               r.CreationDate,
               r.LastEditor,
               r.LastEditionDate,
               r.TraceItemID,
               d.Code AS DlCode
        FROM STC.RecountingInventoryTagItemTrace r
            LEFT JOIN STF.TraceItem AS ti
                ON ti.TraceItemID = r.TraceItemID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = r.DlID
        WHERE RecountingInventoryTagItemID IN (
					SELECT  RecountingInventoryTagItemID
					FROM    ' + @tempTableName + N' );	
		';
    IF @ValidationTempTable IS NULL
        EXEC (@Query);

END;

IF @RecountingTurn = 3
   AND @ThirdRecountableType = 2 -- شمارش دوم و موجودی
BEGIN
    SET @Query
        = N'
					SELECT  oi.[RecountingInventoryTagID] ,
							oi.RecountingInventoryTagItemID ,
							oi.[StuffID] ,
							oi.[Version] ,
							oi.[Creator] ,
							oi.[CreationDate] ,
							oi.[LastEditor] ,
							oi.[LastEditionDate] ,
							oi.[TagNumber] ,
							isnull(rii.MainQuantity, 0 ) as MainQuantity,
							p.*
					into ' + @SourceTempTableName
          + N'
					FROM    STC.RecountingInventoryTagItem oi
							LEFT JOIN ( SELECT  RecountingInventoryTagItemID id ,
												TraceID ,
												CASE WHEN DlID IS NOT NULL THEN CAST (DlID AS NVARCHAR(MAX))
													 When TraceItemID IS NOT NULL THEN cast (TraceItemID as nvarchar(max)) 
													 ELSE Value
												END Value
										FROM    STC.RecountingInventoryTagItemTrace
									  ) x PIVOT ( MAX(Value) FOR TraceID IN ( ' + @Columns
          + N' ) ) p ON oi.RecountingInventoryTagItemID = p.id
			JOIN STC.RecountingInventoryItem rii ON rii.RecountingInventoryTagItemID = oi.RecountingInventoryTagItemID 
			AND rii.[Type] = 2 
			and rii.RecountingInventoryID =@pRecountingInventoryID
					WHERE   RecountingInventoryTagID = @pRecountingInventoryTagID
							AND TagNumber > 0';

    SET @Params = N'@pRecountingInventoryTagID int,@pRecountingInventoryID int';

    EXECUTE sp_executesql @Query,
                          @Params,
                          @pRecountingInventoryTagID = @RecountingInventoryTagID,
                          @pRecountingInventoryID = @RecountingInventoryID;

    DECLARE @tempTableName1 NVARCHAR(128) = CFG.getTempTableName(1);


    SET @Query
        = N'
			SELECT	RecountingInventoryTagItemID,
					RecountingInventoryTagID,
					source.StuffID,
					TagNumber as Number,
					 [STF].[GetStuffCode](s.StuffID) as StuffCode,
					case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	                      when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then s.Title2
	                 end as StuffTitle,
					s.Barcode AS BarCode ,
					s.IranCode,
					isnull(target.MainQuantity,0) as MainInventory,
					target.SubQuantity as SubInventory ,
					TagNumber,
					s.MainMeasureUnit MainUnit
				into ' + @tempTableName1 + N'
			from ' + @SourceTempTableName + N' source
			join stf.vwstuff s on s.stuffid = source.stuffid
			left join ' + @TargetTempTableName + N' target on source.stuffid = target.stuffid ' + @ConditionalInnerJoin + N' 
			where source.MainQuantity <> isnull(target.MainQuantity,0)';


    EXEC (@Query);
    IF @ValidationTempTable IS NULL
    BEGIN
        SET @Query = N'
					SELECT  *
					FROM    ' + @tempTableName1;
    END;
    ELSE
    BEGIN
        SET @Query
            = N'
					SELECT  RecountingInventoryTagItemID,
							RecountingInventoryTagID,
							StuffID,
							Number,
							StuffCode,
							StuffTitle,
							MainInventory,
							SubInventory,
							TagNumber
					into ' + @ValidationTempTable + N'
					FROM    ' + @tempTableName1;
    END;

    EXEC (@Query);

    SET @Query
        = N'
		SELECT  r.RecountingInventoryTagItemTraceID ,
				r.RecountingInventoryTagItemID ,
				r.TraceID ,
				r.DlID ,
				CASE
				   WHEN r.TraceItemID IS NOT NULL THEN
					   CASE '+  + CAST(@CultureNo AS CHAR(1)) +'
						   WHEN 2 THEN
							   ti.Item2
						   ELSE
							   ti.Item
					   END
				   ELSE
					   r.[Value]
				   END AS [Value] ,
				   r.Version,
				   r.Creator,
				   r.CreationDate,
				   r.LastEditor,
				   r.LastEditionDate,
				   r.TraceItemID,
				   d.Code AS DlCode
        FROM STC.RecountingInventoryTagItemTrace r
			 LEFT JOIN STF.TraceItem AS ti
                ON ti.TraceItemID = r.TraceItemID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = r.DlID
			WHERE   RecountingInventoryTagItemID IN (
					SELECT  RecountingInventoryTagItemID
					FROM    ' + @tempTableName1 + N' )';

    IF @ValidationTempTable IS NULL
        EXEC (@Query);

END;

IF @RecountingTurn = 3
   AND @ThirdRecountableType = 3 -- مغایرت شمارش اول و دوم
BEGIN
    DECLARE @tempTableName2 NVARCHAR(128) = CFG.getTempTableName(1);
    SET @Query
        = N'
            SELECT  RecountingInventoryTagItemID,
					RecountingInventoryTagID,
					source.StuffID,
					TagNumber as Number,
					 [STF].[GetStuffCode](s.StuffID) as StuffCode,
					case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	                      when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then s.Title2
	                 end as StuffTitle,
					s.Barcode AS BarCode ,
					s.IranCode,
					0.0000 as MainInventory,
					null as SubInventory ,
					TagNumber,
					s.MainMeasureUnit MainUnit
			INTO    ' + @tempTableName2
          + N'
            FROM    STC.RecountingInventoryTagItem source
			join stf.vwstuff s on s.stuffid = source.stuffid
            WHERE   RecountingInventoryTagItemID IN (
                    SELECT  firstCounting.RecountingInventoryTagItemID
                    FROM    ( SELECT    MainQuantity ,
                                        RecountingInventoryTagItemID
                              FROM      STC.RecountingInventoryItem
                              WHERE     [Type] = 1
                                        AND RecountingInventoryID = ' + cast(@RecountingInventoryID as varchar(100))
          + N'
                            ) firstCounting
                            LEFT JOIN ( SELECT  MainQuantity ,
                                                RecountingInventoryTagItemID
                                        FROM    STC.RecountingInventoryItem
                                        WHERE   [Type] = 2
                                                AND RecountingInventoryID = ' + cast(@RecountingInventoryID as varchar(100))
          + N'
                                      ) secondCounting ON secondCounting.RecountingInventoryTagItemID = firstCounting.RecountingInventoryTagItemID
                                                          AND secondCounting.MainQuantity <> firstCounting.MainQuantity );';
    EXEC (@Query);
    IF @ValidationTempTable IS NULL
    BEGIN
        SET @Query = N'SELECT  *
            FROM   ' + @tempTableName2;
    END;
    ELSE
    BEGIN
        SET @Query
            = N' SELECT RecountingInventoryTagItemID,
							RecountingInventoryTagID,
							StuffID,
							Number,
							StuffCode,
							StuffTitle,
							MainInventory,
							SubInventory,
							TagNumber
				INTO ' + @ValidationTempTable + N'
				FROM ' + @tempTableName2;
    END;
    EXEC (@Query);
    IF @ValidationTempTable IS NULL
    BEGIN
        SET @Query
            = N'SELECT 
			   r.RecountingInventoryTagItemTraceID,
               r.RecountingInventoryTagItemID,
               r.TraceID,
               r.DlID,
               CASE
                   WHEN r.TraceItemID IS NOT NULL THEN
                       CASE  ' + CAST(@CultureNo AS CHAR(1)) + N'
                           WHEN 2 THEN
                               ti.Item2
                           ELSE
                               ti.Item
                       END
                   ELSE
                       r.[Value]
               END AS [Value],
               r.Version,
               r.Creator,
               r.CreationDate,
               r.LastEditor,
               r.LastEditionDate,
               r.TraceItemID,
               d.Code AS DlCode
        FROM STC.RecountingInventoryTagItemTrace r
            LEFT JOIN STF.TraceItem AS ti
                ON ti.TraceItemID = r.TraceItemID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = r.DlID
        WHERE RecountingInventoryTagItemID IN
              (
                  SELECT RecountingInventoryTagItemID FROM '+@tempTableName2+'
              );'
			     EXEC (@Query);
    END;
END;
