CREATE   PROC [FIN].[spPaymentCommitmentRecallInsert] 
    @FinancialPeriodID int,
    @BranchID int,
    @Date date,
    @DLID bigint,
    @CashID int,
    @PreVoucherID int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON  
	
	INSERT INTO [FIN].[PaymentCommitmentRecall] ([FinancialPeriodID], [BranchID], [Date], [DLID], [CashID], [PreVoucherID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @FinancialPeriodID, @BranchID, @Date, @DLID, @CashID, @PreVoucherID, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [PaymentCommitmentRecallID], [Version]
	FROM   [FIN].[PaymentCommitmentRecall]
	WHERE  [PaymentCommitmentRecallID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
