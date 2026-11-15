CREATE PROC [FOS].[spLetterCreditUpdate] 
    @LetterCreditID int,
    @BranchID int,
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
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
AS 
	SET NOCOUNT ON 

	if @Version=(Select [Version] from [FOS].[LetterCredit]
	where [LetterCreditID] = @LetterCreditID)
	begin	

		set @Version = @Version +1 

		UPDATE [FOS].[LetterCredit]
		SET     [BranchID] = @BranchID, 
				[Date] = @Date, 
				[ProformaInvoiceID] = @ProformaInvoiceID, 
				[LetterCreditTypeID] = @LetterCreditTypeID, 
				[OpeningCreditBank] = @OpeningCreditBank, 
				[LetterCreditNumber] = @LetterCreditNumber, 
				[OpeningCreditDate] = @OpeningCreditDate, 
				[DueDate] = @DueDate, 
				[UsanceDuration] = @UsanceDuration, 
				[ProfitAmount] = @ProfitAmount, 
				[CreditAmount] = @CreditAmount,
				[DLID] = @DLID,
				[Description] = @Description, 
				[Description2] = @Description2, 
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate, 
				[Version] = @Version
		WHERE  [LetterCreditID] = @LetterCreditID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   [FOS].[LetterCredit]
		WHERE  [LetterCreditID] = @LetterCreditID	
		-- End Return Select <- do not remove

	END
