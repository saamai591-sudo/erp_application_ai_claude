CREATE      PROC [SLE].[spPourcentageParameterMethodFormulaInsert]
    @PourcentageParameterMethodID INT = NULL ,
    @Title NVARCHAR(500) = NULL ,
    @Expression NVARCHAR(MAX) = NULL ,
    @Condition NVARCHAR(MAX) = NULL ,
    @SQLExpression NVARCHAR(MAX) = NULL ,
    @SQLCondition NVARCHAR(MAX) = NULL ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME
AS
    SET NOCOUNT ON;

    DECLARE @ID INT;

    SET @SQLExpression = SLE.CreatePourcentageSqlExpression(@Expression);
    SET @SQLCondition = SLE.CreatePourcentageSqlExpression(@Condition);

    INSERT INTO [SLE].[PourcentageParameterMethodFormula] ( [PourcentageParameterMethodID] ,
                                                            [Title] ,
                                                            [Expression] ,
                                                            [Condition] ,
                                                            [SQLExpression] ,
                                                            [SQLCondition] ,
                                                            [Creator] ,
                                                            [CreationDate] ,
                                                            [LastEditor] ,
                                                            [LastEditionDate] ,
                                                            [Version] )
                SELECT @PourcentageParameterMethodID ,
                       @Title ,
                       @Expression ,
                       @Condition ,
                       @SQLExpression ,
                       @SQLCondition ,
                       @Creator ,
                       @CreationDate ,
                       @LastEditor ,
                       @LastEditionDate ,
                       0;

    SET @ID = SCOPE_IDENTITY();

    EXEC SLE.UpdatePourcentageFormulaParameters @expr = @Expression ,
                                                @formulaID = @ID;

    EXEC SLE.UpdatePourcentageFormulaParameters @expr = @Condition ,
                                                @formulaID = @ID;

    -- Begin Return Select <- do not remove
    SELECT [PourcentageParameterMethodFormulaID] ,
           [Version]
    FROM   [SLE].[PourcentageParameterMethodFormula]
    WHERE  [PourcentageParameterMethodFormulaID] = @ID;
	-- End Return Select <- do not remove
