CREATE    PROC [FIN].[spPaymentPromissoryCommitmentInsert]
    @PaymentCommitmentID int,
    @RowIndex smallint,
    @Number nvarchar(100),
    @Date date,
    @Seri nvarchar(100),
    @CurrencyID int,
    @CurrencyRate decimal(20, 10),
    @Amount decimal(30, 4),
    @Description nvarchar(250),
    @Description2 nvarchar(250),
    @LastState tinyint,
	@CommitmentTypeID int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 	
	
	INSERT INTO [FIN].[PaymentPromissoryCommitment] ([PaymentCommitmentID], [RowIndex], [Number], [Date], [Seri], [CurrencyID], [CurrencyRate], [Amount], [Description], [Description2], [LastState],[CommitmentTypeID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @PaymentCommitmentID, @RowIndex, @Number, @Date, @Seri, @CurrencyID, @CurrencyRate, @Amount, @Description, @Description2, @LastState,@CommitmentTypeID, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [PaymentPromissoryCommitmentID], [Version]
	FROM   [FIN].[PaymentPromissoryCommitment]
	WHERE  [PaymentPromissoryCommitmentID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
