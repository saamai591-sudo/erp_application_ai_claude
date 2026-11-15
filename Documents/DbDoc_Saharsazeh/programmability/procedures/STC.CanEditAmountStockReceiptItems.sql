---------------------------------------------------------------------------------------------------------------
CREATE   PROC [STC].CanEditAmountStockReceiptItems
(
    @StockReceiptItems ArrayInput READONLY,
    @changeEstimatedFeeCols BIT,
    @changeRealCols BIT
)
--WITH ENCRYPTION
AS
BEGIN

    DECLARE @Date DATE;

    SELECT TOP 1
           @Date = sr.Date
    FROM STC.StockReceiptItem AS sri
        JOIN STC.StockReceipt AS sr
            ON sr.StockReceiptID = sri.StockReceiptID
    WHERE sri.StockReceiptItemID IN
          (
              SELECT sri2.Val FROM @StockReceiptItems AS sri2
          );

    --1.	رسید بر مبنای فاکتور خرید، قرارداد خرید، استعلام قیمت و ترخیص نباشد.
    IF EXISTS
    (
        SELECT 1
        FROM STC.StockReceiptItem AS sri
        WHERE sri.StockReceiptItemID IN
              (
                  SELECT Val FROM @StockReceiptItems
              )
              AND
              ( sri.PurchaseInvoiceItemID IS NOT NULL
                  OR sri.ProposalItemID IS NOT NULL
              )
    )
    BEGIN
        --PRINT N'StockReceiptIssuedWithBaseItem';
        RAISERROR(N'StockManager.StockReceiptIssuedWithBaseItem', 16, 12);
        RETURN;
    END;

    --2.	مبلغ برآوردی(استاندارد) صفر باشد.
    IF @changeRealCols = 1
       AND EXISTS
    (
        SELECT 1
        FROM STC.StockReceiptItem AS sri
        WHERE sri.StockReceiptItemID IN
              (
                  SELECT Val FROM @StockReceiptItems
              )
              AND sri.EstimatedPrice <> 0
    )
    BEGIN
        RAISERROR(N'FeeAndPriceCannotChanged', 16, 12);
        RETURN;
    END;

    --2.	مبلغ واقعی صفر باشد.
    IF @changeEstimatedFeeCols = 1
       AND EXISTS
    (
        SELECT 1
        FROM STC.StockReceiptItem AS sri
        WHERE sri.StockReceiptItemID IN
              (
                  SELECT Val FROM @StockReceiptItems
              )
              AND sri.Price <> 0
    )
    BEGIN
        RAISERROR(N'EstimatedFeeAndEstimatedPriceCannotChanged', 16, 12);
        RETURN;
    END;

    --3.	پیش نویس سند صادر نشده باشد.
    IF EXISTS
    (
        SELECT 1
        FROM STC.StockReceiptItem AS sri
            JOIN STC.StockReceipt AS sr
                ON sr.StockReceiptID = sri.StockReceiptID
        WHERE sri.StockReceiptItemID IN
              (
                  SELECT Val FROM @StockReceiptItems
              )
              AND sr.PreVoucherID IS NOT NULL
    )
    BEGIN
        --PRINT N'UnEditableIssuedPrevoucher';
        RAISERROR(N'UnEditableIssuedPrevoucher', 16, 12);
        RETURN;
    END;

    --4.	عملیات قیمت گذاری بزرگتر مساوی آن تاریخ برای کالای مورد نظر انجام نشده باشد.
    DECLARE @SelectColumns NVARCHAR(MAX),
            @leftJoin NVARCHAR(MAX),
            @query NVARCHAR(MAX),
            @tableName VARCHAR(20),
            @msg NVARCHAR(MAX);

    SET @tableName = CFG.getTempTableName(1);

    SELECT @SelectColumns = STUFF(
    (
        SELECT DISTINCT
               ',' + QUOTENAME(CAST(t.TraceID AS VARCHAR(10)))
        FROM STF.Trace t
        WHERE t.PricingBase = 1
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                                 );

    IF (@SelectColumns IS NULL)
        SET @SelectColumns = N'[-1]';

    SELECT @leftJoin
        = STUFF(
    (
        SELECT DISTINCT
               ' AND pr.' + QUOTENAME(CAST(t.TraceID AS VARCHAR(10))) + ' = sr.'
               + QUOTENAME(CAST(t.TraceID AS VARCHAR(10)))
        FROM STF.Trace t
        WHERE t.PricingBase = 1
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );

    IF (@leftJoin IS NULL)
        SET @leftJoin = N'';

    SELECT Val AS StockReceiptItemID
    INTO #t
    FROM @StockReceiptItems AS sri;

    SET @query
        = N'SELECT sr.StuffID
					INTO ' + @tableName + N'
					FROM   (   SELECT sri.StuffID ,
                                      st.StockID,
									  ' + @SelectColumns
          + N'
							   FROM   STC.StockReceiptItem AS sri
                                    join STC.StockReceipt st on sri.StockReceiptID = st.StockReceiptID
									  LEFT JOIN (   SELECT srit.StockReceiptItemID ,
														   TraceID ,
														   CASE WHEN DlID IS NOT NULL THEN CAST(DlID AS NVARCHAR(MAX))
															    WHEN TraceItemID IS NOT NULL THEN CAST(TraceItemID AS NVARCHAR(MAX))
																ELSE [Value]
														   END Value
													FROM   STC.StockReceiptItemTrace AS srit ) AS x
									  PIVOT (   MAX(Value)
												FOR TraceID IN ( ' + @SelectColumns
          + N' )) piv ON piv.StockReceiptItemID = sri.StockReceiptItemID
							   WHERE  sri.StockReceiptItemID IN (   SELECT StockReceiptItemID
																	FROM   #t )) sr
		LEFT JOIN (
            SELECT pi.StuffID ,
                   pi.StockID,
				   pi.LastPricingDate ,
                          ' + @SelectColumns
          + N'   FROM   STC.PricingItem AS pi
						    LEFT JOIN (   SELECT pit.PricingItemID ,
												    TraceID ,
												    CASE WHEN DlID IS NOT NULL THEN CAST(DlID AS NVARCHAR(MAX))
													    WHEN TraceItemID IS NOT NULL THEN CAST(TraceItemID AS NVARCHAR(MAX))
													    ELSE [Value]
												    END Value
										    FROM   STC.PricingItemTrace AS pit 
                            ) AS x
						    PIVOT (   MAX(Value)
								      FOR TraceID IN (' + @SelectColumns
              + N' )
              ) piv ON piv.PricingItemID = pi.PricingItemID 

          ) pr ON pr.StuffID = sr.StuffID ' + @leftJoin
          + N' WHERE  pr.LastPricingDate >= @Date AND (pr.StockID is null or sr.StockID = pr.StockID)';

    EXEC sp_executesql @query, N'@Date DATE', @Date = @Date;

    SELECT @msg = REPLACE(lsmv.Value, '{0}', '( %s )')
    FROM CFG.LocalizationSQLMessageValue AS lsmv
        LEFT JOIN CFG.LocalizationSQLMessage AS lsm
            ON lsm.LocalizationSQLMessageID = lsmv.LocalizationSQLMessageID
    WHERE lsm.SQLMessageCode = 'STC_SpClearFinalStuffInventoryFromDeletedEntity_1'
          AND lsmv.Culture = CFG.GetuserCulture();

    SET @query
        = N'
			IF EXISTS( SELECT 1 FROM ' + @tableName
          + N')
			BEGIN
				DECLARE @stuffCodes NVARCHAR(MAX)
			
				SELECT @stuffCodes = STUFF(
				   (   SELECT TOP 3 '', '' + s.Code
					   FROM ' + @tableName
          + N' t
						JOIN STF.Stuff AS s ON s.StuffID = t.StuffID 
					   FOR XML PATH(''''), TYPE ).value(''.'', ''NVARCHAR(MAX)'') ,
				   1 ,
				   1 ,
				   '''');
		   
				RAISERROR(@msg ,16,12,@stuffCodes)
				RETURN
			END
				';

    EXEC sys.sp_executesql @query, N'@msg NVARCHAR(max)', @msg = @msg;

    IF OBJECT_ID('tempDb..' + @tableName) IS NOT NULL
        EXEC ('DROP TABLE ' + @tableName);

    --5.	برای آن ردیف اصلاح فی تمام شده صادر نشده باشد.
    IF EXISTS
    (
        SELECT 1
        FROM STC.StockReceiptItem AS sri
            JOIN STC.RevisionCostItem AS rci
                ON rci.StockReceiptItemID = sri.StockReceiptItemID
        WHERE sri.StockReceiptItemID IN
              (
                  SELECT Val FROM @StockReceiptItems
              )
    )
    BEGIN
        RAISERROR(N'StockManager.ReceiptItemRevisionCostIssued', 16, 12);
        RETURN;
    END;

    --6.	بر مبنای ردیف مورد نظر فاکتور خرید صادر نشده باشد.
    IF EXISTS
    (
        SELECT 1
        FROM STC.StockReceiptItem AS sri
            JOIN VND.PurchaseInvoiceItem AS pii
                ON pii.PurchaseInvoiceItemID = sri.PurchaseInvoiceItemID
        WHERE sri.StockReceiptItemID IN
              (
                  SELECT Val FROM @StockReceiptItems
              )
    )
    BEGIN
        --PRINT N'StockManager.PurchaseInvoiceIssuedOnReceiptBase';
        RAISERROR(N'StockManager.PurchaseInvoiceIssuedOnReceiptBase', 16, 12);
        RETURN;
    END;

    --7.	سایر هزینه ها، تسهیم نشده باشد.
    IF EXISTS
    (
        SELECT 1
        FROM STC.StockReceiptItem AS sri
        WHERE sri.ShareOfCosts <> 0
              AND sri.StockReceiptItemID IN
                  (
                      SELECT Val FROM @StockReceiptItems
                  )
    )
    BEGIN
        RAISERROR(N'StockManager.ReceiptHasShareOfCosts', 16, 12);
        RETURN;
    END;

    --8.	رسید از نوع تبدیل و انتقالی نباشد.
    IF EXISTS
    (
        SELECT 1
        FROM STC.StockReceiptItem AS sri
            JOIN STC.StockReceipt AS sr
                ON sr.StockReceiptID = sri.StockReceiptID				
			JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
				ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
            JOIN STC.StockDocumentType AS sdt
                ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
        WHERE (
                  sdt.DocumentType = 5
                  OR sdt.DocumentType = 8
              )
              AND sri.StockReceiptItemID IN
                  (
                      SELECT Val FROM @StockReceiptItems
                  )
    )
    BEGIN
        --PRINT N'StockManager.SpecifyPriecAutomatically';
        RAISERROR(N'StockManager.SpecifyPriecAutomatically', 16, 12);
        RETURN;
    END;

END;



