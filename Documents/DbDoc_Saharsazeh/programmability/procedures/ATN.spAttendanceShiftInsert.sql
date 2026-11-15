
-------------------------------------
CREATE    PROC ATN.spAttendanceShiftInsert
    @Code int,
    @Title nvarchar(256),
    @Title2 nvarchar(256),
	@StartDate DATE,
	@ShiftPeriod INT,	
    @Creator int,
    @CreationDate datetime
AS 
	SET NOCOUNT ON 
	SET XACT_ABORT ON  

	if (@Code is null or @Code = 0)
	begin
		set @Code =isnull((select MAX(Code) from ATN.AttendanceShift),0) + 1
	end		

INSERT INTO ATN.AttendanceShift (
	Code
	,[Title]
	,[Title2]
	,[StartDate]
	,[ShiftPeriod]
	,[Version]
	,[Creator]
	,[CreationDate]
	,[LastEditor]
	,[LastEditionDate]
	)
SELECT @Code
	,@Title
	,@Title2
	,@StartDate
	,@ShiftPeriod
	,0
	,@Creator
	,@CreationDate
	,@Creator
	,@CreationDate

	
	-- Begin Return Select <- do not remove
	SELECT AttendanceShiftID, [Version], Code
	FROM   ATN.AttendanceShift
	WHERE  AttendanceShiftID = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
