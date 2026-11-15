CREATE PROC [STC].[spInventoryMethodUpdate] 
    @InventoryMethodID int,
    @Title nvarchar(150),
    @Title2 nvarchar(150),
    @IsActive bit,
    @CountingTurns tinyint,
    @MinQuantity decimal(18, 4),
    @SecondRecountableType tinyint,
    @SecondRecountableConflict int,
    @ThirdRecountableType tinyint,
    @ThirdRecountableConflict int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int,
    @Number int
AS 
	SET NOCOUNT ON 

	if @Version=(Select [Version] from [STC].[InventoryMethod]
	where [InventoryMethodID] = @InventoryMethodID)
	begin	

		set @Version = @Version +1 

		UPDATE [STC].[InventoryMethod]
		SET [Title] = @Title, 
			[Title2] = @Title2, 
			[IsActive] = @IsActive, 
			[CountingTurns] = @CountingTurns, 
			[MinQuantity] = @MinQuantity, 
			[SecondRecountableType] = @SecondRecountableType, 
			[SecondRecountableConflict] = @SecondRecountableConflict, 
			[ThirdRecountableType] = @ThirdRecountableType, 
			[ThirdRecountableConflict] = @ThirdRecountableConflict, 
			[Creator] = @Creator, 
			[CreationDate] = @CreationDate, 
			[LastEditor] = @LastEditor, 
			[LastEditionDate] = @LastEditionDate, 
			[Version] = @Version,
			[Number] = @Number
		WHERE  [InventoryMethodID] = @InventoryMethodID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version] ,
				[Number]
        FROM   [STC].[InventoryMethod]
		WHERE  [InventoryMethodID] = @InventoryMethodID	
		-- End Return Select <- do not remove
	end
