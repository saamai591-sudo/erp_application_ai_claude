CREATE PROC [FOS].[spSpecialCostUpdate] 
    @SpecialCostID int,
    @Code nvarchar(256),
    @Title nvarchar(256),
    @Title2 nvarchar(256),
	@SlID int,
	@ShareDividingBase tinyint,
	@CustomsCost bit,
	@ValueAddedTax bit,
	@ValueAddedDuty bit,
	@Active bit,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int	
AS 
SET NOCOUNT ON 

	if @Version=(Select [Version] from [FOS].[SpecialCost]
	where [SpecialCostID] = @SpecialCostID)
	begin	

		set @Version = @Version +1 

		UPDATE [FOS].[SpecialCost]
		SET    [Code] = @Code, 
			   [Title] = @Title, 
			   [Title2] = @Title2, 
			   [SlID] = @SlID, 
			   [ShareDividingBase] = @ShareDividingBase,
			   [CustomsCost] = @CustomsCost,
			   [ValueAddedTax] = @ValueAddedTax,
			   [ValueAddedDuty] =@ValueAddedDuty,
			   [Active] = @Active,
			   [LastEditor] = @LastEditor, 
			   [LastEditionDate] = @LastEditionDate, 
			   [Version] = @Version				
		WHERE  [SpecialCostID] = @SpecialCostID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   [FOS].[SpecialCost]
		WHERE  [SpecialCostID] = @SpecialCostID	
		-- End Return Select <- do not remove

	end 
	ELSE 
		RAISERROR('Version mismatch...', 16 , 10)
