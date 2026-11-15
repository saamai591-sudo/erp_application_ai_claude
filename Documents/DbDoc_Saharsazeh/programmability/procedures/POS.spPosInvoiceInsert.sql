
-------------Start of #8783
Create   PROC [POS].spPosInvoiceInsert
(
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
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Status TINYINT,
    @BasePosInvoiceID INT,
    @UniqueId BIGINT,
    @SaleAgentID INT,
    @RoundPrice DECIMAL(30, 4),
    @TotalNetPriceBeforeRound DECIMAL(30, 4),
    @TemporaryNumber INT,
    @PricingCalculationID INT
)
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS
    (
        SELECT 1
        FROM POS.PosInvoice AS pin
        WHERE pin.UniqueId = @UniqueId
    )
    BEGIN
        RAISERROR('StoreSale.DuplicatePosInvoice', 16, 12);
        RETURN;
    END;

    Declare @CompanyId INT;

    select top 1 @CompanyId=CompanyID  from POS.PosInvoice p
            join pos.StationShift  ss on p.StateShiftID = ss.StationShiftID
            join pos.Station s on ss.StationID = s.StationID
            join cfg.Branch b on b.BranchID = s.BranchID

    EXEC CFG.CheckWithVatAndSeason @Date, @FinancialPeriodID,@CompanyId;
	
    DECLARE @stationId						INT,
	        @NumberingPattern               INT;

    SELECT @stationId = StationID
    FROM POS.StationShift
    WHERE StationShiftID = @StateShiftID;
    
    DECLARE   @engName NVARCHAR(255) = N'PosInvoice',
            @Message NVARCHAR(MAX);

    IF @IsReturnInvoice = 1
        SET @engName = N'ReturnPosInvoice';
	 
    INSERT INTO [POS].[PosInvoice]
    (
        [FinancialPeriodID],
        [Number],
        [Date],
        [StateShiftID],
        IsReturnInvoice,
        [StockID],
        [CustomerID],
        [TotalPrice],
        [TotalDiscount],
        [TotalNetPrice],
        [TotalTax],
        [TotalDuty],
        [HasInstallment],
        [HasCredit],
        [Version],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Status],
        [BasePosInvoiceID],
        [UniqueId],
        SaleAgentID,
        [RoundPrice],
        [TotalNetPriceBeforeRound],
        [TemporaryNumber],
        [PricingCalculationID]
    )
    SELECT @FinancialPeriodID,
           ISNULL(@Number,0),
           @Date,
           @StateShiftID,
           @IsReturnInvoice,
           @StockID,
           @CustomerID,
           @TotalPrice,
           @TotalDiscount,
           @TotalNetPrice,
           @TotalTax,
           @TotalDuty,
           @HasInstallment,
           @HasCredit,
           0,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate,
           @Status,
           @BasePosInvoiceID,
           @UniqueId,
           @SaleAgentID,
           @RoundPrice,
           @TotalNetPriceBeforeRound,
           @TemporaryNumber,
           @PricingCalculationID;
           
           DECLARE @PosInvoiceID INT = SCOPE_IDENTITY();
           
    IF (@Status = 2)
    BEGIN
        IF (@TemporaryNumber = 0 OR @TemporaryNumber IS NULL)
            SET @TemporaryNumber = ISNULL(
                                   (
                                       SELECT MAX(p.TemporaryNumber) + 1 FROM POS.PosInvoice p
                                   ),
                                   1
                                         );
        SET @Number = 0;
    END;
    ELSE
    BEGIN
	if isnull(@Number ,0) =0
	begin
		EXEC cfg.spGetPatternLastNumber
			@EntityName = @engName,
			@SaleAreaID = null,
			@StationID = @stationId,
			@FinancialPeriodID = @FinancialPeriodID,
			@SaleTypeID = null,
			@BranchID = NULL,
			@Date = @Date,
			@number = @Number OUTPUT,
	        @NumberingPattern = @NumberingPattern  OUTPUT
			
			UPDATE pos.PosInvoice
			SET Number = @Number
			WHERE PosInvoiceID = @PosInvoiceID 
			
			UPDATE cfg.NumberingPattern
			SET LastAssignedNumber = @Number
			WHERE NumberingPatternID = @NumberingPattern
			end
    END;
           
    -- Begin Return Select <- do not remove
    SELECT PosInvoiceID,
           Version,
           Number
    FROM [POS].[PosInvoice]
    WHERE [PosInvoiceID] = @PosInvoiceID;
-- End Return Select <- do not remove

END;
---------------End of #8783
