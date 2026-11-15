CREATE   PROC [EDU].[spCourseCostEstimationUpdate] 
    @CourseCostEstimationID int,
    @CoursePlanningID int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
AS 
	SET NOCOUNT ON 


	if @Version=(Select [Version] from [EDU].[CourseCostEstimation]
	where [CourseCostEstimationID] = @CourseCostEstimationID)
	begin	

		set @Version = @Version +1 

		UPDATE [EDU].[CourseCostEstimation]
		SET    [CoursePlanningID] = @CoursePlanningID, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate, [Version] = @Version
		WHERE  [CourseCostEstimationID] = @CourseCostEstimationID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version]
		FROM   [EDU].[CourseCostEstimation]
		WHERE  [CourseCostEstimationID] = @CourseCostEstimationID	
		-- End Return Select <- do not remove

	end
