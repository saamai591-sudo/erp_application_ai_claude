
------------------------------[STC].SpStockClosingValidation-----------------------------------------------------------------------------------------------
CREATE   PROCEDURE STC.SpStockClosingValidation
(
    @FinancialPeriodID INT,
    @StockIDs VARCHAR(MAX),
    @Status TINYINT
)
--WITH ENCRYPTION 
AS
BEGIN TRY

    SELECT value
    INTO #Stocks
    FROM CFG.R_FnCommaStr2Table(@StockIDs);

    IF OBJECT_ID('ValidationTemp') IS NOT NULL
        DROP TABLE ValidationTemp;

    CREATE TABLE ValidationTemp
    (
        ValidationNo NVARCHAR(MAX),
        ValidationDesc NVARCHAR(MAX)
    );

    DECLARE @Stock NVARCHAR(MAX),
            @StockID INT,
            @StartDate DATETIME = NULL,
            @NextFinancialPeriod INT = NULL,
            @Message NVARCHAR(MAX),
            @TableName NVARCHAR(250),
            @Columns NVARCHAR(MAX),
            @ColumnsInSelectList NVARCHAR(MAX),
            @Query NVARCHAR(MAX),
            @Param NVARCHAR(MAX),
            @EndDate DATE,
            @ParmDefinition NVARCHAR(MAX);

    SELECT @EndDate = EndDate
    FROM CFG.FinancialPeriod
    WHERE FinancialPeriodID = @FinancialPeriodID;

		 if exists
		 (
		 select *
		 from #Stocks a
		 left join stc.StockClosePeriod  b on a.value = b.stockid and b.Date >= @EndDate
		 where b.StockClosePeriodID is null
		 )
		BEGIN
            INSERT dbo.ValidationTemp
            (
                ValidationNo,
                ValidationDesc
            )
            VALUES
            (N'1',  N'ابتدا انبارهای مورد نظر را تا تاریخ پایان دوره مالی ببندید.');
		END
		
    DECLARE db_cursor CURSOR FOR SELECT value FROM #Stocks;

    OPEN db_cursor;
    FETCH NEXT FROM db_cursor
    INTO @StockID;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @TableName = CFG.getTempTableName(1);

        SELECT @Stock = Title
        FROM STF.Stock
        WHERE StockID = @StockID;

        SET @StartDate =
        (
            SELECT MIN(StartDate)
            FROM CFG.FinancialPeriod
            WHERE StartDate >
            (
                SELECT EndDate
                FROM CFG.FinancialPeriod
                WHERE FinancialPeriodID = @FinancialPeriodID
            )
        );
        SET @NextFinancialPeriod =
        (
            SELECT FinancialPeriodID
            FROM CFG.FinancialPeriod
            WHERE StartDate = @StartDate
        );


        IF (@NextFinancialPeriod IS NULL)
        BEGIN
            INSERT INTO ValidationTemp
            (
                ValidationNo,
                ValidationDesc
            )
            VALUES
            (1, 'STC_SpStockClosingValidation_1');
        END;

        IF EXISTS
        (
            SELECT 1
            FROM STC.RecountingInventoryTag t
            JOIN STC.RecountingInventoryPeriod rip 
                ON t.RecountingInventoryPeriodID = rip.RecountingInventoryPeriodID
            JOIN #Stocks
                ON #Stocks.value = rip.StockID
            WHERE rip.FinancialPeriodID = @FinancialPeriodID
            AND t.Status <> 1
        )
        BEGIN
            INSERT dbo.ValidationTemp
            (
                ValidationNo,
                ValidationDesc
            )
            VALUES
            (N'1', N'در شمارش انبارگردانی برخی از انبارهای انتخاب شده، عملیات مغایرت گیری انجام نشده است.' );
        END;


		--حواله انتقالی
			if exists(
			SELECT  1
			FROM    STC.Outgoing hdr
            JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON hdr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
					INNER JOIN STC.OutgoingItem itm ON itm.OutgoingID = hdr.OutgoingID
					INNER JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
					LEFT  join STC.StockReceiptItem sri on sri.OutgoingItemID = itm.OutgoingItemID
			WHERE   sdt.DocumentType = 4
					AND hdr.FinancialPeriodID = @FinancialPeriodID
					AND sri.StockReceiptItemID is null
					AND hdr.StockID = @StockID
					)
					begin
						INSERT dbo.ValidationTemp
						(
							ValidationNo,
							ValidationDesc
						)
						VALUES
						(N'1', N'انبار انتخاب شده داراي حواله هاي انتقالي است که به انبار مقصد تحويل داده نشده است.');
					end

		--حواله تبدیل
			if exists(
			SELECT  1
				from stc.Outgoing o
				JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
				INNER JOIN stc.StockDocumentType sdt
					ON sdtb.StockDocumentTypeID = sdt.StockDocumentTypeID
				INNER JOIN stc.OutgoingItem oi
					ON o.OutgoingID = oi.OutgoingID
				LEFT JOIN stc.ConvertSpecification cs
					ON cs.OutgoingItemID = oi.OutgoingItemID
				LEFT JOIN stc.StockReceiptItem si
					ON si.ConvertSpecificationID = cs.ConvertSpecificationID
			WHERE   FinancialPeriodID = @FinancialPeriodID
					AND StockID = @StockID
					AND DocumentType = 9
					AND si.StockReceiptItemID IS NULL
					)
					BEGIN
						INSERT dbo.ValidationTemp
						(
							ValidationNo,
							ValidationDesc
						)
						VALUES
						(N'1', N'تعدادی از حواله های انبار از نوع تبدیل فاقد رسید هستند.');
					end

		--حواله ترکیب
			if exists(
			SELECT 1
				from [STC].[StockReceipt] sr
                JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                    ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
				inner join stc.StockDocumentType sdt
					on sdtb.StockDocumentTypeID = sdt.StockDocumentTypeID
				inner join stc.StockReceiptItem si
					on sr.StockReceiptID = si.StockReceiptID
				left join stc.StuffComposition sc
					on sc.StockReceiptItemID = si.StockReceiptItemID
				left join stc.OutgoingItem oi
					on oi.StuffCompositionID = sc.StuffCompositionID
			WHERE   FinancialPeriodID = @FinancialPeriodID
					AND StockID = @StockID
					AND DocumentType = 9
					and oi.OutgoingItemID is null
					)
					begin
						INSERT dbo.ValidationTemp
						(
							ValidationNo,
							ValidationDesc
						)
						VALUES
						(N'1', N'تعدادی از رسیدهای ترکیب فاقد حواله هستند.');
					end
		--رسید کارمزدی
			if exists(
			SELECT  1
				from [STC].[StockReceipt] s
                JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                    ON s.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
				inner join stc.StockDocumentType sdt
					on sdtb.StockDocumentTypeID = sdt.StockDocumentTypeID
				inner join stc.StockReceiptItem si
					on s.StockReceiptID = si.StockReceiptID
				left join stc.[StockReceiptChargingService] sc
					on sc.StockReceiptItemID = si.StockReceiptItemID
			WHERE   FinancialPeriodID = @FinancialPeriodID
						AND StockID = @StockID
					AND DocumentType = 10
					and sc.OutgoingItemID is null
					)
					begin
						INSERT dbo.ValidationTemp
						(
							ValidationNo,
							ValidationDesc
						)
						VALUES
						(N'1', N'در تعدادی از رسیدهای کارمزدی، حواله انبار مشخص نشده است.');
					end

        SELECT @ColumnsInSelectList = STUFF(
        (
            SELECT DISTINCT
                   ',' + QUOTENAME(TraceID)
            FROM STF.Trace
            WHERE PricingBase = 1
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'),1   ,0   ,'');

        IF (@ColumnsInSelectList IS NULL)
            SET @ColumnsInSelectList = N'';

        SELECT @Columns = STUFF(
        (
            SELECT DISTINCT
                   ',' + QUOTENAME(TraceID) + ' NVARCHAR(256)'
            FROM STF.Trace
            WHERE CheckInventory = 1
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

        IF (@Columns IS NULL)
            SET @Columns = N'[-1] NVARCHAR(256)';

        SELECT @Columns = STUFF(
        (
            SELECT DISTINCT
                    ',' + QUOTENAME(TraceID)
            FROM STF.Trace
            WHERE CheckInventory = 1
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

        IF (@Columns IS NULL)
            SET @Columns = N'[-1] ';

        IF (@Status = 1)
        BEGIN

            IF EXISTS
            (
                SELECT StockReceiptID
                FROM STC.StockReceipt sr
                JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                    ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                JOIN STC.StockDocumentType sdt
                    ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
                WHERE sr.FinancialPeriodID = @NextFinancialPeriod
                      AND sdt.[DocumentType] = 7
                      AND sr.StockID = @StockID
            )
            BEGIN

                SET @Message = REPLACE('STC_SpStockClosingValidation_2', '{0}', @Stock);

                INSERT INTO ValidationTemp
                (
                    ValidationNo,
                    ValidationDesc
                )
                VALUES
                (1, @Message);
            END;

            IF EXISTS
            (
                SELECT i.StockReceiptItemID
                FROM STC.StockReceiptItem i
                    JOIN STC.StockReceipt h
                        ON h.StockReceiptID = i.StockReceiptID 
                    JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                        ON h.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                    JOIN STC.StockDocumentType sdt
                        ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
                    LEFT JOIN
                    (
                        SELECT StockReceiptItemID,
                               SUM(MainQuantity) MainQuantity
                        FROM STC.ReturnStockReceiptItem
                        GROUP BY StockReceiptItemID
                    ) R
                        ON R.StockReceiptItemID = i.StockReceiptItemID
                WHERE i.MainQuantity > ISNULL(R.MainQuantity, 0)
                      AND FinancialPeriodID = @FinancialPeriodID
                      AND StockID = @StockID
                      AND sdt.[DocumentType] = 2
                      AND i.Fee = 0
            )
            BEGIN

                SET @Message = 'STC_SpStockClosingValidation_3^'+ @Stock

                INSERT INTO ValidationTemp
                (
                    ValidationNo,
                    ValidationDesc
                )
                VALUES
                (1, @Message);
            END;

        END;

        IF (@Status = 2)
        BEGIN

            IF  NOT EXISTS
            (
                SELECT [Status]
                FROM [STC].[StockClosingOperation]
                WHERE [FinancialPeriodID] = @FinancialPeriodID
                      AND StockID = @StockID
            )
            BEGIN

                SET @Message = REPLACE('STC_SpStockClosingValidation_5', '{0}', @Stock);
                INSERT INTO ValidationTemp
                (
                    ValidationNo,
                    ValidationDesc
                )
                VALUES
                (1, @Message);
            END;

		exec [STC].spPricingDataSource
			@FinancialPeriodID = @FinancialPeriodID,
			@PricingDate = @EndDate,
			@TableName = @TableName

            DECLARE @Stuffs NVARCHAR(MAX);
			                
			set @Query = N'SELECT @Stuffs = STUFF(
            (
                SELECT DISTINCT
                       '','' + t.StuffCode
                FROM '+ @TableName+N'  t
				join #Stocks s on s.value = t.StockID
                FOR XML PATH(''''), TYPE
            ).value(''.'', ''NVARCHAR(MAX)''),1   ,1   ,'''');			
							'
							
        --PRINT @qUERY
	EXECUTE sp_executeSQL     
				@Query,
				N'@Stuffs NVARCHAR(MAX) out',
				@Stuffs = @Stuffs output

            IF @Stuffs IS NOT NULL
            BEGIN
                SET @Message = N'کالاهای زیر بطور کامل قیمت گذاری نشده اند.' + CHAR(13) + CHAR(10) + @Stuffs;
                INSERT INTO ValidationTemp
                (
                    ValidationNo,
                    ValidationDesc
                )
                VALUES
                (5, @Message);
            END;

        END;

        FETCH NEXT FROM db_cursor
        INTO @StockID;
    END;

    CLOSE db_cursor;
    DEALLOCATE db_cursor;

    SELECT DISTINCT ValidationNo,
           ValidationDesc
    FROM ValidationTemp;
   
    IF OBJECT_ID('ValidationTemp') IS NOT NULL
        DROP TABLE ValidationTemp;

END TRY
BEGIN CATCH

    IF OBJECT_ID('ValidationTemp') IS NOT NULL
        DROP TABLE ValidationTemp;

    DECLARE @ErrorMessage NVARCHAR(4000);
    DECLARE @ErrorSeverity INT;
    DECLARE @ErrorState INT;

    SELECT @ErrorMessage = ERROR_MESSAGE(),
           @ErrorSeverity = ERROR_SEVERITY(),
           @ErrorState = ERROR_STATE();

    RAISERROR(   @ErrorMessage,  -- Message text.
                 @ErrorSeverity, -- Severity.
                 @ErrorState     -- State.
             );
END CATCH;

