
CREATE        PROC [PRM].[spReworkDelete]
    @ReworkID INT,
    @Version INT
AS
SET NOCOUNT ON;
IF @Version =
(
    SELECT [Version]
    FROM [PRM].[Rework]
    WHERE [ReworkID] = @ReworkID
)
BEGIN

    DELETE FROM [PRM].[Rework]
    WHERE [ReworkID] = @ReworkID;

END;
ELSE
BEGIN

    RAISERROR(   N'Delete_%s_%d.',       -- Message text.
                 16,                     -- Severity,
                 10,                     -- State,
                 N'Rework', -- First argument.
                 @ReworkID
             ); -- Second argument.)
END;

