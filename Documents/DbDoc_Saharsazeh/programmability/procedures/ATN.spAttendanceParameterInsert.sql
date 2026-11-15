
---------------------------------------------------------
CREATE    PROC ATN.spAttendanceParameterInsert
	@Title nvarchar(256),
	@Title2 nvarchar(256),
	@DataEntryMethod tinyint,
	@Type tinyint,
	@TimingMethod TINYINT,
	@Creator int,
	@CreationDate datetime,
	@DisplayInPerformanceReport bit = 0
--WITH ENCRYPTION
AS 
	INSERT INTO ATN.AttendanceParameter ([Title], [Title2], DataEntryMethod, [Type], [TimingMethod], [Version], [Creator], [CreationDate], [LastEditor], 
										 [LastEditionDate],DisplayInPerformanceReport)
	SELECT @Title, @Title2, @DataEntryMethod, @Type, @TimingMethod, 0, @Creator, @CreationDate, @Creator, @CreationDate,@DisplayInPerformanceReport
	
	-- Begin Return Select <- do not remove
	SELECT AttendanceParameterID, [Version]
	FROM   ATN.AttendanceParameter
	WHERE  AttendanceParameterID = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
