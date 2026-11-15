CREATE PROC [FOS].[spSpecialCostInsert] 
    @Code nvarchar(256),
    @Title nvarchar(256),
    @Title2 nvarchar(256),
    @SlID int,
	@ShareDividingBase tinyint,
	@CustomsCost bit,
	@ValueAddedTax bit,
	@ValueAddedDuty bit,
	@Active bit,
    @Creator int,
    @CreationDate datetime
AS 
BEGIN
SET NOCOUNT ON 
	
	INSERT INTO [FOS].[SpecialCost] ([Code], [Title], [Title2], [SlID], [ShareDividingBase],
	            [CustomsCost], [ValueAddedTax], [ValueAddedDuty], [Active],
	            [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Version])
	SELECT @Code, @Title, @Title2, @SlID, @ShareDividingBase,
	       @CustomsCost, @ValueAddedTax, @ValueAddedDuty, @Active,
	       @Creator, @CreationDate, @Creator, @CreationDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT [SpecialCostID], [Version]
	FROM   [FOS].[SpecialCost]
	WHERE  [SpecialCostID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
END
