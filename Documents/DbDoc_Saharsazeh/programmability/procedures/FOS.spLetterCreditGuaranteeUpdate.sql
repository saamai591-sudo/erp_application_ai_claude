
CREATE   PROC FOS.spLetterCreditGuaranteeUpdate
    @LetterCreditGuaranteeID int,
    @LetterCreditID int,
	@PaymentCheqeCommitmentID int,
	@PaymentPromissoryCommitmentID int,
	@PaymentGuarantyCommitmentID int,	
	@RowIndex SMALLINT,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
AS 
	SET NOCOUNT ON 


	if @Version=(Select [Version] from FOS.LetterCreditGuarantee
	where LetterCreditGuaranteeID = @LetterCreditGuaranteeID)
	begin	

		set @Version = @Version +1 

		UPDATE FOS.LetterCreditGuarantee
		SET    [LetterCreditID] = @LetterCreditID,
			   [PaymentCheqeCommitmentID] = @PaymentCheqeCommitmentID, 
			   [PaymentPromissoryCommitmentID] = @PaymentPromissoryCommitmentID, 
			   [PaymentGuarantyCommitmentID] = @PaymentGuarantyCommitmentID, 
			   [RowIndex] = @RowIndex, 
			   [LastEditor] = @LastEditor, 
			   [LastEditionDate] = @LastEditionDate, 
			   [Version] = @Version
		WHERE  LetterCreditGuaranteeID = @LetterCreditGuaranteeID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   FOS.LetterCreditGuarantee
		WHERE  LetterCreditGuaranteeID = @LetterCreditGuaranteeID
		-- End Return Select <- do not remove

	end 
ELSE 
			RAISERROR('Version mismatch...', 16 , 10)

--------------------------------------------------------------------------------------------------------
