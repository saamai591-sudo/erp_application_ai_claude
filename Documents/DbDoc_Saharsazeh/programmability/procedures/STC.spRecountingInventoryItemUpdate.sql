
CREATE   PROC [STC].[spRecountingInventoryItemUpdate]
    @RecountingInventoryItemID INT,
    @RecountingInventoryID INT,
    @Type TINYINT,
    @MainQuantity DECIMAL(30, 4),
    @SubQuantity DECIMAL(30, 4),
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @RecountingInventoryTagItemID INT,
    @ZoneID INT =null
--WITH ENCRYPTION 
AS
SET NOCOUNT ON;


IF @Version <>
(
    SELECT [Version]
    FROM [STC].[RecountingInventoryItem]
    WHERE [RecountingInventoryItemID] = @RecountingInventoryItemID
)
BEGIN
    RAISERROR('Version mismatch...', 16, 10);
    RETURN;
END;

IF
(
    SELECT MeasureSubUnitID
    FROM STC.RecountingInventoryTagItem t
        JOIN STF.StuffDetail s
            ON t.StuffID = s.StuffID
    WHERE RecountingInventoryTagItemID = @RecountingInventoryTagItemID
) IS NULL
    SET @SubQuantity = NULL;


IF EXISTS
(
    SELECT 1
    FROM STC.RecountingInventoryItem AS rii
    WHERE rii.RecountingInventoryTagItemID = @RecountingInventoryTagItemID
          AND rii.RecountingInventoryItemID <> @RecountingInventoryItemID
          AND rii.[Type] = @Type
)
BEGIN

    DECLARE @msg NVARCHAR(MAX),
            @tagNumber INT;

    SELECT @tagNumber = riti.TagNumber
    FROM STC.RecountingInventoryTagItem AS riti
    WHERE riti.RecountingInventoryTagItemID = @RecountingInventoryTagItemID;

    SET @msg = 'StockManager.DuplicatRecontingInventoryTag^' + CAST(@tagNumber AS NVARCHAR(100));
    RAISERROR(@msg, 16, 12);
    RETURN;
END;


UPDATE [STC].[RecountingInventoryItem]
SET [Type] = @Type,
    [MainQuantity] = @MainQuantity,
    [SubQuantity] = @SubQuantity,
    [Version] = @Version + 1,
    [LastEditor] = @LastEditor,
    [LastEditionDate] = @LastEditionDate,
    [RecountingInventoryTagItemID] = @RecountingInventoryTagItemID,
    [ZoneID]=@ZoneID
WHERE [RecountingInventoryItemID] = @RecountingInventoryItemID;

    -- Begin Return Select <- do not remove
    SELECT  [Version] 
    FROM [STC].[RecountingInventoryItem]
    WHERE [RecountingInventoryItemID] = @RecountingInventoryItemID;
    -- End Return Select <- do not remove
