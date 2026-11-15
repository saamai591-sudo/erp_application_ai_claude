

CREATE PROC [PAY].[spFormulaUpdate] 
    @FormulaID int,
    @CalculationMethodID int,
    @Title nvarchar(512),
    @Expression varchar(MAX),
    @Condition varchar(MAX),
    @SQLExpression nvarchar(MAX),
    @SQLCondition nvarchar(MAX),
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime

			--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON 
	if @Version=(Select [Version] from [PAY].[Formula]
	where [FormulaID] = @FormulaID)
	begin	
	
		DECLARE @CalculationTypeID INT,
				@EfficientCalendarMonthID INT,
				@ParameterID INT		
		
		SELECT @EfficientCalendarMonthID = EfficientCalendarMonthID, @ParameterID = ParameterID
		FROM PAY.CalculationMethod
		WHERE @CalculationMethodID = CalculationMethodID
		
		SELECT @CalculationTypeID = CalculationTypeID FROM PAY.Parameter
		WHERE ParameterID = @ParameterID
		
		
		IF (PAY.HasCalculation(@CalculationTypeID, @EfficientCalendarMonthID)= 1)
		BEGIN
			RAISERROR('عامل مورد در این ماه نظر محاسبه شرکت کرده، بنابراین فرمول قابل ویرایش نمی باشد.',16,12)
			RETURN
		END

		DELETE pay.FormulaParameter
		WHERE FormulaID=@FormulaID

		SET @SQLExpression= Pay.CreateSqlExpression(@Expression)
		SET @SQLCondition= Pay.CreateSqlExpression(@Condition)
	
	
	EXEC  Pay.UpdareFormulaParameters @FormulaID,@Expression
	 EXEC  Pay.UpdareFormulaParameters @FormulaID,@Condition

		UPDATE [PAY].[Formula]
		SET    [CalculationMethodID] = @CalculationMethodID, [Title] = @Title, [Expression] = @Expression, [Condition] = @Condition, [SQLExpression] = @SQLExpression, [SQLCondition] = @SQLCondition, [Version] = @Version, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate
		WHERE  [FormulaID] = @FormulaID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version]
		FROM   [PAY].[Formula]
		WHERE  [FormulaID] = @FormulaID	
		-- End Return Select <- do not remove
	

	end
