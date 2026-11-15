CREATE   PROC [FOS].[spCreditAllocationUpdate] 
	@CreditAllocationID int,
    @Number int,
    @Date date,
	@LetterCreditID int,
    @Amount decimal(30, 4),
    @CurrencyRate decimal(20, 10),
    @Description nvarchar(256),
    @Description2 nvarchar(256),
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON

	declare @FinancialPeriodID int,
			@PreVersion int

	Select  @PreVersion =  [Version] ,
			@FinancialPeriodID = FinancialPeriodID
	from FOS.CreditAllocation
	where CreditAllocationID = @CreditAllocationID
	
	if @Version=@PreVersion
	begin	

		set @Version = @Version + 1 

		if (@Number is null or @Number = 0)
		set @Number = isnull((select max(Number) + 1 from FOS.CreditAllocation where FinancialPeriodID = @FinancialPeriodID),1)

		UPDATE FOS.CreditAllocation
		SET     [Number] = @Number, 
				[Date] = @Date, 
				[LetterCreditID] = @LetterCreditID,
				[Amount] = @Amount, 
				[CurrencyRate] = @CurrencyRate, 
				[Description] = @Description, 
				[Description2] = @Description2, 
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate, 
				[Version] = @Version
		WHERE  CreditAllocationID = @CreditAllocationID
	
		-- Begin Return Select <- do not remove
		SELECT [Version],[Number]
		FROM   FOS.CreditAllocation
		WHERE  CreditAllocationID = @CreditAllocationID
		-- End Return Select <- do not remove

		DECLARE @Remain decimal(30, 4), @Message NVARCHAR(MAX)

	select @Remain = vw.Remain
	from FOS.LetterCredit l
	join FOS.vwLetterCreditRemain vw on l.LetterCreditID = vw.LetterCreditID
	where l.LetterCreditID = @LetterCreditID

	IF (@Remain < 0)	
	BEGIN
		SELECT @Message = lsv.[Value]
		FROM cfg.LocalizationSQLMessage ls
		JOIN cfg.LocalizationSQLMessageValue lsv 
		ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
		WHERE ls.SQLMessageCode = 'LetterCreditRemainWillBeNegative'
		AND lsv.Culture = cfg.GetuserCulture()
			
		SET @Message= REPLACE(@Message, '{0}', @Number)
		RAISERROR(@Message,16,12)
		return
	END
	end
	else 
		RAISERROR('Version mismatch...', 16 , 10)
