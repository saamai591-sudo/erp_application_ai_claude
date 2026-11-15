    
-------------------------------------------------------
CREATE   PROC [POS].spPosInvoiceUpdate
(
    @PosInvoiceID INT,
    @FinancialPeriodID INT,
    @Number INT,
    @Date DATE,
    @IsReturnInvoice BIT,
    @StateShiftID INT,
    @StockID INT,
    @CustomerID BIGINT,
    @TotalPrice DECIMAL(30, 4),
    @TotalDiscount DECIMAL(30, 4),
    @TotalNetPrice DECIMAL(30, 4),
    @TotalTax DECIMAL(30, 4),
    @TotalDuty DECIMAL(30, 4),
    @HasInstallment BIT,
    @HasCredit BIT,
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Status TINYINT,
    @BasePosInvoiceID INT,
    @SaleAgentID INT,
    @RoundPrice DECIMAL(30, 4),
    @TotalNetPriceBeforeRound DECIMAL(30, 4),
    @TemporaryNumber INT,
    @PricingCalculationID INT,
    @UniqueId BIGINT
)
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS
    (
        SELECT 1
        FROM POS.PosInvoice AS pin
        WHERE pin.UniqueId = @UniqueId and pin.PosInvoiceID <> @PosInvoiceID
    )
    BEGIN
        RAISERROR('StoreSale.DuplicatePosInvoice', 16, 12);
        RETURN;
    END;

    DECLARE @PreDate DATE,
    @NumberingPattern INT;

    SELECT @PreDate = pi1.[Date]
    FROM POS.PosInvoice AS pi1
    WHERE pi1.PosInvoiceID = @PosInvoiceID;

    IF @Version =
    (
        SELECT [Version]
        FROM [POS].[PosInvoice]
        WHERE [PosInvoiceID] = @PosInvoiceID
    )
    BEGIN
        IF EXISTS
        (
            SELECT 1
            FROM POS.PosReceipt pr
                JOIN POS.PosInvoice p
                    ON p.PosInvoiceID = pr.PosInvoiceID
            WHERE pr.PosInvoiceID = @PosInvoiceID
                  AND
                  (
                      @TotalDiscount <> p.TotalDiscount
                      OR p.TotalNetPrice <> @TotalNetPrice
                      OR p.CustomerID <> @CustomerID
                      OR p.StockID <> @StockID
                  )
        )
        BEGIN
            RAISERROR('StoreSale.PosInvoiceHasPayment', 16, 12);
            RETURN;
        END;

            Declare @CompanyId INT;

    select top 1 @CompanyId=CompanyID  from POS.PosInvoice p
            join pos.StationShift  ss on p.StateShiftID = ss.StationShiftID
            join pos.Station s on ss.StationID = s.StationID
            join cfg.Branch b on b.BranchID = s.BranchID


        EXEC CFG.CheckWithVatAndSeason @PreDate, @FinancialPeriodID,@CompanyId;

        EXEC CFG.CheckWithVatAndSeason @Date, @FinancialPeriodID,@CompanyId;

        DECLARE @StartNum INT = NULL,
                @EndNum INT = NULL,
                @DocumentNumID INT,
                @engName NVARCHAR(255) = N'PosInvoice',
                @Message NVARCHAR(MAX),
                @stationType INT = 0;

        IF @IsReturnInvoice = 1
            SET @engName = N'ReturnPosInvoice';

        SELECT @StartNum = dn.StartNum,
               @EndNum = dn.EndNum,
               @DocumentNumID = dn.DocumentNumID
        FROM CFG.DocumentNum dn
            JOIN CFG.DocumentNumType dnt
                ON dnt.DocumentNumTypeID = dn.DocumentNumTypeID
        WHERE dnt.EngName = @engName
              AND dn.FinancialPeriodID = @FinancialPeriodID;

        IF EXISTS
        (
            SELECT 1
            FROM CFG.DocumentNumResetNumberBase
            WHERE DocumentNumID = @DocumentNumID
                  AND DocumentNumResetNumberBaseTypeID = 8
        )
        BEGIN
            SET @stationType = 1;
        END;

        DECLARE @stationId INT;

        SELECT @stationId = StationID
        FROM POS.StationShift
        WHERE StationShiftID = @StateShiftID;
        
		SET @Version = @Version + 1;

        UPDATE [POS].[PosInvoice]
        SET [FinancialPeriodID] = @FinancialPeriodID,
            IsReturnInvoice = @IsReturnInvoice,
            [Number] = @Number,
            [Date] = @Date,
            [StateShiftID] = @StateShiftID,
            [StockID] = @StockID,
            [CustomerID] = @CustomerID,
            [TotalPrice] = @TotalPrice,
            [TotalDiscount] = @TotalDiscount,
            [TotalNetPrice] = @TotalNetPrice,
            [TotalTax] = @TotalTax,
            [TotalDuty] = @TotalDuty,
            [HasInstallment] = @HasInstallment,
            [HasCredit] = @HasCredit,
            [Version] = @Version,
            [Creator] = @Creator,
            [CreationDate] = @CreationDate,
            [LastEditor] = @LastEditor,
            [LastEditionDate] = @LastEditionDate,
            [Status] = @Status,
            [BasePosInvoiceID] = @BasePosInvoiceID,
            [SaleAgentID] = @SaleAgentID,
            [RoundPrice] = @RoundPrice,
            [TotalNetPriceBeforeRound] = @TotalNetPriceBeforeRound,
            TemporaryNumber = @TemporaryNumber,
            PricingCalculationID = @PricingCalculationID
        WHERE [PosInvoiceID] = @PosInvoiceID;


			EXEC cfg.spGetPatternLastNumber
				@EntityName = @engName,
				@SaleAreaID = null,
				@StationID = @stationId,
				@FinancialPeriodID = @FinancialPeriodID,
				@SaleTypeID = null,
				@BranchID = NULL,
				@Date = @Date,				
            	@EntityID = @PosInvoiceID,
				@number = @Number,
				@NumberingPattern = @NumberingPattern  
			
		
		
    
        -- Begin Return Select <- do not remove
        SELECT  [Version], Number
        FROM [POS].[PosInvoice]
        WHERE [PosInvoiceID] = @PosInvoiceID;
    -- End Return Select <- do not remove
    END;
    ELSE
        RAISERROR('Version mismatch...', 16, 10);
END;
