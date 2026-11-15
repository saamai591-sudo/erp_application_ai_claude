CREATE      PROC [SLE].[spPourcentageParameterMethodFormulaUpdate]
    @PourcentageParameterMethodFormulaID INT ,
    @PourcentageParameterMethodID INT = NULL ,
    @Title NVARCHAR(500) = NULL ,
    @Expression NVARCHAR(MAX) = NULL ,
    @Condition NVARCHAR(MAX) = NULL ,
    @SQLExpression NVARCHAR(MAX) = NULL ,
    @SQLCondition NVARCHAR(MAX) = NULL ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @Version INT
AS
    SET NOCOUNT ON;


    IF @Version = (   SELECT [Version]
                      FROM   [SLE].[PourcentageParameterMethodFormula]
                      WHERE  [PourcentageParameterMethodFormulaID] = @PourcentageParameterMethodFormulaID )
        BEGIN

            SET @Version = @Version + 1;

            SET @SQLExpression = SLE.CreatePourcentageSqlExpression(
                                     @Expression);
            SET @SQLCondition = SLE.CreatePourcentageSqlExpression(@Condition);


            UPDATE [SLE].[PourcentageParameterMethodFormula]
            SET    [PourcentageParameterMethodID] = @PourcentageParameterMethodID ,
                   [Title] = @Title ,
                   [Expression] = @Expression ,
                   [Condition] = @Condition ,
                   [SQLExpression] = @SQLExpression ,
                   [SQLCondition] = @SQLCondition ,
                   [Creator] = @Creator ,
                   [CreationDate] = @CreationDate ,
                   [LastEditor] = @LastEditor ,
                   [LastEditionDate] = @LastEditionDate ,
                   [Version] = @Version
            WHERE  [PourcentageParameterMethodFormulaID] = @PourcentageParameterMethodFormulaID;


            EXEC SLE.UpdatePourcentageFormulaParameters @expr = @Expression ,
                                                        @formulaID = @PourcentageParameterMethodFormulaID;

            EXEC SLE.UpdatePourcentageFormulaParameters @expr = @Condition ,
                                                        @formulaID = @PourcentageParameterMethodFormulaID;

            -- Begin Return Select <- do not remove
            SELECT  [Version] 
             FROM   [SLE].[PourcentageParameterMethodFormula]
            WHERE  [PourcentageParameterMethodFormulaID] = @PourcentageParameterMethodFormulaID;
        -- End Return Select <- do not remove

        END;
