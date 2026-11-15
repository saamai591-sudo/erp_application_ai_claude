CREATE         PROC [PRM].[spSpoilageStatisticItemInsert]
    @SpoilageStatisticID INT,
    @StuffID INT,
    @MainQuantity DECIMAL(30, 4),
    @SubQuantity DECIMAL(30, 4) = NULL,
    @Description NVARCHAR(1000) = NULL,
    @Description2 NVARCHAR(1000) = NULL,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
AS
    SET NOCOUNT ON;

    INSERT INTO [PRM].[SpoilageStatisticItem]
    (
        [SpoilageStatisticID],
        [StuffID],
        [MainQuantity],
        [SubQuantity],
        [Description],
        [Description2],
        [Version],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate]
    )
    SELECT @SpoilageStatisticID,
           @StuffID,
           @MainQuantity,
           @SubQuantity,
           @Description,
           @Description2,
           0,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate
    -- Begin Return Select <- do not remove
    SELECT [SpoilageStatisticItemID],
           [Version]
    FROM [PRM].[SpoilageStatisticItem]
    WHERE [SpoilageStatisticItemID] = SCOPE_IDENTITY();
    -- End Return Select <- do not remove
