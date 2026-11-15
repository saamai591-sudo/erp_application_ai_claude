CREATE PROC [STC].[spInventoryMethodInsert] 
    @Title NVARCHAR(150),
    @Title2 NVARCHAR(150),
    @IsActive BIT,
    @CountingTurns TINYINT,
    @MinQuantity DECIMAL(18, 4),
    @SecondRecountableType TINYINT,
    @SecondRecountableConflict INT,
    @ThirdRecountableType TINYINT,
    @ThirdRecountableConflict INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Number INT
AS 
BEGIN
	SET NOCOUNT ON 

	SET @Number = ISNULL((	SELECT MAX(Number) + 1 FROM   [STC].[InventoryMethod]),1)	

	INSERT INTO [STC].[InventoryMethod] ([Title], [Title2], [IsActive], [CountingTurns], [MinQuantity], [SecondRecountableType], [SecondRecountableConflict], [ThirdRecountableType], [ThirdRecountableConflict], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Version], [Number])
	SELECT @Title, @Title2, @IsActive, @CountingTurns, @MinQuantity, @SecondRecountableType, @SecondRecountableConflict, @ThirdRecountableType, @ThirdRecountableConflict, @Creator, @CreationDate, @LastEditor, @LastEditionDate, 0, @Number
	
	-- Begin Return Select <- do not remove
	SELECT	[InventoryMethodID],
			[Version], 
			[Number]
	FROM   [STC].[InventoryMethod]
	WHERE  [InventoryMethodID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
END
