
CREATE   PROC [SLE].spInvoiceUpdate
	@InvoiceID INT,
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
	@Version INT,
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

	DECLARE @MaxVat DATE,
			@PreDate DATE,
			@PreVersion INT,
			@prePrevoucherID INT,
			@Message NVARCHAR(MAX),
			@orgBranchId INT,
			@OrgSaleTypeId INT,
			@CompanyId INT,
			@PreStatus TINYINT,
			@engName  NVARCHAR(255) = 'Invoice',
			@DateHasChanged bit;

	if @SaleAreaID is null
	set @SaleAreaID = -1

	select @DateHasChanged = case when date<> @Date then 1 else 0 end
	 from sle.Invoice where InvoiceID = @InvoiceID

	SELECT @PreVersion = [Version],
		   @PreDate = [Date],
		   @prePrevoucherID = PreVoucherID,
		   @PreStatus = SaleInvoiceStatus
	FROM [SLE].[Invoice]
	WHERE [InvoiceID] = @InvoiceID;

	if @PreStatus = 5
	begin
		RAISERROR(N'SaleManager.RevokedInvoiceCannotBeChanged', 16, 12);
		RETURN;
	end
		
	SELECT @CompanyId=CompanyID 
	FROM CFG.Branch 
	WHERE BranchID=@BranchID;

	EXEC CFG.CheckWithVatAndSeason @Date, @FinancialPeriodID, @CompanyId;

	IF EXISTS
	(
		SELECT 1
		FROM CFG.InstallmentPayment
		WHERE BaseType = 2
			  AND DocumentID = @InvoiceID
	)
	BEGIN

		SET @Message = 'InvoiceHasInstallment';
		RAISERROR(@Message, 16, 12);
	END;

	IF @Version <> @PreVersion
	   OR @prePrevoucherID IS NOT NULL
		RAISERROR('Version mismatch...', 16, 10);

	SELECT @orgBranchId = i.BranchID,
		   @OrgSaleTypeId = i.SaleTypeID
	FROM SLE.Invoice AS i
	WHERE i.InvoiceID = @InvoiceID;
	DECLARE @NumberingPattern int
	if @DateHasChanged = 1
	begin 
	EXEC cfg.spGetPatternLastNumber
		@EntityName = @engName,
		@SaleAreaID = @SaleAreaID,
		@StationID = null,
		@FinancialPeriodID = @FinancialPeriodID,
		@SaleTypeID = @SaleTypeId,
		@BranchID = @BranchID,
		@Date = @Date,
		@EntityID = @InvoiceID,
		@number = @Number ,
		@NumberingPattern = @NumberingPattern 
		end

		UPDATE [SLE].[Invoice]
		SET [BaseDocument] = @BaseDocument,
			[SaleTypeID] = @SaleTypeId,
			[BranchID] = @BranchID,
			[CustomerID] = @CustomerID,
			[AddressID] = @AddressID,
			[Number] = @Number,
			[Date] = @Date,
			[CurrencyID] = @CurrencyID,
			[CurrencyRate] = @CurrencyRate,
			[TotalPrice] = @TotalPrice,
			[TotalDiscount] = @TotalDiscount,
			[TotalNetPrice] = @TotalNetPrice,
			[TotalTax] = @TotalTax,
			[TotalDuty] = @TotalDuty,
			[SaleInvoiceStatus] = @SaleInvoiceStatus,
			[Version] = @Version + 1,
			[LastEditor] = @LastEditor,
			[LastEditionDate] = @LastEditionDate,
			[SaleAgentID] = @SaleAgentID,
			[Percentage] = @Percentage,
			[SaleAreaID] = @SaleAreaID,
			[Usance] = @Usance,
			ParentInvoiceID = @ParentInvoiceID
		WHERE [InvoiceID] = @InvoiceID;

		IF @SaleInvoiceStatus = 5
		BEGIN

			DECLARE @OutgoingItemId INT,
					@InvoiceItemId INT,
					@RemittanceItemId INT,
					@InvoiceMainQuantity DECIMAL(30, 4),
					@InvoiceSubQuantity DECIMAL(30, 4),
					@JustificationItemID INT,
					@QuotationItemID INT;

			DECLARE db_cursor CURSOR FOR
			SELECT OutgoingItemId,
				   MainQuantity,
				   SubQuantity,
				   InvoiceItemID,
				   RemittanceItemID,
				   JustificationItemID,
				   QuotationItemID
			FROM [SLE].[InvoiceItem]
			WHERE [InvoiceID] = @InvoiceID;

			OPEN db_cursor;
			FETCH NEXT FROM db_cursor
			INTO @OutgoingItemId,
				 @InvoiceMainQuantity,
				 @InvoiceSubQuantity,
				 @InvoiceItemId,
				 @RemittanceItemId,
				 @JustificationItemID,
				 @QuotationItemID;

			WHILE @@FETCH_STATUS = 0
			BEGIN

				UPDATE SLE.InvoiceItem
				SET OutgoingItemId = NULL,
					JustificationItemID = NULL,
					QuotationItemID = NULL,
					RemittanceItemID = NULL
				WHERE InvoiceItemID = @InvoiceItemId;

				FETCH NEXT FROM db_cursor
				INTO @OutgoingItemId,
					 @InvoiceMainQuantity,
					 @InvoiceSubQuantity,
					 @InvoiceItemId,
					 @RemittanceItemId,
					 @JustificationItemID,
					 @QuotationItemID;
			END;

			CLOSE db_cursor;
			DEALLOCATE db_cursor;
		END;
		-- Begin Return Select <- do not remove
		SELECT  [Version] ,
				[Number]
		FROM [SLE].[Invoice]
		WHERE [InvoiceID] = @InvoiceID;
	-- End Return Select <- do not remove
END

