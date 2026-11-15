CREATE PROC [PAY].[spFormulaInsert] 
    @CalculationMethodID int,
    @Title nvarchar(512),
    @Expression varchar(MAX),
    @Condition varchar(MAX),
    @SQLExpression nvarchar(MAX),
    @SQLCondition nvarchar(MAX),
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime

			--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON 	

DECLARE @ID INT

	DECLARE @ParameterTypeID INT
	
	
	SELECT @ParameterTypeID=p.ParameterTypeID FROM pay.Parameter AS p
	INNER JOIN PAY.CalculationMethod AS cm
	          ON cm.ParameterID = p.ParameterID
	WHERE cm.CalculationMethodID=@CalculationMethodID
	
	IF @ParameterTypeID=1 OR @ParameterTypeID=7 OR @ParameterTypeID=8
	BEGIN
				RAISERROR('PayrollManager.IsNotFormulaable',16,12)
				return
	END

	SET @SQLExpression= Pay.CreateSqlExpression(@Expression)
	SET @SQLCondition= Pay.CreateSqlExpression(@Condition)
	
	INSERT INTO [PAY].[Formula] ([CalculationMethodID], [Title], [Expression], [Condition], [SQLExpression], [SQLCondition], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @CalculationMethodID, @Title, @Expression, @Condition, @SQLExpression, @SQLCondition, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	
	SET @ID=SCOPE_IDENTITY()
	
	EXEC  Pay.UpdareFormulaParameters @ID,@Expression
	 EXEC  Pay.UpdareFormulaParameters @ID,@Condition
	
	-- Begin Return Select <- do not remove
	SELECT [FormulaID], [Version]
	FROM   [PAY].[Formula]
	WHERE  [FormulaID] = @ID
	-- End Return Select <- do not remove
