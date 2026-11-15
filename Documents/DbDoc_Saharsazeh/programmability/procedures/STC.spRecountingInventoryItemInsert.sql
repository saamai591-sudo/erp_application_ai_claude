CREATE   PROC [STC].[spRecountingInventoryItemInsert]
    @RecountingInventoryID INT,
    @Type TINYINT,
    @MainQuantity DECIMAL(30, 4),
    @SubQuantity DECIMAL(30, 4),
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @RecountingInventoryTagItemID INT,
    @ZoneID INT =null
--WITH ENCRYPTION 
AS
BEGIN
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
		RETURN 0;
	END;


INSERT INTO [STC].[RecountingInventoryItem]
(
    [RecountingInventoryID],
    [Type],
    [MainQuantity],
    [SubQuantity],
    [Version],
    [Creator],
    [CreationDate],
    [LastEditor],
    [LastEditionDate],
    [RecountingInventoryTagItemID],
    [ZoneID]
)
SELECT @RecountingInventoryID,
       @Type,
       @MainQuantity,
       @SubQuantity,
       0,
       @Creator,
       @CreationDate,
       @LastEditor,
       @LastEditionDate,
       @RecountingInventoryTagItemID,
       @ZoneID;

	-- Begin Return Select <- do not remove
	SELECT [RecountingInventoryItemID],
		   [Version]
	FROM [STC].[RecountingInventoryItem]
	WHERE [RecountingInventoryItemID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove
END
