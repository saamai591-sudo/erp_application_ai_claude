
---------------------------------------------------------
CREATE    PROCEDURE [SLE].[GetNonQuotation]
(
    @Date DATE,
    @ids NVARCHAR(MAX),
    @dlId INT,
    @saleTypeId INT = NULL,
    @currencyId INT = NULL,
    @branchId INT = NULL,
    @isSaleSpoilage BIT = NULL,
    @saleAreaId INT = NULL
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
            @basePrecisionCount SMALLINT,
            @CultureNo TINYINT;

    SELECT @basePrecisionCount = c.PrecisionCount
    FROM CFG.Currency AS c
    WHERE c.CurrencyID = -1;

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
    WHERE ConfigKey = 'QuotationNeedConfirm';

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
 SELECT		qi.QuotationItemID,
			q.QuotationID,
			qi.RowIndex,
			q.Number,
			q.ExpirationDate Expiration,
			CFG.GetCLRSaturnDate(q.[Date],@DateFormat, 0, @DateType) DateString,
			s.StuffID,
			s.Code StuffCode,
			case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	             when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then s.Title2
	        end as StuffTitle,
            s.StuffDetailType,
			s.[Type] StuffType,
			qi.SaleModelID,
			qi.MainQuantity,
			qi.SubQuantity,
			qi.Fee,
			qi.Discount,
			qi.Tax,
			qi.Duty,
			CASE WHEN qni.Non = qr.Non THEN qni.NonPrice
				ELSE
					ROUND((qni.Price / qni.MainQuantity ) * qr.Non , @basePrecisionCount)
			END AS NonPrice,

			CASE WHEN qni.Non = qr.Non THEN qni.NonDiscount
				ELSE
					ROUND((qni.Discount / qni.MainQuantity ) * qr.Non , @basePrecisionCount)
			END AS NonDiscount,

			qni.Price AS BasePrice ,
			qni.Discount AS BaseDiscount,
			qni.MainQuantity AS BaseMainQuantity,

			qr.Non,
			qr.NonSub,' + @SelectColumns + N',0' + @CodeAndTitleColumn
          + N'	
 FROM   SLE.QuotationItem qi
        JOIN SLE.Quotation q ON q.QuotationID = qi.QuotationID
        JOIN SLE.Quotation_Remains qr ON qr.QuotationItemID = qi.QuotationItemID
        JOIN CFG.Party p ON p.PartyID = q.CustomerID
		JOIN STF.vwStuff s ON s.StuffID = qi.StuffID
		LEFT JOIN SLE.Quotation_Non_Invoice AS qni ON qni.QuotationItemID = qi.QuotationItemID
		LEFT JOIN STF.StuffDetail AS sd ON sd.StuffID = s.StuffID
		LEFT JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
		LEFT JOIN (SELECT tr.QuotationItemID ,
					   tr.TraceID ,
					   CASE WHEN tr.DlID IS NOT NULL THEN CAST(tr.DlID AS NVARCHAR(MAX)) 
							WHEN tr.TraceItemID IS NOT NULL THEN CAST(tr.TraceItemID AS NVARCHAR(MAX)) 
							ELSE tr.Value
					   END Value
					   FROM SLE.QuotationItemTrace tr
				) x
				PIVOT (
					MAX(Value)
					FOR TraceID IN ( ' + @DynamicColumns
          + N')
				) AS piv ON piv.QuotationItemID = qi.QuotationItemID
				' + @LeftJoin + N' ' + @listLeftJoin
          + N'
 WHERE  qr.Non > 0
		AND ( @isSaleSpoilage IS NULL  OR  (@isSaleSpoilage = 0 AND SAG.StuffDetailType <> 3 ) OR  (@isSaleSpoilage = 1 AND SAG.StuffDetailType = 3))
		AND (@saleAreaId is null or q.SaleAreaID = @saleAreaId)
        AND q.[Status] <> 2
        AND q.[Date] <= @Date
		AND q.[ExpirationDate] >= @Date
        AND p.DlID = @dlId
        --AND ( @ids IS NULL
        --      OR qi.QuotationItemID NOT IN (
        --      SELECT    value
        --      FROM      CFG.R_FnCommaStr2Table(@ids) )
        --    )
        AND ( @isConfirmed = 0
              OR q.[Status] = 3
            )
        AND ( @branchId IS NULL
              OR q.BranchID = @branchId
            )
        AND ( @currencyId IS NULL
              OR q.CurrencyID = @currencyId
            )
        AND ( @saleTypeId IS NULL
              OR q.[SaleTypeID] = @saleTypeId
            )
			';

    PRINT @query;

    EXEC sp_executesql @query,
                       N'
			@Date DATE ,
			@ids NVARCHAR(MAX) ,
			@saleTypeId int ,
			@currencyId int ,
			@branchId int ,
			@dlId INT,
			@isConfirmed bit,
			@DateFormat nvarchar(20),
			@DateType TINYINT,
			@basePrecisionCount SMALLINT,
			@isSaleSpoilage BIT,
			@saleAreaId int
		',
                       @Date = @Date,
                       @ids = @ids,
                       @dlId = @dlId,
                       @saleTypeId = @saleTypeId,
                       @isConfirmed = @isConfirmed,
                       @currencyId = @currencyId,
                       @branchId = @branchId,
                       @DateFormat = @DateFormat,
                       @DateType = @DateType,
                       @basePrecisionCount = @basePrecisionCount,
                       @isSaleSpoilage = @isSaleSpoilage,
                       @saleAreaId = @saleAreaId;

END;
