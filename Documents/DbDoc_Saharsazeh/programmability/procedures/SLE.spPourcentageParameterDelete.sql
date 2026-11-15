

CREATE   PROC [SLE].[spPourcentageParameterDelete]
    @PourcentageParameterID INT ,
    @Version INT
AS
    SET NOCOUNT ON;


    IF @Version = (   SELECT [Version]
                      FROM   [SLE].[PourcentageParameter]
                      WHERE  [PourcentageParameterID] = @PourcentageParameterID )
        BEGIN



            DELETE FROM [SLE].[PourcentageParameter]
            WHERE [PourcentageParameterID] = @PourcentageParameterID;

        END;
    ELSE
        BEGIN

            RAISERROR(N'Delete_%s_%d.' ,        -- Message text.
                      16 ,                      -- Severity,
                      10 ,                      -- State,
                      N'PourcentageParameter' , -- First argument.
                      @PourcentageParameterID); -- Second argument.)
        END;
