CREATE   PROC [EDU].[spCourseRegistrationItemDelete] 
    @CourseRegistrationItemID int,@Version int
AS 
	SET NOCOUNT ON
	
	declare @existingVersion int,@CoursePlanningID int,@Title nvarchar(256)

	select @CoursePlanningID = r.CoursePlanningID,@existingVersion = i.Version,@Title = c.Title
    from EDU.CourseRegistrationItem i
	join EDU.CourseRegistration r on i.CourseRegistrationID = r.CourseRegistrationID
	join EDU.CoursePlanning p on r.CoursePlanningID = p.CoursePlanningID
	join EDU.Course c on p.CourseID = c.CourseID
	where CourseRegistrationItemID = @CourseRegistrationItemID
	
	if (@Version = @existingVersion)
	begin	

		if exists(select * from EDU.Rollcall where CoursePlanningID = @CoursePlanningID)
		begin
			raiserror('غیر قابل حذف. به دلیل انجام حضور و غیاب برای دوره %s ',16,12,@Title)
			return
		end

		if exists(select * from EDU.CoursePlaningResult where CoursePlanningID = @CoursePlanningID)
		begin
			raiserror('غیر قابل حذف. به دلیل برگزاری آزمون برای دوره %s',16,12,@Title)
			return
		end

		DELETE
		FROM   [EDU].[CourseRegistrationItem]
		WHERE  [CourseRegistrationItemID] = @CourseRegistrationItemID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'CourseRegistrationItem', -- First argument.
		@CourseRegistrationItemID); -- Second argument.)
	end
