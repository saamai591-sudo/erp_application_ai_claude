

CREATE       PROC [PRM].[spSpoilageStatisticDelete]
    @SpoilageStatisticID INT,
    @Version INT
AS
SET NOCOUNT ON;
IF @Version =
(
    SELECT [Version]
    FROM [PRM].[SpoilageStatistic]
    WHERE [SpoilageStatisticID] = @SpoilageStatisticID
)
BEGIN

    DELETE FROM [PRM].[SpoilageStatistic]
    WHERE [SpoilageStatisticID] = @SpoilageStatisticID;

END;
ELSE
BEGIN

    RAISERROR(   N'Delete_%s_%d.',       -- Message text.
                 16,                     -- Severity,
                 10,                     -- State,
                 N'SpoilageStatistic', -- First argument.
                 @SpoilageStatisticID
             ); -- Second argument.)
END;

