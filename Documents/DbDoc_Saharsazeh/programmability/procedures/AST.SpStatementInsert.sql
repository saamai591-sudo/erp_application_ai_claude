CREATE   PROC [AST].[SpStatementInsert] 
    @FinancialPeriodID int,
    @Number int,
    @Date date,
    @PartyID bigint,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime 
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

	DECLARE @Count int,
			@LatestNumber int			
	
	select @Count = COUNT(*) from AST.Statement c where c.FinancialPeriodID = @FinancialPeriodID
	if (@Count = 0)
	 set @Number = 1
    else 
    begin
        select @LatestNumber = MAX(c.Number) from AST.Statement c where c.FinancialPeriodID = @FinancialPeriodID
        set @Number = @LatestNumber + 1 
    end 
	
	INSERT INTO [AST].[Statement] ([FinancialPeriodID], [Number], [Date], [PartyID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @FinancialPeriodID, @Number, @Date, @PartyID, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [StatementID], [Version], [Number]
	FROM   [AST].[Statement]
	WHERE  [StatementID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
