
---------------------------------------------------------
CREATE   PROC [PRM].spStationPerformanceInsert
    @FinancialPeriodID INT,
    @Number INT,
    @Date DATE,
    @BaseType TINYINT,
    @ProductionPlanningID INT = NULL,
    @WorkStationID INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
AS
SET NOCOUNT ON;

IF @Number IS NULL
   OR @Number = 0
BEGIN

    SET @Number = ISNULL(
                  (
                      SELECT MAX(ps.Number)
                      FROM PRM.StationPerformance AS ps
                      WHERE ps.FinancialPeriodID = @FinancialPeriodID
                  ),
                  0
                        ) + 1;
END;

INSERT INTO [PRM].[StationPerformance]
(
    [FinancialPeriodID],
    [Number],
    [Date],
    [BaseType],
    [ProductionPlanningID],
    [WorkStationID],
    [Creator],
    [CreationDate],
    [LastEditor],
    [LastEditionDate],
    [Version]
)
SELECT @FinancialPeriodID,
       @Number,
       @Date,
       @BaseType,
       @ProductionPlanningID,
       @WorkStationID,
       @Creator,
       @CreationDate,
       @LastEditor,
       @LastEditionDate,
       0;

-- Begin Return Select <- do not remove
SELECT [StationPerformanceID],
       [Version],
       [Number]
FROM [PRM].[StationPerformance]
WHERE [StationPerformanceID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove
