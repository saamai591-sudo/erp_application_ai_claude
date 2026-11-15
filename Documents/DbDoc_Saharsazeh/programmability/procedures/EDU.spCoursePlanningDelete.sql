CREATE PROC [EDU].[spCoursePlanningDelete] 
    @CoursePlanningID int,@Version int
AS 
	SET NOCOUNT ON 

	
	if @Version=(Select [Version] from [EDU].[CoursePlanning]
	where [CoursePlanningID] = @CoursePlanningID)
	begin	



		DELETE
		FROM   [EDU].[CoursePlanning]
		WHERE  [CoursePlanningID] = @CoursePlanningID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'CoursePlanning', -- First argument.
		@CoursePlanningID); -- Second argument.)
	end

