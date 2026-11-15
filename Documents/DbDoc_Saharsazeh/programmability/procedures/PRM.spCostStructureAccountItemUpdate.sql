CREATE   PROC [PRM].[spCostStructureAccountItemUpdate]
    @CostStructureAccountItemID int,
    @CostStructureAccountID int,
    @RowIndex smallint,
    @SlID int,
    @Version int,
    @LastEditor int,
    @LastEditionDate datetime,
	@ApportionBaseType tinyint
AS 
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
	           from PRM.CostStructureAccountItem i
			   join PRM.CostStructureAccount a on i.CostStructureAccountID = a.CostStructureAccountID
			   join PRM.CostStructure c on a.CostStructureID = c.CostStructureID
			   join PRM.UsedSlsOnCostStructure s on c.CostStructureID = s.CostStructureID
	           where s.CostStructureID = @CostStructureID and s.SlID = @SlID and 
			         i.CostStructureAccountItemID <> @CostStructureAccountItemID)
	begin
		set @Message= 'SlUsedInOtherHeading^' + @SlTitle + cast(@CostStructureID as varchar(50))
		raiserror(@Message,16,12)
		return
	end

    IF @Version = (   SELECT [Version]
                      FROM   [PRM].[CostStructureAccountItem]
                      WHERE  [CostStructureAccountItemID] = @CostStructureAccountItemID )
        BEGIN
        SET @Version = @Version + 1;

		UPDATE [PRM].[CostStructureAccountItem]
		SET    [CostStructureAccountID] = @CostStructureAccountID, 
		       [RowIndex] = @RowIndex, 
			   [SlID] = @SlID, 
			   [Version] = @Version, 
			   [LastEditor] = @LastEditor, 
			   [LastEditionDate] = @LastEditionDate,
			   ApportionBaseType = @ApportionBaseType
		WHERE  [CostStructureAccountItemID] = @CostStructureAccountItemID 
	
		-- Begin Return Select <- do not remove
		SELECT   [Version] 
		FROM   [PRM].[CostStructureAccountItem]
		WHERE  [CostStructureAccountItemID] = @CostStructureAccountItemID 	
		-- End Return Select <- do not remove
	END
