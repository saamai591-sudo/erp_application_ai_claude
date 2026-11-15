
-------------------------------------
CREATE   PROCEDURE [AST].[SpSalvageInsert] 
    @FinancialPeriodID int,
    @Number int,
    @Date date,
    @Creator int,
    @CreationDate datetime,
	@BranchID int,
	@SalvageStatus tinyint
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
	
	if (@Number is null or @Number = 0)
		set @Number =isnull((select MAX(Number) from AST.Salvage where FinancialPeriodID = @FinancialPeriodID),0) + 1

	INSERT INTO [AST].[Salvage] ([FinancialPeriodID], [Number], [Date], [PrevoucherID], [SalvageStatus], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [BranchID])
	SELECT @FinancialPeriodID, @Number, @Date, null,@SalvageStatus , 0, @Creator, @CreationDate, @Creator, @CreationDate, @BranchID
	
	-- Begin Return Select <- do not remove
	SELECT [SalvageID], [Version], [Number]
	FROM   [AST].[Salvage]
	WHERE  [SalvageID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
