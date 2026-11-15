
------------------------------------------------------------------------------------------------
CREATE   PROC [STC].[spStockReceiptPricing]
(
    @stockReceiptItemIds ArrayInput READONLY,
    @FinancialPeriodId INT
)
AS
BEGIN

    DECLARE @StockReceiptItemID INT,
            @PurchaseInvoiceItemID INT,
            @EstimatedPrice DECIMAL(30, 10),
			@Non DECIMAL(36, 10),
            @NonPricedQuantity DECIMAL(30, 10),
            @UserID INT,
			@PurchaseInvoiceDate DATE,
            @BranchID INT;

    SET @UserID = CFG.GetuserID();

    DECLARE @revisionCostFeeItems TABLE
    (
        RevisionCostDate DATE NOT NULL,
        FinancialPeriodID INT NOT NULL,
        BranchID INT NOT NULL,
        StockReceiptItemID INT NOT NULL,
        RevisionFee DECIMAL(36, 10) NOT NULL,
        RevisionPrice DECIMAL(36, 10) NOT NULL,
        Deference DECIMAL(36, 10) NOT NULL
    );

    SELECT sri.StockReceiptItemID,
		   v.PurchaseInvoiceItemID,
           sri.EstimatedPrice,
		   h.Date PurchaseInvoiceDate,
		   h.BranchID,
		   sri.StockReceiptID
		into #itemsToCalculate
    FROM STC.StockReceiptItem AS sri
    INNER JOIN @stockReceiptItemIds AS srii
        ON sri.StockReceiptItemID = srii.Val
	INNER JOIN STC.StockReceipt_PurchaseInvoice v
		ON v.StockReceiptItemID = sri.StockReceiptItemID
	INNER JOIN VND.PurchaseInvoiceItem i
		ON v.PurchaseInvoiceItemID = i.PurchaseInvoiceItemID
	INNER JOIN VND.PurchaseInvoice h
		ON i.PurchaseInvoiceID = h.PurchaseInvoiceID

    DECLARE calculate_cursor CURSOR FOR
    SELECT itc.StockReceiptItemID,
		   itc.PurchaseInvoiceItemID,
           itc.EstimatedPrice,
		   itc.PurchaseInvoiceDate,
		   itc.BranchID
    FROM #itemsToCalculate AS itc;

    OPEN calculate_cursor;
    FETCH NEXT FROM calculate_cursor
    INTO @StockReceiptItemID,
		 @PurchaseInvoiceItemID,
         @EstimatedPrice,
		 @PurchaseInvoiceDate,
		 @BranchID;

    WHILE @@FETCH_STATUS = 0
    BEGIN

            SELECT @Non = Non ,
				   @NonPricedQuantity = NonPricedQuantity
            FROM VND.PurchaseInvoice_PriceRemains
            WHERE PurchaseInvoiceItemID = @PurchaseInvoiceItemID
			
			IF @EstimatedPrice = 0
			BEGIN

				UPDATE sri
				SET sri.Price = ROUND(sri.MainQuantity/@NonPricedQuantity * @Non , cfg.GetBaseCurrencyPrecision()),
					sri.Fee   = @Non / @NonPricedQuantity
				FROM STC.StockReceiptItem AS sri
				WHERE sri.StockReceiptItemID = @StockReceiptItemID;

			END;
			ELSE
			BEGIN
				DECLARE @feeValue DECIMAL(36, 10),
						@priceValue DECIMAL(36, 10);

				SELECT @priceValue = ROUND(sri.MainQuantity/@NonPricedQuantity * @Non , cfg.GetBaseCurrencyPrecision()),
					   @feeValue   = @Non / @NonPricedQuantity
				FROM STC.StockReceiptItem AS sri
				WHERE sri.StockReceiptItemID = @StockReceiptItemID;

				IF @priceValue <> @EstimatedPrice
				BEGIN

					INSERT @revisionCostFeeItems
					(
						RevisionCostDate,
						FinancialPeriodID,
						BranchID,
						StockReceiptItemID,
						RevisionFee,
						RevisionPrice,
						Deference
					)
					SELECT @PurchaseInvoiceDate,
						   @FinancialPeriodId,
						   @BranchID,
						   @StockReceiptItemID,
						   @feeValue,
						   @priceValue,
						   @priceValue - @EstimatedPrice
				END;
			END;

        FETCH NEXT FROM calculate_cursor
    INTO @StockReceiptItemID,
		 @PurchaseInvoiceItemID,
         @EstimatedPrice,
		 @PurchaseInvoiceDate,
		 @BranchID;
    END;

    CLOSE calculate_cursor;
    DEALLOCATE calculate_cursor;


		update sr
		set 
						sr.TotalCosts =
		                (
		                    SELECT SUM(ShareOfCosts)
		                    FROM STC.StockReceiptItem
		                    WHERE StockReceiptID = sr.StockReceiptID
		                ),
		                sr.TotalInvoicePrice =
		                (
		                    SELECT SUM(Price)
		                    FROM STC.StockReceiptItem
		                    WHERE StockReceiptID = sr.StockReceiptID
		                ),
		                sr.TotalNetPrice =
		                (
		                    SELECT SUM(NetPrice)
		                    FROM STC.StockReceiptItem
		                    WHERE StockReceiptID = sr.StockReceiptID
		                ),
		                sr.TotalEstimatedPrice =
		                (
		                    SELECT SUM(EstimatedPrice)
		                    FROM STC.StockReceiptItem
		                    WHERE StockReceiptID = sr.StockReceiptID
		                )
		from stc.StockReceipt sr
		join ( select distinct sii.StockReceiptID from  stc.StockReceiptItem sii
				join @stockReceiptItemIds tsi on tsi.Val = sii.StockReceiptItemID 
		) src on sr.StockReceiptID = src.StockReceiptID

    IF EXISTS (SELECT 1 FROM @revisionCostFeeItems)
    BEGIN

        DECLARE @maxId INT,
                @MaxRevisionCostNumber INT;

				        SELECT @maxId = MAX(rc.RevisionCostID)
        FROM STC.RevisionCost AS rc

        SELECT
		@MaxRevisionCostNumber = MAX(rc.Number)
        FROM STC.RevisionCost AS rc
        WHERE rc.FinancialPeriodID = @FinancialPeriodId;


        SELECT src.rn + ISNULL(@maxId,1) AS RevisionCostID,
               src.rn + ISNULL(@MaxRevisionCostNumber,1) AS Number,
               src.RevisionCostDate,
               src.FinancialPeriodID,
               src.BranchID
        INTO #revisionHeader
        FROM
        (
            SELECT ROW_NUMBER() OVER (ORDER BY BranchID) AS rn,
                   RevisionCostDate,
                   FinancialPeriodID,
                   BranchID
            FROM @revisionCostFeeItems
            GROUP BY RevisionCostDate,
                     FinancialPeriodID,
                     BranchID
        ) AS src;




        SET IDENTITY_INSERT STC.RevisionCost ON;

        INSERT INTO STC.RevisionCost
        (
            RevisionCostID,
            Number,
            [Date],
            AutoGenerated,
            PreVoucherID,
            FinancialPeriodID,
            Version,
            Creator,
            CreationDate,
            LastEditor,
            LastEditionDate,
            [Type],
            BranchID,
			[AutoGenerateType]
        )
        SELECT rh.RevisionCostID,
               rh.Number,
               rh.RevisionCostDate,
               1,
               NULL,
               rh.FinancialPeriodID,
               0,
               @UserID,
               GETDATE(),
               @UserID,
               GETDATE(),
               0,
               rh.BranchID,
			   2
        FROM #revisionHeader AS rh;

        SET IDENTITY_INSERT STC.RevisionCost OFF;

        INSERT STC.RevisionCostItem
        (
            RevisionCostID,
            StockReceiptItemID,
            RevisionFee,
            RevisionPrice,
            Deference,
            Description,
            Description2,
            Version,
            Creator,
            CreationDate,
            LastEditor,
            LastEditionDate
        )
        SELECT rh.RevisionCostID,
               rcfi.StockReceiptItemID,
               rcfi.RevisionFee,
               rcfi.RevisionPrice,
               rcfi.Deference,
               NULL,
               NULL,
               0,
               @UserID,
               GETDATE(),
               @UserID,
               GETDATE()
        FROM @revisionCostFeeItems AS rcfi
        JOIN #revisionHeader AS rh
            ON rh.BranchID = rcfi.BranchID
                AND rh.FinancialPeriodID = rcfi.FinancialPeriodID
                AND rh.RevisionCostDate = rcfi.RevisionCostDate;
    END;

END;
