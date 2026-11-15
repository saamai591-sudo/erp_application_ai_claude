CREATE   PROC [SLE].[spReturnedSaleInvoiceInsert]
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
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @PreVoucherID INT ,
	@SaleAreaID INT
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

    DECLARE @Message			NVARCHAR(MAX),
            @EngName			NVARCHAR(250) = 'ReturnedSaleInvoice',
            @NumberingPattern	INT;

	if @SaleAreaID is null
	set @SaleAreaID = -1


    DECLARE @CompanyId INT;

    SELECT top 1 @CompanyId=CompanyID 
    FROM CFG.Branch 
    where BranchID=@BranchID


	EXEC CFG.CheckWithVatAndSeason @Date = @Date , -- date
	                               @FinancialPeriodId = @FinancialPeriodID, -- int
                                   @CompanyId=@CompanyId

        BEGIN
            INSERT INTO [SLE].[ReturnedSaleInvoice] ( [FinancialPeriodID] ,
                                                      [BaseDocument] ,
                                                      [SaleTypeID] ,
                                                      [BranchID] ,
                                                      [CustomerID] ,
                                                      [Number] ,
                                                      [Date] ,
                                                      [CurrencyID] ,
                                                      [CurrencyRate] ,
                                                      [TotalPrice] ,
                                                      [TotalDiscount] ,
                                                      [TotalNetPrice] ,
                                                      [TotalTax] ,
                                                      [TotalDuty] ,
                                                      [Status] ,
                                                      [Version] ,
                                                      [Creator] ,
                                                      [CreationDate] ,
                                                      [LastEditor] ,
                                                      [LastEditionDate] ,
                                                      [PreVoucherID],
													  [Percentage],
													  [SaleAreaID])
                        SELECT @FinancialPeriodID ,
                               @BaseDocument ,
                               @SaleTypeId ,
                               @BranchID ,
                               @CustomerID ,
                               0 ,
                               @Date ,
                               @CurrencyID ,
                               @CurrencyRate ,
                               @TotalPrice ,
                               @TotalDiscount ,
                               @TotalNetPrice ,
                               @TotalTax ,
                               @TotalDuty ,
                               @Status ,
                               0 ,
                               @Creator ,
                               @CreationDate ,
                               @LastEditor ,
                               @LastEditionDate ,
                               @PreVoucherID ,
							   0,
							   @SaleAreaID
----Set Number
           BEGIN
           	
           	EXEC cfg.spGetPatternLastNumber
				@EntityName =			@engName,
				@SaleAreaID =			@SaleAreaID,
				@StationID =			NULL,
				@FinancialPeriodID =	@FinancialPeriodID,
				@SaleTypeID =			@SaleTypeId,
				@BranchID =				@BranchID,
                @Date =					@Date,
				@number =				@Number OUTPUT,
				@NumberingPattern =		@NumberingPattern  OUTPUT
			
           END				
    DECLARE @ReturnedSaleInvoiceID INT = SCOPE_IDENTITY();
	        
	        
			UPDATE sle.ReturnedSaleInvoice
			SET Number = @Number
			WHERE ReturnedSaleInvoiceID =  @ReturnedSaleInvoiceID
			
			UPDATE cfg.NumberingPattern
			SET LastAssignedNumber = @Number
			WHERE NumberingPatternID = @NumberingPattern			   

            -- Begin Return Select <- do not remove
            SELECT [ReturnedSaleInvoiceID] ,
                   [Version] ,
                   [Number]
            FROM   [SLE].[ReturnedSaleInvoice]
            WHERE  [ReturnedSaleInvoiceID] = SCOPE_IDENTITY();
        -- End Return Select <- do not remove
        END;
