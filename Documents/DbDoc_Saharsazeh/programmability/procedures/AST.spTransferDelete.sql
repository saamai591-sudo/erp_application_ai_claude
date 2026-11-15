

CREATE   PROC [AST].[spTransferDelete] 
    @TransferID int,@Version int
AS 
	SET NOCOUNT ON
BEGIN TRY 

	declare @PreVoucherID int

	Select @PreVoucherID = PreVoucherID 
	from [AST].[Transfer]
	where [TransferID] = @TransferID

	if (@PreVoucherID is not null)
	begin
        RAISERROR('UnableToDeletePrevoucher',16,12)
		RETURN
	end

	if @Version=(Select [Version] from [AST].[Transfer]
	where [TransferID] = @TransferID)
	begin
		
		DELETE
		FROM   [AST].[Transfer]
		WHERE  [TransferID] = @TransferID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'Transfer', -- First argument.
		@TransferID); -- Second argument.)
	end
END TRY
BEGIN CATCH

if CURSOR_STATUS('global','db_cursor') = 1
begin
	CLOSE db_cursor   
	DEALLOCATE db_cursor
end		
	DECLARE @ErrorMessage NVARCHAR(4000);
	DECLARE @ErrorSeverity INT;
	DECLARE @ErrorState INT;

	SELECT 
		@ErrorMessage = ERROR_MESSAGE(),
		@ErrorSeverity = ERROR_SEVERITY(),
		@ErrorState = ERROR_STATE();

	if (ERROR_NUMBER()=547)
		set @ErrorState=11
	RAISERROR (@ErrorMessage, -- Message text.
			   @ErrorSeverity, -- Severity.
			   @ErrorState -- State.
			   );
				   
END CATCH
