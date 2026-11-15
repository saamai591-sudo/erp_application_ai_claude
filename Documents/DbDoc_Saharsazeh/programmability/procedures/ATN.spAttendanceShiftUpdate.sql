
-------------------------------------
CREATE   PROC ATN.spAttendanceShiftUpdate
    @AttendanceShiftID int,
    @Code int,
    @Title nvarchar(250),
    @Title2 nvarchar(250),
	@StartDate DATE,
	@ShiftPeriod INT,
    @Version int,
    @LastEditor int,
    @LastEditionDate datetime
AS 
	SET NOCOUNT ON 
	SET XACT_ABORT ON  	

    IF @Version <>
    (
        SELECT [Version]
        FROM [ATN].AttendanceShift 
        WHERE AttendanceShiftID = @AttendanceShiftID
    )
	begin
		RAISERROR('Version mismatch...', 16, 10);
	end       
	
	if (@Code is null or @Code = 0)
	begin
		set @Code =isnull((select MAX(Code) from ATN.AttendanceShift),0) + 1
	end		 

	UPDATE [ATN].AttendanceShift
	SET    Code = @Code,
	       [Title] = @Title, 
	       [Title2] = @Title2, 
	       [StartDate] = @StartDate, 
	       [ShiftPeriod] = @ShiftPeriod,
	       [Version] = @Version + 1, 
		   [LastEditor] = @LastEditor, 
		   [LastEditionDate] = @LastEditionDate
	WHERE  AttendanceShiftID = @AttendanceShiftID
	
	-- Begin Return Select <- do not remove
	SELECT  [Version], Code
	FROM   ATN.AttendanceShift
	WHERE  AttendanceShiftID = @AttendanceShiftID
	-- End Return Select <- do not remove
