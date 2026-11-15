CREATE   PROC [EDU].[spRollcallDelete] 
    @RollcallID int,@Version int
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON

	declare @Status tinyint,@EntityVersion int,@Title nvarchar(256),@id int = null	

	select @Status = p.[Status], @EntityVersion = r.[Version], @id = cpr.CoursePlanningID, @Title = c.Title from EDU.Rollcall r
	join EDU.CoursePlanning p on r.CoursePlanningID = p.CoursePlanningID
	join EDU.Course c on p.CourseID = c.CourseID
	left join EDU.CoursePlaningResult cpr on p.CoursePlanningID = cpr.CoursePlanningID
	where r.RollcallID = @RollcallID

	if (@id is not null)
	begin
		raiserror('به دلیل برگزاری آزمون برای دوره %s، حذف امکان پذیر نمی باشد.',16,12,@Title)
		return
	end

	if (@Status = 2)
	begin
		raiserror('به دلیل خاتمه دوره %s، حذف امکان پذیر نمی باشد.',16,12,@Title)
		return
	end
	
	if (@Version = @EntityVersion)
	begin	

		DELETE
		FROM   [EDU].[Rollcall]
		WHERE  [RollcallID] = @RollcallID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'Rollcall', -- First argument.
		@RollcallID); -- Second argument.)
	end
