CREATE   PROC [CNT].[spAdditionDeductionTypeMethodFormulaInsert]
    @AdditionDeductionTypeMethodID INT ,
    @Title NVARCHAR(512) ,
    @Expression VARCHAR(MAX) ,
    @Condition VARCHAR(MAX) = NULL ,
    @SQLExpression NVARCHAR(MAX) = NULL ,
    @SQLCondition NVARCHAR(MAX) = NULL ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME
AS
    SET NOCOUNT ON;

    SET @SQLExpression = PAY.CreateSqlExpression(@Expression);
    SET @SQLCondition = PAY.CreateSqlExpression(@Condition);

    INSERT INTO [CNT].[AdditionDeductionTypeMethodFormula] ( [AdditionDeductionTypeMethodID] ,
                                                             [Title] ,
                                                             [Expression] ,
                                                             [Condition] ,
                                                             [SQLExpression] ,
                                                             [SQLCondition] ,
                                                             [Version] ,
                                                             [Creator] ,
                                                             [CreationDate] ,
                                                             [LastEditor] ,
                                                             [LastEditionDate] )
                SELECT @AdditionDeductionTypeMethodID ,
                       @Title ,
                       @Expression ,
                       @Condition ,
                       @SQLExpression ,
                       @SQLCondition ,
                       0 ,
                       @Creator ,
                       @CreationDate ,
                       @LastEditor ,
                       @LastEditionDate;

    DECLARE @id INT = SCOPE_IDENTITY();

    EXEC [CNT].[UpdateAdditionDeductionTypeFormulaParameters] @FormulaID = @id ,   -- int
                                                              @Expr = @Expression; -- varchar(max)

    EXEC [CNT].[UpdateAdditionDeductionTypeFormulaParameters] @FormulaID = @id ,  -- int
                                                              @Expr = @Condition; -- varchar(max)
    -- Begin Return Select <- do not remove
    SELECT [AdditionDeductionTypeMethodFormulaID] ,
           [Version] ,
           [SQLExpression] ,
           [SQLCondition] 
    FROM   [CNT].[AdditionDeductionTypeMethodFormula]
    WHERE  [AdditionDeductionTypeMethodFormulaID] = @id;
-- End Return Select <- do not remove
