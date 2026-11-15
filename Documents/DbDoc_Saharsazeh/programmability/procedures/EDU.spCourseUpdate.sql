CREATE   PROC [EDU].[spCourseUpdate] 
    @CourseID int,
    @CourseTypeID int,
    @Code nvarchar(256),
    @Title nvarchar(256),
    @Title2 nvarchar(256),
    @Description nvarchar(2048),
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int,
	@Description2 nvarchar(2048) null
AS 
	SET NOCOUNT ON 


	if @Version=(Select [Version] from [EDU].[Course]
	where [CourseID] = @CourseID)
	begin	

		set @Version = @Version +1 

		UPDATE [EDU].[Course]
		SET    [CourseTypeID] = @CourseTypeID, [Code] = @Code, [Title] = @Title, [Title2] = @Title2, [Description] = @Description, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate, [Version] = @Version,[Description2]=@Description2
		WHERE  [CourseID] = @CourseID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   [EDU].[Course]
		WHERE  [CourseID] = @CourseID	
		-- End Return Select <- do not remove

	end
