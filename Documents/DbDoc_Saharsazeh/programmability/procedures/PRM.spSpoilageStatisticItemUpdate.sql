

CREATE         PROC [PRM].[spSpoilageStatisticItemUpdate]
    @SpoilageStatisticItemID INT,
    @SpoilageStatisticID INT,
    @StuffID INT,
    @MainQuantity DECIMAL(30, 4),
    @SubQuantity DECIMAL(30, 4) = NULL,
    @Description NVARCHAR(1000) = NULL,
    @Description2 NVARCHAR(1000) = NULL,
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
AS
SET NOCOUNT ON;

IF @Version =
(
    SELECT [Version]
    FROM [PRM].[SpoilageStatisticItem]
    WHERE [SpoilageStatisticItemID] = @SpoilageStatisticItemID
)
BEGIN

    SET @Version = @Version + 1;

    UPDATE [PRM].[SpoilageStatisticItem]
    SET [SpoilageStatisticID] = @SpoilageStatisticID,
        [StuffID] = @StuffID,
        [MainQuantity] = @MainQuantity,
        [SubQuantity] = @SubQuantity,
        [Description] = @Description,
        [Description2] = @Description2,
        [Version] = @Version,
        [Creator] = @Creator,
        [CreationDate] = @CreationDate,
        [LastEditor] = @LastEditor,
        [LastEditionDate] = @LastEditionDate
    WHERE [SpoilageStatisticItemID] = @SpoilageStatisticItemID;

    -- Begin Return Select <- do not remove
    SELECT [Version]
    FROM [PRM].[SpoilageStatisticItem]
    WHERE [SpoilageStatisticItemID] = @SpoilageStatisticItemID;
-- End Return Select <- do not remove

END;
