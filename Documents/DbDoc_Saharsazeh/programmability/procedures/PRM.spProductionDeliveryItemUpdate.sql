CREATE    PROC [PRM].[spProductionDeliveryItemUpdate]
    @ProductionDeliveryItemID INT,
    @ProductionDeliveryID INT = NULL,
	@ProductionPlanningItemID INT = NULL,
    @RowIndex INT,
    @StuffID INT,
    @MainQuantity DECIMAL(30, 4),
    @SubQuantity DECIMAL(30, 4) = NULL,
    @Description NVARCHAR(1000) = NULL,
    @Description2 NVARCHAR(1000) = NULL,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT,
	@ProductionStatisticItemID int
AS
SET NOCOUNT ON;

IF @Version =
(
    SELECT [Version]
    FROM [PRM].[ProductionDeliveryItem]
    WHERE [ProductionDeliveryItemID] = @ProductionDeliveryItemID
)
BEGIN

    SET @Version = @Version + 1;

    UPDATE [PRM].[ProductionDeliveryItem]
    SET [ProductionDeliveryID] = @ProductionDeliveryID,
        [RowIndex] = @RowIndex,
        [StuffID] = @StuffID,
		ProductionPlanningItemID =@ProductionPlanningItemID,
        [MainQuantity] = @MainQuantity,
        [SubQuantity] = @SubQuantity,
        [Description] = @Description,
        [Description2] = @Description2,
        [Creator] = @Creator,
        [CreationDate] = @CreationDate,
        [LastEditor] = @LastEditor,
        [LastEditionDate] = @LastEditionDate,
        [Version] = @Version,
		ProductionStatisticItemID = @ProductionStatisticItemID
    WHERE [ProductionDeliveryItemID] = @ProductionDeliveryItemID;

    -- Begin Return Select <- do not remove
    SELECT   [Version] 
    FROM [PRM].[ProductionDeliveryItem]
    WHERE [ProductionDeliveryItemID] = @ProductionDeliveryItemID;
    -- End Return Select <- do not remove
END;
