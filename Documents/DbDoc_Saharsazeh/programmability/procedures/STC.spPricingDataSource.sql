-----------------------------------------------------------------------

CREATE    proc STC.spPricingDataSource
(
    @FinancialPeriodID	INT,
    @PricingDate		DATE,
	@TableName			nvarchar(MAX) 
)

as
DECLARE @Query NVARCHAR(MAX),
        @Param NVARCHAR(MAX),
        @Columns NVARCHAR(MAX),
        @JoinColumns NVARCHAR(MAX),
        @SelectColumns NVARCHAR(MAX),
        @SelectColumns1 NVARCHAR(MAX),
        @SelectColumnsForDlTraces NVARCHAR(MAX),
        @TableName1 NVARCHAR(250),
        @TableName2 NVARCHAR(250),
        @ConditionalInnerJoin NVARCHAR(MAX);

SET @TableName1 = CFG.getTempTableName(1);
SET @TableName2 = CFG.getTempTableName(1);
if @TableName is null 
begin
SET @TableName = CFG.getTempTableName(1);
end

SELECT @SelectColumns = STUFF(
(
    SELECT 
           ',' + QUOTENAME( CAST(t.TraceID AS VARCHAR(10))) + ' as T'+ CAST(t.TraceID AS VARCHAR(10))
    FROM STF.Trace t
    WHERE t.PricingBase = 1
	order by TraceID
    FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),1   ,0   ,'');


SELECT @SelectColumns1 = STUFF(
(
    SELECT 
           ',' + QUOTENAME( CAST(t.TraceID AS VARCHAR(10)) )
    FROM STF.Trace t
    WHERE t.PricingBase = 1
	order by TraceID
    FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),1   ,0   ,'');


IF (@SelectColumns IS NULL)
    SET @SelectColumns = N'';

	
IF (@SelectColumns1 IS NULL)
    SET @SelectColumns1 = N'';

SELECT @ConditionalInnerJoin = STUFF(
(
    SELECT 
           ' AND isnull(PRIC.' + QUOTENAME(TraceID) + ' ,'''') = isnull(t.t' + CAST(TraceID AS NVARCHAR) + ' ,'''')'
    FROM STF.Trace
    WHERE PricingBase = 1
	order by TraceID
    FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');


IF (@ConditionalInnerJoin IS NULL)
    SET @ConditionalInnerJoin = N' ';

	SELECT @SelectColumnsForDlTraces
		= STUFF(
	(
		SELECT 
			   ' ,'
			   + CASE
					 WHEN t.AccountLevelTypeID = 5 THEN
						 ' cfg.GetSaturnDate(' + 'T.' + QUOTENAME('T' + CAST(t.TraceID AS VARCHAR(10))) + +',0) as [T'
						 + CAST(t.TraceID AS VARCHAR(10)) + 'Value],' + 'T.' + QUOTENAME('T' + CAST(t.TraceID AS VARCHAR(10)))
					 ELSE
						 'T.' + QUOTENAME('T' + CAST(t.TraceID AS VARCHAR(10)))
				 END
			   + CASE
					 WHEN t.AccountLevelTypeID = 1 THEN
						 ', DL' + CAST(t.TraceID AS VARCHAR(10)) + '.Code as   [T' + CAST(t.TraceID AS VARCHAR(10)) + 'Code]'
						 + ',DL' + CAST(t.TraceID AS VARCHAR(10)) + '.Title as   [T' + CAST(t.TraceID AS VARCHAR(10))
						 + 'Title]'
					 ELSE
						 ''
				 END
			   + CASE
					 WHEN t.AccountLevelTypeID = 6 THEN
						 ',tri' + CAST(t.TraceID AS VARCHAR(10)) + '.Item as   [T' + CAST(t.TraceID AS VARCHAR(10))
						 + 'Title]'
					 ELSE
						 ''
				 END
		FROM STF.Trace t
		WHERE t.PricingBase = 1
		order by TraceID
		FOR XML PATH(''), TYPE
	).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');


	IF (@SelectColumnsForDlTraces IS NULL)
		SET @SelectColumnsForDlTraces = N'';

	SELECT @JoinColumns
		= STUFF(
	(
		SELECT 
				' Left join Acc.Dl DL' + CAST(t.TraceID AS VARCHAR(10)) + '
						   on DL' + CAST(t.TraceID AS VARCHAR(10)) + '.DLID=T.'
			   + QUOTENAME('T' + CAST(t.TraceID AS VARCHAR(10)))
		FROM STF.Trace t
		WHERE t.PricingBase = 1
			  AND t.AccountLevelTypeID = 1
			  order by TraceID
		FOR XML PATH(''), TYPE
	).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

	IF (@JoinColumns IS NULL)
		SET @JoinColumns = N'';

    DECLARE @ListJoinColumns NVARCHAR(MAX)

	SELECT @ListJoinColumns
		= STUFF(
	(
		SELECT 
			   ' Left join STF.TraceItem tri' + CAST(t.TraceID AS VARCHAR(10)) + '
						   on tri' + CAST(t.TraceID AS VARCHAR(10)) + '.TraceItemID=T.'
			   + QUOTENAME('T' + CAST(t.TraceID AS VARCHAR(10)))
		FROM STF.Trace t
		WHERE t.PricingBase = 1
			  AND t.AccountLevelTypeID = 6
			  order by TraceID
		FOR XML PATH(''), TYPE
	).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

	IF (@ListJoinColumns IS NULL)
		SET @ListJoinColumns = N'';

	EXEC (@Query);



	SELECT @Columns = STUFF(
	(
		SELECT 
			   ',' + QUOTENAME('T' + CAST(TraceID AS VARCHAR(10))) + ' NVARCHAR(256)'
		FROM STF.Trace
		WHERE PricingBase = 1
		order by TraceID
		FOR XML PATH(''), TYPE
	).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

	IF (@Columns IS NULL)
		SET @Columns = N'[-1] NVARCHAR(256)';


		exec stc.spGetInventoryInDate
    @StuffId  =   null,
    @stockID =    null,
	@ToDate =	  @PricingDate,
	@FinalTable = @TableName1
	

	SET @Query = N'
		SELECT A.StuffID,
			   StockID
			   ' + @SelectColumns + N' 
			   INTO ' + @TableName2 + N'
		FROM   ' + @TableName1 + N' A 
		join stf.stuffDetail S on S.StuffID = A.StuffID 
		join stf.stuffaccountgroup sag on s.StuffAccountGroupID = sag.StuffAccountGroupID
		WHERE  StuffDetailType <> 3 and StuffDetailType <>9
		group by a.StuffID,a.StockID'+@SelectColumns1;
		print @Query

	EXECUTE sp_executesql @Query


	SELECT @Columns = STUFF(
	(
		SELECT ',' + QUOTENAME(TraceID)
		FROM STF.Trace
		WHERE PricingBase = 1
		FOR XML PATH(''), TYPE
	).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');
		IF (@Columns IS NULL)
			SET @Columns = N'[-1]';


	DECLARE @DateType VARCHAR(10),
			@DateFormat VARCHAR(10),
			@UserID INT,
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


	select *
	into #VwStuff
	from STF.[VwStuff]

	select *
	into #vwStockAccess
	from cfg.vwStockAccess

    DECLARE @user VARCHAR(25) = CAST(CFG.GetuserID() AS VARCHAR(25));
	
    SET @Query
        = N'
	    SELECT  ROW_NUMBER() OVER(ORDER BY s2.StuffID) AS Rno
	           ' + @SelectColumnsForDlTraces + N',T.StockID,T.StuffID,0 Status,
	           s.Title AS StockTitle,s.Title2 AS StockTitle2,s.Code as StockCode,
	           s2.Title AS StuffTitle,s2.Title2 AS StuffTitle2,s2.Code StuffCode,
			   sag.Title AS StuffAccountGroup ,sag.Title2 AS StuffAccountGroup2 ,s2.StuffDetailTypeTitle,
			   cfg.GetCLRSaturnDate(LastPricingDate,@pDateFormat,0,@pDateType) LastPricingDate
			   into '+ @TableName + N'
	    FROM   ' + @TableName2 + N' T
	           INNER JOIN STF.Stock s
	                ON  s.StockID = T.StockID
	           INNER JOIN #VwStuff s2
	                ON  s2.StuffID = T.StuffID	 
			   LEFT JOIN Stf.StuffAccountGroup sag
					ON s2.StuffAccountGroupID=sag.StuffAccountGroupID
				INNER JOIN #vwStockAccess AS vsa ON vsa.StockID = s.StockID	
				left join 
				(
					select a.PricingItemID,a.StuffID,a.StockID,a.LastPricingDate,TraceID,
							Case When DLID IS NOT NULL THEN cast (DLID as nvarchar(max)) 
								When TraceItemID IS NOT NULL THEN cast (TraceItemID as nvarchar(max)) 
										else Value end Value
						from stc.PricingItem a
					left join stc.PricingItemTrace b on a.PricingItemID = b.PricingItemID
				)x
				pivot
				(
				max(Value)
						for TraceID in (' + @Columns + N')
				)pric on pric.stuffid = T.stuffid and pric.stockid = T.stockid
					' + @ConditionalInnerJoin + N'
				' + @JoinColumns + ' ' +@ListJoinColumns+ N'
	  where s.isactive = 1 
	  and( pric.PricingItemID is null or pric.LastPricingDate < @pDate)';


	EXECUTE sp_executesql @Query,
						  N'@pDate Date,@pDateFormat varchar(100),@pDateType VARCHAR(10)',
						  @pDate = @PricingDate,
						  @pDateFormat = @DateFormat,
						  @pDateType = @DateType;
