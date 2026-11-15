
CREATE   PROC [PRM].spProductionStatisticItemUpdate
    @ProductionStatisticItemID INT,
    @ProductionStatisticID INT,
    @StuffID INT,
    @MainQuantity DECIMAL(30, 4),
    @SubQuantity DECIMAL(30, 4) = NULL,
    @Description NVARCHAR(1000) = NULL,
    @Description2 NVARCHAR(1000) = NULL,
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @ProductionPlanningItemID INT,
    @ProductionFormulaItemID INT
AS
SET NOCOUNT ON;

IF @Version =
(
    SELECT [Version]
    FROM [PRM].[ProductionStatisticItem]
    WHERE [ProductionStatisticItemID] = @ProductionStatisticItemID
)
BEGIN

    SET @Version = @Version + 1;

    UPDATE [PRM].[ProductionStatisticItem]
    SET [ProductionStatisticID] = @ProductionStatisticID,
        [StuffID] = @StuffID,
        [MainQuantity] = @MainQuantity,
        [SubQuantity] = @SubQuantity,
        [Description] = @Description,
        [Description2] = @Description2,
        [Version] = @Version,
        [Creator] = @Creator,
        [CreationDate] = @CreationDate,
        [LastEditor] = @LastEditor,
        [LastEditionDate] = @LastEditionDate,
        ProductionPlanningItemID = @ProductionPlanningItemID,
        ProductionFormulaItemID = @ProductionFormulaItemID
    WHERE [ProductionStatisticItemID] = @ProductionStatisticItemID;

    -- Begin Return Select <- do not remove
    SELECT  [Version]
    FROM [PRM].[ProductionStatisticItem]
    WHERE [ProductionStatisticItemID] = @ProductionStatisticItemID;
-- End Return Select <- do not remove

END;

