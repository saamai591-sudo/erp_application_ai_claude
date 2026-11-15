
---------------------------------------------------------
CREATE   PROC ATN.spAttendanceCalendarInsert
    @Date date,
	@AttendanceShiftID int, 
	@StartHour decimal(18,0),
	@EndHour decimal(18,0),
	@DayType TINYINT,
    @Creator int,
    @CreationDate datetime
--WITH ENCRYPTION 
AS 
	if exists (select 1 from ATN.AttendanceCalendar where [Date] = @Date and AttendanceShiftID = @AttendanceShiftID)
	begin
		RAISERROR(N'AttendanceManagement.Messages.DuplicateAttendanceCalendar', 16, 12);
		return
	end

	if (@StartHour is not null and @EndHour is not null and @EndHour < @StartHour)
	begin
		RAISERROR(N'AttendanceManagement.Messages.EndTimeGreaterThanStartTime', 16, 12);
		return
	end

	INSERT INTO ATN.AttendanceCalendar ([Date], AttendanceShiftID, StartHour, EndHour, DayType, [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @Date, @AttendanceShiftID, @StartHour, @EndHour, @DayType, 0, @Creator, @CreationDate, @Creator, @CreationDate
	
	-- Begin Return Select <- do not remove
	SELECT AttendanceCalendarID, [Version]
	FROM   ATN.AttendanceCalendar
	WHERE  AttendanceCalendarID = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
