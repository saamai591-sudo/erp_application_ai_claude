
CREATE   PROC FOS.spLetterCreditGuaranteeInsert
    @LetterCreditID int,
    @PaymentCheqeCommitmentID int,
	@PaymentPromissoryCommitmentID int,
	@PaymentGuarantyCommitmentID int,
	@RowIndex SMALLINT,
    @Creator int,
    @CreationDate datetime
AS 
	SET NOCOUNT ON 

	
	INSERT INTO FOS.LetterCreditGuarantee
	           ([LetterCreditID],
	            [PaymentCheqeCommitmentID], 
				[PaymentPromissoryCommitmentID],
				[PaymentGuarantyCommitmentID],
				[RowIndex],
				[Creator],
				[CreationDate], 
				[LastEditor],
				[LastEditionDate], 
				[Version])
	SELECT @LetterCreditID, 
	       @PaymentCheqeCommitmentID,
		   @PaymentPromissoryCommitmentID, 
		   @PaymentGuarantyCommitmentID,
		   @RowIndex,
		   @Creator, 
		   @CreationDate, 
		   @Creator, 
		   @CreationDate, 
		   0
	
	-- Begin Return Select <- do not remove
	SELECT [LetterCreditGuaranteeID],[Version]
	FROM   [FOS].[LetterCreditGuarantee]
	WHERE  [LetterCreditGuaranteeID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove

-----------------------------------------------------------------------------------------------------------------
