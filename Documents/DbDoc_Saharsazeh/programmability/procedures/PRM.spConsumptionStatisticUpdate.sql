
---------------------------------------------------------
CREATE   PROC [PRM].spConsumptionStatisticUpdate
    @ConsumptionStatisticID INT,
    @FinancialPeriodID INT,
    @BaseType TINYINT,
    @ProductionPlanningID INT = NULL,
    @Number INT,
    @Date DATE,
    @CostCenterId INT,
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
    FROM [PRM].[ConsumptionStatistic]
    WHERE [ConsumptionStatisticID] = @ConsumptionStatisticID
)
BEGIN
    IF @Number IS NULL
       OR @Number = 0
        SET @Number = ISNULL(
                      (
                          SELECT MAX(Number)
                          FROM [PRM].[ConsumptionStatistic]
                          WHERE FinancialPeriodID = @FinancialPeriodID
                                AND [ConsumptionStatisticID] <> @ConsumptionStatisticID
                      ),
                      0
                            ) + 1;



    SET @Version = @Version + 1;

    UPDATE [PRM].[ConsumptionStatistic]
    SET [FinancialPeriodID] = @FinancialPeriodID,
        [BaseType] = @BaseType,
        [ProductionPlanningID] = @ProductionPlanningID,
        [Number] = @Number,
        [Date] = @Date,
        [CostCenterId] = @CostCenterId,
        [Creator] = @Creator,
        [CreationDate] = @CreationDate,
        [LastEditor] = @LastEditor,
        [LastEditionDate] = @LastEditionDate,
        [Version] = @Version
    WHERE [ConsumptionStatisticID] = @ConsumptionStatisticID;

    -- Begin Return Select <- do not remove
    SELECT  [Version], [Number] 
    FROM [PRM].[ConsumptionStatistic]
    WHERE [ConsumptionStatisticID] = @ConsumptionStatisticID;
-- End Return Select <- do not remove

END;
