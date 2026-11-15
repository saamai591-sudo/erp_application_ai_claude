
-------------------------------------
CREATE   PROCEDURE [AST].[SpSalvageUpdate] 
    @SalvageID int,
    @FinancialPeriodID int,
    @Number int,
    @Date date,
    @PrevoucherID int = NULL,
    @Version int,
    @LastEditor int,
    @LastEditionDate datetime,
	@BranchID int,
	@SalvageStatus tinyint
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

	if @Version <> (Select [Version] from [AST].[Salvage]
				where [SalvageID] = @SalvageID)
	begin
		RAISERROR('Version mismatch...', 16 , 10)
		return
	end

	set @Version = @Version +1 

	UPDATE [AST].[Salvage]
	SET     [Number] = @Number, 
			[Date] = @Date, 
			[Version] = @Version, 
			[LastEditor] = @LastEditor, 
			[LastEditionDate] = @LastEditionDate,
			[BranchID] = @BranchID,
			[SalvageStatus] = @SalvageStatus
	WHERE  [SalvageID] = @SalvageID
	
	-- Begin Return Select <- do not remove
	SELECT	[Version],
			[Number]
	FROM   [AST].[Salvage]
	WHERE  [SalvageID] = @SalvageID	
	-- End Return Select <- do not remove
