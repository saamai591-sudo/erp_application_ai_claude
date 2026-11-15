CREATE     PROC [FOS].[spCreditAllocationInsert] 
    @FinancialPeriodID int,
    @Number int,
    @Date date,
	@LetterCreditID int,
    @Amount decimal(30, 4),
    @CurrencyRate decimal(20, 10),
    @Description nvarchar(256),
    @Description2 nvarchar(256),
    @Creator int,
    @CreationDate datetime
--WITH ENCRYPTION
AS 
BEGIN
	SET NOCOUNT ON 

	declare @OpeningCreditDate Date,
			@DueDate Date,
			@Remain decimal(30, 4), 
			@Message NVARCHAR(MAX)

	select  @OpeningCreditDate = OpeningCreditDate,
			@DueDate = DueDate
	from FOS.LetterCredit 
	where LetterCreditID = @LetterCreditID

	if @Date < @OpeningCreditDate
	begin
		SELECT @Message = lsv.[Value]
		FROM cfg.LocalizationSQLMessage ls
		JOIN cfg.LocalizationSQLMessageValue lsv 
		ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
		WHERE ls.SQLMessageCode = 'CreditAllocationDateCanNotBeLessThanTheOpeningCreditDate'
		AND lsv.Culture = cfg.GetuserCulture()
			
		SET @Message= REPLACE(@Message, '{0}', @Number)
		RAISERROR(@Message,16,12)
		return
	end

	if @Date > @DueDate
	begin
		SELECT @Message = lsv.[Value]
		FROM cfg.LocalizationSQLMessage ls
		JOIN cfg.LocalizationSQLMessageValue lsv 
		ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
		WHERE ls.SQLMessageCode = 'CreditAllocationDateCanNotBeLongerThanTheMaturityDate'
		AND lsv.Culture = cfg.GetuserCulture()
			
		SET @Message= REPLACE(@Message, '{0}', @Number)
		RAISERROR(@Message,16,12)
		return
	end

	if (@Number is null or @Number = 0)
	set @Number = isnull((select max(Number) + 1 from FOS.CreditAllocation where FinancialPeriodID = @FinancialPeriodID),1)
	
	INSERT INTO [FOS].[CreditAllocation]
           ([FinancialPeriodID]
           ,[Number]
           ,[Date]
           ,[LetterCreditID]
           ,[Amount]
           ,[CurrencyRate]
           ,[Description]
           ,[Description2]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version])
	SELECT @FinancialPeriodID, @Number, @Date, @LetterCreditID,
	       @Amount, @CurrencyRate, @Description, @Description2, 
		   @Creator, @CreationDate, @Creator, @CreationDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT CreditAllocationID,[Version],[Number]
	FROM   [FOS].[CreditAllocation]
	WHERE  CreditAllocationID = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
	
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
END
