
---------------------------------------------------------
CREATE    PROCEDURE [SLE].[GetNonRemittancForQuantityOutgoing]
(
    @Date DATE,
    @ids NVARCHAR(MAX),
    @dlId INT,
    @stockId INT,
    @isSaleSpoilage BIT = NULL
)
--WITH ENCRYPTION
AS
BEGIN

    DECLARE @SelectColumns NVARCHAR(MAX),
            @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @Culture VARCHAR(10),
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

    DECLARE @QuotationNeedConfirm NVARCHAR(100),
            @isConfirmed BIT;

    SELECT @QuotationNeedConfirm = ConfigValue
    FROM CFG.Configuration
    WHERE ConfigKey = 'RemittanceNeedConfirm';

    IF (
           @QuotationNeedConfirm IS NOT NULL
           AND LOWER(@QuotationNeedConfirm) = 'true'
       )
    BEGIN
        SET @isConfirmed = 1;
    END;
    ELSE
    BEGIN
        SET @isConfirmed = 0;
    END;

    SET @query
        = N'
 SELECT		ri.RemittanceItemID ,
			ri.RowIndex,
			r.RemittanceID ,
			r.Number ,
			r.StockID ,
			CFG.GetCLRSaturnDate(r.[Date],@DateFormat, 0, @DateType) DateString,
			s.Code StuffCode ,
			case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	             when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then s.Title2
	        end as StuffTitle ,
            s.StuffDetailType,
			ri.StuffID ,
			ri.MainQuantity ,
			ri.SubQuantity ,
			rr.Non ,
			rr.NonSub,' + @SelectColumns + N',0' + @CodeAndTitleColumn
          + N'	
 FROM   SLE.RemittanceItem ri
        JOIN SLE.Remittance r ON r.RemittanceID = ri.RemittanceID
        LEFT JOIN SLE.InvoiceItem ii ON ii.InvoiceItemID = ri.InvoiceItemID
        JOIN STF.vwStuff s ON s.StuffID = ri.StuffID
		LEFT JOIN STF.StuffDetail AS sd ON sd.StuffID = s.StuffID
		LEFT JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
        JOIN SLE.Remittance_Remains rr ON rr.RemittanceItemID = ri.RemittanceItemID
		JOIN CFG.Party p ON p.PartyID = r.CustomerID
		LEFT JOIN (SELECT tr.RemittanceItemID ,
					   tr.TraceID ,
					   CASE WHEN tr.DlID IS NOT NULL THEN CAST(tr.DlID AS NVARCHAR(MAX)) 
							WHEN tr.TraceItemID IS NOT NULL THEN CAST(tr.TraceItemID AS NVARCHAR(MAX)) 
							ELSE tr.Value
					   END Value
					   FROM SLE.RemittanceItemTrace tr
				) x
				PIVOT (
					MAX(Value)
					FOR TraceID IN ( ' + @DynamicColumns
          + N')
				) AS piv ON piv.RemittanceItemID = ri.RemittanceItemID
				' + @LeftJoin + N' ' + @listLeftJoin
          + N'
 WHERE  ii.OutgoingItemId IS NULL
		AND ( @isSaleSpoilage IS NULL  OR  (@isSaleSpoilage = 0 AND SAG.StuffDetailType <> 3 ) OR  (@isSaleSpoilage = 1 AND SAG.StuffDetailType = 3))
        AND rr.Non > 0
        AND r.[Status] <> 2
        AND ( @isConfirmed = 0
              OR r.[Status] = 3
        )
        AND p.DlID = @dlId
		AND @Date between  r.Date and r.DeadLine
        --AND ( @ids IS NULL
        --      OR ri.RemittanceItemID NOT IN (
        --      SELECT    value
        --      FROM      CFG.R_FnCommaStr2Table(@ids) )
        --    )
		AND r.StockID = @stockId
			';

    PRINT @query;

    EXEC sp_executesql @query,
                       N'
			@Date DATE ,
			@ids NVARCHAR(MAX) ,
			@stockId int,
			@dlId INT,
			@isConfirmed bit,
			@DateFormat nvarchar(20),
			@DateType TINYINT		,
			@isSaleSpoilage BIT
		',
                       @Date = @Date,
                       @ids = @ids,
                       @dlId = @dlId,
                       @isConfirmed = @isConfirmed,
                       @stockId = @stockId,
                       @DateFormat = @DateFormat,
                       @DateType = @DateType,
                       @isSaleSpoilage = @isSaleSpoilage;

END;
