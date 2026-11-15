
CREATE PROC [FSS].[spReportDelete] 
    @ReportID int,@Version int
AS 
	SET NOCOUNT ON 

	
	if @Version=(Select [Version] from [FSS].[Report]
	where [ReportID] = @ReportID)
	begin	



		DELETE
		FROM   [FSS].[Report]
		WHERE  [ReportID] = @ReportID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'Report', -- First argument.
		@ReportID); -- Second argument.)
	end

