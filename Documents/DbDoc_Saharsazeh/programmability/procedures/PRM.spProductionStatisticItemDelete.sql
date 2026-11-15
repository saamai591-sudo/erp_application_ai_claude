

CREATE   PROC [PRM].[spProductionStatisticItemDelete]
    @ProductionStatisticItemID INT,
    @Version INT
AS
SET NOCOUNT ON;
IF @Version =
(
    SELECT [Version]
    FROM [PRM].[ProductionStatisticItem]
    WHERE [ProductionStatisticItemID] = @ProductionStatisticItemID
)
BEGIN

    DELETE FROM [PRM].[ProductionStatisticItem]
    WHERE [ProductionStatisticItemID] = @ProductionStatisticItemID;

END;
ELSE
BEGIN

    RAISERROR(   N'Delete_%s_%d.',           -- Message text.
                 16,                         -- Severity,
                 10,                         -- State,
                 N'ProductionStatisticItem', -- First argument.
                 @ProductionStatisticItemID
             ); -- Second argument.)
END;

