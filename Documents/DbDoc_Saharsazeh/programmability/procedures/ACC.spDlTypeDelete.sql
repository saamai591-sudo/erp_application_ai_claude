CREATE   PROC [ACC].[spDlTypeDelete] 
    @DlTypeID int,@Version int
		--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON 
	SET XACT_ABORT ON  
	
	if @Version=(Select [Version] from [ACC].[DlType]
	where [DlTypeID] = @DlTypeID)
	begin
		DELETE
		FROM   [ACC].[DlType]
		WHERE  [DlTypeID] = @DlTypeID
	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
           16, -- Severity,
           10, -- State,
           N'DlType', -- First argument.
           @DlTypeID); -- Second argument.
	end
