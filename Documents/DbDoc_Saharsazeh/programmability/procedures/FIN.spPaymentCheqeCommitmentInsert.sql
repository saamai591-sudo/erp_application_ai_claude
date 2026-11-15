CREATE     PROC [FIN].[spPaymentCheqeCommitmentInsert]
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
		if exists(select 1 from FIN.PaymentCheqeCommitment where CheqeBookID = @CheqeBookID)
			set @duplicate = 1
	end
	else
	begin
		if exists(select 1 from FIN.PaymentCheqeCommitment where BankAccountID = @BankAccountID and Number = @Number)
			set @duplicate = 1
	end

	if (@duplicate = 1)
	begin
		raiserror('چک (%s) تکراری است.',16,12,@Number)
		return
	end
		
	IF (@CheqeBookID is not null)
	BEGIN
		if ((select [Status] from FIN.CheqeBook where CheqeBookID = @CheqeBookID) = 1)
		begin
			RAISERROR('چک شماره (%s) قبلا صادر شده است.',16,12,@Number) 
			return
		end
	END
	
	INSERT INTO [FIN].[PaymentCheqeCommitment] ([PaymentCommitmentID], [RowIndex], [BankAccountID], [Number], [CheqeBookID], [CurrencyID], [CurrencyRate], [Amount], [Description], [Description2], [LastState], [Date],[CommitmentTypeID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @PaymentCommitmentID, @RowIndex, @BankAccountID, @Number, @CheqeBookID, @CurrencyID, @CurrencyRate, @Amount, @Description, @Description2, @LastState, @Date,@CommitmentTypeID, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [PaymentCheqeCommitmentID], [Version]
	FROM   [FIN].[PaymentCheqeCommitment]
	WHERE  [PaymentCheqeCommitmentID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove

	IF (@CheqeBookID IS NOT NULL)
	BEGIN
		UPDATE [FIN].[CheqeBook]
		SET [Status] = 1
		WHERE [CheqeBookID] = @CheqeBookID 
	END
