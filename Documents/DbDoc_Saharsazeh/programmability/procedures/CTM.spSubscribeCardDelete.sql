CREATE PROC [CTM].[spSubscribeCardDelete] 
    @SubscribeCardID int,@Version int
AS 
	SET NOCOUNT ON 

	
	if @Version=(Select [Version] from [CTM].[SubscribeCard]
	where [SubscribeCardID] = @SubscribeCardID)
	begin	



		DELETE
		FROM   [CTM].[SubscribeCard]
		WHERE  [SubscribeCardID] = @SubscribeCardID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'SubscribeCard', -- First argument.
		@SubscribeCardID); -- Second argument.)
	end

