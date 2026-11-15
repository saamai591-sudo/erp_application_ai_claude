CREATE PROC [HRM].[SpPaymentSystemFormulaUpdate] 
    @PaymentSystemFormulaID INT,
    @PaymentSystemCalculationMethodID INT,
    @Title NVARCHAR(512),
    @Expression VARCHAR(MAX),
    @Condition VARCHAR(MAX) = NULL,
    @SQLExpression NVARCHAR(MAX) = NULL,
    @SQLCondition NVARCHAR(MAX) = NULL,
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION
AS 
    SET NOCOUNT ON 

    IF @Version <> (
           SELECT [Version]
           FROM   [HRM].[PaymentSystemFormula]
           WHERE  [PaymentSystemFormulaID] = @PaymentSystemFormulaID
       )
    BEGIN
        RAISERROR('Version mismatch...', 16, 10)
        RETURN
    END

    SET @Version = @Version + 1 

    DELETE hrm.PaymentSystemFormulaParameter
    WHERE PaymentSystemFormulaID = @PaymentSystemFormulaID

    SET @SQLExpression = Pay.CreateSqlExpression(@Expression)
    SET @SQLCondition = Pay.CreateSqlExpression(@Condition)
		
    EXEC Hrm.[UpdatePaymentSystemFormulaParameters] @PaymentSystemFormulaID,
         @Expression

    EXEC Hrm.[UpdatePaymentSystemFormulaParameters] @PaymentSystemFormulaID,
         @Condition
		
    UPDATE [HRM].[PaymentSystemFormula]
    SET    [PaymentSystemCalculationMethodID] = @PaymentSystemCalculationMethodID,
           [Title] = @Title,
           [Expression] = @Expression,
           [Condition] = @Condition,
           [SQLExpression] = @SQLExpression,
           [SQLCondition] = @SQLCondition,
           [Version] = @Version,
           [Creator] = @Creator,
           [CreationDate] = @CreationDate,
           [LastEditor] = @LastEditor,
           [LastEditionDate] = @LastEditionDate
    WHERE  [PaymentSystemFormulaID] = @PaymentSystemFormulaID
	
    -- Begin Return Select <- do not remove
    SELECT  [Version]
		    FROM   [HRM].[PaymentSystemFormula]
    WHERE  [PaymentSystemFormulaID] = @PaymentSystemFormulaID 
    -- End Return Select <- do not remove
