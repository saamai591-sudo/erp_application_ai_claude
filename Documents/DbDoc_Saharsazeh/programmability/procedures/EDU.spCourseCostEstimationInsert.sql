
------------------------------------------------------------
CREATE   PROC [EDU].[spCourseCostEstimationInsert] 
    @CoursePlanningID int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
AS 
	SET NOCOUNT ON 

	INSERT INTO [EDU].[CourseCostEstimation] ([CoursePlanningID], [Creator], [CreationDate], [LastEditor], [LastEditionDate],[Version])
	SELECT @CoursePlanningID, @Creator, @CreationDate, @LastEditor, @LastEditionDate,0
	
	-- Begin Return Select <- do not remove
	SELECT [CourseCostEstimationID], [Version]
	FROM   [EDU].[CourseCostEstimation]
	WHERE  [CourseCostEstimationID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove
