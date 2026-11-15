
CREATE   PROC [EDU].[spCourseRegistrationUpdate] 
    @CourseRegistrationID int,
    @CoursePlanningID int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
AS 
	SET NOCOUNT ON 

	if @Version=(Select [Version] from [EDU].[CourseRegistration]
	where [CourseRegistrationID] = @CourseRegistrationID)
	begin	

		set @Version = @Version +1 

		UPDATE [EDU].[CourseRegistration]
		SET    [CoursePlanningID] = @CoursePlanningID, [Creator] = @Creator, [CreationDate] = @CreationDate,
		       [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate, [Version] = @Version
		WHERE  [CourseRegistrationID] = @CourseRegistrationID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version]
		FROM   [EDU].[CourseRegistration]
		WHERE  [CourseRegistrationID] = @CourseRegistrationID	
		-- End Return Select <- do not remove

	end
