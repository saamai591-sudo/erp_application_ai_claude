
CREATE   PROC [SLE].spInvoiceInsert
	@FinancialPeriodID INT,
	@BaseDocument TINYINT,
	@SaleTypeId INT,
	@BranchID INT,
	@CustomerID BIGINT,
	@AddressID INT,
	@Number INT,
	@Date DATETIME,
	@CurrencyID INT,
	@CurrencyRate DECIMAL(20, 10),
	@TotalPrice DECIMAL(30, 4),
	@TotalDiscount DECIMAL(30, 4),
	@TotalNetPrice DECIMAL(30, 4),
	@TotalTax DECIMAL(30, 4),
	@TotalDuty DECIMAL(30, 4),
	@PreVoucherID INT,
	@SaleInvoiceStatus TINYINT,
	@Creator INT,
	@CreationDate DATETIME,
	@LastEditor INT,
	@LastEditionDate DATETIME,
	@SaleAgentID INT,
	@Percentage DECIMAL(30, 4),
	@SaleAreaID INT,
	@Usance INT,
	@ParentInvoiceID int
--WITH ENCRYPTION
AS
BEGIN
	SET NOCOUNT ON;

	if @SaleAreaID is null
	set @SaleAreaID = -1

-------------------  Start : SATURNNEW-5460 -------------------------
DECLARE @Message NVARCHAR(MAX),
		@CompanyId INT,
		@engName  NVARCHAR(255) = 'Invoice',
		@NumberingPattern INT;


	SELECT @CompanyId=CompanyID 
	FROM CFG.Branch 
	WHERE BranchID=@BranchID;
---------------------------  END: SATURNNEW-5460 --------------------

EXEC CFG.CheckWithVatAndSeason @Date, @FinancialPeriodID, @CompanyId;

	INSERT INTO [SLE].[Invoice]
	(
		[FinancialPeriodID],
		[BaseDocument],
		[SaleTypeID],
		[BranchID],
		[CustomerID],
		[AddressID],
		[Number],
		[Date],
		[CurrencyID],
		[CurrencyRate],
		[TotalPrice],
		[TotalDiscount],
		[TotalNetPrice],
		[TotalTax],
		[TotalDuty],
		[PreVoucherID],
		[SaleInvoiceStatus],
		[Version],
		[Creator],
		[CreationDate],
		[LastEditor],
		[LastEditionDate],
		[SaleAgentID],
		[Percentage],
		[SaleAreaID],
		[Usance],
		ParentInvoiceID
	)
	SELECT @FinancialPeriodID,
		   @BaseDocument,
		   @SaleTypeId,
		   @BranchID,
		   @CustomerID,
		   @AddressID,
		   @Number,
		   @Date,
		   @CurrencyID,
		   @CurrencyRate,
		   @TotalPrice,
		   @TotalDiscount,
		   @TotalNetPrice,
		   @TotalTax,
		   @TotalDuty,
		   @PreVoucherID,
		   @SaleInvoiceStatus,
		   0,
		   @Creator,
		   @CreationDate,
		   @LastEditor,
		   @LastEditionDate,
		   @SaleAgentID,
		   @Percentage,
		   @SaleAreaID,
		   @Usance,
		   @ParentInvoiceID;
		   
	---Set Number	   
if ISNULL(@Number,0) =0	
BEGIN
	EXEC cfg.spGetPatternLastNumber
			@EntityName = @engName,
			@SaleAreaID = @SaleAreaID,
			@StationID = NULL,
			@FinancialPeriodID = @FinancialPeriodID,
			@SaleTypeID = @SaleTypeId,
			@BranchID = @BranchID,
			@Date = @Date,
			@number = @Number OUTPUT,
			@NumberingPattern = @NumberingPattern  OUTPUT
				 
		   DECLARE @InvoiceID INT = SCOPE_IDENTITY();
			
	UPDATE sle.Invoice
			SET Number = @Number
			WHERE InvoiceID =  @InvoiceID
			
			UPDATE cfg.NumberingPattern
			SET LastAssignedNumber = @Number
			WHERE NumberingPatternID = @NumberingPattern	        
END

	-- Begin Return Select <- do not remove
	SELECT [InvoiceID],
		   [Version],
		   [Number]
	FROM [SLE].[Invoice]
	WHERE [InvoiceID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove

END;

