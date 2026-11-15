
CREATE   PROC [EDU].[spCourseRequestUpdate] 
    @CourseRequestID int,
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
    @LastEditionDate datetime,
    @Version int
AS 
	SET NOCOUNT ON 


	if @Version=(Select [Version] from [EDU].[CourseRequest]
	where [CourseRequestID] = @CourseRequestID)
	begin	

		set @Version = @Version +1 

		UPDATE [EDU].[CourseRequest]
		SET    [CourseID] = @CourseID, [OrganizationUnitID] = @OrganizationUnitID, [Number] = @Number, [Date] = @Date, [Description] = @Description, [CourseTopics] = @CourseTopics, [Status] = @Status, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate, [Version] = @Version
		WHERE  [CourseRequestID] = @CourseRequestID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   [EDU].[CourseRequest]
		WHERE  [CourseRequestID] = @CourseRequestID	
		-- End Return Select <- do not remove

	end
