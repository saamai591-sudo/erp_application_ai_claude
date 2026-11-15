

CREATE   PROC [PRM].[spProductionDeliveryItemDelete]
    @ProductionDeliveryItemID INT,
    @Version INT
AS
SET NOCOUNT ON;
IF @Version =
(
    SELECT [Version]
    FROM [PRM].[ProductionDeliveryItem]
    WHERE [ProductionDeliveryItemID] = @ProductionDeliveryItemID
)
BEGIN

    DELETE FROM [PRM].[ProductionDeliveryItem]
    WHERE [ProductionDeliveryItemID] = @ProductionDeliveryItemID;

END;
ELSE
BEGIN

    RAISERROR(   N'Delete_%s_%d.',          -- Message text.
                 16,                        -- Severity,
                 10,                        -- State,
                 N'ProductionDeliveryItem', -- First argument.
                 @ProductionDeliveryItemID
             ); -- Second argument.)
END;

