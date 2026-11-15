
create PROC [FOS].[spLetterCreditGuaranteeDelete]
    @LetterCreditGuaranteeID int,@Version int
AS 
	SET NOCOUNT ON 

	
	if @Version=(Select [Version] from FOS.LetterCreditGuarantee
	where LetterCreditGuaranteeID = @LetterCreditGuaranteeID)
	begin	



		DELETE
		FROM   FOS.LetterCreditGuarantee
		WHERE  LetterCreditGuaranteeID = @LetterCreditGuaranteeID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'LetterCreditGuarantee', -- First argument.
		@LetterCreditGuaranteeID); -- Second argument.)
	end
