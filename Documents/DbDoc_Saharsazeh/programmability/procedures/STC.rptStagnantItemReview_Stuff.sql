------------------------------------------------------------------------------------------------------------------
CREATE   PROCEDURE [STC].rptStagnantItemReview_Stuff
(
    @FromDate DATE,
    @EndDate DATE,
    @SelectedStock NVARCHAR(MAX) = NULL,
    @SelectedStuffAccountGroup NVARCHAR(MAX) = NULL,
    @SelectedStuffTrace NVARCHAR(MAX) = NULL,
    @SelectedStuffGroup NVARCHAR(MAX) = NULL,
    @selectedStockDocumentTypes NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
BEGIN

    DECLARE @userid INT,
            @FinancialPeriodID INT,
            @stockDocumentsType NVARCHAR(MAX),
            @stockPriceDocumentsTypeSelect NVARCHAR(MAX),
            @stockQuantityDocumentsTypeSelect NVARCHAR(MAX),
            @Culture VARCHAR(25),
            @CultureNo TINYINT;

    SET @userid = CFG.GetuserID();


    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;


    SELECT value
    INTO #selectedStockDocumentType
    FROM CFG.R_FnCommaStr2Table(@selectedStockDocumentTypes);

    INSERT #selectedStockDocumentType
    (
        value
    )
    SELECT sdt.StockDocumentTypeID
    FROM STC.StockDocumentType AS sdt
    WHERE sdt.DocumentType = 7
          AND sdt.[Type] = 1;

    SELECT @FinancialPeriodID = FinancialPeriodID
    FROM CFG.FinancialPeriod
    WHERE @FromDate
    BETWEEN StartDate AND EndDate;

    SELECT DISTINCT
           a.StockDocumentTypeID
    INTO #existStockDocumentType
    FROM
    (
        SELECT sdtb.StockDocumentTypeID
        FROM STC.StockReceipt sr
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
            ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
        UNION
        SELECT sdtb.StockDocumentTypeID
        FROM STC.ReturnStockReceipt rsr
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
            ON rsr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
        UNION
        SELECT sdtb.StockDocumentTypeID
        FROM STC.Outgoing o
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
        UNION
        SELECT sdtb.StockDocumentTypeID
        FROM STC.ReturnedOutgoing ro
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
            ON ro.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
    ) a
    ORDER BY a.StockDocumentTypeID;

    SELECT @stockDocumentsType = STUFF(
    (
        SELECT DISTINCT
               ',' + QUOTENAME(CAST(StockDocumentTypeID AS VARCHAR(5)))
        FROM STC.StockDocumentType
            JOIN #selectedStockDocumentType
                ON value = StockDocumentTypeID
        WHERE StockDocumentTypeID IN
    (
        SELECT StockDocumentTypeID FROM #existStockDocumentType
    )
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                                      );

    IF @stockDocumentsType IS NULL
       OR @stockDocumentsType = ''
        SET @stockDocumentsType = N'[-1000]';
    ELSE
        SET @stockDocumentsType = @stockDocumentsType + N', [-1000]';

    DECLARE @query NVARCHAR(MAX);


    SELECT @stockQuantityDocumentsTypeSelect
        = STUFF(
    (
        SELECT DISTINCT
               ',ISNULL(q.' + QUOTENAME(CAST(StockDocumentTypeID AS VARCHAR(5))) + ', 0) [SDTQ'
               + CAST(StockDocumentTypeID AS VARCHAR(5)) + ']'
        FROM STC.StockDocumentType
            JOIN #selectedStockDocumentType AS sdt
                ON sdt.value = StockDocumentTypeID
        WHERE StockDocumentTypeID IN
    (
        SELECT StockDocumentTypeID FROM #existStockDocumentType
    )
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    0   ,
    ''
               );

    SELECT @stockPriceDocumentsTypeSelect
        = STUFF(
    (
        SELECT DISTINCT
               ',ISNULL(a.' + QUOTENAME(CAST(StockDocumentTypeID AS VARCHAR(5))) + ', 0) [SDTP'
               + CAST(StockDocumentTypeID AS VARCHAR(5)) + '], ISNULL(qty.'
               + QUOTENAME(CAST(StockDocumentTypeID AS VARCHAR(5))) + ', 0) [SDTC'
               + CAST(StockDocumentTypeID AS VARCHAR(5)) + ']'
        FROM STC.StockDocumentType
            JOIN #selectedStockDocumentType AS sdt
                ON sdt.value = StockDocumentTypeID
        WHERE StockDocumentTypeID IN
    (
        SELECT StockDocumentTypeID FROM #existStockDocumentType
    )
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    0   ,
    ''
               );


    IF @stockQuantityDocumentsTypeSelect IS NULL
       OR @stockQuantityDocumentsTypeSelect = ''
    BEGIN
        IF EXISTS (SELECT 1 FROM #selectedStockDocumentType WHERE value = -1000)
            SET @stockQuantityDocumentsTypeSelect = N'ISNULL(q.[-1000], 0) [PosQuantity]';
        ELSE
            SET @stockQuantityDocumentsTypeSelect = N'';
    END;
    ELSE IF EXISTS (SELECT 1 FROM #selectedStockDocumentType WHERE value = -1000)
        SET @stockQuantityDocumentsTypeSelect
            = @stockQuantityDocumentsTypeSelect + N', ISNULL(q.[-1000], 0) [PosQuantity]';

    IF @stockPriceDocumentsTypeSelect IS NULL
       OR @stockPriceDocumentsTypeSelect = ''
    BEGIN
        IF EXISTS (SELECT 1 FROM #selectedStockDocumentType WHERE value = -1000)
            SET @stockPriceDocumentsTypeSelect = N' ISNULL(a.[-1000], 0) [PosPrice],ISNULL(qty.[-1000], 0) [PosCount]';
        ELSE
            SET @stockPriceDocumentsTypeSelect = N'';
    END;
    ELSE IF EXISTS (SELECT 1 FROM #selectedStockDocumentType WHERE value = -1000)
        SET @stockPriceDocumentsTypeSelect
            = @stockPriceDocumentsTypeSelect + N',ISNULL(a.[-1000], 0) [PosPrice],ISNULL(qty.[-1000], 0) [PosCount]';

    SELECT A.StuffID,
           A.StockDocumentTypeID,
           SUM(A.MainQuantity) MainQuantity,
           SUM(A.SubQuantity) SubQuantity,
           SUM(A.NetPrice) NetPrice
    INTO #SourceData
    FROM
    (
        SELECT ii.StuffID,
               sdtb.StockDocumentTypeID,
               ii.MainQuantity AS MainQuantity,
               ii.SubQuantity AS SubQuantity,
               CASE
                   WHEN Revision.RevisionPrice IS NOT NULL THEN
                       Revision.RevisionPrice
                   ELSE
                       ii.NetPrice
               END AS NetPrice
        FROM STC.StockReceipt i
            INNER JOIN STC.StockReceiptItem ii
                ON i.StockReceiptID = ii.StockReceiptID 
            JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
            JOIN STC.StockDocumentType sdt
                ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
            JOIN STF.StuffDetail sd
                ON sd.StuffID = ii.StuffID
			JOIN STF.StuffAccountGroup SAG 
				ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
            JOIN STF.[Stuff] AS s
                ON s.StuffID = ii.StuffID
            INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = i.StockID
            INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = i.FinancialPeriodID          
            LEFT JOIN
            (
                SELECT ROW_NUMBER() OVER (PARTITION BY i.StockReceiptItemID ORDER BY h.Number DESC) Rno,
                       i.StockReceiptItemID,
                       i.RevisionPrice
                FROM STC.RevisionCost h
                    JOIN STC.RevisionCostItem i
                        ON h.RevisionCostID = i.RevisionCostID
                WHERE i.StockReceiptItemID IS NOT NULL
                      AND h.FinancialPeriodID = @FinancialPeriodID
            ) Revision
                ON Revision.Rno = 1
                   AND Revision.StockReceiptItemID = ii.StockReceiptItemID
        WHERE i.FinancialPeriodID = @FinancialPeriodID
              AND SAG.StuffDetailType <> 3
              AND
              (
                  i.Date < @FromDate
                  OR sdt.DocumentType = 7
              )
              AND
              (
                  @SelectedStock IS NULL
                  OR i.StockID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStock)
                     )
              )
              AND
              (
                  @SelectedStuffGroup IS NULL
                  OR s.StuffGroupID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffGroup)
                     )
              )
              AND
              (
                  @SelectedStuffAccountGroup IS NULL
                  OR sd.StuffAccountGroupID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffAccountGroup)
                     )
              )
              AND
              (
                  @SelectedStuffTrace IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffTrace)
                     )
              )
        UNION ALL
        SELECT ii.StuffID,
               sdtb.StockDocumentTypeID,
               ii.MainQuantity AS MainQuantity,
               ii.SubQuantity AS SubQuantity,
               CASE
                   WHEN Revision.RevisionPrice IS NOT NULL THEN
                       Revision.RevisionPrice
                   ELSE
                       ii.NetPrice
               END AS NetPrice
        FROM STC.StockReceipt i
            INNER JOIN STC.StockReceiptItem ii
                ON i.StockReceiptID = ii.StockReceiptID
            JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
            JOIN STC.StockDocumentType sdt
                ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
            JOIN STF.StuffDetail sd
                ON sd.StuffID = ii.StuffID
            JOIN STF.[Stuff] AS s
                ON s.StuffID = ii.StuffID
			JOIN STF.StuffAccountGroup SAG 
				ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
            INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = i.StockID
            INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = i.FinancialPeriodID
            LEFT JOIN
            (
                SELECT ROW_NUMBER() OVER (PARTITION BY StockReceiptItemID ORDER BY Number DESC) Rno,
                       StockReceiptItemID,
                       RevisionPrice
                FROM STC.RevisionCost h
                    JOIN STC.RevisionCostItem i
                        ON h.RevisionCostID = i.RevisionCostID
                WHERE StockReceiptItemID IS NOT NULL
            ) Revision
                ON Rno = 1
                   AND Revision.StockReceiptItemID = ii.StockReceiptItemID
        WHERE i.Date
              BETWEEN @FromDate AND @EndDate
              AND SAG.StuffDetailType <> 3
              AND sdt.DocumentType <> 7
              AND
              (
                  @SelectedStock IS NULL
                  OR i.StockID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStock)
                     )
              )
              AND
              (
                  @SelectedStuffGroup IS NULL
                  OR s.StuffGroupID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffGroup)
                     )
              )
              AND
              (
                  @SelectedStuffAccountGroup IS NULL
                  OR sd.StuffAccountGroupID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffAccountGroup)
                     )
              )
              AND
              (
                  @SelectedStuffTrace IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffTrace)
                     )
              )
        UNION ALL
        SELECT ii.StuffID,
               sdtb.StockDocumentTypeID,
               -ii.MainQuantity AS MainQuantity,
               -ii.SubQuantity AS SubQuantity,
               (-1) * CASE
                          WHEN Revision.RevisionPrice IS NOT NULL THEN
                              Revision.RevisionPrice
                          ELSE
                              ii.Price
                      END AS NetPrice
        FROM STC.ReturnStockReceipt i
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
            ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
            INNER JOIN STC.ReturnStockReceiptItem ii
                ON i.ReturnStockReceiptID = ii.ReturnStockReceiptID
            JOIN STF.StuffDetail sd
                ON sd.StuffID = ii.StuffID
			JOIN STF.StuffAccountGroup SAG 
				ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
            JOIN STF.[Stuff] AS s
                ON s.StuffID = ii.StuffID
            INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = i.StockID
            INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = i.FinancialPeriodID
            LEFT JOIN
            (
                SELECT ROW_NUMBER() OVER (PARTITION BY ReturnStockReceiptItemID ORDER BY Number DESC) Rno,
                       i.ReturnStockReceiptItemID,
                       RevisionPrice
                FROM STC.RevisionCost h
                    JOIN STC.RevisionCostItem i
                        ON h.RevisionCostID = i.RevisionCostID
                WHERE ReturnStockReceiptItemID IS NOT NULL
                      AND FinancialPeriodID = @FinancialPeriodID
            ) Revision
                ON Rno = 1
                   AND Revision.ReturnStockReceiptItemID = ii.ReturnStockReceiptItemID
        WHERE i.FinancialPeriodID = @FinancialPeriodID
              AND i.Date < @FromDate
              AND SAG.StuffDetailType <> 3
              AND
              (
                  @SelectedStock IS NULL
                  OR i.StockID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStock)
                     )
              )
              AND
              (
                  @SelectedStuffGroup IS NULL
                  OR s.StuffGroupID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffGroup)
                     )
              )
              AND
              (
                  @SelectedStuffAccountGroup IS NULL
                  OR sd.StuffAccountGroupID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffAccountGroup)
                     )
              )
              AND
              (
                  @SelectedStuffTrace IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffTrace)
                     )
              )
        UNION ALL
        SELECT ii.StuffID,
               sdtb.StockDocumentTypeID,
               -ii.MainQuantity AS MainQuantity,
               -ii.SubQuantity AS SubQuantity,
               (-1) * CASE
                          WHEN Revision.RevisionPrice IS NOT NULL THEN
                              Revision.RevisionPrice
                          ELSE
                              ii.Price
                      END AS NetPrice
        FROM STC.ReturnStockReceipt i
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
            ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
            INNER JOIN STC.ReturnStockReceiptItem ii
                ON i.ReturnStockReceiptID = ii.ReturnStockReceiptID
            JOIN STC.StockDocumentType sdt
                ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
            JOIN STF.StuffDetail sd
                ON sd.StuffID = ii.StuffID
			JOIN STF.StuffAccountGroup SAG 
				ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
            JOIN STF.[Stuff] AS s
                ON s.StuffID = ii.StuffID
            INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = i.StockID
            INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = i.FinancialPeriodID
            LEFT JOIN
            (
                SELECT ROW_NUMBER() OVER (PARTITION BY ReturnStockReceiptItemID ORDER BY Number DESC) Rno,
                       ReturnStockReceiptItemID,
                       RevisionPrice
                FROM STC.RevisionCost h
                    JOIN STC.RevisionCostItem i
                        ON h.RevisionCostID = i.RevisionCostID
                WHERE ReturnStockReceiptItemID IS NOT NULL
            ) Revision
                ON Rno = 1
                   AND Revision.ReturnStockReceiptItemID = ii.ReturnStockReceiptItemID
        WHERE i.Date
              BETWEEN @FromDate AND @EndDate
              AND SAG.StuffDetailType <> 3
              AND
              (
                  @SelectedStock IS NULL
                  OR i.StockID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStock)
                     )
              )
              AND
              (
                  @SelectedStuffGroup IS NULL
                  OR s.StuffGroupID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffGroup)
                     )
              )
              AND
              (
                  @SelectedStuffAccountGroup IS NULL
                  OR sd.StuffAccountGroupID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffAccountGroup)
                     )
              )
              AND
              (
                  @SelectedStuffTrace IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffTrace)
                     )
              )
        UNION ALL
        SELECT ii.StuffID,
               sdtb.StockDocumentTypeID,
               -ii.MainQuantity AS MainQuantity,
               -ii.SubQuantity AS SubQuantity,
               (-1) * CASE
                          WHEN Revision.RevisionPrice IS NOT NULL THEN
                              Revision.RevisionPrice
                          ELSE
                              ii.Price
                      END AS NetPrice
        FROM STC.Outgoing i
            JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
                ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
            INNER JOIN STC.OutgoingItem ii
                ON i.OutgoingID = ii.OutgoingID
            JOIN STF.StuffDetail sd
                ON sd.StuffID = ii.StuffID
			JOIN STF.StuffAccountGroup SAG 
				ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
            JOIN STF.[Stuff] AS s
                ON s.StuffID = ii.StuffID
            INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = i.StockID
            INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = i.FinancialPeriodID
            LEFT JOIN
            (
                SELECT ROW_NUMBER() OVER (PARTITION BY OutgoingItemID ORDER BY Number DESC) Rno,
                       OutgoingItemID,
                       RevisionPrice
                FROM STC.RevisionCost h
                    JOIN STC.RevisionCostItem i
                        ON h.RevisionCostID = i.RevisionCostID
                WHERE OutgoingItemID IS NOT NULL
                      AND FinancialPeriodID = @FinancialPeriodID
            ) Revision
                ON Rno = 1
                   AND Revision.OutgoingItemID = ii.OutgoingItemID
        WHERE i.FinancialPeriodID = @FinancialPeriodID
              AND i.Date < @FromDate
              AND SAG.StuffDetailType <> 3
              AND
              (
                  @SelectedStock IS NULL
                  OR i.StockID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStock)
                     )
              )
              AND
              (
                  @SelectedStuffGroup IS NULL
                  OR s.StuffGroupID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffGroup)
                     )
              )
              AND
              (
                  @SelectedStuffAccountGroup IS NULL
                  OR sd.StuffAccountGroupID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffAccountGroup)
                     )
              )
              AND
              (
                  @SelectedStuffTrace IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffTrace)
                     )
              )
        UNION ALL
        SELECT ii.StuffID,
               sdtb.StockDocumentTypeID,
               -ii.MainQuantity AS MainQuantity,
               -ii.SubQuantity AS SubQuantity,
               (-1) * CASE
                          WHEN Revision.RevisionPrice IS NOT NULL THEN
                              Revision.RevisionPrice
                          ELSE
                              ii.Price
                      END AS NetPrice
        FROM STC.Outgoing i
            JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
                ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
            INNER JOIN STC.OutgoingItem ii
                ON i.OutgoingID = ii.OutgoingID
            JOIN STF.StuffDetail sd
                ON sd.StuffID = ii.StuffID
			JOIN STF.StuffAccountGroup SAG 
				ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
            JOIN STF.[Stuff] AS s
                ON s.StuffID = ii.StuffID
            INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = i.StockID
            INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = i.FinancialPeriodID
            JOIN STC.StockDocumentType sdt
                ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
            LEFT JOIN
            (
                SELECT ROW_NUMBER() OVER (PARTITION BY OutgoingItemID ORDER BY Number DESC) Rno,
                       OutgoingItemID,
                       RevisionPrice
                FROM STC.RevisionCost h
                    JOIN STC.RevisionCostItem i
                        ON h.RevisionCostID = i.RevisionCostID
                WHERE OutgoingItemID IS NOT NULL
            ) Revision
                ON Rno = 1
                   AND Revision.OutgoingItemID = ii.OutgoingItemID
        WHERE i.Date
              BETWEEN @FromDate AND @EndDate
              AND SAG.StuffDetailType <> 3
              AND
              (
                  @SelectedStock IS NULL
                  OR i.StockID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStock)
                     )
              )
              AND
              (
                  @SelectedStuffGroup IS NULL
                  OR s.StuffGroupID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffGroup)
                     )
              )
              AND
              (
                  @SelectedStuffAccountGroup IS NULL
                  OR sd.StuffAccountGroupID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffAccountGroup)
                     )
              )
              AND
              (
                  @SelectedStuffTrace IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffTrace)
                     )
              )
        UNION ALL
        SELECT ii.StuffID,
               sdtb.StockDocumentTypeID,
               ii.MainQuantity AS MainQuantity,
               ii.SubQuantity AS SubQuantity,
               CASE
                   WHEN Revision.RevisionPrice IS NOT NULL THEN
                       Revision.RevisionPrice
                   ELSE
                       ii.Price
               END AS NetPrice
        FROM STC.ReturnedOutgoing i
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
            ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
            INNER JOIN STC.ReturnedOutgoingItem ii
                ON i.ReturnedOutgoingID = ii.ReturnedOutgoingID
            JOIN STF.StuffDetail sd
                ON sd.StuffID = ii.StuffID
			JOIN STF.StuffAccountGroup SAG 
				ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
            JOIN STF.[Stuff] AS s
                ON s.StuffID = ii.StuffID
            INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = i.StockID
            INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = i.FinancialPeriodID
            LEFT JOIN
            (
                SELECT ROW_NUMBER() OVER (PARTITION BY ReturnedOutgoingItemID ORDER BY Number DESC) Rno,
                       ReturnedOutgoingItemID,
                       RevisionPrice
                FROM STC.RevisionCost h
                    JOIN STC.RevisionCostItem i
                        ON h.RevisionCostID = i.RevisionCostID
                WHERE ReturnedOutgoingItemID IS NOT NULL
                      AND FinancialPeriodID = @FinancialPeriodID
            ) Revision
                ON Rno = 1
                   AND Revision.ReturnedOutgoingItemID = ii.ReturnedOutgoingItemID
        WHERE i.FinancialPeriodID = @FinancialPeriodID
              AND i.Date < @FromDate
              AND SAG.StuffDetailType <> 3
              AND
              (
                  @SelectedStock IS NULL
                  OR i.StockID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStock)
                     )
              )
              AND
              (
                  @SelectedStuffGroup IS NULL
                  OR s.StuffGroupID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffGroup)
                     )
              )
              AND
              (
                  @SelectedStuffAccountGroup IS NULL
                  OR sd.StuffAccountGroupID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffAccountGroup)
                     )
              )
              AND
              (
                  @SelectedStuffTrace IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffTrace)
                     )
              )
        UNION ALL
        SELECT ii.StuffID,
               sdtb.StockDocumentTypeID,
               ii.MainQuantity AS MainQuantity,
               ii.SubQuantity AS SubQuantity,
               CASE
                   WHEN Revision.RevisionPrice IS NOT NULL THEN
                       Revision.RevisionPrice
                   ELSE
                       ii.Price
               END AS NetPrice
        FROM STC.ReturnedOutgoing i
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
            ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
            INNER JOIN STC.ReturnedOutgoingItem ii
                ON i.ReturnedOutgoingID = ii.ReturnedOutgoingID
            JOIN STC.StockDocumentType sdt
                ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
            JOIN STF.StuffDetail sd
                ON sd.StuffID = ii.StuffID
			JOIN STF.StuffAccountGroup SAG 
				ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
            JOIN STF.[Stuff] AS s
                ON s.StuffID = ii.StuffID
            INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = i.StockID
            INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = i.FinancialPeriodID
            LEFT JOIN
            (
                SELECT ROW_NUMBER() OVER (PARTITION BY ReturnedOutgoingItemID ORDER BY Number DESC) Rno,
                       ReturnedOutgoingItemID,
                       RevisionPrice
                FROM STC.RevisionCost h
                    JOIN STC.RevisionCostItem i
                        ON h.RevisionCostID = i.RevisionCostID
                WHERE ReturnedOutgoingItemID IS NOT NULL
            ) Revision
                ON Rno = 1
                   AND Revision.ReturnedOutgoingItemID = ii.ReturnedOutgoingItemID
        WHERE i.Date
              BETWEEN @FromDate AND @EndDate
              AND SAG.StuffDetailType <> 3
              AND
              (
                  @SelectedStock IS NULL
                  OR i.StockID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStock)
                     )
              )
              AND
              (
                  @SelectedStuffGroup IS NULL
                  OR s.StuffGroupID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffGroup)
                     )
              )
              AND
              (
                  @SelectedStuffAccountGroup IS NULL
                  OR sd.StuffAccountGroupID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffAccountGroup)
                     )
              )
              AND
              (
                  @SelectedStuffTrace IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffTrace)
                     )
              )
        UNION ALL
        SELECT ii.StuffID,
               -1000,
               -ii.MainQuantity AS MainQuantity,
               -ii.SubQuantity AS SubQuantity,
               -1 * CASE
                        WHEN Revision.RevisionPrice IS NOT NULL THEN
                            Revision.RevisionPrice
                        ELSE
                            ii.Cost
                    END AS NetPrice
        FROM POS.PosInvoice i
            INNER JOIN POS.PosInvoiceItem AS ii
                ON i.PosInvoiceID = ii.PosInvoiceID
            JOIN STF.[Stuff] AS s
                ON s.StuffID = ii.StuffID
            JOIN STF.StuffDetail sd
                ON sd.StuffID = ii.StuffID
			JOIN STF.StuffAccountGroup SAG 
				ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
            INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = i.StockID
            INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = i.FinancialPeriodID
            LEFT JOIN
            (
                SELECT ROW_NUMBER() OVER (PARTITION BY r.PosInvoiceItemID ORDER BY Number DESC) Rno,
                       r.PosInvoiceItemID,
                       RevisionPrice
                FROM STC.RevisionCost h
                    JOIN STC.RevisionCostItem r
                        ON h.RevisionCostID = r.RevisionCostID
                WHERE r.PosInvoiceItemID IS NOT NULL
            ) Revision
                ON Rno = 1
                   AND Revision.PosInvoiceItemID = ii.PosInvoiceItemID
        WHERE i.[Date]
              BETWEEN @FromDate AND @EndDate
              AND i.IsReturnInvoice = 0
              AND i.[Status] <> 3
              AND s.[Type] = 0
              AND SAG.StuffDetailType <> 3
              AND
              (
                  @SelectedStock IS NULL
                  OR i.StockID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStock)
                     )
              )
              AND
              (
                  @SelectedStuffGroup IS NULL
                  OR s.StuffGroupID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffGroup)
                     )
              )
              AND
              (
                  @SelectedStuffAccountGroup IS NULL
                  OR sd.StuffAccountGroupID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffAccountGroup)
                     )
              )
              AND
              (
                  @SelectedStuffTrace IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffTrace)
                     )
              )
        UNION ALL
        SELECT ii.StuffID,
               -1000,
               ii.MainQuantity AS MainQuantity,
               ii.SubQuantity AS SubQuantity,
               CASE
                   WHEN Revision.RevisionPrice IS NOT NULL THEN
                       Revision.RevisionPrice
                   ELSE
                       ii.Cost
               END AS NetPrice
        FROM POS.PosInvoice i
            INNER JOIN POS.PosInvoiceItem AS ii
                ON i.PosInvoiceID = ii.PosInvoiceID
            JOIN STF.[Stuff] AS s
                ON s.StuffID = ii.StuffID
            JOIN STF.StuffDetail sd
                ON sd.StuffID = ii.StuffID
			JOIN STF.StuffAccountGroup SAG 
				ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
            INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = i.StockID
            INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = i.FinancialPeriodID
            LEFT JOIN
            (
                SELECT ROW_NUMBER() OVER (PARTITION BY r.PosInvoiceItemID ORDER BY Number DESC) Rno,
                       r.PosInvoiceItemID,
                       RevisionPrice
                FROM STC.RevisionCost h
                    JOIN STC.RevisionCostItem r
                        ON h.RevisionCostID = r.RevisionCostID
                WHERE r.PosInvoiceItemID IS NOT NULL
            ) Revision
                ON Rno = 1
                   AND Revision.PosInvoiceItemID = ii.PosInvoiceItemID
        WHERE i.[Date]
              BETWEEN @FromDate AND @EndDate
              AND i.IsReturnInvoice = 1
              AND i.[Status] <> 3
              AND s.[Type] = 0
              AND SAG.StuffDetailType <> 3
              AND
              (
                  @SelectedStock IS NULL
                  OR i.StockID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStock)
                     )
              )
              AND
              (
                  @SelectedStuffGroup IS NULL
                  OR s.StuffGroupID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffGroup)
                     )
              )
              AND
              (
                  @SelectedStuffAccountGroup IS NULL
                  OR sd.StuffAccountGroupID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffAccountGroup)
                     )
              )
              AND
              (
                  @SelectedStuffTrace IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffTrace)
                     )
              )
    ) A
    GROUP BY A.StuffID,
             A.StockDocumentTypeID;

    SET @query
        = N'
		select s.StuffID, s.code StuffCode,sd.TechnicalCode,
		case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	                when ' + CAST(@CultureNo AS CHAR(1)) + N' = 2 then s.Title2
	           end as StuffTitle ' + @stockQuantityDocumentsTypeSelect + N' ' + @stockPriceDocumentsTypeSelect
          + N' from (
			select 
				StuffID,
				' + @stockDocumentsType
          + N' 
			FROM ( SELECT	StuffID ,
							MainQuantity ,
							StockDocumentTypeID  FROM  #SourceData) a
					PIVOT ( 
						SUM(MainQuantity) 
						FOR StockDocumentTypeID IN ( ' + @stockDocumentsType
          + N')
					) piv
			) q
			join 
			(select 
					StuffID,
					' + +@stockDocumentsType
          + +N' 
				FROM ( SELECT StuffID ,
							  NetPrice ,
							  StockDocumentTypeID  FROM  #SourceData) a
						PIVOT ( 
							SUM(NetPrice) 
							FOR StockDocumentTypeID IN ( ' + @stockDocumentsType
          + N' )
						) piv 
			) a ON  a.StuffID = q.StuffID
			join 
			(select 
					StuffID,
					' + +@stockDocumentsType
          + +N' 
				FROM ( SELECT StuffID ,
							  NetPrice ,
							  StockDocumentTypeID  FROM  #SourceData) a
						PIVOT ( 
							count(NetPrice) 
							FOR StockDocumentTypeID IN ( ' + @stockDocumentsType
          + N' )
						) piv 
			) qty ON  qty.StuffID = q.StuffID

			JOIN STF.VWStuff s on s.StuffID = q.StuffID
			JOIN STF.StuffDetail sd on s.StuffID = sd.StuffID

	';

    PRINT @query;

    EXEC sp_executesql @query,
                       N'
		@FromDate DATE,
		@EndDate DATE',
                       @FromDate = @FromDate,
                       @EndDate = @EndDate;
END;
