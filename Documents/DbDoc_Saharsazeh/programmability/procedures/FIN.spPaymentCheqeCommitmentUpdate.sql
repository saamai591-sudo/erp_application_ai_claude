CREATE     PROC [FIN].[spPaymentCheqeCommitmentUpdate]
    @PaymentCheqeCommitmentID int,
    @PaymentCommitmentID int,
    @RowIndex smallint,
    @BankAccountID int,
    @Number nvarchar(100),
	@CheqeBookID int,
    @CurrencyID int,
    @CurrencyRate decimal(20, 10),
    @Amount decimal(30, 4),
    @Description nvarchar(250),
    @Description2 nvarchar(250),
    @LastState tinyint,
	@Date date,
	@CommitmentTypeID int,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

	declare @duplicate bit = 0
	if (@CheqeBookID is not null)
	begin
		if exists(select 1 from FIN.PaymentCheqeCommitment 
		          where CheqeBookID = @CheqeBookID and PaymentCheqeCommitmentID <> @PaymentCheqeCommitmentID)
			set @duplicate = 1
	end
	else
	begin
		if exists(select 1 from FIN.PaymentCheqeCommitment 
		          where BankAccountID = @BankAccountID and Number = @Number and
			      PaymentCheqeCommitmentID <> @PaymentCheqeCommitmentID)
			set @duplicate = 1
	end

	if (@duplicate = 1)
	begin
		raiserror('چک (%s) تکراری است.',16,12,@Number)
		return
	end

	DECLARE @PreviousCheqeBookID int = null,			
			@PreVersion int,			
		    @PreVoucherID int = null

	select @PreviousCheqeBookID = c.CheqeBookID,
		   @PreVersion = c.[Version],
		   @PreVoucherID = p.PreVoucherID
	from FIN.PaymentCheqeCommitment c
	join FIN.PaymentCommitment p on c.PaymentCommitmentID = p.PaymentCommitmentID
	where c.PaymentCheqeCommitmentID = @PaymentCheqeCommitmentID


	if (@Version <> @PreVersion OR @PreVoucherID is not null)
		RAISERROR('Version mismatch...', 16 , 10)	


	IF ((@PreviousCheqeBookID IS NULL and @CheqeBookID IS NOT NULL) or
		(@PreviousCheqeBookID IS NOT NULL and @CheqeBookID IS NOT NULL and 
		 @PreviousCheqeBookID <> @CheqeBookID))
	BEGIN
		if ((select [Status] from FIN.CheqeBook where CheqeBookID = @CheqeBookID) = 1)
		begin
			RAISERROR('چک شماره (%s) قبلا صادر شده است.',16,12,@Number) 
			return
		end	
	END

	UPDATE [FIN].[PaymentCheqeCommitment]
	SET     [RowIndex] = @RowIndex, 
			[BankAccountID] = @BankAccountID, 
			[Number] = @Number, 
			[CheqeBookID] = @CheqeBookID,
			[CurrencyID] = @CurrencyID, 
			[CurrencyRate] = @CurrencyRate, 
			[Amount] = @Amount, 
			[Description] = @Description, 
			[Description2] = @Description2, 
			[LastState] = @LastState, 
			[Date] = @Date,
			[CommitmentTypeID] = @CommitmentTypeID,
			[Version] = @Version + 1, 
			[LastEditor] = @LastEditor, 
			[LastEditionDate] = @LastEditionDate
	WHERE  [PaymentCheqeCommitmentID] = @PaymentCheqeCommitmentID	
		
	IF (@PreviousCheqeBookID IS NOT NULL and (@CheqeBookID IS NULL or @PreviousCheqeBookID <> @CheqeBookID))
	BEGIN
		UPDATE [FIN].[CheqeBook]
		SET [Status] = 0
		WHERE [CheqeBookID] = @PreviousCheqeBookID
	END

	IF (@CheqeBookID is not null and (@PreviousCheqeBookID IS NULL or @PreviousCheqeBookID <> @CheqeBookID))
	begin
		UPDATE [FIN].[CheqeBook]
		SET [Status] = 1
		WHERE [CheqeBookID] = @CheqeBookID
	end	
		
	-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   [FIN].[PaymentCheqeCommitment]
	WHERE  [PaymentCheqeCommitmentID] = @PaymentCheqeCommitmentID	
	-- End Return Select <- do not remove
