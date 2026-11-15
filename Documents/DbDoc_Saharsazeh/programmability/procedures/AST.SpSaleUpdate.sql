
-------------------------------------
CREATE   PROCEDURE [AST].[SpSaleUpdate] 
    @SaleID int,
    @Number int,
    @Date date,
    @Type tinyint,
	@SaleStatus tinyint,
    @PartyID bigint,
    @Version int,
    @LastEditor int,
    @LastEditionDate datetime,
	@BranchID int
--WITH ENCRYPTION
AS 
SET NOCOUNT ON 

	declare @PreVersion int

	Select  @PreVersion = [Version]
	from [AST].[Sale]
	where [SaleID] = @SaleID

	if @Version <> @PreVersion
	begin
		RAISERROR('Version mismatch...', 16 , 10)
		return
	end	

	set @Version = @Version +1 

	UPDATE [AST].[Sale]
	SET     [Number] = @Number, 
			[Date] = @Date, 
			[Type] = @Type,
			[SaleStatus] = @SaleStatus,
			[PartyID] = @PartyID,
			[Version] = @Version, 
			[LastEditor] = @LastEditor, 
			[LastEditionDate] = @LastEditionDate,
			[BranchID] = @BranchID
	WHERE  [SaleID] = @SaleID
	
	-- Begin Return Select <- do not remove
	SELECT	[Version],
			[Number]
	FROM   [AST].[Sale]
	WHERE  [SaleID] = @SaleID	
	-- End Return Select <- do not remove
