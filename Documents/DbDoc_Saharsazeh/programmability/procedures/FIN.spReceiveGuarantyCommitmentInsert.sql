CREATE   PROC [FIN].[spReceiveGuarantyCommitmentInsert]
    @ReceiveCommitmentID int,
    @RowIndex smallint,
    @Number nvarchar(100),
    @Date date,
    @CurrencyID int,
    @CurrencyRate decimal(20, 10),
    @Amount decimal(30, 4),
    @BankID int,
    @BankBranchCode nvarchar(100),
    @BankBranchName nvarchar(250),
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
	
	INSERT INTO [FIN].[ReceiveGuarantyCommitment] ([ReceiveCommitmentID], [RowIndex], [Number], [Date], [CurrencyID], [CurrencyRate], [Amount], [BankID], [BankBranchCode], [BankBranchName], [Description], [Description2], [LastState],[CommitmentTypeID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @ReceiveCommitmentID, @RowIndex, @Number, @Date, @CurrencyID, @CurrencyRate, @Amount, @BankID, @BankBranchCode, @BankBranchName, @Description, @Description2, @LastState,@CommitmentTypeID, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [ReceiveGuarantyCommitmentID], [Version]
	FROM   [FIN].[ReceiveGuarantyCommitment]
	WHERE  [ReceiveGuarantyCommitmentID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
	
	DECLARE @ReceiveRequestID int = null
	
	SELECT @ReceiveRequestID = r.ReceiveRequestID 
	FROM FIN.ReceiveCommitment r 
	WHERE r.ReceiveCommitmentID = @ReceiveCommitmentID
	
	IF (@ReceiveRequestID is not null)
	BEGIN
		UPDATE REQ.ReceiveRequest 
		SET Non_Received = Non_Received - @Amount
		WHERE ReceiveRequestID = @ReceiveRequestID
	END
