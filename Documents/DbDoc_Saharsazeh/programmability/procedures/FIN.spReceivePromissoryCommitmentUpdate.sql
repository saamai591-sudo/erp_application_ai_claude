CREATE PROC [FIN].[spReceivePromissoryCommitmentUpdate]
    @ReceivePromissoryCommitmentID int,
    @ReceiveCommitmentID int,
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
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
	
	DECLARE @prePrevoucherID INT

	SELECT @prePrevoucherID  = PreVoucherID
	FROM fin.ReceiveCommitment
	WHERE ReceiveCommitmentID = @ReceiveCommitmentID
		
	IF (
		@Version <> (Select [Version] from [FIN].[ReceivePromissoryCommitment] WHERE [ReceivePromissoryCommitmentID] = @ReceivePromissoryCommitmentID) 
		OR @prePrevoucherID is not null
	)
		RAISERROR('Version mismatch...', 16 , 10)	
	
	DECLARE @PreAmount decimal(30, 4)
		
	SELECT @PreAmount = r.Amount 
	FROM FIN.ReceivePromissoryCommitment r 
	WHERE r.ReceivePromissoryCommitmentID = @ReceivePromissoryCommitmentID

	UPDATE [FIN].[ReceivePromissoryCommitment]
		SET [RowIndex] = @RowIndex, 
			[Number] = @Number, 
			[Date] = @Date, 
			[Seri] = @Seri, 
			[CurrencyID] = @CurrencyID, 
			[CurrencyRate] = @CurrencyRate, 
			[Amount] = @Amount, 
			[Description] = @Description, 
			[Description2] = @Description2, 
			[LastState] = @LastState, 
			[CommitmentTypeID] = @CommitmentTypeID,
			[Version] = @Version + 1,
			[LastEditor] = @LastEditor, 
			[LastEditionDate] = @LastEditionDate
	WHERE  [ReceivePromissoryCommitmentID] = @ReceivePromissoryCommitmentID
			
	DECLARE @ReceiveRequestID int = null
	SELECT @ReceiveRequestID = r.ReceiveRequestID FROM FIN.ReceiveCommitment r WHERE r.ReceiveCommitmentID = @ReceiveCommitmentID
	
	IF (@ReceiveRequestID is not null)
	BEGIN
		UPDATE REQ.ReceiveRequest 
		SET Non_Received = (Non_Received + @PreAmount) - @Amount
		WHERE ReceiveRequestID = @ReceiveRequestID
	END

	-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   [FIN].[ReceivePromissoryCommitment]
	WHERE  [ReceivePromissoryCommitmentID] = @ReceivePromissoryCommitmentID	
	-- End Return Select <- do not remove
