CREATE   PROC [FIN].[SpPaymentCommitmentRecallItemInsert] 
    @PaymentCommitmentRecallID int,
    @Type tinyint,
    @RowIndex smallint,
    @PaymentCheqeCommitmentID int = NULL,
    @PaymentGuarantyCommitmentID int = NULL,
    @PaymentPromissoryCommitmentID int = NULL,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
SET NOCOUNT ON 
	
	INSERT INTO [FIN].[PaymentCommitmentRecallItem] ([PaymentCommitmentRecallID], [Type], [RowIndex], [PaymentCheqeCommitmentID], [PaymentGuarantyCommitmentID], [PaymentPromissoryCommitmentID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @PaymentCommitmentRecallID, @Type, @RowIndex, @PaymentCheqeCommitmentID, @PaymentGuarantyCommitmentID, @PaymentPromissoryCommitmentID, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [PaymentCommitmentRecallItemID], [Version]
	FROM   [FIN].[PaymentCommitmentRecallItem]
	WHERE  [PaymentCommitmentRecallItemID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
	
	IF (@Type = 0)
	BEGIN
	
		if((select p.LastState from FIN.PaymentCheqeCommitment p
		where p.PaymentCheqeCommitmentID = @PaymentCheqeCommitmentID) = 1)
		begin
			raiserror('اطلاعات تغییر یافته، فرم را بسته و دوباره باز کنید.',16,12)
			return
		end
		
		UPDATE [FIN].[PaymentCheqeCommitment]
		SET    [LastState] = 1
		WHERE  [PaymentCheqeCommitmentID] = @PaymentCheqeCommitmentID

		DECLARE @CheqeBookID int = null
		select @CheqeBookID = CheqeBookID
		FROM FIN.PaymentCheqeCommitment 
		WHERE PaymentCheqeCommitmentID = @PaymentCheqeCommitmentID
		
		IF (@CheqeBookID IS NOT NULL)
		BEGIN
			
			UPDATE [FIN].[CheqeBook]
			SET [Status] = 0
			WHERE [CheqeBookID] = @CheqeBookID 
				
		END
	
	END
	
	IF (@Type = 1)
	BEGIN
	
		if((select p.LastState from FIN.PaymentPromissoryCommitment p
		where p.PaymentPromissoryCommitmentID = @PaymentPromissoryCommitmentID) = 1)
		begin
			raiserror('اطلاعات تغییر یافته، فرم را بسته و دوباره باز کنید.',16,12)
			return
		end
	
		UPDATE [FIN].[PaymentPromissoryCommitment]
		SET    [LastState] = 1
		WHERE  [PaymentPromissoryCommitmentID] = @PaymentPromissoryCommitmentID
	
	END
