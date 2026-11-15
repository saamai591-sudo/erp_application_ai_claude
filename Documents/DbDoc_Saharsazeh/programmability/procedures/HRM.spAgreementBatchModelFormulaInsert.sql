
CREATE   PROC [HRM].[spAgreementBatchModelFormulaInsert] 
    @AgreementBatchModelID INT,
    @ParameterID INT,
    @Title NVARCHAR(512),
    @Expression VARCHAR(MAX),
    @Condition VARCHAR(MAX),
    @SQLExpression NVARCHAR(MAX),
    @SQLCondition NVARCHAR(MAX),
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
AS 
    SET NOCOUNT ON 
    DECLARE @ID INT
	
    SET @SQLExpression = Pay.CreateSqlExpression(@Expression)
    SET @SQLCondition = Pay.CreateSqlExpression(@Condition)
	
    INSERT INTO [HRM].[AgreementBatchModelFormula]
      (
        [AgreementBatchModelID],
        [ParameterID],
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
    SELECT @AgreementBatchModelID,
           @ParameterID,
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

    EXEC Hrm.[UpdateAgreementBatchModelFormulaParameters] @ID,@Expression,1

    EXEC Hrm.[UpdateAgreementBatchModelFormulaParameters] @ID,@Condition,0
     
	-- Begin Return Select <- do not remove
    SELECT [AgreementBatchModelFormulaID],
           [Version]
    FROM   [HRM].[AgreementBatchModelFormula]
    WHERE  [AgreementBatchModelFormulaID] = @ID
       -- End Return Select <- do not remove
