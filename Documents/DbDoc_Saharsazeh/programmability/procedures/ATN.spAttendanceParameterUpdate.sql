
---------------------------------------------------------
CREATE    PROC ATN.spAttendanceParameterUpdate
	@AttendanceParameterID int,
	@Title nvarchar(256),
	@Title2 nvarchar(256),
	@DataEntryMethod tinyint,
	@Type tinyint,
	@TimingMethod TINYINT,
	@Version int,
	@LastEditor int,
	@LastEditionDate datetime,
	@DisplayInPerformanceReport bit = 0
--WITH ENCRYPTION
AS 	
	IF @Version <>
	(
		SELECT [Version]
		FROM ATN.AttendanceParameter 
		WHERE AttendanceParameterID = @AttendanceParameterID
	)
	begin
		RAISERROR('Version mismatch...', 16, 10);
	end   
	
	if exists (select 1
		from ATN.AttendanceCalculationMethodFormulaParameter a
		where a.ParameterType = 6 and a.Category = -6 and a.Parameter = @AttendanceParameterID)
	begin
		RAISERROR('AttendanceManagement.Messages.ParameterUsedInCalculationMethod', 16, 12)
		return
	end

	UPDATE [ATN].AttendanceParameter
	SET    [Title] = @Title, 
		   [Title2] = @Title2, 
		   DataEntryMethod = @DataEntryMethod,
		   [Type] = @Type,
		   [TimingMethod] = @TimingMethod,
		   [Version] = @Version + 1, 
		   [LastEditor] = @LastEditor, 
		   [LastEditionDate] = @LastEditionDate,
		   DisplayInPerformanceReport = @DisplayInPerformanceReport
	WHERE  AttendanceParameterID = @AttendanceParameterID
	
	-- Begin Return Select <- do not remove
	SELECT  [Version]
	FROM   ATN.AttendanceParameter
	WHERE  AttendanceParameterID = @AttendanceParameterID
	-- End Return Select <- do not remove
