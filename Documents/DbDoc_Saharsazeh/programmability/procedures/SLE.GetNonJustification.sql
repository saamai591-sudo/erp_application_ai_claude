
---------------------------------------------------------
CREATE    PROCEDURE [SLE].[GetNonJustification]
(
    @Date DATE,
    @ids NVARCHAR(MAX),
    @dlId INT,
    @SaletypeId INT = NULL,
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

    IF (@ids = '')
        SET @ids = NULL;

    SELECT @basePrecisionCount = c.PrecisionCount
    FROM CFG.Currency AS c
    WHERE c.CurrencyID = -1;

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

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
 SELECT		ji.JustificationItemID ,
            j.JustificationID ,
			ji.RowIndex,
            j.Number ,
			case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	             when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then s.Title2
	        end as StuffTitle ,
            s.StuffDetailType,
            s.Code StuffCode ,
            s.[Type] StuffType ,
            ji.StuffID ,
            ji.SaleModelID ,
            CFG.GetCLRSaturnDate(j.[Date],@DateFormat,0,@DateType) DateString,
            ji.MainQuantity ,
            ji.SubQuantity ,
            jr.Non ,
            jr.NonSub ,
			CASE WHEN JNI.Non = jr.Non THEN JNI.NonPrice
				ELSE
					ROUND(
						( JNI.Price / JNI.MainQuantity ) * jr.Non ,
						@basePrecisionCount)
			END AS NonInvoicePrice,
			CASE WHEN JNI.Non = jr.Non THEN JNI.NonDiscount
				ELSE
					ROUND(
						( JNI.Discount / JNI.MainQuantity ) * jr.Non ,
						@basePrecisionCount)
			END AS NonInvoiceDiscount,
			
			JNI.Price BasePrice,
			JNI.Discount BaseDiscount,
			JNI.MainQuantity BaseMainQuantity,

            ji.Fee ,
            ji.Discount,' + @SelectColumns + N',0' + @CodeAndTitleColumn
          + N'	
 FROM      SLE.JustificationItem ji
			LEFT JOIN SLE.Justification_Non_Invoice JNI ON jni.JustificationItemId = ji.JustificationItemId
            JOIN SLE.Justification j ON j.JustificationID = ji.JustificationID
            JOIN STF.vwStuff s ON s.StuffID = ji.StuffID
			LEFT JOIN STF.StuffDetail AS sd ON sd.StuffID = s.StuffID
			JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
            JOIN SLE.Justification_Remains jr ON jr.JustificationItemID = ji.JustificationItemID
            JOIN CFG.Party p ON p.PartyID = j.CustomerID
			LEFT JOIN (SELECT tr.JustificationItemID ,
					   tr.TraceID ,
					   CASE WHEN tr.DlID IS NOT NULL THEN CAST(tr.DlID AS NVARCHAR(MAX)) 
							WHEN tr.TraceItemID IS NOT NULL THEN CAST(tr.TraceItemID AS NVARCHAR(MAX)) 
							ELSE tr.Value
					   END Value
					   FROM SLE.JustificationItemTrace tr
				) x
				PIVOT (
					MAX(Value)
					FOR TraceID IN ( ' + @DynamicColumns
          + N')
				) AS piv ON piv.JustificationItemID = ji.JustificationItemID
				' + @LeftJoin + N' ' + @listLeftJoin
          + N'
 WHERE  jr.Non > 0
		AND ( @isSaleSpoilage IS NULL  OR  (@isSaleSpoilage = 0 AND SAG.StuffDetailType <> 3 ) OR  (@isSaleSpoilage = 1 AND SAG.StuffDetailType = 3))
		and (@saleAreaId is null or j.saleAreaID = @saleAreaId)

            AND p.DlID = @dlId
            AND j.[Status] <> 2
            AND j.[Date] <= @Date
			AND (@SaletypeId IS NULL 
				OR j.[SaletypeId] = @SaletypeId
			)
			AND (
				@currencyId is null
				or j.CurrencyID = @currencyId 
			)
			AND (
				@branchId is null
				or j.BranchID = @branchId 
			)
			';

    PRINT @query;

    EXEC sp_executesql @query,
                       N'
			@Date DATE ,
			@ids NVARCHAR(MAX) ,
			@SaletypeId int null,
			@currencyId int,
			@branchId int,
			@dlId INT,
			@DateFormat nvarchar(20),
			@DateType TINYINT,
			@basePrecisionCount SMALLINT,
			@isSaleSpoilage BIT	,
			@saleAreaId int
		',
                       @Date = @Date,
                       @ids = @ids,
                       @dlId = @dlId,
                       @SaletypeId = @SaletypeId,
                       @currencyId = @currencyId,
                       @branchId = @branchId,
                       @DateFormat = @DateFormat,
                       @DateType = @DateType,
                       @basePrecisionCount = @basePrecisionCount,
                       @isSaleSpoilage = @isSaleSpoilage,
                       @saleAreaId = @saleAreaId;

END;
