CREATE   PROC [EDU].[spCourseRequestDelete] 
    @CourseRequestID int,@Version int
AS 
	SET NOCOUNT ON 

	if @Version=(Select [Version] from [EDU].[CourseRequest]
	where [CourseRequestID] = @CourseRequestID)
	begin	
		
		declare @Status tinyint
		select @Status = c.[Status] from EDU.CourseRequest c where c.CourseRequestID = @CourseRequestID
		if (@Status = 2 or @Status = 3)
		begin
			raiserror('درخواست بررسی شده قابل حذف نمی باشد.',16,12)
			return
		end

		DELETE
		FROM   [EDU].[CourseRequest]
		WHERE  [CourseRequestID] = @CourseRequestID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'CourseRequest', -- First argument.
		@CourseRequestID); -- Second argument.)
	end
