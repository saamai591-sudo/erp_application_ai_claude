CREATE PROC [HRM].[SpPaymentSystemFormulaInsert] 
    @PaymentSystemCalculationMethodID INT,
    @Title NVARCHAR(512),
    @Expression VARCHAR(MAX),
    @Condition VARCHAR(MAX) = NULL,
    @SQLExpression NVARCHAR(MAX) = NULL,
    @SQLCondition NVARCHAR(MAX) = NULL,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME 
--WITH ENCRYPTION
AS 
    SET NOCOUNT ON 
    DECLARE @ID INT
	
    SET @SQLExpression = Pay.CreateSqlExpression(@Expression)
    SET @SQLCondition = Pay.CreateSqlExpression(@Condition)
	
    INSERT INTO [HRM].[PaymentSystemFormula]
      (
        [PaymentSystemCalculationMethodID],
        [Title],
        [Expression],
        [Condition],
        [SQLExpression],
        [SQLCondition],
        [Version],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate]
      )
    SELECT @PaymentSystemCalculationMethodID,
           @Title,
           @Expression,
           @Condition,
           @SQLExpression,
           @SQLCondition,
           0,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate
	
    SET @ID = SCOPE_IDENTITY()
	
    EXEC Hrm.[UpdatePaymentSystemFormulaParameters] @ID,
         @Expression

    EXEC Hrm.[UpdatePaymentSystemFormulaParameters] @ID,
         @Condition
	 
	-- Begin Return Select <- do not remove
    SELECT [PaymentSystemFormulaID],
        [Version]
    FROM   [HRM].[PaymentSystemFormula]
    WHERE  [PaymentSystemFormulaID] = @ID
    -- End Return Select <- do not remove
