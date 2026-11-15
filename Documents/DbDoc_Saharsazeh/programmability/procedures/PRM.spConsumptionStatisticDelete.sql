

CREATE   PROC [PRM].[spConsumptionStatisticDelete]
    @ConsumptionStatisticID INT,
    @Version INT
AS
SET NOCOUNT ON;
IF @Version =
(
    SELECT [Version]
    FROM [PRM].[ConsumptionStatistic]
    WHERE [ConsumptionStatisticID] = @ConsumptionStatisticID
)
BEGIN

    DELETE FROM [PRM].[ConsumptionStatistic]
    WHERE [ConsumptionStatisticID] = @ConsumptionStatisticID;

END;
ELSE
BEGIN

    RAISERROR(   N'Delete_%s_%d.',        -- Message text.
                 16,                      -- Severity,
                 10,                      -- State,
                 N'ConsumptionStatistic', -- First argument.
                 @ConsumptionStatisticID
             ); -- Second argument.)
END;

