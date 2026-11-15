
CREATE    PROC [PRM].[spSpoilageStatisticItemDelete]
    @SpoilageStatisticItemID INT,
    @Version INT
AS
SET NOCOUNT ON;
IF @Version =
(
    SELECT [Version]
    FROM [PRM].[SpoilageStatisticItem]
    WHERE [SpoilageStatisticItemID] = @SpoilageStatisticItemID
)
BEGIN

    DELETE FROM [PRM].[SpoilageStatisticItem]
    WHERE [SpoilageStatisticItemID] = @SpoilageStatisticItemID;

END;
ELSE
BEGIN

    RAISERROR(   N'Delete_%s_%d.',           -- Message text.
                 16,                         -- Severity,
                 10,                         -- State,
                 N'SpoilageStatisticItem', -- First argument.
                 @SpoilageStatisticItemID
             ); -- Second argument.)
END;

