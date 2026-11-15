
CREATE     PROC [PRM].[spReworkItemDelete]
    @ReworkItemID INT,
    @Version INT
AS
SET NOCOUNT ON;
IF @Version =
(
    SELECT [Version]
    FROM [PRM].[ReworkItem]
    WHERE [ReworkItemID] = @ReworkItemID
)
BEGIN

    DELETE FROM [PRM].[ReworkItem]
    WHERE [ReworkItemID] = @ReworkItemID;

END;
ELSE
BEGIN

    RAISERROR(   N'Delete_%s_%d.',           -- Message text.
                 16,                         -- Severity,
                 10,                         -- State,
                 N'ReworkItem', -- First argument.
                 @ReworkItemID
             ); -- Second argument.)
END;

