-------------------------------------MonitoringActivity_GetNegativeInventory.sql:

Create     PROCEDURE [CFG].MonitoringActivity_GetNegativeInventory
(@FinancialPeriodID INT)
--WITH ENCRYPTION
AS
SET NOCOUNT ON
BEGIN
    DECLARE @Query NVARCHAR(MAX),
            @Columns NVARCHAR(MAX),
            @TableName1 NVARCHAR(250),
			@SrcTable NVARCHAR(Max),
			@AggregateTable nvarchar(MAX),
			@InventoryInDateTable  NVARCHAR(Max),
			@StartDate DATE,
			@ToDate date,			
			@StartDateFinancialPeriodID int;

		select @ToDate = EndDate,
		@StartDate = StartDate
            FROM CFG.FinancialPeriod
			where FinancialPeriodID = @FinancialPeriodID

    SELECT @Columns = STUFF(
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

    IF (@Columns IS NULL)
        SET @Columns = '[-1] NVARCHAR(256)';

    SET @TableName1				= CFG.getTempTableName(1);
	SET @SrcTable				= CFG.getTempTableName(1);	
	SET @InventoryInDateTable	= CFG.getTempTableName(1);
	SET @AggregateTable			= CFG.getTempTableName(1);
	   
    SET @Query
        = N'Create table ' + @TableName1
          + '
			(	
				[Date]	Date,
				StockID int,
				StuffID int,
				' + @Columns
          + '
				,MainQuantity Decimal(36,10),
				MainInLine Decimal(36,10)
			) ';
			
    EXEC (@Query);

	declare @NextDayOfStartDate date
	set @NextDayOfStartDate = DATEADD(day,1,@StartDate)
	--Print sysdatetime()
	exec stc.spGetInventoryInDate	 
			@StuffId  = NULL,
			@stockID  = NULL,
			@ToDate   = @StartDate,
			@finalTable = @InventoryInDateTable
--Print sysdatetime()

    exec [STC].RptReviewDataSource
			@ReviewType =        1, ---1 Quantity   -----2 Amount
			@FromDate  =				 @NextDayOfStartDate,
			@ToDate =					 @ToDate,
			@TableName =				 @SrcTable,
			@SelectedStocks =			 Null,
			@SelectedDl = NULL,
			@SelectedStuffTrace  = NULL,
			@SelectedStuffAccountGroup  = NULL,
			@SelectedStuffGroup  = NULL,
			@SelectedStuff  =			Null,
			@SelectedStockDocumentType  = NULL,
			@IsTraceTab  = 1,
			@Parameter ='Stuff',
			@StartDateFinancialPeriodID  = @StartDateFinancialPeriodID,
			@HasGroupByDate  = 1

--Print sysdatetime()

set @query = N'Create table '+@AggregateTable + N'
(Date date,StuffID int,StockID int,'+@Columns+N',MainQuantity decimal(36,10))'
----Print @Query
EXECUTE sp_executesql
    @query

declare @ColumnsInSelect nvarchar(MAX)

SELECT @ColumnsInSelect = STUFF(
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

    IF (@ColumnsInSelect IS NULL)
        SET @ColumnsInSelect = '[-1]';

set @Query = N'insert into '+@AggregateTable+N'
select @StartDate , StuffID,StockID,' + @ColumnsInSelect + N',MainQuantity from '+@InventoryInDateTable

EXECUTE sp_executesql
    @Query,
    N'@StartDate date',
    @StartDate = @StartDate

set @Query = N'insert into '+@AggregateTable+N'
select Date,ID,StockID,' + @ColumnsInSelect + N',MainQuantity from '+@SrcTable

exec (@Query)

--Print sysdatetime()
set @query = N'Insert into '+@TableName1 + N'
select Date, StockID,StuffID,'+@ColumnsInSelect + N' ,MainQuantity,sum(MainQuantity) over(partition by StockID,StuffID,'+@ColumnsInSelect+' order by Date) 
from '+@AggregateTable + N''

exec (@Query)
--Print sysdatetime()
    
    DECLARE @SelectColumns NVARCHAR(MAX),
            @LeftJoin NVARCHAR(MAX),
            @ListLeftJoin NVARCHAR(MAX),
            @CodeAndTitleColumn NVARCHAR(MAX);

    DECLARE @CultureNo INT;
    SELECT @CultureNo = ci.CultureNo
    FROM CFG.CultureInfo AS ci
    WHERE ci.Culture = CFG.GetuserCulture();

    SELECT @SelectColumns
        = STUFF(
    (
        SELECT DISTINCT
               ',' + QUOTENAME(TraceID) + ' As ' + QUOTENAME('T' + CAST(TraceID AS NVARCHAR(10)))
               + CASE
                     WHEN AccountLevelTypeID = 6 THEN
                         ',' + QUOTENAME('Tri' + CAST(TraceID AS NVARCHAR(10))) + +'.Item' + CASE @CultureNo
                                                                           WHEN 2 THEN
                                                                               '2'
                                                                           ELSE
                                                                               ''
                                                                       END + ' As '
                         + QUOTENAME('T' + CAST(TraceID AS NVARCHAR(10))+'Title')
                     ELSE
                         ''
                 END
        FROM STF.Trace
        WHERE CheckInventory = 1
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );

    IF (@SelectColumns IS NULL)
        SET @SelectColumns = N'[-1]';

    IF (@Columns IS NULL)
        SET @Columns = '[-1]';

    SELECT @LeftJoin
        = STUFF(
    (
        SELECT ' Left Join acc.dl d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10))
               + '.DlID = a.' + QUOTENAME(TraceID)
        FROM STF.Trace
        WHERE AccountLevelTypeID = 1
              AND CheckInventory = 1
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );
    IF (@LeftJoin IS NULL)
        SET @LeftJoin = N'';

    SELECT @ListLeftJoin
        = STUFF(
    (
        SELECT ' Left Join STF.TraceItem trI' + CAST(TraceID AS VARCHAR(10)) + ' on trI' + CAST(TraceID AS VARCHAR(10))
               + '.TraceItemID = a.' + QUOTENAME(TraceID)
        FROM STF.Trace
        WHERE AccountLevelTypeID = 6
              AND CheckInventory = 1
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );
    IF (@ListLeftJoin IS NULL)
        SET @ListLeftJoin = N'';

    SELECT @CodeAndTitleColumn
        = STUFF(
    (
        SELECT DISTINCT
               ' ,'
               + CASE
                     WHEN t.AccountLevelTypeID = 5 THEN
                         'cfg.GetSaturnDate(' + QUOTENAME(CAST(t.TraceID AS VARCHAR(10))) + +',0) as [T'
                         + CAST(t.TraceID AS VARCHAR(10)) + 'Value]'
                 END
               + CASE
                     WHEN t.AccountLevelTypeID = 1 THEN
                         ', DL' + CAST(t.TraceID AS VARCHAR(10)) + '.Code as   [T' + CAST(t.TraceID AS VARCHAR(10))
                         + 'Code]' + ', DL' + CAST(t.TraceID AS VARCHAR(10)) + '.Title as   [T'
                         + CAST(t.TraceID AS VARCHAR(10)) + 'Title]'
                     ELSE
                         ''
                 END
        FROM STF.Trace t
        WHERE t.PricingBase = 1
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );

    IF (@CodeAndTitleColumn IS NULL)
        SET @CodeAndTitleColumn = N'';

    ----Print @CodeAndTitleColumn;
    DECLARE @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @Culture VARCHAR(10);

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

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

select * into #vwStuff
from stf.VWStuff

    SET @Query
        = '
				SELECT Row_number() over(Order By Date) as RowNumber,
					CFG.GetCLRSaturnDate(Date,''' + @DateFormat + ''',0,' + CAST(@DateType AS VARCHAR(2))
          + ') as Date,
					a.StockID,
					st.Code StockCode,
					st.Title StockTitle,
					st.Title2 StockTitle2,
					a.StuffID,
					s.Code StuffCode,
					s.Title StuffTitle,
					s.Title2 StuffTitle2,' + @SelectColumns
          + ',
					MainQuantity,
					MainInLine ' + @CodeAndTitleColumn
          + ' from (
				SELECT ROW_NUMBER() OVER (PARTITION BY StockID,StuffID, ' + @ColumnsInSelect + '  order by Date) RN,* FROM '
          + @TableName1
          + '
				where MainInLine <0 
				) as a
				join STF.Stock st on  st.StockID = a.StockID
				join #vwStuff s on s.StuffID = a.StuffID
				' + @LeftJoin + '
				' + @ListLeftJoin + ' 
				where a.RN = 1 
				and s.Type=0
				';

    ----Print @Query;
    EXEC (@Query);
END;
