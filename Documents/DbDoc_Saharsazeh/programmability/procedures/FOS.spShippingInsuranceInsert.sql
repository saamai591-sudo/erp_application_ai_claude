CREATE PROC [FOS].[spShippingInsuranceInsert] 
    @FinancialPeriodID int,
    @BranchID int,
    @Number int,
    @Date date,
    @ProformaInvoiceID int,
    @PartyID bigint,
    @ShippingInsuranceNumber nvarchar(100),
    @IssueDate date,
    @CreditDate date,
    @ShippingInsuranceTypeID int,
    @CurrencyID int,
    @Price decimal(30, 4),
    @PurchaseInvoiceItemID int,
    @Description nvarchar(2048),
    @Description2 nvarchar(2048),
	@PreVoucherID int,
    @Creator int,
    @CreationDate datetime
AS 
BEGIN
	SET NOCOUNT ON 

	if @Number is null or @Number = 0
	set @Number = isnull( (select max(number) + 1 from fos.[ShippingInsurance] 
        where FinancialPeriodID = @FinancialPeriodID),1)
	
	INSERT INTO [FOS].[ShippingInsurance] ([FinancialPeriodID], [BranchID], [Number], [Date], [ProformaInvoiceID], [PartyID], [ShippingInsuranceNumber], [IssueDate], [CreditDate], [ShippingInsuranceTypeID], [CurrencyID], [Price], [PurchaseInvoiceItemID], [Description], [Description2],  [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Version])
	SELECT @FinancialPeriodID, @BranchID, @Number, @Date, @ProformaInvoiceID, @PartyID, @ShippingInsuranceNumber, @IssueDate, @CreditDate, @ShippingInsuranceTypeID, @CurrencyID, @Price, @PurchaseInvoiceItemID, @Description, @Description2,  @Creator, @CreationDate, @Creator, @CreationDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT [ShippingInsuranceID], [Version],[Number]
	FROM   [FOS].[ShippingInsurance]
	WHERE  [ShippingInsuranceID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
END
