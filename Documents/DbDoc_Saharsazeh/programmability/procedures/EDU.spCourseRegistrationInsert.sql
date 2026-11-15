
--------------------------------------------------------------------------------------------------
CREATE   PROC [EDU].[spCourseRegistrationInsert] 
    @CoursePlanningID int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
AS 
	SET NOCOUNT ON 
	
	INSERT INTO [EDU].[CourseRegistration] ([CoursePlanningID], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Version])
	SELECT @CoursePlanningID, @Creator, @CreationDate, @LastEditor, @LastEditionDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT [CourseRegistrationID], [Version]
	FROM   [EDU].[CourseRegistration]
	WHERE  [CourseRegistrationID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove
