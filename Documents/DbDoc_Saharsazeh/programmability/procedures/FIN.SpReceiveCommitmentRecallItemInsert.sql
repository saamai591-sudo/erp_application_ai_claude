CREATE PROC [FIN].[SpReceiveCommitmentRecallItemInsert] 
    @ReceiveCommitmentRecallID int,
    @Type tinyint,
    @RowIndex smallint,
    @ReceiveCheqeCommitmentID int = NULL,
    @ReceiveGuarantyCommitmentID int = NULL,
    @ReceivePromissoryCommitmentID int = NULL,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
	
	INSERT INTO [FIN].[ReceiveCommitmentRecallItem] (
		[ReceiveCommitmentRecallID],
		[Type],
		[RowIndex], 
		[ReceiveCheqeCommitmentID], 
		[ReceiveGuarantyCommitmentID], 
		[ReceivePromissoryCommitmentID], 
		[Version], 
		[Creator], 
		[CreationDate], 
		[LastEditor], 
		[LastEditionDate]
	)
	SELECT @ReceiveCommitmentRecallID,
		   @Type,
		   @RowIndex, 
		   @ReceiveCheqeCommitmentID, 
		   @ReceiveGuarantyCommitmentID, 
		   @ReceivePromissoryCommitmentID, 
		   0, 
		   @Creator, 
		   @CreationDate, 
		   @LastEditor, 
		   @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [ReceiveCommitmentRecallItemID],
		   [Version]
	FROM [FIN].[ReceiveCommitmentRecallItem]
	WHERE [ReceiveCommitmentRecallItemID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
	
	IF (@Type = 0)
	BEGIN
		IF(
			(SELECT r.LastState 
			 FROM FIN.ReceiveCheqeCommitment r 
			 WHERE r.ReceiveCheqeCommitmentID = @ReceiveCheqeCommitmentID) 
		= 1)
		BEGIN
			RAISERROR('اطلاعات تغییر یافته است. فرم را بسته و دوباره باز کنید.',16,12)
			RETURN
		END
	
		UPDATE [FIN].[ReceiveCheqeCommitment]
		SET    [LastState] = 1
		WHERE  [ReceiveCheqeCommitmentID] = @ReceiveCheqeCommitmentID
	
	END
	
	IF (@Type = 1)
	BEGIN
		IF(
			(SELECT r.LastState 
			 FROM FIN.ReceivePromissoryCommitment r 
			 WHERE r.ReceivePromissoryCommitmentID = @ReceivePromissoryCommitmentID)
		= 1)
		BEGIN
			RAISERROR('اطلاعات تغییر یافته است. فرم را بسته و دوباره باز کنید.',16,12)
			RETURN
		END
	
		UPDATE [FIN].[ReceivePromissoryCommitment]
		SET    [LastState] = 1
		WHERE  [ReceivePromissoryCommitmentID] = @ReceivePromissoryCommitmentID
	
	END
