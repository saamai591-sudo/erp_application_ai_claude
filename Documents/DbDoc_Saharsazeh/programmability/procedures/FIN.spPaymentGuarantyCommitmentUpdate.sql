
CREATE    PROC [FIN].[spPaymentGuarantyCommitmentUpdate]
    @PaymentGuarantyCommitmentID int,
    @PaymentCommitmentID int,
    @RowIndex smallint,
    @BankAccountID int,
    @Number nvarchar(100),
    @Date date,
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
	FROM fin.PaymentCommitment pr
	WHERE pr.PaymentCommitmentID = @PaymentCommitmentID
	
	if @Version <> (Select [Version] from [FIN].[PaymentGuarantyCommitment]
	where [PaymentGuarantyCommitmentID] = @PaymentGuarantyCommitmentID)
	OR @prePrevoucherID is not null
	RAISERROR('Version mismatch...', 16 , 10)	
	
	
		DECLARE @PreAmount decimal(30, 4)
		
		SELECT @PreAmount = p.Amount
		FROM FIN.PaymentGuarantyCommitment p
		WHERE p.PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID


		UPDATE [FIN].[PaymentGuarantyCommitment]
		SET     [RowIndex] = @RowIndex, 
				[BankAccountID] = @BankAccountID, 
				[Number] = @Number, 
				[Date] = @Date, 
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
		WHERE  [PaymentGuarantyCommitmentID] = @PaymentGuarantyCommitmentID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   [FIN].[PaymentGuarantyCommitment]
		WHERE  [PaymentGuarantyCommitmentID] = @PaymentGuarantyCommitmentID	
		-- End Return Select <- do not remove
