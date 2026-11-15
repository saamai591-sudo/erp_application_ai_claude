

CREATE   PROC [AST].[spChangePositionDelete]
    @ChangePositionID int,@Version int
AS 
	SET NOCOUNT ON
BEGIN TRY 



	if @Version=(Select [Version] 
				 from [AST].[ChangePosition]
				 where [ChangePositionID] = @ChangePositionID)
	begin
		
		DELETE
		FROM   [AST].[ChangePosition]
		WHERE  [ChangePositionID] = @ChangePositionID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'ChangePosition', -- First argument.
		@ChangePositionID); -- Second argument.)
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
