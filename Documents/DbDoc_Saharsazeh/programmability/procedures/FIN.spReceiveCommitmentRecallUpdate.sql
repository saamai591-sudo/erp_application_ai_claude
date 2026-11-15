
CREATE PROC [FIN].[spReceiveCommitmentRecallUpdate] 
    @ReceiveCommitmentRecallID int,
    @FinancialPeriodID int,
    @BranchID int,
    @Date date,
    @DLID bigint,
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
	 from [FIN].[ReceiveCommitmentRecall]
	where [ReceiveCommitmentRecallID] = @ReceiveCommitmentRecallID
	
	if @Version <> @PreVersion
	OR @prePrevoucherID is not null
	RAISERROR('Version mismatch...', 16 , 10)	

	UPDATE [FIN].[ReceiveCommitmentRecall]
	SET     [BranchID] = @BranchID, 
			[Date] = @Date, 
			[DLID] = @DLID, 
			[Version] = @Version + 1, 
			[LastEditor] = @LastEditor, 
			[LastEditionDate] = @LastEditionDate
	WHERE  [ReceiveCommitmentRecallID] = @ReceiveCommitmentRecallID
	
	-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   [FIN].[ReceiveCommitmentRecall]
	WHERE  [ReceiveCommitmentRecallID] = @ReceiveCommitmentRecallID	
	-- End Return Select <- do not remove
