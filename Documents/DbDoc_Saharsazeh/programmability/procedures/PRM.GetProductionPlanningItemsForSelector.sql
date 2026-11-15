-----------Start of #9000
CREATE    PROCEDURE PRM.GetProductionPlanningItemsForSelector
(
    @date DATE,
    @ids NVARCHAR(MAX) = NULL,
	@costCenter int
)
-- WITH ENCRYPTION
AS
BEGIN

    DECLARE @SelectColumns NVARCHAR(MAX),
            @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @DynamicColumns NVARCHAR(MAX),
            @CodeAndTitleColumn NVARCHAR(MAX),
            @LeftJoin NVARCHAR(MAX),
            @query NVARCHAR(MAX),
            @Culture NVARCHAR(100),
            @CultureNo TINYINT;


    IF (@ids = '')
        SET @ids = NULL;

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
                            WHEN 'ar' THEN
                                2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    SELECT @DynamicColumns = STUFF(
    (
        SELECT DISTINCT
               ',' + QUOTENAME(CAST(TraceID AS VARCHAR(5)))
        FROM STF.Trace
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                                  );

    IF (@DynamicColumns IS NULL)
        SET @DynamicColumns = N'[-1]';

    SELECT @SelectColumns
        = STUFF(
    (
        SELECT DISTINCT
               CASE
                   WHEN AccountLevelTypeID <> 5 THEN
                       ',Piv.' + QUOTENAME(CAST(TraceID AS VARCHAR(5))) + ' AS TR' + CAST(TraceID AS VARCHAR(5))
                       + CASE AccountLevelTypeID
                             WHEN 6 THEN
                                 ',tri' + CAST(TraceID AS VARCHAR(5)) + '.Item' + CASE @CultureNo
                                                                                      WHEN 2 THEN
                                                                                          '2'
                                                                                      ELSE
                                                                                          ''
                                                                                  END + ' AS TRCode'
                                 + CAST(TraceID AS VARCHAR(5))
                             ELSE
                                 ''
                         END
                   ELSE
                       ',Piv.' + QUOTENAME(CAST(TraceID AS VARCHAR(5))) + ' AS TR' + CAST(TraceID AS VARCHAR(5))
                       + ',CFG.GetCLRSaturnDate(Piv.' + QUOTENAME(CAST(TraceID AS VARCHAR(5)))
                       + ', @DateFormat, 0, @DateType) AS TRDate' + CAST(TraceID AS VARCHAR(5))
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
               ' ,d' + CAST(TraceID AS VARCHAR(10)) + '.Code [TRCode' + CAST(TraceID AS VARCHAR(10)) + '],d'
               + CAST(TraceID AS VARCHAR(10)) + '.Title [TRTitle' + CAST(TraceID AS VARCHAR(10)) + ']'
        FROM STF.Trace
        WHERE DlTypeID IS NOT NULL
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );

    IF @CodeAndTitleColumn IS NULL
        SET @CodeAndTitleColumn = N' ';

    SELECT @LeftJoin
        = STUFF(
    (
        SELECT DISTINCT
               ' Left Join ACC.DL d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10))
               + '.DlID = piv.' + QUOTENAME(TraceID)
        FROM STF.Trace
        WHERE DlTypeID IS NOT NULL
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );

    IF @LeftJoin IS NULL
        SET @LeftJoin = N' ';

    DECLARE @listLeftJoin NVARCHAR(MAX);
    
    SELECT * into #vwStuff
    FROM stf.VWStuff AS v

    SELECT @listLeftJoin
        = STUFF(
    (
        SELECT DISTINCT
               ' Left Join STF.TraceItem tri' + CAST(TraceID AS VARCHAR(10)) + ' on tri' + CAST(TraceID AS VARCHAR(10))
               + '.TraceItemID = piv.' + QUOTENAME(TraceID)
        FROM STF.Trace
        WHERE AccountLevelTypeID = 6
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );

    IF @listLeftJoin IS NULL
        SET @listLeftJoin = N' ';

    SET @query
        = N'
			SELECT pp.ProductionPlanningID,
				   ppi.ProductionPlanningItemID,
				   ppi.RowIndex,
				   ppi.StuffID,
				   s.Code AS StuffCode,
				   CASE WHEN @CultureNo = 1 THEN s.Title else s.Title2 END AS StuffTitle, 
					ppi.MainQuantity - isnull(sri.MainQuantity,0) MainQuantity,
					ppi.SubQuantity - isnull(sri.SubQuantity,0) SubQuantity,
					pp.Number,
					CFG.GetCLRSaturnDate(pp.[Date], @dateFormat, 0, @dateType) AS DateString,
					' + @SelectColumns + N',0' + @CodeAndTitleColumn+ N'	
			FROM    PRM.ProductionPlanningItem AS ppi
					JOIN #vwStuff AS s
						ON s.StuffID = ppi.StuffID
					JOIN PRM.ProductionPlanning AS pp
						ON pp.ProductionPlanningID = ppi.ProductionPlanningID
					left join
					(
					select ProductionPlanningItemID,sum(mainquantity)mainquantity,sum(subquantity)subquantity
					from prm.ProductionStatisticItem 
					where ProductionPlanningItemID is not null
					group by ProductionPlanningItemID
					)sri on sri.ProductionPlanningItemID = ppi.ProductionPlanningItemID
					left JOIN
						(
							SELECT tr.ProductionPlanningItemID,
								   tr.TraceID,
								   CASE
									   WHEN tr.DlID IS NOT NULL THEN
										   CAST(tr.DlID AS NVARCHAR(MAX))
									   WHEN tr.TraceItemID IS NOT NULL THEN
										   CAST(tr.TraceItemID AS NVARCHAR(MAX))
									   ELSE
										   tr.Value
								   END Value
							FROM PRM.ProductionPlanningItemTrace AS tr
						) x
						PIVOT
						(
							MAX(x.[Value])
							FOR x.[TraceID] IN (' + @DynamicColumns
						+ N') ) AS piv
							ON piv.ProductionPlanningItemID = ppi.ProductionPlanningItemID
							' + @LeftJoin + N' ' + @listLeftJoin + N'
					WHERE pp.Date <= @date AND pp.State = 1 AND ppi.CostCenterID = @costCenter
					AND ppi.MainQuantity - isnull(sri.MainQuantity,0) > 0';

    PRINT @query;

    EXEC sp_executesql @query,
                       N'@Date DATE ,
						 @DateFormat nvarchar(20),
						 @DateType TINYINT,
						 @CultureNo TinyInt,
						 @costCenter int',
						 @date = @date,
                         @DateFormat = @DateFormat,
                         @DateType = @DateType,
					     @CultureNo = @CultureNo,
						 @costCenter = @costCenter

END;


----------End of #9000

