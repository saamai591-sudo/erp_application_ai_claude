-----------------------------------------------------------------------------------------------------------------
CREATE   PROCEDURE [STC].rptStagnantItemReview_StuffTrace
(
    @FromDate DATE,
    @EndDate DATE,
    @SelectedStock NVARCHAR(MAX) = NULL,
    @SelectedStuff NVARCHAR(MAX) = NULL,
    @SelectedStuffGroup NVARCHAR(MAX) = NULL,
    @SelectedStuffAccountGroup NVARCHAR(MAX) = NULL,
    @selectedStockDocumentTypes NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @userid INT,
            @FinancialPeriodID INT,
            @stockDocumentsType NVARCHAR(MAX),
            @stockPriceDocumentsTypeSelect NVARCHAR(MAX),
            @stockQuantityDocumentsTypeSelect NVARCHAR(MAX);

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
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
            ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
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



    DECLARE @tableName NVARCHAR(200),
            @LeftJoin NVARCHAR(MAX),
            @Columns NVARCHAR(MAX),
            @FinancialPeriod INT,
            @DateType VARCHAR(10),
            @DateFormat VARCHAR(10),
            @Culture VARCHAR(10),
            @CodeAndTitleColumn NVARCHAR(MAX),
            @SelectColumns NVARCHAR(MAX),
            @CultureNo TINYINT;

    SET @Culture = CFG.GetuserCulture();
    SET @tableName = CFG.getTempTableName(1);

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    SELECT @FinancialPeriod = FinancialPeriodID
    FROM CFG.FinancialPeriod
    WHERE @FromDate
    BETWEEN StartDate AND EndDate;

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @userid;

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
          AND us.UserID = @userid;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    --DECLARE  ,
    --         ,
    --         ,
    --        @ColumnsInCreateTable NVARCHAR(MAX) ,
    --        ;


    SELECT @CodeAndTitleColumn
        = STUFF(
    (
        SELECT DISTINCT
               ' ,d' + CAST(TraceID AS VARCHAR(10)) + '.Code [TR_' + CAST(TraceID AS VARCHAR(10)) + 'Code],d'
               + CAST(TraceID AS VARCHAR(10)) + '.Title [TR_' + CAST(TraceID AS VARCHAR(10)) + 'Title]'
        FROM STF.Trace
        WHERE DlTypeID IS NOT NULL
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );

			   

    IF (@CodeAndTitleColumn IS NULL)
        SET @CodeAndTitleColumn = N'';

    SELECT @LeftJoin
        = STUFF(
    (
        SELECT DISTINCT
               ' Left Join acc.dl d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10))
               + '.DlID = Quantity.T' + CAST(TraceID AS VARCHAR(10))
        FROM STF.Trace
        WHERE DlTypeID IS NOT NULL
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );

    IF (@LeftJoin IS NULL)
        SET @LeftJoin = N'';

    SELECT @SelectColumns = STUFF(
    (
        SELECT DISTINCT
               ',' + QUOTENAME(TraceID) + ' AS T' + CAST(TraceID AS NVARCHAR(10))
        FROM STF.Trace
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                                 );

    IF (@SelectColumns IS NULL)
        SET @SelectColumns = N'[-1]';


    SELECT @Columns = STUFF(
    (
        SELECT DISTINCT
               ',' + QUOTENAME(TraceID)
        FROM STF.Trace
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                           );

    IF (@Columns IS NULL)
        SET @Columns = N'[-1]';


    SET @query
        = N'
    SELECT  *
    INTO    ' + @tableName
          + N'
    FROM    ( SELECT    ii.StuffID ,
						sdtb.StockDocumentTypeID,
                        ii.MainQuantity AS MainQuantity ,
                        ii.SubQuantity AS SubQuantity ,
                        CASE WHEN Revision.RevisionPrice IS NOT NULL
                             THEN Revision.RevisionPrice
                             ELSE ii.NetPrice
                        END AS NetPrice ,
						' + @Columns
          + N'
              FROM      STC.StockReceipt i
                        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
                            ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                        INNER JOIN STC.StockReceiptItem ii ON i.StockReceiptID = ii.StockReceiptID
                        JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
						JOIN STF.StuffDetail sd ON sd.StuffID = ii.StuffID
						JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
						join stf.stuff s on s.stuffId = sd.StuffID
						INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = i.StockID
						INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = i.FinancialPeriodID						
                        LEFT JOIN ( SELECT  ROW_NUMBER() OVER ( PARTITION BY StockReceiptItemID ORDER BY Number DESC ) Rno ,
                                            i.StockReceiptItemID ,
                                            RevisionPrice
                                    FROM    STC.RevisionCost h
                                            JOIN STC.RevisionCostItem i ON h.RevisionCostID = i.RevisionCostID
                                    WHERE   StockReceiptItemID IS NOT NULL
                                            AND FinancialPeriodID = @FinancialPeriod
                                  ) Revision ON Rno = 1
                                                AND Revision.StockReceiptItemID = ii.StockReceiptItemID
						LEFT JOIN (
									select StockReceiptItemID,iit.TraceID,case when AccountLevelTypeID = 1 then 
										cast (DLID as nvarchar(max))
									  when AccountLevelTypeID = 5 then  
										CFG.GetCLRSaturnDate(value,''' + @DateFormat + N'''  , 0,''' + @DateType
          + N''')
									  else 
										Value end value
									 from STC.StockReceiptItemTrace iit
									 join stf.trace t on t.traceid = iit.traceid
								 )x pivot
								(
								max(value)
								for traceid in (' + @Columns
          + N')
								)p on p.StockReceiptItemID = ii.StockReceiptItemID 
              WHERE     i.financialperiodid = @FinancialPeriod
						AND SAG.StuffDetailType <> 3
                        AND ( i.date < @FromDate
                              OR sdt.DocumentType = 7
                            )
                        AND ( @SelectedStock IS NULL
                              OR i.StockID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStock) )
                            )
                        AND ( @SelectedStuffGroup IS NULL
                              OR s.StuffGroupID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuffGroup) )
                            )
                        AND ( @SelectedStuff IS NULL
                              OR ii.StuffID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuff) )
                            )
                        AND ( @SelectedStuffAccountGroup IS NULL
                              OR sd.StuffAccountGroupID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuffAccountGroup) )
                            )
                     
              UNION ALL
              SELECT    ii.StuffID ,
						sdtb.StockDocumentTypeID,
                        ii.MainQuantity AS MainQuantity ,
                        ii.SubQuantity AS SubQuantity ,
                        CASE WHEN Revision.RevisionPrice IS NOT NULL
                             THEN Revision.RevisionPrice
                             ELSE ii.NetPrice
                        END AS NetPrice ,
						' + @Columns
          + N'
              FROM      STC.StockReceipt i
                        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
                            ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                        INNER JOIN STC.StockReceiptItem ii ON i.StockReceiptID = ii.StockReceiptID
                        JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
						JOIN STF.StuffDetail sd ON sd.StuffID = ii.StuffID
						JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
						join stf.stuff s on s.stuffId = sd.StuffID
						INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = i.StockID
						INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = i.FinancialPeriodID
						LEFT JOIN ( SELECT  ROW_NUMBER() OVER ( PARTITION BY StockReceiptItemID ORDER BY Number DESC ) Rno ,
                                            StockReceiptItemID ,
                                            RevisionPrice
                                    FROM    STC.RevisionCost h
                                            JOIN STC.RevisionCostItem i ON h.RevisionCostID = i.RevisionCostID
                                    WHERE   StockReceiptItemID IS NOT NULL
                                  ) Revision ON Rno = 1
                                                AND Revision.StockReceiptItemID = ii.StockReceiptItemID
						LEFT JOIN (
									select StockReceiptItemID,iit.TraceID,case when AccountLevelTypeID = 1 then 
										cast (DLID as nvarchar(max))
									  when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat
          + N'''  , 0,''' + @DateType
          + N''')
									  else Value end value
									 from STC.StockReceiptItemTrace iit
									 join stf.trace t on t.traceid = iit.traceid
								 )x 
								 pivot
								 (
								 	max(value)
								 	for traceid in (' + @Columns
          + N')
								 )p on p.StockReceiptItemID = ii.StockReceiptItemID 
              WHERE     i.date BETWEEN @FromDate AND @EndDate
						AND SAG.StuffDetailType <> 3
                        AND sdt.DocumentType <> 7
                        AND ( @SelectedStock IS NULL
                              OR i.StockID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStock) )
                            )
						AND ( @SelectedStuffGroup IS NULL
                              OR s.StuffGroupID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuffGroup) )
                            )
                        AND ( @SelectedStuff IS NULL
                              OR ii.StuffID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuff) )
                            )
                        AND ( @SelectedStuffAccountGroup IS NULL
                              OR sd.StuffAccountGroupID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuffAccountGroup) )
                            )
              UNION ALL
              SELECT    ii.StuffID ,
						sdtb.StockDocumentTypeID,
                        -ii.MainQuantity AS MainQuantity ,
                        -ii.SubQuantity AS SubQuantity ,
                        ( -1 )
                        * CASE WHEN Revision.RevisionPrice IS NOT NULL
                               THEN Revision.RevisionPrice
                               ELSE ii.Price
                          END AS NetPrice ,
						' + @Columns
          + N'
              FROM      STC.ReturnStockReceipt i
                        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
                            ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                        INNER JOIN STC.ReturnStockReceiptItem ii ON i.ReturnStockReceiptID = ii.ReturnStockReceiptID
						JOIN STF.StuffDetail sd ON sd.StuffID = ii.StuffID
						JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
						join stf.stuff s on s.stuffId = sd.StuffID
						INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = i.StockID
						INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = i.FinancialPeriodID                       
						LEFT JOIN ( SELECT  ROW_NUMBER() OVER ( PARTITION BY ReturnStockReceiptItemID ORDER BY Number DESC ) Rno ,
                                            i.ReturnStockReceiptItemID ,
                                            RevisionPrice
                                    FROM    STC.RevisionCost h
                                            JOIN STC.RevisionCostItem i ON h.RevisionCostID = i.RevisionCostID
                                    WHERE   ReturnStockReceiptItemID IS NOT NULL
                                            AND FinancialPeriodID = @FinancialPeriod
                                  ) Revision ON Rno = 1
                                                AND Revision.ReturnStockReceiptItemID = ii.ReturnStockReceiptItemID
						LEFT JOIN (
								select ReturnStockReceiptItemID,iit.TraceID,case when AccountLevelTypeID = 1 then 
									cast (DLID as nvarchar(max))
								  when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat
          + N'''  , 0,''' + @DateType
          + N''')
								  else Value end value
								 from STC.ReturnStockReceiptItemTrace iit
								 join stf.trace t on t.traceid = iit.traceid
								 )x 
								 pivot
								(
									max(value)
									for traceid in (' + @Columns
          + N')
								)p on p.ReturnStockReceiptItemID = ii.ReturnStockReceiptItemID 
						
              WHERE     i.financialperiodid = @FinancialPeriod
						AND SAG.StuffDetailType <> 3
                        AND i.date < @FromDate
                        AND ( @SelectedStock IS NULL
                              OR i.StockID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStock) )
                            )
						AND ( @SelectedStuffGroup IS NULL
                              OR s.StuffGroupID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuffGroup) )
                            )
                        AND ( @SelectedStuff IS NULL
                              OR ii.StuffID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuff) )
                            )
                        AND ( @SelectedStuffAccountGroup IS NULL
                              OR sd.StuffAccountGroupID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuffAccountGroup) )
                            )
              UNION ALL
              SELECT    ii.StuffID ,
						sdtb.StockDocumentTypeID,
                        -ii.MainQuantity AS MainQuantity ,
                        -ii.SubQuantity AS SubQuantity ,
                        ( -1 )
                        * CASE WHEN Revision.RevisionPrice IS NOT NULL
                               THEN Revision.RevisionPrice
                               ELSE ii.Price
                          END AS NetPrice ,
						' + @Columns
          + N'
              FROM      STC.ReturnStockReceipt i
                        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
                            ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                        INNER JOIN STC.ReturnStockReceiptItem ii ON i.ReturnStockReceiptID = ii.ReturnStockReceiptID
                        JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
						JOIN STF.StuffDetail sd ON sd.StuffID = ii.StuffID
						JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
						join stf.stuff s on s.stuffId = sd.StuffID
						INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = i.StockID
						INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = i.FinancialPeriodID                        
						LEFT JOIN ( SELECT  ROW_NUMBER() OVER ( PARTITION BY ReturnStockReceiptItemID ORDER BY Number DESC ) Rno ,
                                            ReturnStockReceiptItemID ,
                                            RevisionPrice
                                    FROM    STC.RevisionCost h
                                            JOIN STC.RevisionCostItem i ON h.RevisionCostID = i.RevisionCostID
                                    WHERE   ReturnStockReceiptItemID IS NOT NULL
                                            --AND FinancialPeriodID = @FinicialPeriodID
                                  ) Revision ON Rno = 1
                                                AND Revision.ReturnStockReceiptItemID = ii.ReturnStockReceiptItemID
						LEFT JOIN (
								select ReturnStockReceiptItemID,iit.TraceID,case when AccountLevelTypeID = 1 then 
									cast (DLID as nvarchar(max))
								  when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat
          + N'''  , 0,''' + @DateType
          + N''')
								  else Value end value
								 from STC.ReturnStockReceiptItemTrace iit
								 join stf.trace t on t.traceid = iit.traceid
								 )x 
								 pivot
								(
									max(value)
									for traceid in (' + @Columns
          + N')
								)p on p.ReturnStockReceiptItemID = ii.ReturnStockReceiptItemID 
						
              WHERE    i.date BETWEEN @FromDate AND @EndDate
						AND SAG.StuffDetailType <> 3
                        AND ( @SelectedStuff IS NULL
                              OR ii.StuffID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuff) )
                            )
						AND ( @SelectedStuffGroup IS NULL
                              OR s.StuffGroupID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuffGroup) )
                            )
                        AND ( @SelectedStock IS NULL
                              OR i.StockID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStock) )
                            )
                        AND ( @SelectedStuffAccountGroup IS NULL
                              OR sd.StuffAccountGroupID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuffAccountGroup) )
                            )
              UNION ALL
              SELECT    ii.StuffID ,
						sdtb.StockDocumentTypeID,
                        -ii.MainQuantity AS MainQuantity ,
                        -ii.SubQuantity AS SubQuantity ,
                        ( -1 )
                        * CASE WHEN Revision.RevisionPrice IS NOT NULL
                               THEN Revision.RevisionPrice
                               ELSE ii.Price
                          END AS NetPrice ,
						' + @Columns
          + N'
              FROM      STC.Outgoing i
                        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
                            ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                        INNER JOIN STC.OutgoingItem ii ON i.OutgoingID = ii.OutgoingID
						JOIN STF.StuffDetail sd ON sd.StuffID = ii.StuffID
						JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
						join stf.stuff s on s.stuffId = sd.StuffID
						INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = i.StockID
						INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = i.FinancialPeriodID                        
						LEFT JOIN ( SELECT  ROW_NUMBER() OVER ( PARTITION BY OutgoingItemID ORDER BY Number DESC ) Rno ,
                                            OutgoingItemID ,
                                            RevisionPrice
                                    FROM    STC.RevisionCost h
                                            JOIN STC.RevisionCostItem i ON h.RevisionCostID = i.RevisionCostID
                                    WHERE   OutgoingItemID IS NOT NULL
                                            AND FinancialPeriodID = @FinancialPeriod
                                  ) Revision ON Rno = 1
                                                AND Revision.OutgoingItemID = ii.OutgoingItemID
						LEFT JOIN (
								select OutgoingItemID,iit.TraceID,case when AccountLevelTypeID = 1 then 
									cast (DLID as nvarchar(max))
								  when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat
          + N'''  , 0,''' + @DateType
          + N''')
								  else Value end value
								 from STC.OutgoingItemTrace iit
								 join stf.trace t on t.traceid = iit.traceid
								 )x 
								 pivot
								(
									max(value)
									for traceid in (' + @Columns
          + N')
								)p on p.OutgoingItemID = ii.OutgoingItemID 
						
              WHERE     i.financialperiodid = @FinancialPeriod
						AND SAG.StuffDetailType <> 3
                        AND i.date < @FromDate
                        AND ( @SelectedStock IS NULL
                              OR i.StockID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStock) )
                            )
                        AND ( @SelectedStuff IS NULL
                              OR ii.StuffID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuff) )
                            )
						AND ( @SelectedStuffGroup IS NULL
                              OR s.StuffGroupID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuffGroup) )
                            )
                        AND ( @SelectedStuffAccountGroup IS NULL
                              OR sd.StuffAccountGroupID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuffAccountGroup) )
                            )
              UNION ALL
              SELECT    ii.StuffID ,
						sdtb.StockDocumentTypeID,
                        -ii.MainQuantity AS MainQuantity ,
                        -ii.SubQuantity AS SubQuantity ,
                        ( -1 )
                        * CASE WHEN Revision.RevisionPrice IS NOT NULL
                               THEN Revision.RevisionPrice
                               ELSE ii.Price
                          END AS NetPrice,
						' + @Columns
          + N'
              FROM      STC.Outgoing i
                        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
                            ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                        INNER JOIN STC.OutgoingItem ii ON i.OutgoingID = ii.OutgoingID
                        JOIN STF.StuffDetail sd ON sd.StuffID = ii.StuffID
						JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
						join stf.stuff s on s.stuffId = sd.StuffID
						INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = i.StockID
						INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = i.FinancialPeriodID                        
                        JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
                        LEFT JOIN ( SELECT  ROW_NUMBER() OVER ( PARTITION BY OutgoingItemID ORDER BY Number DESC ) Rno ,
                                            OutgoingItemID ,
                                            RevisionPrice
                                    FROM    STC.RevisionCost h
                                            JOIN STC.RevisionCostItem i ON h.RevisionCostID = i.RevisionCostID
                                    WHERE   OutgoingItemID IS NOT NULL
                                            --AND FinancialPeriodID = @FinicialPeriodID
                                  ) Revision ON Rno = 1
                                                AND Revision.OutgoingItemID = ii.OutgoingItemID
						LEFT JOIN (
								select OutgoingItemID,iit.TraceID,case when AccountLevelTypeID = 1 then 
									cast (DLID as nvarchar(max))
								  when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat
          + N'''  , 0,''' + @DateType
          + N''')
								  else Value end value
								 from STC.OutgoingItemTrace iit
								 join stf.trace t on t.traceid = iit.traceid
								 )x 
								 pivot
								(
									max(value)
									for traceid in (' + @Columns
          + N')
								)p on p.OutgoingItemID = ii.OutgoingItemID 						
						
              WHERE     i.date BETWEEN @FromDate AND @EndDate
						AND SAG.StuffDetailType <> 3
                        AND ( @SelectedStuff IS NULL
                              OR ii.StuffID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuff) )
                            )
						AND ( @SelectedStuffGroup IS NULL
                              OR s.StuffGroupID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuffGroup) )
                            )
                        AND ( @SelectedStock IS NULL
                              OR i.StockID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStock) )
                            )
                        AND ( @SelectedStuffAccountGroup IS NULL
                              OR sd.StuffAccountGroupID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuffAccountGroup) )
                            )
              UNION ALL
              SELECT    ii.StuffID ,
						sdtb.StockDocumentTypeID,
                        ii.MainQuantity AS MainQuantity ,
                        ii.SubQuantity AS SubQuantity ,
                        CASE WHEN Revision.RevisionPrice IS NOT NULL
                             THEN Revision.RevisionPrice
                             ELSE ii.Price
                        END AS NetPrice ,
						' + @Columns
          + N'
              FROM      STC.ReturnedOutgoing i
                        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
                            ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                        INNER JOIN STC.ReturnedOutgoingItem ii ON i.ReturnedOutgoingID = ii.ReturnedOutgoingID
                        JOIN STF.StuffDetail sd ON sd.StuffID = ii.StuffID
						JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
						join stf.stuff s on s.stuffId = sd.StuffID
						INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = i.StockID
					    INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = i.FinancialPeriodID                        
						LEFT JOIN ( SELECT  ROW_NUMBER() OVER ( PARTITION BY ReturnedOutgoingItemID ORDER BY Number DESC ) Rno ,
                                            ReturnedOutgoingItemID ,
                                            RevisionPrice
                                    FROM    STC.RevisionCost h
                                            JOIN STC.RevisionCostItem i ON h.RevisionCostID = i.RevisionCostID
                                    WHERE   ReturnedOutgoingItemID IS NOT NULL
                                            AND FinancialPeriodID = @FinancialPeriod
                                  ) Revision ON Rno = 1
                                                AND Revision.ReturnedOutgoingItemID = ii.ReturnedOutgoingItemID
						LEFT JOIN (
								select ReturnedOutgoingItemID,iit.TraceID,case when AccountLevelTypeID = 1 then 
									cast (DLID as nvarchar(max))
								  when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat
          + N'''  , 0,''' + @DateType
          + N''')
								  else Value end value
								 from STC.ReturnedOutgoingItemTrace iit
								 join stf.trace t on t.traceid = iit.traceid
								 )x 
								 pivot
								(
									max(value)
									for traceid in (' + @Columns
          + N')
								)p on p.ReturnedOutgoingItemID = ii.ReturnedOutgoingItemID 						
						
              WHERE     i.financialperiodid = @FinancialPeriod
						AND SAG.StuffDetailType <> 3
                        AND i.date < @FromDate
                        AND ( @SelectedStock IS NULL
                              OR i.StockID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStock) )
                            )
						AND ( @SelectedStuffGroup IS NULL
                              OR s.StuffGroupID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuffGroup) )
                            )
                        AND ( @SelectedStuff IS NULL
                              OR ii.StuffID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuff) )
                            )
                        AND ( @SelectedStuffAccountGroup IS NULL
                              OR sd.StuffAccountGroupID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuffAccountGroup) )
                            )
              UNION ALL
              SELECT    ii.StuffID ,
						sdtb.StockDocumentTypeID,
                        ii.MainQuantity AS MainQuantity ,
                        ii.SubQuantity AS SubQuantity ,
                        CASE WHEN Revision.RevisionPrice IS NOT NULL
                             THEN Revision.RevisionPrice
                             ELSE ii.Price
                        END AS NetPrice,
						' + @Columns
          + N'
              FROM      STC.ReturnedOutgoing i
                        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
                            ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                        INNER JOIN STC.ReturnedOutgoingItem ii ON i.ReturnedOutgoingID = ii.ReturnedOutgoingID
                        JOIN STF.StuffDetail sd ON sd.StuffID = ii.StuffID
						JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
						join stf.stuff s on s.stuffId = sd.StuffID
						INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = i.StockID
						INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = i.FinancialPeriodID                       
						JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
                        LEFT JOIN ( SELECT  ROW_NUMBER() OVER ( PARTITION BY ReturnedOutgoingItemID ORDER BY Number DESC ) Rno ,
                                            ReturnedOutgoingItemID ,
                                            RevisionPrice
                                    FROM    STC.RevisionCost h
                                            JOIN STC.RevisionCostItem i ON h.RevisionCostID = i.RevisionCostID
                                    WHERE   ReturnedOutgoingItemID IS NOT NULL
                                  ) Revision ON Rno = 1
                                                AND Revision.ReturnedOutgoingItemID = ii.ReturnedOutgoingItemID
						LEFT JOIN (
								select ReturnedOutgoingItemID,iit.TraceID,case when AccountLevelTypeID = 1 then 
									cast (DLID as nvarchar(max))
								  when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat
          + N'''  , 0,''' + @DateType
          + N''')
								  else Value end value
								 from STC.ReturnedOutgoingItemTrace iit
								 join stf.trace t on t.traceid = iit.traceid
								 )x 
								 pivot
								(
									max(value)
									for traceid in (' + @Columns
          + N')
								)p on p.ReturnedOutgoingItemID = ii.ReturnedOutgoingItemID 						
						
              WHERE     i.date BETWEEN @FromDate AND @EndDate
						AND SAG.StuffDetailType <> 3
                        AND ( @SelectedStuff IS NULL
                              OR ii.StuffID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuff) )
                            )
						AND ( @SelectedStuffGroup IS NULL
                              OR s.StuffGroupID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuffGroup) )
                            )
                        AND ( @SelectedStock IS NULL
                              OR i.StockID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStock) )
                            )
                        AND ( @SelectedStuffAccountGroup IS NULL
                              OR sd.StuffAccountGroupID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuffAccountGroup) )
                            )
				union all

SELECT	i.StuffID ,-1000 AS StockDocumentTypeID,-i.MainQuantity,-i.SubQuantity,
		-1 * ISNULL(CASE WHEN Revision.RevisionPrice IS NOT NULL THEN
                      Revision.RevisionPrice
                  ELSE i.Cost
             END ,
             0) AS NetPrice ,
       ' + @Columns
          + N' 
FROM   POS.PosInvoiceItem AS i
       JOIN POS.PosInvoice AS h ON h.PosInvoiceID = i.PosInvoiceID
       JOIN STF.[Stuff] AS s ON s.StuffID = i.StuffID
       JOIN STF.StuffDetail sd ON sd.StuffID = i.StuffID
	   JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
       INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = h.StockID
       INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = h.FinancialPeriodID  
            LEFT JOIN (   SELECT ROW_NUMBER() OVER ( PARTITION BY PosInvoiceItemID ORDER BY Number DESC ) Rno ,  PosInvoiceItemID , RevisionPrice , RevisionFee
                FROM   STC.RevisionCost rh
                       JOIN STC.RevisionCostItem ri ON ri.RevisionCostID = rh.RevisionCostID
                WHERE  ri.PosInvoiceItemID IS NOT NULL ) Revision ON Rno = 1
                                                                          AND Revision.PosInvoiceItemID = i.PosInvoiceItemID
       LEFT JOIN (   SELECT it.PosInvoiceItemID ,
                            it.TraceID ,
                            CASE WHEN AccountLevelTypeID = 1 THEN
                                     CAST(DlID AS NVARCHAR(MAX))
                                 WHEN AccountLevelTypeID = 5 THEN
                                     CFG.GetCLRSaturnDate(Value ,''' + @DateFormat + N'''  , 0,''' + @DateType
          + N''')
                                 ELSE Value
                            END value
                     FROM   POS.PosInvoiceItemTrace AS it
                            JOIN STF.Trace AS t ON t.TraceID = it.TraceID ) AS x
       PIVOT (   MAX(value)
                 FOR TraceID IN ( ' + @Columns
          + N' )) piv ON piv.PosInvoiceItemID = i.PosInvoiceItemID
WHERE  h.IsReturnInvoice = 0
       AND h.[Status] <> 3
       AND h.[Date]
       BETWEEN @FromDate AND @EndDate
       AND s.[Type] = 0
       AND SAG.StuffDetailType <> 3
       AND (   @SelectedStuffAccountGroup IS NULL
               OR sd.StuffAccountGroupID IN (   SELECT value
                                                FROM   CFG.R_FnCommaStr2Table(
                                                           @SelectedStuffAccountGroup) ))
       AND (   @SelectedStuff IS NULL
               OR i.StuffID IN (   SELECT value
                                    FROM   CFG.R_FnCommaStr2Table(
                                               @SelectedStuff) ))
						AND ( @SelectedStuffGroup IS NULL
                              OR s.StuffGroupID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuffGroup) )
                            )
       AND (   @SelectedStock IS NULL
               OR h.StockID IN (   SELECT value
                                   FROM   CFG.R_FnCommaStr2Table(
                                              @SelectedStock) ))
   

	   union ALL

		SELECT	i.StuffID ,-1000 AS StockDocumentTypeID,i.MainQuantity,i.SubQuantity,
				ISNULL(CASE WHEN Revision.RevisionPrice IS NOT NULL THEN
                      Revision.RevisionPrice
                  ELSE i.Cost
             END ,
             0) AS NetPrice ,
       ' + @Columns
          + N' 
FROM   POS.PosInvoiceItem AS i
       JOIN POS.PosInvoice AS h ON h.PosInvoiceID = i.PosInvoiceID
       JOIN STF.[Stuff] AS s ON s.StuffID = i.StuffID
       JOIN STF.StuffDetail sd ON sd.StuffID = i.StuffID
	   JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
       INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = h.StockID
       INNER JOIN cfg.vwFinancialPeriodAccess AS vfpa ON vfpa.FinancialPeriodID = h.FinancialPeriodID 
            LEFT JOIN (   SELECT ROW_NUMBER() OVER ( PARTITION BY PosInvoiceItemID ORDER BY Number DESC ) Rno ,  PosInvoiceItemID , RevisionPrice , RevisionFee
                FROM   STC.RevisionCost rh
                       JOIN STC.RevisionCostItem ri ON ri.RevisionCostID = rh.RevisionCostID
                WHERE  ri.PosInvoiceItemID IS NOT NULL ) Revision ON Rno = 1
                                                                          AND Revision.PosInvoiceItemID = i.PosInvoiceItemID
       LEFT JOIN (   SELECT it.PosInvoiceItemID ,
                            it.TraceID ,
                            CASE WHEN AccountLevelTypeID = 1 THEN
                                     CAST(DlID AS NVARCHAR(MAX))
                                 WHEN AccountLevelTypeID = 5 THEN
                                     CFG.GetCLRSaturnDate(Value ,''' + @DateFormat + N'''  , 0,''' + @DateType
          + N''')
                                 ELSE Value
                            END value
                     FROM   POS.PosInvoiceItemTrace AS it
                            JOIN STF.Trace AS t ON t.TraceID = it.TraceID ) AS x
       PIVOT (   MAX(value)
                 FOR TraceID IN ( ' + @Columns
          + N' )) piv ON piv.PosInvoiceItemID = i.PosInvoiceItemID
WHERE  h.IsReturnInvoice = 1
       AND h.[Status] <> 3
       AND h.[Date]
       BETWEEN @FromDate AND @EndDate
       AND s.[Type] = 0
       AND SAG.StuffDetailType <> 3
       AND (   @SelectedStuffAccountGroup IS NULL
               OR sd.StuffAccountGroupID IN (   SELECT value
                                                FROM   CFG.R_FnCommaStr2Table(
                                                           @SelectedStuffAccountGroup) ))
       AND (   @SelectedStuff IS NULL
               OR i.StuffID IN (   SELECT value
                                    FROM   CFG.R_FnCommaStr2Table(
                                               @SelectedStuff) ))
						AND ( @SelectedStuffGroup IS NULL
                              OR s.StuffGroupID IN (
                              SELECT    value
                              FROM      CFG.R_FnCommaStr2Table(@SelectedStuffGroup) )
                            )
       AND (   @SelectedStock IS NULL
               OR h.StockID IN (   SELECT value
                                   FROM   CFG.R_FnCommaStr2Table(
                                              @SelectedStock) ))
              ) A
			order by stuffID';

    --PRINT @query

    EXECUTE sp_executesql @query,
                          N'@FinancialPeriod int,
		@userid int,
		@FromDate DATETIME ,
		@EndDate DATETIME ,
		@SelectedStuff NVARCHAR(MAX) ,
		@SelectedStuffGroup NVARCHAR(MAX) ,
		@SelectedStock NVARCHAR(MAX) ,
		@SelectedStuffAccountGroup NVARCHAR(MAX)',
                          @FinancialPeriod = @FinancialPeriod,
                          @userid = @userid,
                          @FromDate = @FromDate,
                          @EndDate = @EndDate,
                          @SelectedStock = @SelectedStock,
                          @SelectedStuff = @SelectedStuff,
                          @SelectedStuffGroup = @SelectedStuffGroup,
                          @SelectedStuffAccountGroup = @SelectedStuffAccountGroup;


    DECLARE @joinTracesEqual NVARCHAR(MAX),
            @traceSelect NVARCHAR(MAX),
            @traceSelect1 NVARCHAR(MAX);

    SELECT @joinTracesEqual
        = STUFF(
    (
        SELECT DISTINCT
               ' AND ISNULL(q.T' + CAST(TraceID AS VARCHAR(10)) + ',0) = ISNULL(a.T' + CAST(TraceID AS VARCHAR(10))
               + ',0)'
        FROM STF.Trace
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    0   ,
    ''
               );

    IF @joinTracesEqual IS NULL
        SET @joinTracesEqual = N'';

    SELECT @traceSelect = STUFF(
    (
        SELECT DISTINCT
               ',T' + CAST(TraceID AS VARCHAR(10))
        FROM STF.Trace
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                               );

    SELECT @traceSelect1 = STUFF(
    (
        SELECT DISTINCT
               ',q.T' + CAST(TraceID AS VARCHAR(10)) + ' TR_' + CAST(TraceID AS VARCHAR(10))
        FROM STF.Trace
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                                );

    IF @traceSelect IS NULL
       OR @traceSelect = ''
        SET @traceSelect = N'[-1]';

    IF @traceSelect1 IS NULL
       OR @traceSelect1 = ''
        SET @traceSelect1 = N'q.[-1]';

    SET @query
        = N'
		select s.StuffID, s.code StuffCode,sd.TechnicalCode,
		case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	         when ' + CAST(@CultureNo AS CHAR(1)) + N' = 2 then s.Title2
	    end as StuffTitle,' + @traceSelect1 + N' ' + @stockQuantityDocumentsTypeSelect + N' '
          + @stockPriceDocumentsTypeSelect + N' ' + @CodeAndTitleColumn + N' from (
			select 
				StuffID,
				' + @traceSelect + N', 
				' + @stockDocumentsType
          + N' 
			FROM ( SELECT	StuffID ,
							MainQuantity ,
							StockDocumentTypeID ,
							' + @SelectColumns + N'
					 FROM  ' + @tableName
          + N') a
					PIVOT ( 
						SUM(MainQuantity) 
						FOR StockDocumentTypeID IN ( ' + @stockDocumentsType
          + N')
					) piv
			) q
			join 
			(select 
					StuffID,
					' + @traceSelect + N', 
					' + @stockDocumentsType
          + N' 
				FROM ( SELECT StuffID ,
							  NetPrice ,
							  StockDocumentTypeID,
							' + @SelectColumns + N'
							  FROM  ' + @tableName
          + N') a
						PIVOT ( 
							SUM(NetPrice) 
							FOR StockDocumentTypeID IN ( ' + @stockDocumentsType
          + N' )
						) piv 
			) a ON  a.StuffID = q.StuffID 
			join 
			(select 
					StuffID,
					' + @traceSelect + N', 
					' + @stockDocumentsType
          + N' 
				FROM ( SELECT StuffID ,
							  NetPrice ,
							  StockDocumentTypeID,
							' + @SelectColumns + N'
							  FROM  ' + @tableName
          + N') a
						PIVOT ( 
							count(NetPrice) 
							FOR StockDocumentTypeID IN ( ' + @stockDocumentsType
          + N' )
						) piv 
			) qty ON  qty.StuffID = q.StuffID ' + @joinTracesEqual
          + N'
		join stf.Stuff s on s.StuffID = q.StuffID
		join stf.StuffDetail sd on sd.stuffid =  s.StuffID
	' + @LeftJoin;

    PRINT @query;

    EXEC sp_executesql @query,
                       N'
		@FromDate DATE,
		@EndDate DATE',
                       @FromDate = @FromDate,
                       @EndDate = @EndDate;
END;

