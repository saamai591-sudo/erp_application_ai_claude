CREATE    PROC [PRM].[spProductionDeliveryUpdate]
    @ProductionDeliveryID INT,
    @BaseType TINYINT,
    @Number INT,
    @Date DATE,
    @CostCenterId INT,
    @DeliverCostCenterId INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
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
        SET @Version = @Version + 1;

        UPDATE [PRM].[ProductionDelivery]
        SET [BaseType] = @BaseType,
            [Number] = @Number,
            [Date] = @Date,
            [CostCenterId] = @CostCenterId,
            [DeliverCostCenterId] = @DeliverCostCenterId,
            [Creator] = @Creator,
            [CreationDate] = @CreationDate,
            [LastEditor] = @LastEditor,
            [LastEditionDate] = @LastEditionDate,
            [Version] = @Version
        WHERE [ProductionDeliveryID] = @ProductionDeliveryID;

        -- Begin Return Select <- do not remove
        SELECT  [Version] ,
                [Number]
        FROM [PRM].[ProductionDelivery]
        WHERE [ProductionDeliveryID] = @ProductionDeliveryID;
    -- End Return Select <- do not remove
    END;
