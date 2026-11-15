CREATE   PROC [EDU].[spCoursePlanningUpdate] 
    @CoursePlanningID int,
    @CourseID int,
    @CourseExamTypeID int,
    @Number int,
    @Date date,
    @StartDate date,
    @HasExam bit,
    @HasCertificate bit,
    @CoursePlaningType tinyint,
    @Description nvarchar(2048),
    @Status tinyint,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
AS 
	SET NOCOUNT ON 


	if @Version=(Select [Version] from [EDU].[CoursePlanning]
	where [CoursePlanningID] = @CoursePlanningID)
	begin	

		set @Version = @Version +1 

		UPDATE [EDU].[CoursePlanning]
		SET    [CourseID] = @CourseID, [CourseExamTypeID] = @CourseExamTypeID, [Number] = @Number, [Date] = @Date, [StartDate] = @StartDate, [HasExam] = @HasExam, [HasCertificate] = @HasCertificate, [CoursePlaningType] = @CoursePlaningType, [Description] = @Description, [Status] = @Status, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate, [Version] = @Version
		WHERE  [CoursePlanningID] = @CoursePlanningID
	
		-- Begin Return Select <- do not remove
		SELECT [Version], [Number]
            FROM   [EDU].[CoursePlanning]
		WHERE  [CoursePlanningID] = @CoursePlanningID	
		-- End Return Select <- do not remove

	end
