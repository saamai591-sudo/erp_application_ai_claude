
---------------------------------------------------------
CREATE   PROC ATN.spAttendanceCalendarUpdate
	@AttendanceCalendarID int,
	@Date date,
	@AttendanceShiftID int, 
	@StartHour decimal(18,0),
	@EndHour decimal(18,0),
	@DayType TINYINT,
	@Version int,
	@LastEditor int,
	@LastEditionDate datetime
AS 
	IF @Version <>
	(
		SELECT [Version]
		FROM [ATN].AttendanceCalendar 
		WHERE AttendanceCalendarID = @AttendanceCalendarID
	)
	begin
		RAISERROR('Version mismatch...', 16, 10);
	end    
	
	if exists (select 1 from ATN.AttendanceCalendar 
		where [Date] = @Date and AttendanceShiftID = @AttendanceShiftID and AttendanceCalendarID <> @AttendanceCalendarID)
	begin
		RAISERROR(N'AttendanceManagement.Messages.DuplicateAttendanceCalendar', 16, 12);
		return
	end

	if (@StartHour is not null and @EndHour is not null and @EndHour < @StartHour)
	begin
		RAISERROR(N'AttendanceManagement.Messages.EndTimeGreaterThanStartTime', 16, 12);
		return
	end   

	UPDATE [ATN].AttendanceCalendar
	SET    [Date] = @Date, 
		   AttendanceShiftID = @AttendanceShiftID, 
		   StartHour = @StartHour,
		   EndHour = @EndHour,
		   DayType = @DayType,
		   [Version] = @Version + 1, 
		   [LastEditor] = @LastEditor, 
		   [LastEditionDate] = @LastEditionDate
	WHERE  AttendanceCalendarID = @AttendanceCalendarID
	
	-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   ATN.AttendanceCalendar
	WHERE  AttendanceCalendarID = @AttendanceCalendarID
	-- End Return Select <- do not remove
