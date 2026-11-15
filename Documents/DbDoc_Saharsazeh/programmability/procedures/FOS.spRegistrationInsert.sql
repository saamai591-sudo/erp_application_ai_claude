CREATE PROC [FOS].[spRegistrationInsert] 
    @FinancialPeriodID int,
    @BranchID int,
    @Number int,
    @Date date,
    @ProformaInvoiceID int,
    @RegistrationNumber nvarchar(100),
    @RegistrationDate date,
	@CreditDate date,
    @WageRate decimal(18, 4),
    @WageRateManner tinyint,
    @CurrencyRate decimal(18, 4),
    @WageAmount decimal(30, 4),
	@PrevoucherID int,
    @Description nvarchar(2048),
	@Description2 nvarchar(2048),
    @Creator int,
    @CreationDate datetime,
	@PartyID BIGINT =null
AS 
	SET NOCOUNT ON 

	if @Number is null or @Number = 0
	set @Number = isnull( (select max(Number) + 1 from fos.Registration where FinancialPeriodID = @FinancialPeriodID),1)


	INSERT INTO [FOS].[Registration] ([FinancialPeriodID], [BranchID], [Number], [Date], 
									  [ProformaInvoiceID], [RegistrationNumber], [RegistrationDate], 
									  [CreditDate], [WageRate], [WageRateManner], [CurrencyRate], 
									  [WageAmount], [Description],[Description2], [PreVoucherID], 
									  [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Version],[PartyID])
	SELECT @FinancialPeriodID, @BranchID, @Number, @Date,
	       @ProformaInvoiceID, @RegistrationNumber, @RegistrationDate, 
		   @CreditDate, @WageRate, @WageRateManner, @CurrencyRate,
		   @WageAmount, @Description, @Description2, null, 
		   @Creator, @CreationDate, @Creator, @CreationDate, 0,@PartyID
	
	-- Begin Return Select <- do not remove
	SELECT	[RegistrationID],
			[Version],
			[Number]
	FROM   [FOS].[Registration]
	WHERE  [RegistrationID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
