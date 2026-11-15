
CREATE   PROC [EDU].[spRollcallUpdate] 
    @RollcallID int,
    @CoursePlanningID int,
	@CoursePlaningItemID int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
AS 
	SET NOCOUNT ON 

	if @Version=(Select [Version] from [EDU].[Rollcall]
	where [RollcallID] = @RollcallID)
	begin	

		set @Version = @Version +1 

		UPDATE [EDU].[Rollcall]
		SET    [CoursePlanningID] = @CoursePlanningID, [CoursePlaningItemID] = @CoursePlaningItemID,
		       [Creator] = @Creator, [CreationDate] = @CreationDate,
		       [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate, [Version] = @Version
		WHERE  [RollcallID] = @RollcallID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   [EDU].[Rollcall]
		WHERE  [RollcallID] = @RollcallID	
		-- End Return Select <- do not remove

	end
