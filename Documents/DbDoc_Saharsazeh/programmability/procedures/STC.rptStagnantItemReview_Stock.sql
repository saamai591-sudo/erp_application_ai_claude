------------------------------------------------------------------------------------------------------------------
CREATE   PROC [STC].rptStagnantItemReview_Stock
(
    @FromDate DATE,
    @EndDate DATE,
    @SelectedStuffGroup NVARCHAR(MAX) = NULL,
    @SelectedStuffAccountGroup NVARCHAR(MAX) = NULL,
    @SelectedStuff NVARCHAR(MAX) = NULL,
    @SelectedStuffTrace NVARCHAR(MAX) = NULL,
    @selectedStockDocumentTypes NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @stockDocumentsType NVARCHAR(MAX),
            @stockPriceDocumentsTypeSelect NVARCHAR(MAX),
            @stockQuantityDocumentsTypeSelect NVARCHAR(MAX),
            @userid INT,
            @FinancialPeriodID INT,
            @Culture VARCHAR(25),
            @CultureNo TINYINT;

    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    SET @userid = CFG.GetuserID();

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
        SELECT  sdtb.StockDocumentTypeID
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
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
            ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
        UNION
        SELECT sdtb.StockDocumentTypeID
        FROM STC.ReturnedOutgoing ro
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
            ON ro.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
    ) a
    ORDER BY a.StockDocumentTypeID;

    IF EXISTS
    (
        SELECT 1
        FROM #selectedStockDocumentType AS ssdt
        WHERE ssdt.value = -1000
    )
        INSERT #existStockDocumentType
        (
            StockDocumentTypeID
        )
        VALUES
        (-1000);

    SELECT @stockDocumentsType = STUFF(
    (
        SELECT DISTINCT
               ',' + QUOTENAME(CAST(StockDocumentTypeID AS VARCHAR(5)))
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
    1   ,
    ''
                                      );

    IF @stockDocumentsType IS NULL
       OR @stockDocumentsType = ''
        SET @stockDocumentsType = N'[-1000]';
    ELSE
        SET @stockDocumentsType = @stockDocumentsType + N', [-1000]';

    DECLARE @query NVARCHAR(MAX),
            @totalAmount NVARCHAR(MAX),
            @totalQuantity NVARCHAR(MAX);

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
    1   ,
    ''
               );

    SELECT @totalAmount = STUFF(
    (
        SELECT DISTINCT
               '+ ISNULL(a.' + QUOTENAME(CAST(StockDocumentTypeID AS VARCHAR(5))) + ', 0)  '
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
    1   ,
    ''
                               );

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
    1   ,
    ''
               );

    SELECT @totalQuantity = STUFF(
    (
        SELECT DISTINCT
               '+ ISNULL(q.' + QUOTENAME(CAST(StockDocumentTypeID AS VARCHAR(5))) + ', 0)  '
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
    1   ,
    ''
                                 );

    IF @totalAmount = NULL
       OR @totalAmount = ''
    BEGIN
        IF EXISTS (SELECT 1 FROM #selectedStockDocumentType WHERE value = -1000)
            SET @totalAmount = N'ISNULL(a.[-1000],0)';
        ELSE
            SET @totalAmount = N'';
    END;
    ELSE
    BEGIN
        IF EXISTS (SELECT 1 FROM #selectedStockDocumentType WHERE value = -1000)
            SET @totalAmount = @totalAmount + N' + ISNULL(a.[-1000],0)';
    END;


    IF @totalQuantity = NULL
       OR @totalQuantity = ''
    BEGIN
        IF EXISTS (SELECT 1 FROM #selectedStockDocumentType WHERE value = -1000)
            SET @totalQuantity = N'ISNULL(q.[-1000],0)';
        ELSE
            SET @totalAmount = N'';
    END;
    ELSE IF EXISTS (SELECT 1 FROM #selectedStockDocumentType WHERE value = -1000)
        SET @totalQuantity = @totalQuantity + N' + ISNULL(q.[-1000],0)';

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

    SELECT sourceData.StockID,
           sourceData.MainQuantity,
           sourceData.StockDocumentTypeID,
           sourceData.NetPrice
    INTO #SourceData
    FROM
    (
        SELECT sr.StockID,
               sdt.StockDocumentTypeID,
               ii.MainQuantity,
               CASE
                   WHEN Revision.RevisionPrice IS NOT NULL THEN
                       Revision.RevisionPrice
                   ELSE
                       ii.NetPrice
               END AS NetPrice
        FROM STC.StockReceipt sr
            INNER JOIN STC.StockReceiptItem ii
                ON sr.StockReceiptID = ii.StockReceiptID
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
            ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
            JOIN STC.StockDocumentType sdt
                ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
            JOIN STF.StuffDetail sd
                ON sd.StuffID = ii.StuffID
			JOIN STF.StuffAccountGroup SAG 
				ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
            JOIN STF.Stuff AS s
                ON s.StuffID = ii.StuffID
            INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = sr.StockID
            INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = sr.FinancialPeriodID
            LEFT JOIN
            (
                SELECT ROW_NUMBER() OVER (PARTITION BY StockReceiptItemID ORDER BY Number DESC) Rno,
                       i.StockReceiptItemID,
                       RevisionPrice
                FROM STC.RevisionCost h
                    JOIN STC.RevisionCostItem i
                        ON h.RevisionCostID = i.RevisionCostID
                WHERE StockReceiptItemID IS NOT NULL
                      AND FinancialPeriodID = @FinancialPeriodID
            ) Revision
                ON Rno = 1
                   AND Revision.StockReceiptItemID = ii.StockReceiptItemID
        WHERE sr.FinancialPeriodID = @FinancialPeriodID
              AND SAG.StuffDetailType <> 3
              AND
              (
                  sr.Date < @FromDate
                  OR sdt.DocumentType = 7
              )
              AND
              (
                  @SelectedStuff IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuff)
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
        SELECT sr.StockID,
               sdt.StockDocumentTypeID,
               ii.MainQuantity,
               CASE
                   WHEN Revision.RevisionPrice IS NOT NULL THEN
                       Revision.RevisionPrice
                   ELSE
                       ii.NetPrice
               END AS NetPrice
        FROM STC.StockReceipt sr
            INNER JOIN STC.StockReceiptItem ii
                ON sr.StockReceiptID = ii.StockReceiptID
            JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
            JOIN STC.StockDocumentType sdt
                ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
            JOIN STF.StuffDetail sd
                ON sd.StuffID = ii.StuffID
			JOIN STF.StuffAccountGroup SAG 
				ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
            JOIN STF.Stuff AS s
                ON s.StuffID = ii.StuffID
            INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = sr.StockID
            INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = sr.FinancialPeriodID
            LEFT JOIN
            (
                SELECT ROW_NUMBER() OVER (PARTITION BY StockReceiptItemID ORDER BY Number DESC) Rno,
                       i.StockReceiptItemID,
                       RevisionPrice
                FROM STC.RevisionCost h
                    JOIN STC.RevisionCostItem i
                        ON h.RevisionCostID = i.RevisionCostID
                WHERE StockReceiptItemID IS NOT NULL
            ) Revision
                ON Rno = 1
                   AND Revision.StockReceiptItemID = ii.StockReceiptItemID
        WHERE sr.Date
              BETWEEN @FromDate AND @EndDate
              AND SAG.StuffDetailType <> 3
              AND sdt.DocumentType <> 7
              AND
              (
                  @SelectedStuff IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuff)
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
        SELECT i.StockID,
               sdtb.StockDocumentTypeID,
               -ii.MainQuantity,
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
            JOIN STF.Stuff AS s
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
              AND SAG.StuffDetailType <> 3
              AND i.[Date] < @FromDate
              AND
              (
                  @SelectedStuff IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuff)
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
        SELECT i.StockID,
               sdtb.StockDocumentTypeID,
               -ii.MainQuantity,
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
            JOIN STF.Stuff AS s
                ON s.StuffID = ii.StuffID
            JOIN STC.StockDocumentType sdt
                ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
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
                  @SelectedStuff IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuff)
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
        SELECT i.StockID,
               sdtb.StockDocumentTypeID,
               -ii.MainQuantity,
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
            JOIN STF.Stuff AS s
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
                  @SelectedStuff IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuff)
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
        SELECT i.StockID,
               sdtb.StockDocumentTypeID,
               -ii.MainQuantity,
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
            JOIN STF.Stuff AS s
                ON s.StuffID = ii.StuffID
            JOIN STC.StockDocumentType sdt
                ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
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
            ) Revision
                ON Rno = 1
                   AND Revision.OutgoingItemID = ii.OutgoingItemID
        WHERE i.Date
              BETWEEN @FromDate AND @EndDate
              AND SAG.StuffDetailType <> 3
              AND
              (
                  @SelectedStuff IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuff)
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
        SELECT i.StockID,
               sdtb.StockDocumentTypeID,
               ii.MainQuantity,
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
            JOIN STF.Stuff AS s
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
                  @SelectedStuff IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuff)
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
        SELECT i.StockID,
               sdtb.StockDocumentTypeID,
               ii.MainQuantity,
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
            JOIN STF.Stuff AS s
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
        WHERE i.[Date]
              BETWEEN @FromDate AND @EndDate
              AND SAG.StuffDetailType <> 3
              AND
              (
                  @SelectedStuff IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuff)
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
        SELECT i.StockID,
               -1000,
               -ii.MainQuantity AS MainQuantity,
               -1 * CASE
                        WHEN Revision.RevisionPrice IS NOT NULL THEN
                            Revision.RevisionPrice
                        ELSE
                            ii.Cost
                    END AS NetPrice
        FROM POS.PosInvoice AS i
            INNER JOIN POS.PosInvoiceItem AS ii
                ON i.PosInvoiceID = ii.PosInvoiceID
            JOIN [STF].[Stuff] AS [s]
                ON s.StuffID = ii.StuffID
            JOIN STF.StuffDetail AS sd
                ON sd.StuffID = s.StuffID
            INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = i.StockID
            INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = i.FinancialPeriodID
            LEFT JOIN
            (
                SELECT ROW_NUMBER() OVER (PARTITION BY PosInvoiceItemID ORDER BY Number DESC) Rno,
                       PosInvoiceItemID,
                       RevisionPrice
                FROM STC.RevisionCost h
                    JOIN STC.RevisionCostItem r
                        ON h.RevisionCostID = r.RevisionCostID
                WHERE r.PosInvoiceItemID IS NOT NULL
            ) Revision
                ON Rno = 1
                   AND Revision.PosInvoiceItemID = ii.PosInvoiceItemID
        WHERE i.Date
              BETWEEN @FromDate AND @EndDate
              AND i.IsReturnInvoice = 0
              AND i.[Status] <> 3
              AND [s].[Type] = 0
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
                  @SelectedStuff IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuff)
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
                  @SelectedStuffTrace IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffTrace)
                     )
              )
        UNION ALL
        SELECT i.StockID,
               -1000,
               ii.MainQuantity AS MainQuantity,
               CASE
                   WHEN Revision.RevisionPrice IS NOT NULL THEN
                       Revision.RevisionPrice
                   ELSE
                       ii.Cost
               END AS NetPrice
        FROM POS.PosInvoice AS i
            INNER JOIN POS.PosInvoiceItem AS ii
                ON i.PosInvoiceID = ii.PosInvoiceID
            JOIN [STF].[Stuff] AS [s]
                ON s.StuffID = ii.StuffID
            JOIN STF.StuffDetail AS sd
                ON sd.StuffID = s.StuffID
            INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = i.StockID
            INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = i.FinancialPeriodID
            LEFT JOIN
            (
                SELECT ROW_NUMBER() OVER (PARTITION BY PosInvoiceItemID ORDER BY Number DESC) Rno,
                       PosInvoiceItemID,
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
              AND [s].[Type] = 0
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
                  @SelectedStuff IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuff)
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
                  @SelectedStuffTrace IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffTrace)
                     )
              )
    ) sourceData;


    SET @query
        = N'
		SELECT s.StockID, s.code StockCode,
		case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	         when ' + CAST(@CultureNo AS CHAR(1)) + N' = 2 then s.Title2
	    end as StockTitle,' + @stockQuantityDocumentsTypeSelect + N',' + @stockPriceDocumentsTypeSelect
          + N'
			 FROM (
			SELECT 
				StockID,
				' + @stockDocumentsType
          + N' 
			FROM ( SELECT	StockID ,
							MainQuantity ,
							StockDocumentTypeID  FROM  #SourceData							
							) a
					PIVOT ( 
						SUM(MainQuantity) 
						FOR StockDocumentTypeID IN ( ' + @stockDocumentsType
          + N')
					) piv
			) q
			JOIN 
			(select 
					StockID,
					' + @stockDocumentsType
          + N' 
				FROM ( SELECT StockID ,
							  NetPrice ,
							  StockDocumentTypeID  FROM  #SourceData
									) a
						PIVOT ( 
							SUM(NetPrice) 
							FOR StockDocumentTypeID IN ( ' + @stockDocumentsType
          + N' )
						) piv 
			) a ON  a.StockID = q.StockID
			JOIN 
			(select 
					StockID,
					' + @stockDocumentsType
          + N' 
				FROM ( SELECT StockID ,
							  NetPrice ,
							  StockDocumentTypeID  FROM  #SourceData) a
						PIVOT ( 
							count(NetPrice) 
							FOR StockDocumentTypeID IN ( ' + @stockDocumentsType
          + N' )
						) piv 
			) QTY ON  QTY.StockID = q.StockID
		JOIN stf.stock s on s.StockID = q.StockID
	';

    PRINT @query;

    EXEC sp_executesql @query,
                       N'
		@FromDate DATE,
		@ToDate DATE,
		@selectedStockDocumentTypes NVARCHAR(MAX)',
                       @FromDate = @FromDate,
                       @ToDate = @EndDate,
                       @selectedStockDocumentTypes = @selectedStockDocumentTypes;
END;

