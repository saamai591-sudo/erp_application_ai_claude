CREATE PROC [FIN].[spReceiveCommitmentRecallInsert] 
    @FinancialPeriodID int,
    @BranchID int,
    @Date date,
    @DLID bigint,
    @PreVoucherID int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
BEGIN
	SET NOCOUNT ON  
	
	
	INSERT INTO [FIN].[ReceiveCommitmentRecall] ([FinancialPeriodID], [BranchID], [Date], [DLID], [PreVoucherID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @FinancialPeriodID, @BranchID, @Date, @DLID, @PreVoucherID, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [ReceiveCommitmentRecallID],  [Version]
	FROM   [FIN].[ReceiveCommitmentRecall]
	WHERE  [ReceiveCommitmentRecallID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
END
