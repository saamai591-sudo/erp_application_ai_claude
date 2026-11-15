
CREATE   PROC ATN.spAttendanceShiftDelete 
    @AttendanceShiftID int,
	@Version int
AS 
	SET NOCOUNT ON 
	SET XACT_ABORT ON  
	
IF @Version =
(
    SELECT [Version]
    FROM ATN.AttendanceShift
    WHERE AttendanceShiftID = @AttendanceShiftID
)
BEGIN
	DELETE
	FROM   ATN.AttendanceShift
	WHERE  AttendanceShiftID = @AttendanceShiftID

END;
ELSE
BEGIN

    RAISERROR(   N'Delete_%s_%d.',      -- Message text.
                 16,                    -- Severity,
                 10,                    -- State,
                 N'AttendanceShift', -- First argument.
                 @AttendanceShiftID
             ); -- Second argument.

END;



