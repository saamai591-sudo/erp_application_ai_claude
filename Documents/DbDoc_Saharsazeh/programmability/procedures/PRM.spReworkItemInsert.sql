CREATE        PROC [PRM].[spReworkItemInsert]
    @ReworkID INT,
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

    INSERT INTO [PRM].[ReworkItem]
    (
        [ReworkID],
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
    SELECT @ReworkID,
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
    SELECT [ReworkItemID],
           [Version]
    FROM [PRM].[ReworkItem]
    WHERE [ReworkItemID] = SCOPE_IDENTITY();
    -- End Return Select <- do not remove
