CREATE   PROC [FIN].[spPaymentCommitmentRecallUpdate] 
    @PaymentCommitmentRecallID int,
    @FinancialPeriodID int,
    @BranchID int,
    @Date date,
    @DLID bigint,
    @CashID int,
    @PreVoucherID int,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
	
	DECLARE @prePrevoucherID INT,
			@PreVersion INT
	
	Select  @PreVersion = [Version],
			@prePrevoucherID = PreVoucherID
	from [FIN].[PaymentCommitmentRecall]
	where [PaymentCommitmentRecallID] = @PaymentCommitmentRecallID
	
	if @Version <> @PreVersion
	OR @prePrevoucherID is not null
	RAISERROR('Version mismatch...', 16 , 10)	


	UPDATE [FIN].[PaymentCommitmentRecall]
	SET     [BranchID] = @BranchID, 
			[Date] = @Date, 
			[DLID] = @DLID, 
			[CashID] = @CashID, 
			[Version] = @Version + 1,
			[LastEditor] = @LastEditor, 
			[LastEditionDate] = @LastEditionDate
	WHERE  [PaymentCommitmentRecallID] = @PaymentCommitmentRecallID
	
	-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   [FIN].[PaymentCommitmentRecall]
	WHERE  [PaymentCommitmentRecallID] = @PaymentCommitmentRecallID	
	-- End Return Select <- do not remove
