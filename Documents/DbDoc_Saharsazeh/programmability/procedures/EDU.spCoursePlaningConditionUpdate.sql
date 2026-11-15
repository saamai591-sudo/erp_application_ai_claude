CREATE   PROC [EDU].[spCoursePlaningConditionUpdate] 
    @CoursePlaningConditionID int,
    @CoursePlanningID int,
    @HasMale bit,
    @HasFemale bit,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
AS 
	SET NOCOUNT ON 


	if @Version=(Select [Version] from [EDU].[CoursePlaningCondition]
	where [CoursePlaningConditionID] = @CoursePlaningConditionID)
	begin	

		set @Version = @Version +1 

		UPDATE [EDU].[CoursePlaningCondition]
		SET    [CoursePlanningID] = @CoursePlanningID, [HasMale] = @HasMale, [HasFemale] = @HasFemale, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate, [Version] = @Version
		WHERE  [CoursePlaningConditionID] = @CoursePlaningConditionID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version]
		FROM   [EDU].[CoursePlaningCondition]
		WHERE  [CoursePlaningConditionID] = @CoursePlaningConditionID	
		-- End Return Select <- do not remove

	end
