

CREATE   PROC [SLE].[spPourcentageParameterMethodFormulaDelete]
    @PourcentageParameterMethodFormulaID INT ,
    @Version INT
AS
    SET NOCOUNT ON;


    IF @Version = (   SELECT [Version]
                      FROM   [SLE].[PourcentageParameterMethodFormula]
                      WHERE  [PourcentageParameterMethodFormulaID] = @PourcentageParameterMethodFormulaID )
        BEGIN



            DELETE FROM [SLE].[PourcentageParameterMethodFormula]
            WHERE [PourcentageParameterMethodFormulaID] = @PourcentageParameterMethodFormulaID;

        END;
    ELSE
        BEGIN

            RAISERROR(
                N'Delete_%s_%d.' ,                     -- Message text.
                16 ,                                   -- Severity,
                10 ,                                   -- State,
                N'PourcentageParameterMethodFormula' , -- First argument.
                @PourcentageParameterMethodFormulaID); -- Second argument.)
        END;
