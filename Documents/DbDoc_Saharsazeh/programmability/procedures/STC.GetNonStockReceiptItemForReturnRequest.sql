---------------------------------------------------------------------------------------------------------------
CREATE   PROCEDURE [STC].GetNonStockReceiptItemForReturnRequest
(
    @ids NVARCHAR(MAX),
    @stockId INT,
    @financialPeriodId INT,
    @date DATE
)
--WITH ENCRYPTION
AS
BEGIN

    DECLARE @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @Culture VARCHAR(10),
            @SelectColumns NVARCHAR(MAX),
            @DynamicColumns NVARCHAR(MAX),
            @CodeAndTitleColumn NVARCHAR(MAX),
            @LeftJoin NVARCHAR(MAX),
            @query NVARCHAR(MAX),
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
			SELECT  sr.StockReceiptID ,
					sri.StockReceiptItemID ,
					sr.Number ,
					CFG.GetCLRSaturnDate(sr.[Date],@DateFormat,0,@DateType) DateString ,
					sri.StuffID ,
					s.Code StuffCode ,
					case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	                     when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then s.Title2
	                end as StuffTitle ,
					sri.MainQuantity ,
					sri.SubQuantity ,
					srr.Non ,
					srr.NonSub,' + @SelectColumns + N',0' + @CodeAndTitleColumn
          + N'	
			FROM    STC.StockReceiptItem sri
					JOIN STC.StockReceipt sr ON sr.StockReceiptID = sri.StockReceiptID
					JOIN STF.[Stuff] s ON s.StuffID = sri.StuffID
					JOIN STC.[StockReceipt_ReturnRemains] srr ON srr.StockReceiptItemID = sri.StockReceiptItemID                    
                    JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                        ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
					JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
					INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = sr.StockID
					LEFT JOIN (SELECT tr.StockReceiptItemID ,
								   tr.TraceID ,
								   CASE WHEN tr.DlID IS NOT NULL
								   THEN CAST(tr.DlID AS NVARCHAR(MAX)) 
								   ELSE tr.Value
								   END Value
								   FROM STC.StockReceiptItemTrace tr
							) x
							PIVOT (
								MAX(Value)
								FOR TraceID IN ( ' + @DynamicColumns
          + N')
							) AS piv ON piv.StockReceiptItemID = sri.StockReceiptItemID
							' + @LeftJoin + N' ' + @listLeftJoin
          + N'
					WHERE	srr.Non > 0
							AND sr.StockID = @stockId
							AND sr.[Date] <= @date
							AND sr.FinancialPeriodID = @financialPeriodId
							--AND ( @ids IS NULL
							--	  OR sri.StockReceiptItemID NOT IN (
							--	  SELECT    value
							--	  FROM      CFG.R_FnCommaStr2Table(@ids) )
							--	)';

    PRINT @query;

    EXEC sp_executesql @query,
                       N'
			@Date DATE ,
			@ids NVARCHAR(MAX) ,	
			@financialPeriodId INT,
			@UserID INT,
			@DateFormat nvarchar(20),
			@DateType TINYINT	,
			@stockId INT	
		',
                       @date = @date,
                       @ids = @ids,
                       @financialPeriodId = @financialPeriodId,
                       @UserID = @UserID,
                       @DateFormat = @DateFormat,
                       @DateType = @DateType,
                       @stockId = @stockId;


END;

