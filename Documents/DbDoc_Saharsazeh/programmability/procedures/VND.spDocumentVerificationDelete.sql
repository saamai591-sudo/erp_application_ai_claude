
CREATE   PROC [VND].[spDocumentVerificationDelete] 
    @DocumentVerificationID int,@Version int
AS 
	SET NOCOUNT ON 

	
	if @Version=(Select [Version] from [VND].[DocumentVerification]
	where [DocumentVerificationID] = @DocumentVerificationID)
	begin	



		DELETE
		FROM   [VND].[DocumentVerification]
		WHERE  [DocumentVerificationID] = @DocumentVerificationID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'DocumentVerification', -- First argument.
		@DocumentVerificationID); -- Second argument.)
	end
