CREATE PROC [FOS].[spShippingInsuranceUpdate] 
    @ShippingInsuranceID int,
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
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
AS 
	SET NOCOUNT ON 

	declare @FinancialPeriodID int,
			@PreVersion int

	Select  @PreVersion = [Version],
			@FinancialPeriodID = FinancialPeriodID
	from [FOS].[ShippingInsurance]
	where [ShippingInsuranceID] = @ShippingInsuranceID

	if @Version = @PreVersion
	begin	

		set @Version = @Version +1 

	if @Number is null or @Number = 0
	set @Number = isnull( (select max(number) + 1 from fos.[ShippingInsurance] where FinancialPeriodID = @FinancialPeriodID),1)

		UPDATE [FOS].[ShippingInsurance]
		SET     [BranchID] = @BranchID, 
				[Number] = @Number, 
				[Date] = @Date, 
				[ProformaInvoiceID] = @ProformaInvoiceID, 
				[PartyID] = @PartyID, 
				[ShippingInsuranceNumber] = @ShippingInsuranceNumber, 
				[IssueDate] = @IssueDate, 
				[CreditDate] = @CreditDate, 
				[ShippingInsuranceTypeID] = @ShippingInsuranceTypeID, 
				[CurrencyID] = @CurrencyID, 
				[Price] = @Price, 
				[PurchaseInvoiceItemID] = @PurchaseInvoiceItemID, 
				[Description] = @Description, 
				[Description2] = @Description2, 
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate, 
				[Version] = @Version
		WHERE  [ShippingInsuranceID] = @ShippingInsuranceID
	
		-- Begin Return Select <- do not remove
		SELECT [Version],[number]
		FROM   [FOS].[ShippingInsurance]
		WHERE  [ShippingInsuranceID] = @ShippingInsuranceID	
		-- End Return Select <- do not remove

	end 
	ELSE 
		RAISERROR('Version mismatch...', 16 , 10)
