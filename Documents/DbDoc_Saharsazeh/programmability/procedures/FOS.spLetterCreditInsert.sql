CREATE   PROC [FOS].[spLetterCreditInsert] 
    @FinancialPeriodID int,
    @BranchID int,
    @Number int,
    @Date date,
    @ProformaInvoiceID int,
    @LetterCreditTypeID int,
    @OpeningCreditBank bigint,
    @LetterCreditNumber nvarchar(100),
    @OpeningCreditDate date,
    @DueDate date,
    @UsanceDuration int,
    @ProfitAmount decimal(30, 4),
	@CreditAmount decimal(30, 4),
	@DLID bigint,
    @Description nvarchar(1024),
    @Description2 nvarchar(1024),
    @Creator int,
    @CreationDate datetime
AS 
	SET NOCOUNT ON 

	if @Number is null or @Number = 0
		set @Number = isnull((select max(Number) + 1 from FOS.LetterCredit where FinancialPeriodID = @FinancialPeriodID),1)
		
	INSERT INTO [FOS].[LetterCredit] ([FinancialPeriodID], [BranchID], [Number], [Date], [ProformaInvoiceID],
			[LetterCreditTypeID], [OpeningCreditBank], [LetterCreditNumber], [OpeningCreditDate],
	        [DueDate], [UsanceDuration], [ProfitAmount], [CreditAmount], [DLID], [Description], [Description2],
			[Creator], [CreationDate], [LastEditor], [LastEditionDate], [Version])
	SELECT @FinancialPeriodID, @BranchID, @Number, @Date, @ProformaInvoiceID,
	       @LetterCreditTypeID, @OpeningCreditBank, @LetterCreditNumber, @OpeningCreditDate,
		   @DueDate, @UsanceDuration, @ProfitAmount, @CreditAmount, @DLID, @Description, @Description2,
		   @Creator, @CreationDate, @Creator, @CreationDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT [LetterCreditID], [Version], [Number]
	FROM   [FOS].[LetterCredit]
	WHERE  [LetterCreditID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
