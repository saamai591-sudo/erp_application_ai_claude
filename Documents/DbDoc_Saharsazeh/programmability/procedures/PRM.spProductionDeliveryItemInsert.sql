CREATE   PROC [PRM].[spProductionDeliveryItemInsert]
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
    @ProductionStatisticItemID INT = NULL
AS
    SET NOCOUNT ON;

    INSERT INTO [PRM].[ProductionDeliveryItem]
    (
        [ProductionDeliveryID],
        [ProductionPlanningItemID],
        [RowIndex],
        [StuffID],
        [MainQuantity],
        [SubQuantity],
        [Description],
        [Description2],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version],
	    ProductionStatisticItemID
    )
    SELECT @ProductionDeliveryID,
           @ProductionPlanningItemID,
           @RowIndex,
           @StuffID,
           @MainQuantity,
           @SubQuantity,
           @Description,
           @Description2,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate,
           0,
	       @ProductionStatisticItemID

    -- Begin Return Select <- do not remove
    SELECT [ProductionDeliveryItemID],
           [Version]
    FROM [PRM].[ProductionDeliveryItem]
    WHERE [ProductionDeliveryItemID] = SCOPE_IDENTITY();
    -- End Return Select <- do not remove
