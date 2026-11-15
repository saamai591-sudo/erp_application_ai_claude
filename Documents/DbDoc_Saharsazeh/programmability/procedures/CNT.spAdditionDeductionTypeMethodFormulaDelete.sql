
CREATE   PROC [CNT].[spAdditionDeductionTypeMethodFormulaDelete]
    @AdditionDeductionTypeMethodFormulaID INT ,
    @Version INT
AS
    SET NOCOUNT ON;


    IF @Version = (   SELECT [Version]
                      FROM   [CNT].[AdditionDeductionTypeMethodFormula]
                      WHERE  [AdditionDeductionTypeMethodFormulaID] = @AdditionDeductionTypeMethodFormulaID )
        BEGIN



            DELETE FROM [CNT].[AdditionDeductionTypeMethodFormula]
            WHERE [AdditionDeductionTypeMethodFormulaID] = @AdditionDeductionTypeMethodFormulaID;

        END;
    ELSE
        BEGIN

            RAISERROR(
                N'Delete_%s_%d.' ,                      -- Message text.
                16 ,                                    -- Severity,
                10 ,                                    -- State,
                N'AdditionDeductionTypeMethodFormula' , -- First argument.
                @AdditionDeductionTypeMethodFormulaID); -- Second argument.)
        END;
