
CREATE   PROC [EDU].[spCourseRegistrationDelete] 
    @CourseRegistrationID int,@Version int
AS 
SET NOCOUNT ON 
	if @Version=(Select [Version] from [EDU].[CourseRegistration]
	where [CourseRegistrationID] = @CourseRegistrationID)
	begin	

		DECLARE @ItemID int,@ItemVersion int
		
		DECLARE db_cursor CURSOR FOR
		SELECT [CourseRegistrationItemID],[Version] 
		FROM [EDU].[CourseRegistrationItem]
		WHERE [CourseRegistrationID] = @CourseRegistrationID		
		
		OPEN db_cursor   
		FETCH NEXT FROM db_cursor INTO @ItemID,@ItemVersion		
		
		WHILE @@FETCH_STATUS = 0   
		BEGIN  
		
		exec [EDU].[spCourseRegistrationItemDelete] @ItemID,@ItemVersion		
		
		FETCH NEXT FROM db_cursor INTO @ItemID,@ItemVersion		 
		END

		DELETE
		FROM   [EDU].[CourseRegistration]
		WHERE  [CourseRegistrationID] = @CourseRegistrationID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'CourseRegistration', -- First argument.
		@CourseRegistrationID); -- Second argument.)
	end
