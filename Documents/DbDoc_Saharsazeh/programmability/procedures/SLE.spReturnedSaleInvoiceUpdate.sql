------------------------------------- START #7283

CREATE   PROC [SLE].spReturnedSaleInvoiceUpdate
    @ReturnedSaleInvoiceID INT ,
    @FinancialPeriodID INT ,
    @BaseDocument TINYINT ,
    @SaleTypeId INT ,
    @BranchID INT ,
    @CustomerID BIGINT ,
    @Number INT ,
    @Date DATETIME ,
    @CurrencyID INT ,
    @CurrencyRate DECIMAL(20, 10) ,
    @TotalPrice DECIMAL(30, 4) ,
    @TotalDiscount DECIMAL(30, 4) ,
    @TotalNetPrice DECIMAL(30, 4) ,
    @TotalTax DECIMAL(30, 4) ,
    @TotalDuty DECIMAL(30, 4) ,
    @Status TINYINT ,
    @Version INT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @PreVoucherID INT,
	@SaleAreaID INT

--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

    DECLARE @PreDate DATE ,
            @PreVersion INT ,
            @prePrevoucherID INT ,
            @Message NVARCHAR(MAX),
            @NumberingPattern	INT;;

    SELECT @PreDate = [Date] ,
            @PreVersion = [Version] ,
            @prePrevoucherID = PreVoucherID
    FROM   [SLE].[ReturnedSaleInvoice]
    WHERE  [ReturnedSaleInvoiceID] = @ReturnedSaleInvoiceID;

	IF @SaleAreaID IS NULL 
        SET @SaleAreaID = -1

    DECLARE @CompanyId INT;

    SELECT top 1 @CompanyId=CompanyID 
    FROM CFG.Branch 
    where BranchID=@BranchID

	EXEC CFG.CheckWithVatAndSeason @Date = @Date , -- date
	                               @FinancialPeriodId = @FinancialPeriodID, -- int
                                   @CompanyId=@CompanyId

   
    DECLARE @HasFlow BIT = (SELECT [SLE].[ReturnedSaleInvoiceHasFlow](@ReturnedSaleInvoiceID) )
    IF (@HasFlow = 1)
    BEGIN
        RAISERROR('HasFlowItemCanNotEdit', 16, 12);
        RETURN;
    END;

    IF @Version <> @PreVersion
        OR @prePrevoucherID IS NOT NULL
        RAISERROR('Version mismatch...', 16, 10);
  
    ELSE 
    BEGIN
  		 	
                UPDATE [SLE].[ReturnedSaleInvoice]
                SET    [BaseDocument] = @BaseDocument ,
                       [SaleTypeID] = @SaleTypeId ,
                       [BranchID] = @BranchID ,
                       [CustomerID] = @CustomerID ,
                       [Number] = @Number ,
                       [Date] = @Date ,
                       [CurrencyID] = @CurrencyID ,
                       [CurrencyRate] = @CurrencyRate ,
                       [TotalPrice] = @TotalPrice ,
                       [TotalDiscount] = @TotalDiscount ,
                       [TotalNetPrice] = @TotalNetPrice ,
                       [TotalTax] = @TotalTax ,
                       [TotalDuty] = @TotalDuty ,
                       [Status] = @Status ,
                       [Version] = @Version + 1 ,
                       [LastEditor] = @LastEditor ,
                       [LastEditionDate] = @LastEditionDate,
					   [SaleAreaID] = @SaleAreaID
                WHERE  [ReturnedSaleInvoiceID] = @ReturnedSaleInvoiceID;

                -- Begin Return Select <- do not remove
                SELECT  [Version] ,
                        [Number]
                FROM   [SLE].[ReturnedSaleInvoice]
                WHERE  [ReturnedSaleInvoiceID] = @ReturnedSaleInvoiceID;
            -- End Return Select <- do not remove
            
			EXEC cfg.spGetPatternLastNumber
            	@EntityName = 'ReturnedSaleInvoice',
            	@SaleAreaID = @SaleAreaID,
            	@StationID = null,
            	@FinancialPeriodID = @FinancialPeriodID,
            	@SaleTypeID = @SaleTypeId,
            	@BranchID = @BranchID,
            	@Date = @Date,
            	@EntityID = @ReturnedSaleInvoiceID,
            	@number = @Number,
            	@NumberingPattern = @NumberingPattern
    END;
