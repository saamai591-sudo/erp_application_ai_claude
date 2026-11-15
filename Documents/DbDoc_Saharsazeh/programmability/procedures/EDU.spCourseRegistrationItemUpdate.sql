CREATE   PROC [EDU].[spCourseRegistrationItemUpdate] 
    @CourseRegistrationItemID int,
    @CourseRegistrationID int,
    @RowIndex smallint,
	@PartyID bigint,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
AS 
	SET NOCOUNT ON 

	if @Version=(Select [Version] from [EDU].[CourseRegistrationItem]
	where [CourseRegistrationItemID] = @CourseRegistrationItemID)
	begin	

		set @Version = @Version +1 

		UPDATE [EDU].[CourseRegistrationItem]
		SET    [CourseRegistrationID] = @CourseRegistrationID, [RowIndex] = @RowIndex, [PartyID] = @PartyID,
		       [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor,
			   [LastEditionDate] = @LastEditionDate, [Version] = @Version
		WHERE  [CourseRegistrationItemID] = @CourseRegistrationItemID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version]
		FROM   [EDU].[CourseRegistrationItem]
		WHERE  [CourseRegistrationItemID] = @CourseRegistrationItemID	
		-- End Return Select <- do not remove

	end
