
CREATE   PROC [EDU].[spCoursePlaningConditionDelete] 
    @CoursePlaningConditionID int,@Version int
AS 
	SET NOCOUNT ON 

	declare @entityVersion int,@CoursePlanningID int 

	Select @entityVersion = Version, @CoursePlanningID = CoursePlanningID 
	from EDU.CoursePlaningCondition
	where CoursePlaningConditionID = @CoursePlaningConditionID

	
	if (@Version=@entityVersion)
	begin	

		if exists (select * from EDU.CourseRegistration where CoursePlanningID = @CoursePlanningID)
		begin

			declare @Title nvarchar(256)
			select @Title = c.Title from EDU.CoursePlanning p
			join EDU.Course c on p.CourseID = c.CourseID
			where p.CoursePlanningID = @CoursePlanningID

			raiserror('به دلیل انجام ثبت نام برای دوره %s، حذف امکان پذیر نمی باشد.',16,12,@Title)
			return
		end

		DELETE
		FROM   [EDU].[CoursePlaningCondition]
		WHERE  [CoursePlaningConditionID] = @CoursePlaningConditionID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'CoursePlaningCondition', -- First argument.
		@CoursePlaningConditionID); -- Second argument.)
	end
