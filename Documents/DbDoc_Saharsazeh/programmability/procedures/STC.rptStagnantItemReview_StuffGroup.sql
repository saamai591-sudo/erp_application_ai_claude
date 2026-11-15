------------------------------------------------------------------------------------------------------------------
CREATE   PROCEDURE [STC].rptStagnantItemReview_StuffGroup
(
    @FromDate DATE,
    @EndDate DATE,
    @SelectedStock NVARCHAR(MAX) = NULL,
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
            @stockQuantityDocumentsTypeSelect NVARCHAR(MAX);

    DECLARE @userid INT,
            @FinancialPeriodID INT,
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
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON ro.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
    ) a
    ORDER BY a.StockDocumentTypeID;




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


    SELECT sourceData.StuffGroupID,
           sourceData.MainQuantity,
           sourceData.StockDocumentTypeID,
           sourceData.NetPrice
    INTO #SourceData
    FROM
    (
        SELECT s.StuffGroupID,
               sdt.StockDocumentTypeID,
               ii.MainQuantity,
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
            JOIN STF.Stuff AS s
                ON s.StuffID = ii.StuffID
            JOIN STF.StuffDetail sd
                ON sd.StuffID = ii.StuffID
			JOIN STF.StuffAccountGroup SAG 
				ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
            INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = i.StockID
            INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = i.FinancialPeriodID
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
                  @SelectedStuff IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuff)
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
        SELECT s2.StuffGroupID,
               sdt.StockDocumentTypeID,
               ii.MainQuantity,
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
            JOIN STF.Stuff AS s2
                ON s2.StuffID = ii.StuffID
            INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = i.StockID
            INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = i.FinancialPeriodID
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
                  @SelectedStuff IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuff)
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
        SELECT s3.StuffGroupID,
               sdtb.StockDocumentTypeID,
               -ii.MainQuantity,
               (-1) * CASE
                          WHEN Revision.RevisionPrice IS NOT NULL THEN
                              Revision.RevisionPrice
                          ELSE
                              ii.Price
                      END AS NetPrice
        FROM STC.ReturnStockReceipt i
            INNER JOIN STC.ReturnStockReceiptItem ii
                ON i.ReturnStockReceiptID = ii.ReturnStockReceiptID
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
            ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
            JOIN STF.StuffDetail sd
                ON sd.StuffID = ii.StuffID
			JOIN STF.StuffAccountGroup SAG 
				ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
            JOIN STF.Stuff AS s3
                ON s3.StuffID = ii.StuffID
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
                  @SelectedStock IS NULL
                  OR i.StockID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStock)
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
        SELECT s4.StuffGroupID,
               sdtb.StockDocumentTypeID,
               -ii.MainQuantity,
               (-1) * CASE
                          WHEN Revision.RevisionPrice IS NOT NULL THEN
                              Revision.RevisionPrice
                          ELSE
                              ii.Price
                      END AS NetPrice
        FROM STC.ReturnStockReceipt i
            INNER JOIN STC.ReturnStockReceiptItem ii
                ON i.ReturnStockReceiptID = ii.ReturnStockReceiptID
            JOIN STF.StuffDetail sd
                ON sd.StuffID = ii.StuffID
			JOIN STF.StuffAccountGroup SAG 
				ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
            JOIN STF.Stuff AS s4
                ON s4.StuffID = ii.StuffID
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
            ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
            JOIN STC.StockDocumentType sdt
                ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
            INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = i.StockID
            INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = i.FinancialPeriodID
            LEFT JOIN
            (
                SELECT ROW_NUMBER() OVER (PARTITION BY ir.ReturnStockReceiptItemID ORDER BY h.Number DESC) Rno,
                       ir.ReturnStockReceiptItemID,
                       ir.RevisionPrice
                FROM STC.RevisionCost h
                    JOIN STC.RevisionCostItem ir
                        ON h.RevisionCostID = ir.RevisionCostID
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
                  AND
                  (
                      @SelectedStock IS NULL
                      OR i.StockID IN
                         (
                             SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStock)
                         )
                  )
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuff)
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
        SELECT s5.StuffGroupID,
               sdtb.StockDocumentTypeID,
               -ii.MainQuantity,
               (-1) * CASE
                          WHEN Revision.RevisionPrice IS NOT NULL THEN
                              Revision.RevisionPrice
                          ELSE
                              ii.Price
                      END AS NetPrice
        FROM STC.Outgoing i
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
            INNER JOIN STC.OutgoingItem ii
                ON i.OutgoingID = ii.OutgoingID
            JOIN STF.StuffDetail sd
                ON sd.StuffID = ii.StuffID
			JOIN STF.StuffAccountGroup SAG 
				ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
            JOIN STF.Stuff AS s5
                ON s5.StuffID = ii.StuffID
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
                  @SelectedStuff IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuff)
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
        SELECT s6.StuffGroupID,
               sdtb.StockDocumentTypeID,
               -ii.MainQuantity,
               (-1) * CASE
                          WHEN Revision.RevisionPrice IS NOT NULL THEN
                              Revision.RevisionPrice
                          ELSE
                              ii.Price
                      END AS NetPrice
        FROM STC.Outgoing i
            JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
            INNER JOIN STC.OutgoingItem ii
                ON i.OutgoingID = ii.OutgoingID
            JOIN STF.StuffDetail sd
                ON sd.StuffID = ii.StuffID
			JOIN STF.StuffAccountGroup SAG 
				ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
            JOIN STF.Stuff AS s6
                ON s6.StuffID = ii.StuffID
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
                  @SelectedStock IS NULL
                  OR i.StockID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStock)
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
        SELECT s7.StuffGroupID,
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
            JOIN STF.Stuff AS s7
                ON s7.StuffID = ii.StuffID
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
                  @SelectedStuff IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuff)
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
        SELECT s8.StuffGroupID,
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
            JOIN STF.Stuff AS s8
                ON s8.StuffID = ii.StuffID
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
                  @SelectedStock IS NULL
                  OR i.StockID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStock)
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
        SELECT s.StuffGroupID,
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
                  @SelectedStock IS NULL
                  OR i.StockID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStock)
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
                  @SelectedStuff IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuff)
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
        SELECT s.StuffGroupID,
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
                  @SelectedStock IS NULL
                  OR i.StockID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStock)
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
                  @SelectedStuff IS NULL
                  OR ii.StuffID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuff)
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

    DECLARE @quantityColumnForTable NVARCHAR(MAX),
            @priceColumnForTable NVARCHAR(MAX),
            @resTablename VARCHAR(15);

    SET @resTablename = CFG.getTempTableName(1);

    SELECT @quantityColumnForTable = STUFF(
    (
        SELECT DISTINCT
               ',[SDTQ' + CAST(StockDocumentTypeID AS VARCHAR(5)) + '] Decimal(30,4)'
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


    SELECT @priceColumnForTable
        = STUFF(
    (
        SELECT DISTINCT
               ',[SDTP' + CAST(StockDocumentTypeID AS VARCHAR(5)) + '] Decimal(30,4),[SDTC'
               + CAST(StockDocumentTypeID AS VARCHAR(5)) + '] Decimal(30,4)'
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


    IF @quantityColumnForTable IS NULL
       OR @quantityColumnForTable = ''
    BEGIN
        IF EXISTS (SELECT 1 FROM #selectedStockDocumentType WHERE value = -1000)
            SET @quantityColumnForTable = N',[PosQuantity] Decimal(30,4)';
        ELSE
            SET @quantityColumnForTable = N'';
    END;
    ELSE IF EXISTS (SELECT 1 FROM #selectedStockDocumentType WHERE value = -1000)
        SET @quantityColumnForTable = @quantityColumnForTable + N',[PosQuantity] Decimal(30,4)';


    IF @priceColumnForTable IS NULL
       OR @priceColumnForTable = ''
    BEGIN
        IF EXISTS (SELECT 1 FROM #selectedStockDocumentType WHERE value = -1000)
            SET @priceColumnForTable = N',[PosPrice] Decimal(30,4),[PosCount] Decimal(30,4)';
        ELSE
            SET @priceColumnForTable = N'';
    END;
    ELSE IF EXISTS (SELECT 1 FROM #selectedStockDocumentType WHERE value = -1000)
        SET @priceColumnForTable = @priceColumnForTable + N',[PosPrice] Decimal(30,4),[PosCount] Decimal(30,4)';


    SET @query
        = N'
    CREATE TABLE ' + @resTablename
          + N'
        (
            StuffGroupID INT ,
            ParentID INT ,
            StuffGroupCode NVARCHAR(100) ,
            StuffGroupTitle NVARCHAR(MAX) ' + @quantityColumnForTable + N'  ' + @priceColumnForTable + N'
        )';

    --PRINT @query;
    EXEC (@query);

    DECLARE @quantityselectForWhere NVARCHAR(MAX),
            @priceSelectForWhere NVARCHAR(MAX);

    SELECT @quantityselectForWhere
        = STUFF(
    (
        SELECT DISTINCT
               ', (select sum([SDTQ' + CAST(StockDocumentTypeID AS VARCHAR(5)) + ']) FROM ' + @resTablename
               + ' WHERE  ParentID = a.StuffGroupID )'
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

    IF @quantityselectForWhere IS NULL
       OR @quantityselectForWhere = ''
    BEGIN
        IF EXISTS (SELECT 1 FROM #selectedStockDocumentType WHERE value = -1000)
            SET @quantityselectForWhere
                = N',(select sum([PosQuantity]) FROM ' + @resTablename + N' WHERE  ParentID = a.StuffGroupID )';
        ELSE
            SET @quantityColumnForTable = N'';
    END;
    ELSE IF EXISTS (SELECT 1 FROM #selectedStockDocumentType WHERE value = -1000)
        SET @quantityselectForWhere
            = @quantityselectForWhere + N',(select sum([PosQuantity]) FROM ' + @resTablename
              + N' WHERE  ParentID = a.StuffGroupID )';


    SELECT @priceSelectForWhere
        = STUFF(
    (
        SELECT DISTINCT
               ',(select sum([SDTP' + CAST(StockDocumentTypeID AS VARCHAR(5)) + ']) FROM ' + @resTablename
               + ' WHERE  ParentID = a.StuffGroupID )' + ',(select sum([SDTC' + CAST(StockDocumentTypeID AS VARCHAR(5))
               + ']) FROM ' + @resTablename + ' WHERE  ParentID = a.StuffGroupID )'
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

    IF @priceSelectForWhere IS NULL
       OR @priceSelectForWhere = ''
    BEGIN
        IF EXISTS (SELECT 1 FROM #selectedStockDocumentType WHERE value = -1000)
            SET @priceSelectForWhere
                = N',(select sum([PosPrice]) FROM ' + @resTablename
                  + N' WHERE  ParentID = a.StuffGroupID ) 
										,(select sum([PosCount]) FROM ' + @resTablename
                  + N' WHERE  ParentID = a.StuffGroupID ) ';
        ELSE
            SET @priceSelectForWhere = N'';
    END;
    ELSE IF EXISTS (SELECT 1 FROM #selectedStockDocumentType WHERE value = -1000)
        SET @priceSelectForWhere
            = @priceSelectForWhere + N',(select sum([PosPrice]) FROM ' + @resTablename
              + N' WHERE  ParentID = a.StuffGroupID ) 
								  ,(select sum([PosCount]) FROM ' + @resTablename
              + N' WHERE  ParentID = a.StuffGroupID ) ';

    SET @query
        = N'INSERT INTO ' + @resTablename
          + N' 
		SELECT s.StuffGroupID,s.ParentID, s.code StuffGroupCode,
		case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	         when ' + CAST(@CultureNo AS CHAR(1)) + N' = 2 then s.Title2
	    end as StuffGroupTitle,' + @stockQuantityDocumentsTypeSelect + N',' + @stockPriceDocumentsTypeSelect
          + N'
			 FROM (
			SELECT 
				StuffGroupID,
				' + @stockDocumentsType
          + N' 
			FROM ( SELECT	StuffGroupID ,
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
					StuffGroupID,
					' + @stockDocumentsType
          + N' 
				FROM ( SELECT StuffGroupID ,
							  NetPrice ,
							  StockDocumentTypeID  FROM  #SourceData
									) a
						PIVOT ( 
							SUM(NetPrice) 
							FOR StockDocumentTypeID IN ( ' + @stockDocumentsType
          + N' )
						) piv 
			) a ON  a.StuffGroupID = q.StuffGroupID
			JOIN 
			(select 
					StuffGroupID,
					' + @stockDocumentsType
          + N' 
				FROM ( SELECT StuffGroupID ,
							  NetPrice ,
							  StockDocumentTypeID  FROM  #SourceData) a
						PIVOT ( 
							count(NetPrice) 
							FOR StockDocumentTypeID IN ( ' + @stockDocumentsType
          + N' )
						) piv 
			) QTY ON  QTY.StuffGroupID = q.StuffGroupID
		JOIN stf.StuffGroup s on s.StuffGroupID = q.StuffGroupID;


		WHILE @@ROWCOUNT <> 0
        BEGIN
		--print 11111
            INSERT INTO ' + @resTablename
          + N' 
                        SELECT a.StuffGroupID ,
                               a.ParentID ,
                               a.Code ,
							   case when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 1 then a.Title
	                                when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then a.Title2
	                           end ' + @quantityselectForWhere + N' ' + @priceSelectForWhere
          + N'FROM   STF.StuffGroup a
					WHERE  a.StuffGroupID IN (   SELECT ParentID FROM  ' + @resTablename
          + N' ) AND NOT EXISTS (   SELECT 1 FROM   ' + @resTablename
          + N' WHERE  a.StuffGroupID = StuffGroupID )
        END;
	';

    EXEC sp_executesql @query,
                       N'
		@FromDate DATE,
		@ToDate DATE,
		@selectedStockDocumentTypes NVARCHAR(MAX)',
                       @FromDate = @FromDate,
                       @ToDate = @EndDate,
                       @selectedStockDocumentTypes = @selectedStockDocumentTypes;


    SET @query = N'SELECT * FROM ' + @resTablename;
    EXEC (@query);
END;

