
CREATE   PROC [HRM].[spAgreementBatchModelFormulaUpdate] 
    @AgreementBatchModelFormulaID INT,
    @AgreementBatchModelID INT,
    @ParameterID INT,
    @Title NVARCHAR(512),
    @Expression VARCHAR(MAX),
    @Condition VARCHAR(MAX),
    @SQLExpression NVARCHAR(MAX),
    @SQLCondition NVARCHAR(MAX),
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
AS 
SET NOCOUNT ON 

IF @Version = (
       SELECT [Version]
       FROM   [HRM].[AgreementBatchModelFormula]
       WHERE  [AgreementBatchModelFormulaID] = @AgreementBatchModelFormulaID
   )
BEGIN
    SET @Version = @Version + 1 
    
    SET @SQLExpression = Pay.CreateSqlExpression(@Expression)
    SET @SQLCondition = Pay.CreateSqlExpression(@Condition)
    
    UPDATE [HRM].[AgreementBatchModelFormula]
    SET    [AgreementBatchModelID] = @AgreementBatchModelID,
           [ParameterID] = @ParameterID,
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
    WHERE  [AgreementBatchModelFormulaID] = @AgreementBatchModelFormulaID

    EXEC Hrm.[UpdateAgreementBatchModelFormulaParameters] @AgreementBatchModelFormulaID,@Expression,1
    
    EXEC Hrm.[UpdateAgreementBatchModelFormulaParameters] @AgreementBatchModelFormulaID,@Condition,0
    
    -- Begin Return Select <- do not remove
    SELECT [Version]
	FROM   [HRM].[AgreementBatchModelFormula]
    WHERE  [AgreementBatchModelFormulaID] = @AgreementBatchModelFormulaID 
           -- End Return Select <- do not remove
END
