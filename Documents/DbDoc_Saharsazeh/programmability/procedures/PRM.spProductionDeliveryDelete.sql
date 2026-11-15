

CREATE   PROC [PRM].[spProductionDeliveryDelete]
    @ProductionDeliveryID INT,
    @Version INT
AS
SET NOCOUNT ON;
IF @Version =
(
    SELECT [Version]
    FROM [PRM].[ProductionDelivery]
    WHERE [ProductionDeliveryID] = @ProductionDeliveryID
)
BEGIN

    DELETE FROM [PRM].[ProductionDelivery]
    WHERE [ProductionDeliveryID] = @ProductionDeliveryID;

END;
ELSE
BEGIN

    RAISERROR(   N'Delete_%s_%d.',      -- Message text.
                 16,                    -- Severity,
                 10,                    -- State,
                 N'ProductionDelivery', -- First argument.
                 @ProductionDeliveryID
             ); -- Second argument.)
END;

