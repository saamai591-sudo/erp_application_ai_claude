CREATE PROC [FOS].[spLetterCreditTypeDelete] 
    @LetterCreditTypeID int,@Version int
AS 
	SET NOCOUNT ON 

	
	if @Version=(Select [Version] from [FOS].[LetterCreditType]
	where [LetterCreditTypeID] = @LetterCreditTypeID)
	begin	



		DELETE
		FROM   [FOS].[LetterCreditType]
		WHERE  [LetterCreditTypeID] = @LetterCreditTypeID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'LetterCreditType', -- First argument.
		@LetterCreditTypeID); -- Second argument.)
	end
