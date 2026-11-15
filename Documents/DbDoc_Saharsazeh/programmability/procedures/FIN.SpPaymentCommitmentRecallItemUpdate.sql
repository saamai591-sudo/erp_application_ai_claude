CREATE   PROC [FIN].[SpPaymentCommitmentRecallItemUpdate] 
    @PaymentCommitmentRecallItemID int,
    @PaymentCommitmentRecallID int,
    @Type tinyint,
    @RowIndex smallint,
    @PaymentCheqeCommitmentID int = NULL,
    @PaymentGuarantyCommitmentID int = NULL,
    @PaymentPromissoryCommitmentID int = NULL,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
	
	DECLARE @PreVoucherID INT

	SELECT @PreVoucherID = PreVoucherID
	FROM FIN.PaymentCommitmentRecall pr
	WHERE pr.PaymentCommitmentRecallID = @PaymentCommitmentRecallID
	
	if @Version <> (Select [Version] from [FIN].[PaymentCommitmentRecallItem]
	where [PaymentCommitmentRecallItemID] = @PaymentCommitmentRecallItemID)
	OR @PreVoucherID is not null
	RAISERROR('Version mismatch...', 16 , 10)	
	
		
	DECLARE @PreType tinyint,
		    @PrePaymentCheqeCommitmentID int = null,
			@PrePaymentPromissoryCommitmentID int = null
		
	SELECT @PreType = p.[Type],
		    @PrePaymentCheqeCommitmentID = p.PaymentCheqeCommitmentID,
		    @PrePaymentPromissoryCommitmentID = p.PaymentPromissoryCommitmentID
	FROM FIN.PaymentCommitmentRecallItem p
	WHERE p.PaymentCommitmentRecallItemID = @PaymentCommitmentRecallItemID
				
	UPDATE [FIN].[PaymentCommitmentRecallItem]
	SET     [Type] = @Type, 
			[RowIndex] = @RowIndex, 
			[PaymentCheqeCommitmentID] = @PaymentCheqeCommitmentID, 
			[PaymentGuarantyCommitmentID] = @PaymentGuarantyCommitmentID, 
			[PaymentPromissoryCommitmentID] = @PaymentPromissoryCommitmentID, 
			[Version] = @Version + 1,
			[LastEditor] = @LastEditor, 
			[LastEditionDate] = @LastEditionDate
	WHERE  [PaymentCommitmentRecallItemID] = @PaymentCommitmentRecallItemID
	
		
	IF (@PreType = 0 AND @Type = 0 AND @PrePaymentCheqeCommitmentID <> @PaymentCheqeCommitmentID)
	BEGIN 
		
		UPDATE [FIN].[PaymentCheqeCommitment]
		SET    [LastState] = 0
		WHERE  [PaymentCheqeCommitmentID] = @PrePaymentCheqeCommitmentID
			
			
		if((select p.LastState from FIN.PaymentCheqeCommitment p
		where p.PaymentCheqeCommitmentID = @PaymentCheqeCommitmentID) = 1)
		begin
			raiserror('اطلاعات تغییر یافته، فرم را بسته و دوباره باز کنید.',16,12)
			return
		end
		
		UPDATE [FIN].[PaymentCheqeCommitment]
		SET    [LastState] = 1
		WHERE  [PaymentCheqeCommitmentID] = @PaymentCheqeCommitmentID
					
		DECLARE @PreCheqeBookID int = null,@CheqeBookID int = null
					
		SELECT @PreCheqeBookID = CheqeBookID
		FROM FIN.PaymentCheqeCommitment 
		WHERE PaymentCheqeCommitmentID = @PrePaymentCheqeCommitmentID	

		SELECT @CheqeBookID = CheqeBookID
		FROM FIN.PaymentCheqeCommitment 
		WHERE PaymentCheqeCommitmentID = @PaymentCheqeCommitmentID
															
		IF (@PreCheqeBookID IS NOT NULL)
		BEGIN					
			UPDATE [FIN].[CheqeBook]
			SET [Status] = 1
			WHERE [CheqeBookID] = @PreCheqeBookID 						
		END					
											
		IF (@CheqeBookID IS NOT NULL)
		BEGIN					
			UPDATE [FIN].[CheqeBook]
			SET [Status] = 0
			WHERE [CheqeBookID] = @CheqeBookID 						
		END					
							
	END		
		
	IF (@PreType = 1 AND @Type = 1 AND @PrePaymentPromissoryCommitmentID <> @PaymentPromissoryCommitmentID)
	BEGIN
		
		UPDATE [FIN].[PaymentPromissoryCommitment]
		SET    [LastState] = 0
		WHERE  [PaymentPromissoryCommitmentID] = @PrePaymentPromissoryCommitmentID
			
			
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
		
	-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   [FIN].[PaymentCommitmentRecallItem]
	WHERE  [PaymentCommitmentRecallItemID] = @PaymentCommitmentRecallItemID	
	-- End Return Select <- do not remove
