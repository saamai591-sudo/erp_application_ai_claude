CREATE     PROC [ATN].[spAttendanceCalculationMethodFormulaUpdate]
    @AttendanceCalculationMethodFormulaID int,
    @AttendanceCalculationMethodID int,
    @Title nvarchar(512),
	@Expression nvarchar(max),
	@Condition nvarchar(max),
	@SQLExpression nvarchar(max),
	@SQLCondition nvarchar(max),
    @Version int,    
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON 
	if @Version=(Select [Version] from ATN.AttendanceCalculationMethodFormula
	where AttendanceCalculationMethodFormulaID = @AttendanceCalculationMethodFormulaID)
	begin	

		DELETE ATN.AttendanceCalculationMethodFormulaParameter
		WHERE AttendanceCalculationMethodFormulaID = @AttendanceCalculationMethodFormulaID

		SET @SQLExpression = ATN.CreateFormulaSqlExpression(@Expression)
		SET @SQLCondition = ATN.CreateFormulaSqlExpression(@Condition)
	
	   EXEC ATN.UpdateAttendanceCalculationMethodFormulaParameters @AttendanceCalculationMethodFormulaID,@Expression
	   EXEC ATN.UpdateAttendanceCalculationMethodFormulaParameters @AttendanceCalculationMethodFormulaID,@Condition

		UPDATE ATN.AttendanceCalculationMethodFormula
		SET    AttendanceCalculationMethodID = @AttendanceCalculationMethodID, 
		       [Title] = @Title, 
			   [Expression] = @Expression, 
			   [Condition] = @Condition, 
			   [SQLExpression] = @SQLExpression, 
			   [SQLCondition] = @SQLCondition, 
			   [Version] = @Version, 
			   [LastEditor] = @LastEditor, 
			   [LastEditionDate] = @LastEditionDate
		WHERE  AttendanceCalculationMethodFormulaID = @AttendanceCalculationMethodFormulaID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   ATN.AttendanceCalculationMethodFormula
		WHERE  AttendanceCalculationMethodFormulaID = @AttendanceCalculationMethodFormulaID	
		-- End Return Select <- do not remove
	end
