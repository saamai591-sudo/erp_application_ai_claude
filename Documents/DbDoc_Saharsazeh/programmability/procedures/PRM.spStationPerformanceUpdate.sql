
-----------------------------------------------------------
CREATE   PROC [PRM].spStationPerformanceUpdate
    @StationPerformanceID INT,
    @FinancialPeriodID INT,
    @Number INT,
    @Date DATE,
    @BaseType TINYINT,
    @ProductionPlanningID INT = NULL,
    @WorkStationID INT,
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
    FROM [PRM].[StationPerformance]
    WHERE [StationPerformanceID] = @StationPerformanceID
)
BEGIN

    IF @Number IS NULL OR @Number = 0
    BEGIN
        SET @Number = ISNULL(
                      (
                          SELECT MAX(ps.Number)
                          FROM PRM.StationPerformance AS ps
                          WHERE ps.FinancialPeriodID = @FinancialPeriodID
                                AND [StationPerformanceID] <> @StationPerformanceID
                      ),
                      0
                            ) + 1;
    END;
    SET @Version = @Version + 1;

    UPDATE [PRM].[StationPerformance]
    SET [FinancialPeriodID] = @FinancialPeriodID,
        [Number] = @Number,
        [Date] = @Date,
        [BaseType] = @BaseType,
        [ProductionPlanningID] = @ProductionPlanningID,
        [WorkStationID] = @WorkStationID,
        [Creator] = @Creator,
        [CreationDate] = @CreationDate,
        [LastEditor] = @LastEditor,
        [LastEditionDate] = @LastEditionDate,
        [Version] = @Version
    WHERE [StationPerformanceID] = @StationPerformanceID;

    -- Begin Return Select <- do not remove
    SELECT [Version], [Number]
    FROM [PRM].[StationPerformance]
    WHERE [StationPerformanceID] = @StationPerformanceID;
    -- End Return Select <- do not remove
END;
