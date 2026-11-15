CREATE     PROC [ATN].[spAttendanceParameterDelete] 
    @AttendanceParameterID int,
	@Version int
--WITH ENCRYPTION 
AS 
BEGIN
	IF @Version =
	(
		SELECT [Version]
		FROM ATN.AttendanceParameter
		WHERE AttendanceParameterID = @AttendanceParameterID
	)
	BEGIN
		if exists (select 1
			from ATN.AttendanceCalculationMethodFormulaParameter a
			where a.ParameterType = 6 and a.Category = -6 and a.Parameter = @AttendanceParameterID)
		begin
			RAISERROR('AttendanceManagement.Messages.ParameterUsedInCalculationMethod', 16, 12)
			return
		end

		DELETE
		FROM   ATN.AttendanceParameter
		WHERE  AttendanceParameterID = @AttendanceParameterID
	END;
	ELSE
	BEGIN
		RAISERROR(   N'Delete_%s_%d.',      -- Message text.
					 16,                    -- Severity,
					 10,                    -- State,
					 N'AttendanceParameter', -- First argument.
					 @AttendanceParameterID
				 ); -- Second argument.
	END;
END
