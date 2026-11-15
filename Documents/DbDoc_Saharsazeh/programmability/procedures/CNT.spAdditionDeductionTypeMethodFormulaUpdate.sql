CREATE   PROC [CNT].[spAdditionDeductionTypeMethodFormulaUpdate]
    @AdditionDeductionTypeMethodFormulaID INT ,
    @AdditionDeductionTypeMethodID INT ,
    @Title NVARCHAR(512) ,
    @Expression VARCHAR(MAX) ,
    @Condition VARCHAR(MAX) = NULL ,
    @SQLExpression NVARCHAR(MAX) = NULL ,
    @SQLCondition NVARCHAR(MAX) = NULL ,
    @Version INT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME
AS
    SET NOCOUNT ON;

    IF @Version = (   SELECT [Version]
                      FROM   [CNT].[AdditionDeductionTypeMethodFormula]
                      WHERE  [AdditionDeductionTypeMethodFormulaID] = @AdditionDeductionTypeMethodFormulaID )
    BEGIN

        SET @Version = @Version + 1;
		
        SET @SQLExpression= pay.CreateSqlExpression(@Expression)
		SET @SQLCondition= pay.CreateSqlExpression(@Condition)

        UPDATE [CNT].[AdditionDeductionTypeMethodFormula]
        SET    [AdditionDeductionTypeMethodID] = @AdditionDeductionTypeMethodID ,
                [Title] = @Title ,
                [Expression] = @Expression ,
                [Condition] = @Condition ,
                [SQLExpression] = @SQLExpression ,
                [SQLCondition] = @SQLCondition ,
                [Version] = @Version ,
                [Creator] = @Creator ,
                [CreationDate] = @CreationDate ,
                [LastEditor] = @LastEditor ,
                [LastEditionDate] = @LastEditionDate
        WHERE  [AdditionDeductionTypeMethodFormulaID] = @AdditionDeductionTypeMethodFormulaID;

		EXEC [CNT].[UpdateAdditionDeductionTypeFormulaParameters] @FormulaID = @AdditionDeductionTypeMethodFormulaID, -- int
			                                                        @Expr = @Expression     -- varchar(max)
			
		EXEC [CNT].[UpdateAdditionDeductionTypeFormulaParameters] @FormulaID = @AdditionDeductionTypeMethodFormulaID, -- int
			                                                        @Expr = @Condition     -- varchar(max)
        -- Begin Return Select <- do not remove
        SELECT [Version], 
                @SQLExpression, 
                @SQLCondition
        FROM   [CNT].[AdditionDeductionTypeMethodFormula]
        WHERE  [AdditionDeductionTypeMethodFormulaID] = @AdditionDeductionTypeMethodFormulaID;
    -- End Return Select <- do not remove
    END;
