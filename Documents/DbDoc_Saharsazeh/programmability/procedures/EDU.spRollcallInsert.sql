
--------------------------------------------------------------------------------------------------
CREATE   PROC [EDU].[spRollcallInsert] 
    @CoursePlanningID int,
	@CoursePlaningItemID int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
AS 
	SET NOCOUNT ON 
	
	INSERT INTO [EDU].[Rollcall] ([CoursePlanningID], [CoursePlaningItemID], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Version])
	SELECT @CoursePlanningID, @CoursePlaningItemID, @Creator, @CreationDate, @LastEditor, @LastEditionDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT [RollcallID], [Version]
	FROM   [EDU].[Rollcall]
	WHERE  [RollcallID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove
