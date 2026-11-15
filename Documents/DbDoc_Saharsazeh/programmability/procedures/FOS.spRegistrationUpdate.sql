CREATE PROC [FOS].[spRegistrationUpdate] 
    @RegistrationID int,
    @BranchID int,
    @Date date,
    @ProformaInvoiceID int,
    @RegistrationNumber nvarchar(100),
    @RegistrationDate date,
	@CreditDate date,
    @WageRate decimal(18, 4),
    @WageRateManner tinyint,
    @CurrencyRate decimal(18, 4),
    @WageAmount decimal(30, 4),
    @Description nvarchar(2048),
	@Description2 nvarchar(2048),
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int,
	@PartyID BIGINT=null
AS 
	SET NOCOUNT ON 

	declare @FinancialPeriodID int,
			@PreVersion int

	Select  @PreVersion =  [Version] ,
			@FinancialPeriodID = FinancialPeriodID
	from [FOS].[Registration]
	where [RegistrationID] = @RegistrationID

	if @Version=@PreVersion
	begin	

		set @Version = @Version +1 

		UPDATE [FOS].[Registration]
		SET    [BranchID] = @BranchID, 
			   [Date] = @Date, 
			   [ProformaInvoiceID] = @ProformaInvoiceID, 
			   [RegistrationNumber] = @RegistrationNumber, 
			   [RegistrationDate] = @RegistrationDate, 
			   [CreditDate] = @CreditDate, 
			   [WageRate] = @WageRate, 
			   [WageRateManner] = @WageRateManner, 
			   [CurrencyRate] = @CurrencyRate, 
			   [WageAmount] = @WageAmount, 
			   [Description] = @Description, 
			   [Description2] = @Description2,
			   [LastEditor] = @LastEditor, 
			   [LastEditionDate] = @LastEditionDate, 
			   [Version] = @Version,
			   [PartyID]=@PartyID
		WHERE  [RegistrationID] = @RegistrationID
	
		-- Begin Return Select <- do not remove
		SELECT [Version], [Number]
		FROM   [FOS].[Registration]
		WHERE  [RegistrationID] = @RegistrationID	
		-- End Return Select <- do not remove

	end 
	ELSE 
		RAISERROR('Version mismatch...', 16 , 10)
