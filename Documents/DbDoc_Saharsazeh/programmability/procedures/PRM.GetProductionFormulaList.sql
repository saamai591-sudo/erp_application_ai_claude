CREATE   PROCEDURE [PRM].GetProductionFormulaList
(
    @PageNumber INT,
    @RowspPage INT,
    @Sort NVARCHAR(MAX) = NULL,
    @Filter NVARCHAR(MAX) = NULL
)
AS
BEGIN

    DECLARE @Columns NVARCHAR(MAX),
            @SelectList NVARCHAR(MAX),
            @query NVARCHAR(MAX),
            @UserID INT,
            @DateType VARCHAR(10),
            @DateFormat VARCHAR(10),
            @Culture VARCHAR(10),
            @CultureNo TINYINT,
            @listLeftJoin NVARCHAR(MAX);

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

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
                            ELSE
                                2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';


    SELECT @Columns = STUFF(
    (
        SELECT ',' + QUOTENAME(TraceID)
        FROM STF.Trace
        ORDER BY TraceID
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                           );

    IF (@Columns IS NULL)
        SET @Columns = N'[-1]';


    SELECT @listLeftJoin
        = STUFF(
    (
        SELECT DISTINCT
               ' Left Join STF.TraceItem d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10))
               + '.TraceItemID = ii.[' + CAST(TraceID AS VARCHAR(10)) + ']'
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

    SELECT @SelectList
        = STUFF(
    (
        SELECT DISTINCT
               ',(select top 1 ' + QUOTENAME(TraceID) + ' from #t) + ''' + ':'''
               + CASE
                     WHEN AccountLevelTypeID = 6 THEN
                         ' + d' + CAST(TraceID AS VARCHAR(10)) + '.Item' + CASE
                                                                               WHEN @CultureNo = 2 THEN
                                                                                   '2'
                                                                               ELSE
                                                                                   ''
                                                                           END
                     ELSE
                         ' + ii.' + QUOTENAME(TraceID)
                 END
        FROM STF.Trace
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );

    IF (@SelectList IS NULL)
        SET @SelectList = N'''NoTrace''';

    IF @Sort IS NULL
       OR @Sort = ''
        SET @Sort = 'CreateDateString ';

    SET @Sort = REPLACE(@Sort, 'CreateDateString', '[CreationDate]');
    SET @Sort = REPLACE(@Sort, 'EditionDateString', '[LastEditionDate]');
    SET @Sort = REPLACE(@Sort, 'DateString', '[Date]');

    SET @query
        = N'

select * into #T
from
		(
		select  TraceID,title
from   stf.Trace 
	)x
		pivot
		(
			max(title)
			for traceid in (' + @Columns
          + N')		
		) ii


;WITH Query_Result 
			As (
select 
a.ProductionFormulaID
,a.StuffID
,CASE
           WHEN a.StuffID IS NOT NULL THEN
               [STF].[GetStuffCode](a.[StuffID])
           ELSE
               CAST(bg.Code AS NVARCHAR(200))
       END StuffCode
,CASE WHEN @CultureNo = 2 THEN vws.Title2 ELSE  vws.Title END StuffTitle
,a.Quantity
,a.[Type]
,a.BomGroupID
,a.Version
,a.Creator
,a.CreationDate
,a.LastEditor
,a.LastEditionDate
,CFG.GetCLRSaturnDate(a.CreationDate,@DateFormat  , 1,@DateType) AS CreateDateString
,CFG.GetCLRSaturnDate(a.LastEditionDate,@DateFormat , 1,@DateType) AS EditionDateString
,u.Name AS CreatorUserName
,u2.Name AS EditorName 
,STUFF(
		(
			select ' + @SelectList
          + N'
			FOR XML PATH(''''), TYPE
		).value(''.'', ''NVARCHAR(MAX)''),1,0,''''
		) TraceDetail
from [PRM].[ProductionFormula] a
	LEFT JOIN [STF].[Stuff] s
        ON s.StuffID = a.StuffID
    LEFT JOIN stf.VWStuff vws
		ON vws.StuffID = s.StuffID
    LEFT JOIN PRM.BomGroup AS bg
        ON bg.BomGroupID = a.BomGroupID
		JOIN CFG.[User] AS u ON u.UserID = a.Creator 
		JOIN CFG.[User] AS u2 ON u2.UserID = a.LastEditor
left join
		(select  b.ProductionFormulaID,b.TraceID,
				case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
  					 when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
					 when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,@DateFormat  , 0, @DateType)
					 else Value end value
from  prm.ProductionFormulaTrace b
left join stf.Trace c
	on c.TraceID = b.TraceID
	)x
		pivot
		(
			max(value)
			for traceid in (' + @Columns + N')		
		) ii on a.ProductionFormulaID = ii.ProductionFormulaID
		' + @listLeftJoin + N'
)

'   ;
    print @Query

    DECLARE @selectQuery NVARCHAR(MAX);

    IF @Filter IS NULL
       OR @Filter = ''
        SET @Filter = '';
    ELSE
        SET @Filter = 'Where (' + @Filter + ')';


    DECLARE @tableName VARCHAR(100);
    SET @tableName = CFG.getTempTableName(1);



    SET @query = CFG.ApplyPaging(@tableName, @query, @PageNumber, @RowspPage, @Filter, @Sort);
    --PRINT @Query

    EXECUTE sys.sp_executesql @query,
                              N'@dateFormat varchar(10),
							  @dateType int,
							  @CultureNo TINYINT',
                              @DateType = @DateType,
                              @DateFormat = @DateFormat,
							  @CultureNo = @CultureNo;



    DECLARE @Count INT;


    EXEC ('select * from ' + @tableName + ' order by _RN');

    SET @query = N'select top 1 @Count=  r_count from ' + @tableName;
    EXECUTE sys.sp_executesql @query, N'@count int out', @Count = @Count OUT;

    RETURN ISNULL(@Count, 0);

END;