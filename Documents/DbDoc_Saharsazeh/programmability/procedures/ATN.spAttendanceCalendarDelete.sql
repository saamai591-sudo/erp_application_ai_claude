
CREATE   PROC ATN.spAttendanceCalendarDelete 
    @AttendanceCalendarID int,
	@Version int
AS 
	SET NOCOUNT ON 
	SET XACT_ABORT ON  
	
IF @Version =
(
    SELECT [Version]
    FROM ATN.AttendanceCalendar
    WHERE AttendanceCalendarID = @AttendanceCalendarID
)
BEGIN
	DELETE
	FROM   ATN.AttendanceCalendar
	WHERE  AttendanceCalendarID = @AttendanceCalendarID

END;
ELSE
BEGIN

    RAISERROR(   N'Delete_%s_%d.',      -- Message text.
                 16,                    -- Severity,
                 10,                    -- State,
                 N'AttendanceCalendar', -- First argument.
                 @AttendanceCalendarID
             ); -- Second argument.

END;



