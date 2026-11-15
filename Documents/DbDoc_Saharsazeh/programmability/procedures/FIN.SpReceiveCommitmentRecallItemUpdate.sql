
CREATE PROC [FIN].[SpReceiveCommitmentRecallItemUpdate] 
    @ReceiveCommitmentRecallItemID int,
    @ReceiveCommitmentRecallID int,
    @Type tinyint,
    @RowIndex smallint,
    @ReceiveCheqeCommitmentID int = NULL,
    @ReceiveGuarantyCommitmentID int = NULL,
    @ReceivePromissoryCommitmentID int = NULL,
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
	FROM fin.ReceiveCommitmentRecall pr
	WHERE pr.ReceiveCommitmentRecallID = @ReceiveCommitmentRecallID
	
	if @Version <> (Select [Version] from [FIN].[ReceiveCommitmentRecallItem]
	where [ReceiveCommitmentRecallItemID] = @ReceiveCommitmentRecallItemID)
	OR @prePrevoucherID is not null
	RAISERROR('Version mismatch...', 16 , 10)
		
	DECLARE @PreType tinyint,@PreReceiveCheqeCommitmentID int = null,
	@PreReceivePromissoryCommitmentID int = null,@PreReceiveGuarantyCommitmentID int = null
		
	SELECT @PreType = r.[Type],
		    @PreReceiveCheqeCommitmentID = r.ReceiveCheqeCommitmentID,
		    @PreReceivePromissoryCommitmentID = r.ReceivePromissoryCommitmentID,
		    @PreReceiveGuarantyCommitmentID = r.ReceiveGuarantyCommitmentID
	FROM FIN.ReceiveCommitmentRecallItem r
	WHERE r.ReceiveCommitmentRecallItemID = @ReceiveCommitmentRecallItemID

	UPDATE [FIN].[ReceiveCommitmentRecallItem]
	SET     [Type] = @Type, 
			[RowIndex] = @RowIndex, 
			[ReceiveCheqeCommitmentID] = @ReceiveCheqeCommitmentID, 
			[ReceiveGuarantyCommitmentID] = @ReceiveGuarantyCommitmentID, 
			[ReceivePromissoryCommitmentID] = @ReceivePromissoryCommitmentID, 
			[Version] = @Version + 1, 
			[LastEditor] = @LastEditor, 
			[LastEditionDate] = @LastEditionDate
	WHERE  [ReceiveCommitmentRecallItemID] = @ReceiveCommitmentRecallItemID
				
	IF (@PreType = 0 AND @Type = 0 AND @PreReceiveCheqeCommitmentID <> @ReceiveCheqeCommitmentID)
	BEGIN 
		
		UPDATE [FIN].[ReceiveCheqeCommitment]
		SET    [LastState] = 0
		WHERE  [ReceiveCheqeCommitmentID] = @PreReceiveCheqeCommitmentID
			
			
		if((select r.LastState from FIN.ReceiveCheqeCommitment r
		where r.ReceiveCheqeCommitmentID = @ReceiveCheqeCommitmentID) = 1)
		begin
			raiserror('اطلاعات تغییر یافته است، فرم را بسته و دوباره باز کنید.',16,12)
			return
		end
			
		UPDATE [FIN].[ReceiveCheqeCommitment]
		SET    [LastState] = 1
		WHERE  [ReceiveCheqeCommitmentID] = @ReceiveCheqeCommitmentID
		
	END
				
	IF (@PreType = 1 AND @Type = 1 AND @PreReceivePromissoryCommitmentID <> @ReceivePromissoryCommitmentID)
	BEGIN 
		
		UPDATE [FIN].[ReceivePromissoryCommitment]
		SET    [LastState] = 0
		WHERE  [ReceivePromissoryCommitmentID] = @PreReceivePromissoryCommitmentID
			
			
		if((select r.LastState from FIN.ReceivePromissoryCommitment r
		where r.ReceivePromissoryCommitmentID = @ReceivePromissoryCommitmentID) = 1)
		begin
			raiserror('اطلاعات تغییر یافته است، فرم را بسته و دوباره باز کنید.',16,12)
			return
		end
			
		UPDATE [FIN].[ReceivePromissoryCommitment]
		SET    [LastState] = 1
		WHERE  [ReceivePromissoryCommitmentID] = @ReceivePromissoryCommitmentID
		
	END	
	
	-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   [FIN].[ReceiveCommitmentRecallItem]
	WHERE  [ReceiveCommitmentRecallItemID] = @ReceiveCommitmentRecallItemID	
	-- End Return Select <- do not remove
