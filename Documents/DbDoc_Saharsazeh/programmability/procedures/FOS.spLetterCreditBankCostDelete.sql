CREATE PROC [FOS].[spLetterCreditBankCostDelete] 
    @LetterCreditBankCostID int,@Version int
AS 
	SET NOCOUNT ON 

	
	if @Version=(Select [Version] from [FOS].[LetterCreditBankCost]
	where [LetterCreditBankCostID] = @LetterCreditBankCostID)
	begin	



		DELETE
		FROM   [FOS].[LetterCreditBankCost]
		WHERE  [LetterCreditBankCostID] = @LetterCreditBankCostID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'LetterCreditBankCost', -- First argument.
		@LetterCreditBankCostID); -- Second argument.)
	end

