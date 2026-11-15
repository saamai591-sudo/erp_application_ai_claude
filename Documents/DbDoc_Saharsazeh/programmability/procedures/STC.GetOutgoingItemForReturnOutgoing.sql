
CREATE   PROCEDURE [STC].[GetOutgoingItemForReturnOutgoing]
(
    @Date DATE,
    @StockDocumentTypeBaseEntityID INT,
    @StockId INT,
    @DeliverDlId INT = NULL,
    @DeliverStockId INT = NULL,
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
            @CultureNo TINYINT,
			@StockDocumentTypeID INT;
	
	select @StockDocumentTypeID = StockDocumentTypeID
	from stc.StockDocumentTypeBaseEntity
	where StockDocumentTypeBaseEntityID = @StockDocumentTypeBaseEntityID


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

    SET @Query
        = N'
	 SELECT oi.OutgoingItemID,
		oi.OutgoingID ,
		o.Number,
		oi.RowIndex,
		oi.StuffID,		
        s.IsStuffSerializable,
		oi.MainQuantity,
		oi.SubQuantity,
		s.Code StuffCode,
		case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	         when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then s.Title2
	    end as StuffTitle,
        s.StuffDetailType,
		o.Date,
		sdt.DocumentType Type,
		o.DeliverDlID,
		o.DeliverStockID,
		o.StockID,
		CFG.GetCLRSaturnDate(o.Date,@DateFormat, 0, @DateType) DateString,
		oi.Fee,
		oi.Price,
		orr.Non,
        orr.NonSub,				
			' + @SelectColumns + N',0' + @CodeAndTitleColumn
          + N'	 
	 FROM STC.OutgoingItem oi 
INNER JOIN STC.Outgoing o ON o.OutgoingID = oi.OutgoingID
JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
JOIN SLE.Outgoing_Return_Remain orr ON orr.OutgoingItemID = oi.OutgoingItemID
INNER JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
JOIN STF.VWStuff s ON s.StuffID = oi.StuffID
LEFT JOIN (SELECT tr.OutgoingItemID ,
					   tr.TraceID ,
					   CASE WHEN tr.DlID IS NOT NULL THEN CAST(tr.DlID AS NVARCHAR(MAX)) 
							WHEN tr.TraceItemID IS NOT NULL THEN CAST(tr.TraceItemID AS NVARCHAR(MAX)) 
					        ELSE tr.Value
					   END Value
					   FROM STC.OutgoingItemTrace tr
				) x
				PIVOT (
					MAX(Value)
					FOR TraceID IN ( ' + @DynamicColumns
          + N')
				) AS piv ON piv.OutgoingItemID = oi.OutgoingItemID
				' + @LeftJoin +'  ' +@listLeftJoin
          + N'
WHERE sdt.StockDocumentTypeID = @StockDocumentTypeID
AND o.StockID = @StockId
AND o.[Date] <= @Date
AND orr.Non > 0
AND (@StuffId IS NULL OR oi.StuffID = @StuffId )
AND (@DeliverStockId IS NULL OR o.DeliverStockID = @DeliverStockId)
AND (@DeliverDlId IS NULL OR o.DeliverDlID = @DeliverDlId)
' + @WhereClause;

    PRINT @Query;

    EXEC sp_executesql @Query,
        N'  @Date DATE ,
		    @StockDocumentTypeID int ,
		    @StockId INT ,
		    @DeliverDlId INT ,
		    @DeliverStockId INT ,
		    @StuffId INT,
		    @DateFormat nvarchar(20),
		    @DateType TINYINT		
		',
    @Date = @Date,
    @StockDocumentTypeID = @StockDocumentTypeID,
    @StockId = @StockId,
    @DeliverDlId = @DeliverDlId,
    @DeliverStockId = @DeliverStockId,
    @StuffId = @StuffId,
    @DateFormat = @DateFormat,
    @DateType = @DateType;

END;

