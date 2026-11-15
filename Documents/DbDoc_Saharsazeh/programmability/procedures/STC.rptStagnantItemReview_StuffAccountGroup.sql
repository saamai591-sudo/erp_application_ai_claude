------------------------------------------------------------------------------------------------------------------
CREATE   PROC [STC].rptStagnantItemReview_StuffAccountGroup
(
    @FromDate DATE,
    @EndDate DATE,
    @SelectedStock NVARCHAR(MAX) = NULL,
    @SelectedStuffGroup NVARCHAR(MAX) = NULL,
    @SelectedStuff NVARCHAR(MAX) = NULL,
    @SelectedStuffTrace NVARCHAR(MAX) = NULL,
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
        SELECT StockDocumentTypeID
        FROM STC.StockReceipt sr
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
            ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
        UNION
        SELECT StockDocumentTypeID
        FROM STC.ReturnStockReceipt rsr
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
            ON rsr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
        UNION
        SELECT StockDocumentTypeID
        FROM STC.Outgoing o
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
            ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
        UNION
        SELECT StockDocumentTypeID
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
    BEGIN
        IF EXISTS
        (
            SELECT 1
            FROM #selectedStockDocumentType AS ssdt
            WHERE ssdt.value = -1000
        )
            SET @stockDocumentsType = N'[-1000]';
        ELSE
            SET @stockDocumentsType = N'';
    END;
    ELSE IF EXISTS
    (
        SELECT 1
        FROM #selectedStockDocumentType AS ssdt
        WHERE ssdt.value = -1000
    )
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

    SELECT sd.StuffAccountGroupID,
           A.StockDocumentTypeID,
           A.MainQuantity,
           A.SubQuantity,
           A.NetPrice
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
            JOIN STF.Stuff AS s
                ON s.StuffID = ii.StuffID
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
            JOIN STF.Stuff AS s
                ON s.StuffID = ii.StuffID
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
              AND i.Date < @FromDate
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
            JOIN STF.Stuff AS s
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
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
            INNER JOIN STC.OutgoingItem ii
                ON i.OutgoingID = ii.OutgoingID
            JOIN STC.StockDocumentType sdt
                ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
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
            ) Revision
                ON Rno = 1
                   AND Revision.OutgoingItemID = ii.OutgoingItemID
        WHERE i.Date
              BETWEEN @FromDate AND @EndDate
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
            INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = i.StockID
            INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = i.FinancialPeriodID
            JOIN STF.Stuff AS s
                ON s.StuffID = ii.StuffID
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
        FROM POS.PosInvoice AS i
            INNER JOIN POS.PosInvoiceItem AS ii
                ON i.PosInvoiceID = ii.PosInvoiceID
            JOIN STF.Stuff AS s
                ON s.StuffID = ii.StuffID
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
        FROM POS.PosInvoice AS i
            INNER JOIN POS.PosInvoiceItem AS ii
                ON i.PosInvoiceID = ii.PosInvoiceID
            JOIN STF.Stuff AS s2
                ON s2.StuffID = ii.StuffID
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
              AND i.IsReturnInvoice = 1
              AND i.[Status] <> 3
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
                  OR s2.StuffGroupID IN
                     (
                         SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedStuffGroup)
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
    ) A
        JOIN STF.Stuff s
            ON s.StuffID = A.StuffID
        JOIN STF.StuffDetail sd
            ON sd.StuffID = s.StuffID
		JOIN STF.StuffAccountGroup SAG 
			ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
    WHERE SAG.StuffDetailType <> 3
          AND s.[Type] = 0;

    SET @query
        = N'
		select sa.StuffAccountGroupID, sa.code StuffAccountGroupCode,
		case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then sa.Title
	                when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then sa.Title2
	           end as StuffAccountGroupTitle' + @stockQuantityDocumentsTypeSelect + N' '
          + @stockPriceDocumentsTypeSelect + N' from (
			select 
				StuffAccountGroupID,
				' + @stockDocumentsType
          + N' 
			FROM ( SELECT	StuffAccountGroupID ,
							MainQuantity ,
							StockDocumentTypeID  FROM  #SourceData) item
					PIVOT ( 
						SUM(MainQuantity) 
						FOR StockDocumentTypeID IN ( ' + @stockDocumentsType
          + N')
					) piv
			) q
			join 
			(select 
					StuffAccountGroupID,
					' + +@stockDocumentsType
          + +N' 
				FROM ( SELECT StuffAccountGroupID ,
							  NetPrice ,
							  StockDocumentTypeID  FROM  #SourceData) amount
						PIVOT ( 
							SUM(NetPrice) 
							FOR StockDocumentTypeID IN ( ' + @stockDocumentsType
          + N' )
						) piv 
			) a ON  a.StuffAccountGroupID = q.StuffAccountGroupID
			join 
			(select 
					StuffAccountGroupID,
					' + +@stockDocumentsType
          + +N' 
				FROM ( SELECT StuffAccountGroupID ,
							  NetPrice ,
							  StockDocumentTypeID  FROM  #SourceData) a
						PIVOT ( 
							count(NetPrice) 
							FOR StockDocumentTypeID IN ( ' + @stockDocumentsType
          + N' )
						) piv 
			) qty ON  qty.StuffAccountGroupID = q.StuffAccountGroupID
			JOIN STF.StuffAccountGroup sa on sa.StuffAccountGroupID = q.StuffAccountGroupID
	';

    --PRINT @query;

    EXEC sp_executesql @query,
                       N'
		@FromDate DATE,
		@EndDate DATE',
                       @FromDate = @FromDate,
                       @EndDate = @EndDate;
END;


