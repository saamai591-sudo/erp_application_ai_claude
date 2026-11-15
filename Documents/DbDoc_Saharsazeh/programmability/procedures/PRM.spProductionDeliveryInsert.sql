CREATE    PROC [PRM].[spProductionDeliveryInsert]
    @BaseType TINYINT,
    @Number INT,
    @Date DATE,
    @CostCenterId INT,
    @DeliverCostCenterId INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
AS
    SET NOCOUNT ON;

    IF @Number IS NULL
       OR @Number = 0
        SET @Number = ISNULL(
                      (
                          SELECT MAX(Number) FROM [PRM].[ProductionDelivery] AS [pd]
                      ),
                      0
                            ) + 1;

    INSERT INTO [PRM].[ProductionDelivery]
    (
        [BaseType],
        [Number],
        [Date],
        [CostCenterId],
        [DeliverCostCenterId],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version]
    )
    SELECT @BaseType,
           @Number,
           @Date,
           @CostCenterId,
           @DeliverCostCenterId,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate,
           0;

    -- Begin Return Select <- do not remove
    SELECT [ProductionDeliveryID],
           [Version],
           [Number]
    FROM [PRM].[ProductionDelivery]
    WHERE [ProductionDeliveryID] = SCOPE_IDENTITY();
    -- End Return Select <- do not remove
