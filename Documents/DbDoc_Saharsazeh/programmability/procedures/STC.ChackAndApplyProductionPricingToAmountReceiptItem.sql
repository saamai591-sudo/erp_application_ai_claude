
-----------------------------------------------------------------------
CREATE    PROCEDURE [STC].ChackAndApplyProductionPricingToAmountReceiptItem
    @ProductionPriceID INT ,
    @IsConfirmed BIT
--With Encryption 
AS
    BEGIN
        -- DECLARE Needed Variables
        DECLARE @Columns AS NVARCHAR(MAX) ,
                @SourceQuery AS NVARCHAR(MAX) ,
                @innerJoinConditionForDynamicColumns AS NVARCHAR(MAX) ,
                @SelectDynamicColumns AS NVARCHAR(MAX) ,
                @FromDate AS DATE ,
                @ToDate AS DATE ,
                @DlID AS BIGINT ,
                @UserID AS INT;
        -- Get Selected Production Price Data
        SET @UserID = CFG.GetuserID();

        SELECT @FromDate = FromDate ,
               @ToDate = ToDate ,
               @DlID = DlID
        FROM   STC.ProductionPrice
        WHERE  ProductionPriceID = @ProductionPriceID;

        -- Remove All temp Tables

        IF OBJECT_ID('tempdb..##ProductionPrices') IS NOT NULL
            DROP TABLE ##ProductionPrices;

        IF OBJECT_ID('tempdb..##CoreData') IS NOT NULL
            DROP TABLE ##CoreData;

        IF OBJECT_ID('tempdb..##TempTableForInsert') IS NOT NULL
            DROP TABLE ##TempTableForInsert;

        IF OBJECT_ID('tempdb..##PricingTemp') IS NOT NULL
            DROP TABLE ##PricingTemp;

        IF OBJECT_ID('tempdb..##PricingResultTemp') IS NOT NULL
            DROP TABLE ##PricingResultTemp;

        -- Get Dynamic Column
        SELECT @Columns = STUFF(
        (   SELECT DISTINCT ',' + QUOTENAME(TraceID)
            FROM   STF.Trace
            WHERE  PricingBase = 1
            FOR XML PATH(''), TYPE ).value('.', 'NVARCHAR(MAX)') ,
        1   ,
        1   ,
        ''  );

        IF ( @Columns IS NULL )
            SET @Columns = '[-1]';

        SELECT flow.StockID
        INTO   #flowTable
        FROM   (   SELECT sr.StockID
                   FROM   STC.StockReceipt AS sr
                   WHERE  sr.DeliverDlID = @DlID
                   UNION
                   SELECT ro.StockID
                   FROM   STC.ReturnedOutgoing AS ro
                   WHERE  ro.DlDeliverID = @DlID ) AS flow;


        -- for select in dynamic inner join
        SELECT @SelectDynamicColumns = STUFF(
        (   SELECT DISTINCT ',a.' + QUOTENAME(TraceID)
            FROM   STF.Trace
            WHERE  PricingBase = 1
            FOR XML PATH(''), TYPE         ).value('.', 'NVARCHAR(MAX)') ,
        1   ,
        1   ,
        ''  );

        IF ( @SelectDynamicColumns IS NULL )
            SET @SelectDynamicColumns = 'a.[-1]';

        -- Get Pricing Data Filter By Date

        SET @SourceQuery = 'SELECT pi.StuffID,pt.* 
									  INTO ##PricingTemp
										FROM    STC.PricingItem pi 
												LEFT JOIN (SELECT  PricingItemID ,
																	TraceID ,
																	CASE WHEN DlID IS NOT NULL THEN CAST (DlID AS NVARCHAR(MAX))
																		 WHEN TraceItemID IS NOT NULL THEN CAST (TraceItemID AS NVARCHAR(MAX))
																		 ELSE Value
																	END Value
															FROM    STC.PricingItemTrace
														  ) x PIVOT ( MAX(Value) FOR TraceID IN ( '
                           + @Columns
                           + ' ))  pt ON pt.PricingItemID = pi.PricingItemID
										WHERE pi.lastPricingDate BETWEEN @pFromDate AND @pToDate
										AND  pi.StockID IN ( SELECT StockID FROM #flowTable)';

        EXECUTE sp_executesql @SourceQuery ,
                              N'@pFromDate DATE , @pToDate DATE' ,
                              @pFromDate = @FromDate ,
                              @pToDate = @ToDate;


        -- Get All ProductionPrices

        SET @SourceQuery = 'SELECT pp.ProductionPriceID,
								   ppi.Fee,
								   stuffId,
								   pp.DlID,
								   pp.FromDate,
								   pp.ToDate,
								   pt.*
								   INTO ##ProductionPrices
							FROM   stc.ProductionPrice pp
								   INNER JOIN STC.ProductionPriceItem ppi
										ON  ppi.ProductionPriceID = pp.ProductionPriceID
								   LEFT JOIN (
											SELECT ppit.ProductionPriceItemID,
												   TraceID,
												   CASE 
														WHEN DlID IS NOT NULL THEN CAST(DlID AS NVARCHAR(MAX))
														WHEN TraceItemID IS NOT NULL THEN CAST (TraceItemID AS NVARCHAR(MAX))
														ELSE VALUE
												   END VALUE
											FROM   STC.ProductionPriceItemTrace ppit
										) x PIVOT(MAX(VALUE) FOR TraceID IN ('
                           + @Columns
                           + ')) 
										pt
										ON  pt.ProductionPriceItemID = ppi.ProductionPriceItemID
							WHERE  ppi.ProductionPriceID = @pProductionPriceID';

        EXEC sp_executesql @SourceQuery ,
                            N'@pProductionPriceID INT' ,
                           @pProductionPriceID = @ProductionPriceID;


        -- Get AmountReceiptItems and Quantity Data

        SET @innerJoinConditionForDynamicColumns = 'INNER JOIN ##ProductionPrices pp
														ON  a.StuffID = pp.StuffId'
                                                   + STUFF(
                                                         (   SELECT DISTINCT ' AND  ISNULL(pp.'
                                                                             + QUOTENAME(
                                                                                   TraceID)
                                                                             + ' , 0)'
                                                                             + '= ISNULL(a.'
                                                                             + QUOTENAME(
                                                                                   TraceID)
                                                                             + ',0)'
                                                             FROM   STF.Trace
                                                             WHERE  PricingBase = 1
                                                             FOR XML PATH(''), TYPE ).value(
                                                                                          '.' ,
                                                                                          'NVARCHAR(MAX)') ,
                                                         1 ,
                                                         0 ,
                                                         '');

        IF ( @innerJoinConditionForDynamicColumns IS NULL )
            SET @innerJoinConditionForDynamicColumns = 'INNER JOIN ##ProductionPrices pp
														ON  a.StuffID = pp.StuffId';

        SET @SourceQuery = 'SELECT a.StockReceiptItemID,
							   a.Fee OldFee,
							   a.StuffID,
							   a.Date,
							   a.DeliverDlID,
							   a.PreVoucherID,
							   pp.Fee,
							   ' + @SelectDynamicColumns
                           + '
							   INTO ##CoreData
						FROM   (
								   SELECT ari.StockReceiptItemID ,
										  ari.Fee,
										  ari.StuffID,
										  sr.Date,
										  sr.DeliverDlID,
										  sr.PreVoucherID,
										  sdt.DocumentType Type,
										  p.*
								   FROM   STC.StockReceipt sr
                                   JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
                                        ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
								   JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
										  INNER JOIN STC.StockReceiptItem ari
											   ON  ari.StockReceiptID = sr.StockReceiptID
										  LEFT JOIN (
												   SELECT StockReceiptItemID ID,
														  TraceID,
														  CASE 
															   WHEN DlID IS NOT NULL THEN CAST(DlID AS NVARCHAR(MAX))
															   WHEN TraceItemID IS NOT NULL THEN CAST (TraceItemID AS NVARCHAR(MAX))
															   ELSE VALUE
														  END VALUE
												   FROM   STC.StockReceiptItemTrace
											   ) x PIVOT(MAX(VALUE) FOR TraceID IN ('
                           + @Columns
                           + ')) 
											   p
											   ON  ari.StockReceiptItemID = p.ID
								)a ' + @innerJoinConditionForDynamicColumns
                           + '
						WHERE  a.Date BETWEEN @pFromDate AND @pToDate
							   AND a.DeliverDlID = @pDlID AND a.Type = 0';

        EXECUTE sp_executesql @SourceQuery ,
                              N'@pFromDate DATE , @pToDate DATE,@pDlID bigint' ,
                              @pFromDate = @FromDate ,
                              @pToDate = @ToDate ,
                              @pDlID = @DlID;



        -- Check Have Priceing For this Stuffs
        DECLARE @StuffIDPricingCount INT;

        SET @SourceQuery = 'SELECT * 
							INTO ##PricingResultTemp 
						 FROM 
							(SELECT StuffID,' + @Columns
                           + ' FROM  ##PricingTemp 
										INTERSECT 
										SELECT StuffID,' + @Columns
                           + ' FROM ##ProductionPrices) a';


        EXECUTE sp_executesql @SourceQuery;

        SELECT @StuffIDPricingCount = COUNT(StuffID)
        FROM   ##PricingResultTemp;

        IF @StuffIDPricingCount > 0
            BEGIN
                DECLARE @StuffIdHavePricing NVARCHAR(MAX);
                SELECT @StuffIdHavePricing = STUFF(
                (   SELECT DISTINCT '  , ' + QUOTENAME(Code)
                    FROM   (   SELECT s.Code
                               FROM   STF.Stuff s
                               WHERE  s.StuffID IN (   SELECT StuffID
                                                       FROM   ##PricingResultTemp )) AS a
                    FOR XML PATH(''), TYPE       ).value('.', 'NVARCHAR(MAX)') ,
                1   ,
                1   ,
                ''  );

                SET @StuffIdHavePricing = 'PricingDoBefore' + '   '
                                          + @StuffIdHavePricing;
                RAISERROR(@StuffIdHavePricing, 16, 13);
                RETURN;
            END;


        -- Check has PrevoucherID not null in StockReceipt
        DECLARE @PrevoucherIDNotNullCount INT;

        SELECT @PrevoucherIDNotNullCount = COUNT(PreVoucherID)
        FROM   ##CoreData
        WHERE  PreVoucherID IS NOT NULL;

        IF ( @PrevoucherIDNotNullCount > 0 )
            BEGIN
                DECLARE @HavePreVoucherIDStuffs NVARCHAR(MAX);

                SELECT @HavePreVoucherIDStuffs = STUFF(
                (   SELECT DISTINCT '  , ' + QUOTENAME(Code)
                    FROM   (   SELECT s.Code
                               FROM   STF.[Stuff] s
                               WHERE  s.StuffID IN (   SELECT StuffID
                                                       FROM   ##CoreData
                                                       WHERE  PreVoucherID IS NOT NULL )) AS a
                    FOR XML PATH(''), TYPE           ).value(
                                                           '.' ,
                                                           'NVARCHAR(MAX)') ,
                1   ,
                1   ,
                ''  );

                SET @HavePreVoucherIDStuffs = 'ReceiptBefore'
                                              + @HavePreVoucherIDStuffs;

                RAISERROR(@HavePreVoucherIDStuffs, 16, 13);
                RETURN;
            END;

        --Check has InvoiceFee not zero
        DECLARE @InvoiceFeeNotZeroCount INT;
        SELECT @InvoiceFeeNotZeroCount = COUNT(1)
        FROM   ##CoreData
        WHERE  OldFee > 0;

        IF (   @InvoiceFeeNotZeroCount > 0
               AND @IsConfirmed = 0 )
            BEGIN
                DECLARE @stuffsHasFee NVARCHAR(MAX);

                SELECT @stuffsHasFee = STUFF(
                (   SELECT DISTINCT '  , ' + QUOTENAME(Code)
                    FROM   (   SELECT s.Code
                               FROM   STF.[Stuff] s
                               WHERE  s.StuffID IN (   SELECT StuffID
                                                       FROM   ##CoreData
                                                       WHERE  OldFee > 0 )) AS a
                    FOR XML PATH(''), TYPE ).value('.', 'NVARCHAR(MAX)') ,
                1   ,
                1   ,
                ''  );

                SET @stuffsHasFee = 'FeeHasSet' + @stuffsHasFee;
                RAISERROR(@stuffsHasFee, 16, 13);
                RETURN;
            END;

        DECLARE @Precision INT;

        SET @Precision = CFG.GetBaseCurrencyPrecision();

        UPDATE ari
        SET    Fee = cd.Fee ,
               Price = ROUND(cd.Fee * ari.MainQuantity, @Precision) ,
               ShareOfCosts = 0
        FROM   STC.StockReceiptItem ari
               INNER JOIN ##CoreData cd ON cd.StockReceiptItemID = ari.StockReceiptItemID

        --Calculate TotalInvoicePrice for StokeReceipt And Update that
        ;
        WITH temp
        AS ( SELECT   StockReceiptID ,
                      SUM(Price) TotalInvoicePrice
             FROM     STC.StockReceiptItem
             GROUP BY StockReceiptID )
        UPDATE b
        SET    b.TotalInvoicePrice = t.TotalInvoicePrice ,
               b.TotalNetPrice = t.TotalInvoicePrice
        FROM   STC.StockReceipt b
               INNER JOIN temp t ON t.StockReceiptID = b.StockReceiptID;
    END;
