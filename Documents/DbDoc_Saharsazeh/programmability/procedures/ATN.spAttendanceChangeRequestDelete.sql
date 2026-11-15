
CREATE   PROC ATN.spAttendanceChangeRequestDelete 
    @AttendanceChangeRequestID int,
	@Version int
AS 
	SET NOCOUNT ON 
	SET XACT_ABORT ON  
	
IF @Version =
(
    SELECT [Version]
    FROM ATN.AttendanceChangeRequest
    WHERE AttendanceChangeRequestID = @AttendanceChangeRequestID
)
BEGIN
	DELETE
	FROM   ATN.AttendanceChangeRequest
	WHERE  AttendanceChangeRequestID = @AttendanceChangeRequestID

END;
ELSE
BEGIN

    RAISERROR(   N'Delete_%s_%d.',      -- Message text.
                 16,                    -- Severity,
                 10,                    -- State,
                 N'AttendanceChangeRequest', -- First argument.
                 @AttendanceChangeRequestID
             ); -- Second argument.

END;



