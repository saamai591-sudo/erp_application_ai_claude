
--------------------------------------------------------------------------------------------------
CREATE   PROC [EDU].[spCourseRequestInsert] 
    @CourseID int,
    @OrganizationUnitID int,
    @Number varchar(50),
    @Date date,
    @Description nvarchar(2048),
    @CourseTopics nvarchar(MAX),
	@Status tinyint,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
AS 
    SET NOCOUNT ON 

	IF (@Number is null)
    SET @Number = CAST(isnull((SELECT MAX(CAST(c.Number AS int)) FROM EDU.CourseRequest c),0) + 1 AS varchar(50)) 
	
	INSERT INTO [EDU].[CourseRequest] ([CourseID], [OrganizationUnitID], [Number], [Date], [Description], [CourseTopics], [Status], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Version])
	SELECT @CourseID, @OrganizationUnitID, @Number, @Date, @Description, @CourseTopics, @Status, @Creator, @CreationDate, @LastEditor, @LastEditionDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT [CourseRequestID], [Version], [Number]
	FROM   [EDU].[CourseRequest]
	WHERE  [CourseRequestID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove
