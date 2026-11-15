
---------------------------------------------------------
CREATE   PROC [PRM].spConsumptionStatisticInsert
    @FinancialPeriodID INT,
    @BaseType TINYINT,
    @ProductionPlanningID INT = NULL,
    @Number INT,
    @Date DATE,
    @CostCenterId INT,
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
                      SELECT MAX(Number)
                      FROM [PRM].[ConsumptionStatistic]
                      WHERE FinancialPeriodID = @FinancialPeriodID
                  ),
                  0
                        ) + 1;

INSERT INTO [PRM].[ConsumptionStatistic]
(
    [FinancialPeriodID],
    [BaseType],
    [ProductionPlanningID],
    [Number],
    [Date],
    [CostCenterId],
    [Creator],
    [CreationDate],
    [LastEditor],
    [LastEditionDate],
    [Version]
)
SELECT @FinancialPeriodID,
       @BaseType,
       @ProductionPlanningID,
       @Number,
       @Date,
       @CostCenterId,
       @Creator,
       @CreationDate,
       @LastEditor,
       @LastEditionDate,
       0;

-- Begin Return Select <- do not remove
SELECT [ConsumptionStatisticID],
       [Version],
       [Number]
FROM [PRM].[ConsumptionStatistic]
WHERE [ConsumptionStatisticID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove
