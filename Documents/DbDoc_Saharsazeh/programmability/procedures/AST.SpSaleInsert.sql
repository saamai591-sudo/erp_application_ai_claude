
-------------------------------------
CREATE   PROCEDURE [AST].[SpSaleInsert] 
    @FinancialPeriodID int,
    @Number int,
    @Date date,
    @Type tinyint,
	@SaleStatus tinyint,
    @PartyID bigint,
    @Creator int,
    @CreationDate datetime,
	@BranchID int
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

    IF (@Number is null) or @Number = 0
    SET @Number = isnull((SELECT MAX(s.Number) FROM AST.Sale s WHERE s.FinancialPeriodID = @FinancialPeriodID),0) + 1 
	
	INSERT INTO [AST].[Sale] ([FinancialPeriodID], [Number], [Date], [Type],[SaleStatus], [PartyID], [PrevoucherID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [BranchID])
	SELECT @FinancialPeriodID, @Number, @Date, @Type,@SaleStatus, @PartyID, null, 0, @Creator, @CreationDate, @Creator, @CreationDate, @BranchID
	
	-- Begin Return Select <- do not remove
	SELECT [SaleID], [Version], [Number]
	FROM   [AST].[Sale]
	WHERE  [SaleID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
