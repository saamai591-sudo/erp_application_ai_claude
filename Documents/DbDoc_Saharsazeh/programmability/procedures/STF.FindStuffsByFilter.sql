CREATE PROC [STF].FindStuffsByFilter
(
    @title NVARCHAR(500) = NULL,
    @groupId INT = NULL,
    @code NVARCHAR(200) = NULL,
    @technicalCode NVARCHAR(200) = NULL,
    @stuffNature TINYINT = NULL,
    @iranCode NVARCHAR(100) = NULL,
    @barcode NVARCHAR(100) = NULL,
    @Salable BIT = NULL,
    @type TINYINT = NULL,
    @propertyFilter NVARCHAR(MAX) = NULL,
    @StuffDetailType ArrayInput READONLY,
    @fixedAssetConversion BIT NULL,
    @StockID INT = NULL,
    @StockDocumentTypeID INT = NULL,
    @Dl INT = NULL
)
AS
BEGIN

    DECLARE @culureNo INT;

    SELECT @culureNo = ci.CultureNo
    FROM CFG.CultureInfo AS ci
    WHERE ci.Culture = CFG.GetuserCulture();


    SELECT CFG.GetStringPartBySpliter(rfstbs.VALUE, 1, '#') AS PropertyId,
           CFG.GetStringPartBySpliter(rfstbs.VALUE, 2, '#') AS PropertyValue
    INTO #t
    FROM CFG.R_FnStr2TableBySplitor(@propertyFilter, '|') AS rfstbs;

    DECLARE @Count INT =
            (
                SELECT COUNT(1)FROM #t
            );

    SELECT spv.StuffID
    INTO #validPropertyFilterStuffs
    FROM STF.StuffPropertyValue AS spv
        JOIN STF.Property AS p
            ON p.PropertyID = spv.PropertyID
        JOIN #t t
            ON t.PropertyId = p.PropertyID
    WHERE (
              p.AccountLevelTypeID = 6
              AND spv.TraceItemID = CAST(t.PropertyValue AS INT)
          )
          OR
          (
              p.AccountLevelTypeID <> 6
              AND
              (
                  (
                      @culureNo = 2
                      OR spv.Value2 LIKE N'%' + t.PropertyValue + N'%'
                  )
                  AND
                  (
                      @culureNo <> 2
                      OR spv.[Value] LIKE N'%' + t.PropertyValue + N'%'
                  )
              )
          )
    GROUP BY spv.StuffID
    HAVING COUNT(1) = @Count;

    DECLARE @Seprator CHAR,
            @ConfigValue BIT;

    SELECT @ConfigValue = CASE
                              WHEN ConfigValue = 'True' THEN
                                  1
                              ELSE
                                  0
                          END
    FROM CFG.Configuration
    WHERE ConfigType = 4
          AND ConfigKey = 'IndependentStuffCoding';



    SELECT @Seprator = ConfigValue
    FROM [CFG].[Configuration]
    WHERE [ConfigKey] = 'StuffGroupCodeSeprator';

    SELECT StuffGroupID,
           STF.StuffGroupFullCode(StuffGroupID) FullCode,
           Title,
           Title2
    INTO #StuffGroup
    FROM STF.StuffGroup;

    SELECT s.StuffID,
           s.[Type],
           CASE
               WHEN @ConfigValue = 1 THEN
                   s.Code
               ELSE
                   CASE
                       WHEN @Seprator IS NULL
                            OR @Seprator = '' THEN
                           ISNULL(sg.FullCode, '') + s.Code
                       ELSE
                           ISNULL(sg.FullCode + @Seprator, '') + s.Code
                   END
           END Code,
           ISNULL(s.StandardTitle, '') + ISNULL(' ' + s.Title, '') Title,
           ISNULL(s.StandardTitle2, '') + ISNULL(' ' + s.Title2, '') Title2,
           SAG.StuffDetailType,
           sd.TechnicalCode,
           s.StuffNature,
           sd.DiscountGroupID,
           s.DutyRate,
           s.TaxRate,
           CASE
               WHEN @ConfigValue = 1 THEN
                   s.Code
               ELSE
                   CASE
                       WHEN @Seprator IS NULL
                            OR @Seprator = '' THEN
                           ISNULL(sg.FullCode, '') + s.Code
                       ELSE
                           ISNULL(sg.FullCode + @Seprator, '') + s.Code
                   END
           END StuffFullCode,
           sd.IranCode,
           sd.Barcode AS BarCode,
           s.ExemptOfPurchaseVat,
           s.ExemptOfSellVat,
           s.MainMeasureUnitID,
           s.StuffGroupID,
           s.StockReceiptCostAgent,
           s.FixedAssetConversion,
           sd.Saleable,
           sd.ConvertRatio,
           sd.IsStable,
           sd.MeasureSubUnitID,
           s.IsActive
    INTO #stuffs
    FROM STF.[Stuff] AS s
        JOIN STF.StuffDetail sd
            ON sd.StuffID = s.StuffID
        JOIN STF.StuffAccountGroup SAG
            ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
        LEFT JOIN #StuffGroup sg
            ON sg.StuffGroupID = s.StuffGroupID
        LEFT JOIN #validPropertyFilterStuffs v
            ON v.StuffID = s.StuffID
        LEFT JOIN @StuffDetailType AS sdt
            ON sdt.Val = SAG.StuffDetailType
        LEFT JOIN
        (
            SELECT StuffID
            FROM STF.StuffPursuitGroup spg
                JOIN STF.PursuitGroupStock pgs
                    ON pgs.PursuitGroupID = spg.PursuitGroupID
            GROUP BY StuffID
        ) pgs
            ON pgs.StuffID = s.StuffID
        LEFT JOIN
        (SELECT StuffID FROM STF.StuffPursuitGroup spg GROUP BY StuffID) pgsdt
            ON pgsdt.StuffID = s.StuffID
    WHERE (
              @propertyFilter IS NULL
              OR v.StuffID IS NOT NULL
          )
          AND
          (
              @groupId IS NULL
              OR s.StuffGroupID = @groupId
          )
          AND
          (
              @fixedAssetConversion IS NULL
              OR s.FixedAssetConversion = @fixedAssetConversion
          )
          AND
          (
              @stuffNature IS NULL
              OR s.StuffNature = @stuffNature
          )
          AND
          (
              @barcode IS NULL
              OR sd.Barcode LIKE N'%' + @barcode + N'%'
          )
          AND
          (
              @iranCode IS NULL
              OR sd.IranCode LIKE N'%' + @iranCode + N'%'
          )
          AND
          (
              @technicalCode IS NULL
              OR sd.TechnicalCode LIKE N'%' + @technicalCode + N'%'
          )
          AND
          (
              @Salable IS NULL
              OR sd.Saleable = @Salable
          )
          AND
          (
              @type IS NULL
              OR s.[Type] = @type
          )
          AND
          (
              NOT EXISTS
    (
        SELECT 1 FROM @StuffDetailType AS sdt2
    )
              OR sdt.Val IS NOT NULL
          )
          AND
          (
              @StockID IS NULL
              OR pgs.StuffID IS NULL
              OR EXISTS
    (
        SELECT StuffID
        FROM STF.StuffPursuitGroup spg
            JOIN STF.PursuitGroupStock pgs
                ON pgs.PursuitGroupID = spg.PursuitGroupID
        WHERE StuffID = s.StuffID
              AND StockID = @StockID
    )
          )
          AND
          (
              @StockDocumentTypeID IS NULL
              OR pgsdt.StuffID IS NULL
              OR EXISTS
    (
        SELECT StuffID FROM STF.StuffPursuitGroup spg WHERE StuffID = s.StuffID
    )
          );



    CREATE TABLE #TableName1
    (
        [Date] DATE,
        StockID INT,
        StuffID INT,
        MainQuantity DECIMAL(30, 4),
        SubQuantity DECIMAL(30, 4)
    );

    DECLARE @StartDate DATE;



    IF @StockID IS NOT NULL
    BEGIN

        SELECT TOP (1)
               @StartDate = DATEADD(DAY, 1, a.EndDate)
        FROM CFG.FinancialPeriod a
            JOIN STC.StockClosingOperation b
                ON a.FinancialPeriodID = b.FinancialPeriodID
        WHERE b.StockID = @StockID
        ORDER BY a.EndDate DESC;

    END;
    IF @StartDate IS NULL
    BEGIN
        SELECT TOP 1
               @StartDate = StartDate
        FROM CFG.FinancialPeriod
        ORDER BY StartDate;
    END;



    INSERT INTO #TableName1
    (
        [Date],
        StockID,
        StuffID,
        MainQuantity,
        SubQuantity
    )
    EXEC [STC].GoodsInventory NULL, @StockID, @StartDate;


    SELECT s.StuffID,
           s.Type,
           s.Code,
           CASE
               WHEN @culureNo = 2 THEN
                   s.Title2
               ELSE
                   s.Title
           END AS Title,
           s.ExemptOfPurchaseVat,
           s.ExemptOfSellVat,
           s.MainMeasureUnitID,
           s.StuffGroupID,
           s.StuffDetailType,
           s.DiscountGroupID,
           s.MeasureSubUnitID,
           s.BarCode,
           s.IranCode,
           s.Saleable,
           s.ConvertRatio,
           s.IsStable,
           s.TechnicalCode,
           s.StuffNature,
           s.DutyRate,
           s.TaxRate,
           s.StuffFullCode,
           s.StockReceiptCostAgent,
           s.FixedAssetConversion,
           mu.MeasureUnitID,
           CASE
               WHEN @culureNo = 2 THEN
                   mu.Title2
               ELSE
                   mu.Title
           END AS MainMeasureUnitTitle,
           ISNULL(vw.RealInventory, 0) RealInventory,
           s.IsActive
    FROM #stuffs AS s
        JOIN STF.MeasureUnit AS mu
            ON mu.MeasureUnitID = s.MainMeasureUnitID
        LEFT JOIN
        (
            SELECT StuffID,
                   SUM(MainQuantity) RealInventory
            FROM #TableName1
            WHERE (
                      @StockID IS NULL
                      OR StockID = @StockID
                  )
            GROUP BY StuffID
        ) vw
            ON vw.StuffID = s.StuffID
    WHERE s.IsActive = 1
          AND
          (
              @code IS NULL
              OR s.Code LIKE N'%' + @code + N'%'
          )
          AND
          (
              @title IS NULL
              OR s.Title LIKE N'%' + @title + N'%'
              OR s.Title2 LIKE N'%' + @title + N'%'
          );

END;
