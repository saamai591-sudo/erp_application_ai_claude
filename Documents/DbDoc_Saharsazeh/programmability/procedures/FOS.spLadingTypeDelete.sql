CREATE PROC [FOS].[spLadingTypeDelete] 
    @LadingTypeID int,@Version int
AS 
	SET NOCOUNT ON 

	
	if @Version=(Select [Version] from [FOS].[LadingType]
	where [LadingTypeID] = @LadingTypeID)
	begin	



		DELETE
		FROM   [FOS].[LadingType]
		WHERE  [LadingTypeID] = @LadingTypeID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'LadingType', -- First argument.
		@LadingTypeID); -- Second argument.)
	end
