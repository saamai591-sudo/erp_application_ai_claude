

CREATE     PROC [PRM].[spStationPerformanceDelete]
    @StationPerformanceID INT,
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

    DELETE FROM [PRM].[StationPerformance]
    WHERE [StationPerformanceID] = @StationPerformanceID;

END;
ELSE
BEGIN

    RAISERROR(   N'Delete_%s_%d.',       -- Message text.
                 16,                     -- Severity,
                 10,                     -- State,
                 N'StationPerformance', -- First argument.
                 @StationPerformanceID
             ); -- Second argument.)
END;

