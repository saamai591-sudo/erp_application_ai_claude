

CREATE   PROC [PRM].[spCostDriverDelete] 
    @CostDriverID int,
    @Version INT
AS 
	SET NOCOUNT ON 
	IF @Version = (   SELECT [Version]
                      FROM   [PRM].[CostDriver]
                      WHERE  [CostDriverID] = @CostDriverID )
        BEGIN

		DELETE
			FROM   [PRM].[CostDriver]
		WHERE  [CostDriverID] = @CostDriverID 

        END;
    ELSE
        BEGIN

            RAISERROR(N'Delete_%s_%d.' ,   -- Message text.
                      16 ,                 -- Severity,
                      10 ,                 -- State,
                      N'CostDriver' , -- First argument.
                      @CostDriverID); -- Second argument.)
        END;

