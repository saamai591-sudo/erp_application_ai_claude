-----------------------------------------------------------------------------------------------------------------
CREATE   PROC [STC].[GetStuffReceiptItemsForChargingService]
(@stockReceiptId INT)
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @userId INT,
            @culture NVARCHAR(10),
            @cultureNo INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(12),
            @DynamicColumns NVARCHAR(MAX),
            @SelectColumns NVARCHAR(MAX),
            @CodeAndTitleColumn NVARCHAR(MAX),
            @LeftJoin NVARCHAR(MAX),
            @query NVARCHAR(MAX);

    SET @userId = CFG.GetuserID();
    SET @culture = CFG.GetuserCulture();

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @userId;

    IF @DateType IS NULL
        SET @DateType = CASE @culture
                            WHEN 'fa' THEN
                                0
                            WHEN 'en' THEN
                                1
                            WHEN 'ar' THEN
                                2
                            ELSE
                                0
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @userId;

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
                                 ',tri' + CAST(TraceID AS VARCHAR(5)) + '.Item' + CASE @cultureNo
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

    SELECT @cultureNo = ci.CultureNo
    FROM CFG.CultureInfo AS ci
    WHERE ci.Culture = @culture;

    SET @query
        = N'
SELECT si.StockReceiptItemID,
       s.Number,
       si.RowIndex,
	    CFG.GetCLRSaturnDate(s.[Date],@DateFormat,0,@DateType) AS DateString,
       si.MainQuantity,
       si.SubQuantity,
       STF.GetStuffCode(s2.StuffID) AS StuffCode,
       CASE
           WHEN @cultureNo = 2 THEN
               s2.Title2
           ELSE
               s2.Title
       END AS StuffTitle,
       srr.Non,
       srr.NonSub,' + @SelectColumns + N',0' + @CodeAndTitleColumn
          + N'
FROM STC.StockReceiptItem si
    JOIN STC.StockReceipt s
        ON s.StockReceiptID = si.StockReceiptID
    JOIN STC.StockReceipt_Remains AS srr
        ON srr.StockReceiptItemID = si.StockReceiptItemID
    JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
        ON s.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
    JOIN STC.StockDocumentType AS sdt
        ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
    JOIN STF.VWStuff AS s2
        ON s2.StuffID = si.StuffID
	LEFT JOIN
    (
        SELECT tr.StockReceiptItemID,
               tr.TraceID,
               CASE
                   WHEN tr.DlID IS NOT NULL THEN CAST(tr.DlID AS NVARCHAR(MAX))
                   WHEN tr.TraceItemID IS NOT NULL THEN CAST(tr.TraceItemID AS NVARCHAR(MAX))
                   ELSE
                       tr.Value
               END Value
        FROM STC.StockReceiptItemTrace tr
    ) x
    PIVOT
    (
        MAX(Value)
        FOR TraceID IN (' + @DynamicColumns
          + N')
    ) AS piv
        ON piv.StockReceiptItemID = si.StockReceiptItemID
		' + @LeftJoin + N' ' + @listLeftJoin + N'
WHERE si.StockReceiptID = @stockReceiptId AND si.Fee = 0';

    EXEC sp_executesql @query,
                       N' 	@stockReceiptId INT,
						@cultureNo		INT,
						@DateFormat		nvarchar(12),
						@DateType		int ',
                       @stockReceiptId = @stockReceiptId,
                       @cultureNo = @cultureNo,
                       @DateFormat = @DateFormat,
                       @DateType = @DateType;


END;
