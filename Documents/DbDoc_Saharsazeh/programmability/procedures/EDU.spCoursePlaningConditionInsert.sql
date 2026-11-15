               
--------------------------------------------------------------------------------------------------
CREATE   PROC [EDU].[spCoursePlaningConditionInsert] 
    @CoursePlanningID int,
    @HasMale bit,
    @HasFemale bit,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
AS 
	SET NOCOUNT ON 
	
	INSERT INTO [EDU].[CoursePlaningCondition] ([CoursePlanningID], [HasMale], [HasFemale], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Version])
	SELECT @CoursePlanningID, @HasMale, @HasFemale, @Creator, @CreationDate, @LastEditor, @LastEditionDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT [CoursePlaningConditionID], [Version]
	FROM   [EDU].[CoursePlaningCondition]
	WHERE  [CoursePlaningConditionID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove
