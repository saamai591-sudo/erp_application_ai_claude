CREATE   PROC [PRM].[spCostStructureAccountItemInsert]
    @CostStructureAccountID int,
    @RowIndex smallint,
    @SlID int,
    @Creator int,
    @CreationDate datetime,
	@ApportionBaseType tinyint
AS 
BEGIN
	SET NOCOUNT ON 

	declare @CostStructureID int,
	        @CostStructureTitle nvarchar(250),
			@SlTitle nvarchar(256),
			@Message nvarchar(256)

	select @CostStructureID = a.CostStructureID,
	       @CostStructureTitle = c.Title
	from PRM.CostStructureAccount a 
	join PRM.CostStructure c on a.CostStructureID = c.CostStructureID
	where a.CostStructureAccountID = @CostStructureAccountID

	select @SlTitle = Title from ACC.SL where SlID = @SlID

	if exists (select *
	           from PRM.UsedSlsOnCostStructure s
	           where s.CostStructureID = @CostStructureID and s.SlID = @SlID)
	begin
		set @Message= 'SlUsedInOtherHeading^' + @SlTitle + @CostStructureID
		raiserror(@Message,16,12)
		return
	end

	INSERT INTO [PRM].[CostStructureAccountItem] ([CostStructureAccountID], [RowIndex], [SlID],
				[Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate],[ApportionBaseType])
	SELECT @CostStructureAccountID, @RowIndex, @SlID, 0, @Creator, @CreationDate, @Creator, @CreationDate,@ApportionBaseType
	
	-- Begin Return Select <- do not remove
	SELECT [CostStructureAccountItemID], [Version]
	FROM   [PRM].[CostStructureAccountItem]
	WHERE  [CostStructureAccountItemID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
END
