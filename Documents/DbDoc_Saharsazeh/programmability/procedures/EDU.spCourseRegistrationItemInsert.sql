
--------------------------------------------------------------------------------------------------
CREATE   PROC [EDU].[spCourseRegistrationItemInsert] 
    @CourseRegistrationID int,
    @RowIndex smallint,
	@PartyID bigint,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
AS 
	SET NOCOUNT ON 
	
	INSERT INTO [EDU].[CourseRegistrationItem] ([CourseRegistrationID], [RowIndex], [PartyID], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Version])
	SELECT @CourseRegistrationID, @RowIndex, @PartyID, @Creator, @CreationDate, @LastEditor, @LastEditionDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT [CourseRegistrationItemID], [Version]
	FROM   [EDU].[CourseRegistrationItem]
	WHERE  [CourseRegistrationItemID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove
