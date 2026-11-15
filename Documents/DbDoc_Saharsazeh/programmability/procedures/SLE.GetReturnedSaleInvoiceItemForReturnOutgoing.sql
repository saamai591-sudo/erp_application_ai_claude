
CREATE   PROCEDURE SLE.GetReturnedSaleInvoiceItemForReturnOutgoing
(
    @FinancialPeriodId INT,
    @Date DATE,
    @DeliverDlId INT = NULL,
    @StuffId INT = NULL,
    @Traces NVARCHAR(MAX) = ''
)
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @DynamicColumns NVARCHAR(MAX),
            @WhereClause NVARCHAR(MAX),
            @Query NVARCHAR(MAX),
            @SelectColumns NVARCHAR(MAX),
            @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @Culture VARCHAR(10),
            @LeftJoin NVARCHAR(MAX),
            @CodeAndTitleColumn NVARCHAR(MAX),
            @CultureNo TINYINT;

    SET @Culture = CFG.GetuserCulture();

    SET @UserID = CFG.GetuserID();

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

    SELECT CFG.GetStringPart(VALUE, 1) AS TraceId,
           CFG.GetStringPart(VALUE, 2) AS Value
    INTO #traceTempTable
    FROM CFG.R_FnStr2TableBySplitor(@Traces, '#') rfstbs;

    SELECT @WhereClause
        = STUFF(
    (
        SELECT DISTINCT
               ' AND piv.' + QUOTENAME(CAST(TraceId AS NVARCHAR(5))) + '= N'
               + QUOTENAME(CAST(Value AS NVARCHAR(500)), '''')
        FROM #traceTempTable
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );

    IF (@WhereClause IS NULL)
        SET @WhereClause = N'';

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
		
	DECLARE @listLeftJoin NVARCHAR(MAX)

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


		declare @CustomerID int
		select @CustomerID = PartyID
		from cfg.party 
		where dlid = @DeliverDlId

    SET @Query
        = N'
	 SELECT oi.ReturnedSaleInvoiceItemID,
		oi.ReturnedSaleInvoiceID ,
		o.Number,
		oi.RowIndex,
		oi.StuffID,
        s.IsStuffSerializable,
		oi.MainQuantity-isnull(roi.MainQuantity,0) MainQuantity,
		oi.SubQuantity-isnull(roi.SubQuantity,0) SubQuantity,
		s.Code StuffCode,
		case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	         when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then s.Title2
	    end as StuffTitle,
        s.StuffDetailType,
		o.Date,
		CFG.GetCLRSaturnDate(o.Date,@DateFormat, 0, @DateType) DateString,
			' + @SelectColumns + N',0' + @CodeAndTitleColumn
          + N'	 
	 FROM SLE.ReturnedSaleInvoiceItem oi 
	JOIN SLE.ReturnedSaleInvoice o ON o.ReturnedSaleInvoiceID = oi.ReturnedSaleInvoiceID
	JOIN STF.vwStuff s ON s.StuffID = oi.StuffID
	left join
	(
	select ReturnedSaleInvoiceItemID,sum(MainQuantity) MainQuantity,sum(SubQuantity) SubQuantity
	from stc.ReturnedOutgoingItem
	group by ReturnedSaleInvoiceItemID
	)roi on roi.ReturnedSaleInvoiceItemID = oi.ReturnedSaleInvoiceItemID
	LEFT JOIN (
		SELECT ReturnedSaleInvoiceItemID, TraceID, Value
		FROM (
			SELECT ReturnedSaleInvoiceItemID,
				   TraceID,
				   Value,
				   ROW_NUMBER() OVER (PARTITION BY ReturnedSaleInvoiceItemID, TraceID ORDER BY SrcPriority) AS rn
			FROM (
				SELECT tr.ReturnedSaleInvoiceItemID,
					   tr.TraceID,
					   CASE WHEN tr.DlID IS NOT NULL THEN CAST(tr.DlID AS NVARCHAR(MAX))
							WHEN tr.TraceItemID IS NOT NULL THEN CAST(tr.TraceItemID AS NVARCHAR(MAX))
							ELSE tr.Value
					   END Value,
					   1 AS SrcPriority
				FROM SLE.ReturnedSaleInvoiceItemTrace tr
				UNION ALL
				SELECT oi2.ReturnedSaleInvoiceItemID,
					   iit.TraceID,
					   CASE WHEN iit.DlID IS NOT NULL THEN CAST(iit.DlID AS NVARCHAR(MAX))
							WHEN iit.TraceItemID IS NOT NULL THEN CAST(iit.TraceItemID AS NVARCHAR(MAX))
							ELSE iit.Value
					   END Value,
					   2 AS SrcPriority
				FROM SLE.ReturnedSaleInvoiceItem oi2
				INNER JOIN SLE.InvoiceItemTrace iit ON iit.InvoiceItemID = oi2.InvoiceItemID
				WHERE oi2.InvoiceItemID IS NOT NULL
			) allTraces
		) ranked
		WHERE rn = 1
	) x
					PIVOT (
						MAX(Value)
						FOR TraceID IN ( ' + @DynamicColumns
			  + N')
					) AS piv ON piv.ReturnedSaleInvoiceItemID = oi.ReturnedSaleInvoiceItemID
					' + @LeftJoin +'  ' +@listLeftJoin
			  + N'
	WHERE
	o.FinancialPeriodID = @FinancialPeriodId 
	AND o.[Date] <= @Date
	AND (@StuffId IS NULL OR oi.StuffID = @StuffId )
	AND (@CustomerID IS NULL OR o.CustomerID = @CustomerID)
	and oi.MainQuantity-isnull(roi.MainQuantity,0) > 0
	and oi.ReturnedOutgoingItemID is null
' + @WhereClause;

    PRINT @Query;

    EXEC sp_executesql @Query,
                       N'
			@FinancialPeriodId INT,
			@Date DATE ,
			@CustomerID INT ,
			@StuffId INT,
			@DateFormat nvarchar(20),
			@DateType TINYINT		
		',
                       @FinancialPeriodId = @FinancialPeriodId,
                       @Date = @Date,
                       @CustomerID = @CustomerID,
                       @StuffId = @StuffId,
                       @DateFormat = @DateFormat,
                       @DateType = @DateType;

END;

