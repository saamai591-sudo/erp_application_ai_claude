
CREATE    PROC [VND].spPurchaseInvoiceUpdate
    @PurchaseInvoiceID INT,
    @BaseType TINYINT,
    @DlID BIGINT,
    @BranchID INT,
    @FinancialPeriodID INT,
    @Type TINYINT,
    @InvoiceNumber NVARCHAR(100),
    @InvoiceDate DATE,
    @Number INT,
    @Date DATE,
    @CurrencyID INT,
    @CurrencyRate DECIMAL(36, 10) ,
    @TotalPrice DECIMAL(36, 10),
    @TotalDiscount DECIMAL(36, 10),
    @TotalTax DECIMAL(36, 10),
    @TotalDuty DECIMAL(36, 10),
    @TotalNetPrice DECIMAL(36, 10),
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT,
    @PreVoucherID INT,
    @ExchangeManner TINYINT,
	@Status TINYINT

--WITH ENCRYPTION
AS
    SET NOCOUNT ON;
    DECLARE @MaxVat DATE,
            @PreVersion INT,
            @PrePrevoucherid INT,
            @Message NVARCHAR(MAX),
            @oldDlID INT,
            @CompanyId INT;

    SELECT top 1 @CompanyId=CompanyID 
    FROM CFG.Branch 
    where BranchID=@BranchID

	EXEC CFG.CheckWithVatAndSeason @Date = @Date ,
	                               @FinancialPeriodId = @FinancialPeriodID, 
                                   @CompanyId=@CompanyId
    
    DECLARE @HasFlow BIT = (SELECT VND.PurchaseInvoiceHasFlow(@PurchaseInvoiceID) )
    IF (@HasFlow = 1)
    BEGIN
        RAISERROR('HasFlowItemCanNotEdit', 16, 12);
        RETURN;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM CFG.InstallmentPayment
        WHERE BaseType = 4
              AND DocumentID = @PurchaseInvoiceID
    )
    BEGIN
        RAISERROR('InvoiceHasInstallment', 16, 12);
    END;

    SELECT @PreVersion = [Version],
           @PrePrevoucherid = PreVoucherID,
           @oldDlID = DlID
    FROM [VND].[PurchaseInvoice]
    WHERE [PurchaseInvoiceID] = @PurchaseInvoiceID;

    IF @oldDlID <> @DlID
       AND EXISTS
    (
        SELECT 1
        FROM VND.PurchaseInvoiceItem AS pii
        WHERE pii.PurchaseInvoiceID = @PurchaseInvoiceID
              AND VND.PurchaseInvoiceItemHasFlow(pii.PurchaseInvoiceItemID) = 1
    )
    BEGIN
        RAISERROR('VendorManager.DlIdCannotChange', 16, 12);
        RETURN;
    END;

    IF @Version <> @PreVersion
       OR @PrePrevoucherid IS NOT NULL
        RAISERROR('Version mismatch...', 16, 10);

    DECLARE @StartNum INT = NULL,
            @EndNum INT = NULL,
            @ResetBranch BIT = 0,
            @ResetType BIT = 0,
            @DocumentNumID INT,
            @DocumentNumTypeID INT;

    SELECT @DocumentNumTypeID = DocumentNumTypeID
    FROM [CFG].[DocumentNumType]
    WHERE EngName = 'PurchaseInvoice';

    SELECT @StartNum = StartNum,
           @EndNum = EndNum,
           @DocumentNumID = DocumentNumID
    FROM CFG.DocumentNum
    WHERE DocumentNumTypeID = @DocumentNumTypeID
          AND FinancialPeriodID = @FinancialPeriodID;

    IF EXISTS (   SELECT *
                  FROM   CFG.DocumentNumResetNumberBase a
				  join cfg.DocumentNumResetNumberBaseType b
					on a.DocumentNumResetNumberBaseTypeID = b.DocumentNumResetNumberBaseTypeID
                  WHERE  DocumentNumID = @DocumentNumID
                    AND  b.EngName = 'Type' )
        BEGIN
            SET @ResetType = 1;
        END;


    IF EXISTS (   SELECT *
                  FROM   CFG.DocumentNumResetNumberBase a
				  join cfg.DocumentNumResetNumberBaseType b
					on a.DocumentNumResetNumberBaseTypeID = b.DocumentNumResetNumberBaseTypeID
                  WHERE  DocumentNumID = @DocumentNumID
                    AND  b.EngName = 'Branch' )
        BEGIN
            SET @ResetBranch = 1;
        END;


    IF (@Number = 0 OR @Number IS NULL) 
    BEGIN
        SET @Number = ISNULL(
                      (
                          SELECT MAX(Number) + 1
                          FROM [VND].[PurchaseInvoice]
                          WHERE FinancialPeriodID = @FinancialPeriodID
								AND (   @ResetType = 0   OR [Type] = @Type )
								AND (   @ResetBranch = 0 OR BranchID = @BranchID )
                      ),
                      @StartNum
                            );
    END;
    ELSE
    BEGIN
        IF (EXISTS
        (
            SELECT 1
            FROM [VND].[PurchaseInvoice]
            WHERE PurchaseInvoiceID <> @PurchaseInvoiceID
			AND FinancialPeriodID = @FinancialPeriodID
			AND (   @ResetType = 0   OR [Type] = @Type )
			AND (   @ResetBranch = 0 OR BranchID = @BranchID )
			AND Number = @Number
        )
           )
        BEGIN
            RAISERROR('NumberIsDuplicate', 16, 12);
            RETURN;
        END;
    END;

    IF (@Number >= @StartNum AND (@EndNum IS NULL OR @Number <= @EndNum))
    BEGIN
        DECLARE @oldCurrencyRate DECIMAL(20, 10);

        SELECT @oldCurrencyRate = pi.CurrencyRate
        FROM VND.PurchaseInvoice AS pi
        WHERE pi.PurchaseInvoiceID = @PurchaseInvoiceID;

        UPDATE [VND].[PurchaseInvoice]
        SET [BaseType] = @BaseType,
            [DlID] = @DlID,
            [BranchID] = @BranchID,
            [Type] = @Type,
            [InvoiceNumber] = @InvoiceNumber,
            [InvoiceDate] = @InvoiceDate,
            [Number] = @Number,
            [Date] = @Date,
            [CurrencyID] = @CurrencyID,
            [CurrencyRate] = @CurrencyRate,
            [TotalPrice] = @TotalPrice,
            [TotalDiscount] = @TotalDiscount,
            [TotalTax] = @TotalTax,
            [TotalDuty] = @TotalDuty,
            [TotalNetPrice] = @TotalNetPrice,
            [LastEditor] = @LastEditor,
            [LastEditionDate] = @LastEditionDate,
            [Version] = @Version + 1,
            [PreVoucherID] = @PreVoucherID,
            [ExchangeManner] = @ExchangeManner,
			Status = @Status
        WHERE [PurchaseInvoiceID] = @PurchaseInvoiceID;


        IF @BaseType = 6
           AND @oldCurrencyRate <> @CurrencyRate
        BEGIN
            DECLARE @ExchangeUnit DECIMAL(36, 10),
                    @BaseDigit DECIMAL(36, 10);

            SET @BaseDigit = CFG.GetBaseCurrencyPrecision();

            SELECT @ExchangeUnit = c.ExchangeUnit
            FROM CFG.Currency AS c
            WHERE c.CurrencyID = @CurrencyID;
            UPDATE sri
            SET sri.Fee = ROUND((pii.CostOfBuying * @CurrencyRate) / @ExchangeUnit, @BaseDigit) / sri.MainQuantity,
                Price = ROUND((pii.CostOfBuying * @CurrencyRate) / @ExchangeUnit, @BaseDigit)
            FROM STC.StockReceiptItem AS sri
                JOIN VND.PurchaseInvoiceItem AS pii
                    ON pii.StockReceiptItemID = sri.StockReceiptItemID
                       AND pii.PurchaseInvoiceID = @PurchaseInvoiceID;

            UPDATE sr
            SET TotalCosts =
                (
                    SELECT SUM(ShareOfCosts)
                    FROM STC.StockReceiptItem
                    WHERE StockReceiptID = sr.StockReceiptID
                ),
                TotalInvoicePrice =
                (
                    SELECT SUM(Price)
                    FROM STC.StockReceiptItem
                    WHERE StockReceiptID = sr.StockReceiptID
                ),
                TotalNetPrice =
                (
                    SELECT SUM(NetPrice)
                    FROM STC.StockReceiptItem
                    WHERE StockReceiptID = sr.StockReceiptID
                ),
                TotalEstimatedPrice =
                (
                    SELECT SUM(EstimatedPrice)
                    FROM STC.StockReceiptItem
                    WHERE StockReceiptID = sr.StockReceiptID
                )
            FROM STC.StockReceipt AS sr
                JOIN
                (
                    SELECT DISTINCT
                        sri.StockReceiptID
                    FROM VND.PurchaseInvoiceItem AS pii
                        JOIN STC.StockReceiptItem AS sri
                            ON sri.StockReceiptItemID = pii.StockReceiptItemID
                ) t
                    ON t.StockReceiptID = sr.StockReceiptID;
        END;
		
        -- Begin Return Select <- do not remove
        SELECT [Version],
			   [Number]
        FROM [VND].[PurchaseInvoice]
        WHERE [PurchaseInvoiceID] = @PurchaseInvoiceID;
        -- End Return Select <- do not remove
    END;
    ELSE
    BEGIN
        RAISERROR('InvalidNumberRange', 16, 12);
    END;
