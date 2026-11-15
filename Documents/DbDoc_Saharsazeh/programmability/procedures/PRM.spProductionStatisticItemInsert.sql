
-- #63958 Remove Type from ProductionStatisticItem (UI column + DB).

CREATE   PROC [PRM].spProductionStatisticItemInsert
    @ProductionStatisticID INT,
    @StuffID INT,
    @MainQuantity DECIMAL(30, 4),
    @SubQuantity DECIMAL(30, 4) = NULL,
    @Description NVARCHAR(1000) = NULL,
    @Description2 NVARCHAR(1000) = NULL,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @ProductionPlanningItemID INT,
    @ProductionFormulaItemID INT
AS
    SET NOCOUNT ON;

    INSERT INTO [PRM].[ProductionStatisticItem]
    (
        [ProductionStatisticID],
        [StuffID],
        [MainQuantity],
        [SubQuantity],
        [Description],
        [Description2],
        [Version],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [ProductionPlanningItemID],
        [ProductionFormulaItemID]
    )
    SELECT @ProductionStatisticID,
           @StuffID,
           @MainQuantity,
           @SubQuantity,
           @Description,
           @Description2,
           0,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate,
           @ProductionPlanningItemID,
           @ProductionFormulaItemID

    -- Begin Return Select <- do not remove
    SELECT [ProductionStatisticItemID],
           [Version]
    FROM [PRM].[ProductionStatisticItem]
    WHERE [ProductionStatisticItemID] = SCOPE_IDENTITY();
    -- End Return Select <- do not remove

