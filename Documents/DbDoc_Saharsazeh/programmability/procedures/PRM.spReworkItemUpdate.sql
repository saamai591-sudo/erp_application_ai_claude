CREATE      PROC [PRM].[spReworkItemUpdate]
    @ReworkItemID INT,
    @ReworkID INT,
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
    FROM [PRM].[ReworkItem]
    WHERE [ReworkItemID] = @ReworkItemID
)
BEGIN

    SET @Version = @Version + 1;

    UPDATE [PRM].[ReworkItem]
    SET [ReworkID] = @ReworkID,
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
    WHERE [ReworkItemID] = @ReworkItemID;

    -- Begin Return Select <- do not remove
    SELECT [Version]
    FROM [PRM].[ReworkItem]
    WHERE [ReworkItemID] = @ReworkItemID;
-- End Return Select <- do not remove

END;
