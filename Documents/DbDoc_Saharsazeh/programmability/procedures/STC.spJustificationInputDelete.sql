CREATE PROC [STC].[spJustificationInputDelete] 
    @JustificationInputID int,@Version int
AS 
	SET NOCOUNT ON 

	
	if @Version=(Select [Version] from [STC].[JustificationInput]
	where [JustificationInputID] = @JustificationInputID)
	begin	



		DELETE
		FROM   [STC].[JustificationInput]
		WHERE  [JustificationInputID] = @JustificationInputID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'JustificationInput', -- First argument.
		@JustificationInputID); -- Second argument.)
	end

