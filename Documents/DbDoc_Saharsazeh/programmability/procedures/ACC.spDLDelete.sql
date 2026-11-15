CREATE   PROC [ACC].[spDLDelete] 
    @DLID bigint,@Version int
--WITH ENCRYPTION 
	 AS 
SET NOCOUNT ON 
	SET XACT_ABORT ON  

	if @Version=(Select [Version] from [ACC].[DL]
	where [DLID] = @DLID)
	begin
		DELETE
		FROM   [ACC].[DL]
		WHERE  [DLID] = @DLID
	end
	else
	begin
	
	declare @n varchar = cast(@DLID as varchar(100))
	RAISERROR (N'Delete_%s_%s.', -- Message text.
           16, -- Severity,
           10, -- State,
           N'DL', -- First argument.
           @n); -- Second argument.

	end
