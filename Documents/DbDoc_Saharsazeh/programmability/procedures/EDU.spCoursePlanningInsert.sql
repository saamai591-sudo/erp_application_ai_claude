
--------------------------------------------------------------------------------------------------
CREATE   PROC [EDU].[spCoursePlanningInsert] 
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
    @LastEditionDate datetime
AS 
	SET NOCOUNT ON 

	IF (@Number is null or @Number = 0)
		SET @Number = isnull((SELECT MAX(c.Number) FROM EDU.CoursePlanning c),0) + 1 

	
	INSERT INTO [EDU].[CoursePlanning] ([CourseID], [CourseExamTypeID], [Number], [Date], [StartDate], [HasExam], [HasCertificate], [CoursePlaningType], [Description], [Status], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Version])
	SELECT @CourseID, @CourseExamTypeID, @Number, @Date, @StartDate, @HasExam, @HasCertificate, @CoursePlaningType, @Description, @Status, @Creator, @CreationDate, @LastEditor, @LastEditionDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT [CoursePlanningID],[Version] , [Number]
	FROM   [EDU].[CoursePlanning]
	WHERE  [CoursePlanningID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove
