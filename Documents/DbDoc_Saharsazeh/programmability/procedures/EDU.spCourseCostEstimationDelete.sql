
CREATE   PROC [EDU].[spCourseCostEstimationDelete] 
    @CourseCostEstimationID int,@Version int
AS 
SET NOCOUNT ON 
	
	declare @Status tinyint,@EntityVersion int	

	select @Status = p.[Status], @EntityVersion = c.[Version] from EDU.CourseCostEstimation c
	join EDU.CoursePlanning p on c.CoursePlanningID = p.CoursePlanningID
	where c.CourseCostEstimationID = @CourseCostEstimationID

	if (@Status = 2)
	begin
		raiserror('به دلیل خاتمه دوره، حذف امکان پذیر نمی باشد.',16,12)
		return
	end

	if (@Version = @EntityVersion)
	begin	

		DELETE
		FROM   [EDU].[CourseCostEstimation]
		WHERE  [CourseCostEstimationID] = @CourseCostEstimationID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'CourseCostEstimation', -- First argument.
		@CourseCostEstimationID); -- Second argument.)
	end
